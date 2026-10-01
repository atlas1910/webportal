#!/usr/bin/env python3
"""Export the 2026 Libertadores group venues from GeoPackage to GeoJSON."""

from __future__ import annotations

import argparse
import csv
import json
import math
import sqlite3
import struct
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
ICON_BY_TEAM = {
    "Corinthians": "assets/icones/escudos-historicos/2012.png",
    "Colo-Colo": "assets/icones/competicoes/libertadores-2026/colo-colo.png",
    "Caracas FC": "assets/icones/competicoes/libertadores-2026/caracas-fc.png",
    "Santa Fé": "assets/icones/competicoes/libertadores-2026/santa-fe.png",
    "Independiente del Valle": "assets/icones/competicoes/libertadores-2026/independiente-del-valle.png",
    "Belgrano": "assets/icones/competicoes/libertadores-2026/belgrano.svg",
    "Universitario": "assets/icones/competicoes/libertadores-2026/universitario.svg",
    "Palmeiras": "assets/icones/competicoes/libertadores-2026/palmeiras.png",
    "Cruzeiro": "assets/icones/competicoes/libertadores-2026/cruzeiro.png",
    "LDU Quito": "assets/icones/competicoes/libertadores-2026/ldu-quito.png",
    "Bolívar": "assets/icones/competicoes/libertadores-2026/bolivar.png",
    "Olimpia": "assets/icones/competicoes/libertadores-2026/olimpia.png",
    "Deportivo Cali": "assets/icones/competicoes/libertadores-2026/deportivo-cali.png",
    "Libertad": "assets/icones/competicoes/libertadores-2026/libertad.png",
    "Nacional": "assets/icones/competicoes/libertadores-2026/nacional.png",
    "Universidad de Chile": "assets/icones/competicoes/libertadores-2026/universidad-de-chile.png",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("geopackage", type=Path, help="GeoPackage with the four group layers")
    parser.add_argument("teams_csv", type=Path, help="UTF-8 CSV with team names and attributes")
    parser.add_argument(
        "--output",
        type=Path,
        default=ROOT / "data" / "competicoes" / "libertadores-2026.geojson",
        help="Output GeoJSON path",
    )
    return parser.parse_args()


def read_point(blob: bytes) -> tuple[float, float]:
    if blob[:2] != b"GP" or len(blob) < 29:
        raise ValueError("Invalid or unsupported GeoPackage geometry header")

    flags = blob[3]
    envelope_code = (flags >> 1) & 0b111
    envelope_bytes = {0: 0, 1: 32, 2: 48, 3: 48, 4: 64}.get(envelope_code)
    if envelope_bytes is None:
        raise ValueError(f"Unsupported GeoPackage envelope code: {envelope_code}")

    srs_id = struct.unpack("<i" if flags & 1 else ">i", blob[4:8])[0]
    if srs_id != 4326:
        raise ValueError(f"Expected EPSG:4326, found SRS {srs_id}")

    wkb_offset = 8 + envelope_bytes
    byte_order = blob[wkb_offset]
    endian = "<" if byte_order == 1 else ">"
    geometry_type = struct.unpack(endian + "I", blob[wkb_offset + 1:wkb_offset + 5])[0]
    if geometry_type != 1:
        raise ValueError(f"Expected Point geometry, found WKB type {geometry_type}")

    longitude, latitude = struct.unpack(endian + "dd", blob[wkb_offset + 5:wkb_offset + 21])
    return longitude, latitude


def load_csv_rows(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8-sig", newline="") as csv_file:
        rows = list(csv.DictReader(csv_file))
    if len(rows) != 16:
        raise ValueError(f"Expected 16 teams in CSV, found {len(rows)}")
    return rows


def build_features(geopackage: Path, teams_csv: Path) -> list[dict[str, Any]]:
    csv_rows = load_csv_rows(teams_csv)
    rows_by_coordinate: dict[tuple[float, float], dict[str, str]] = {}
    for row in csv_rows:
        key = (float(row["long"]), float(row["lat"]))
        if key in rows_by_coordinate:
            raise ValueError(f"Duplicate CSV coordinate: {key}")
        rows_by_coordinate[key] = row

    connection = sqlite3.connect(geopackage)
    try:
        contents = connection.execute(
            "SELECT table_name, srs_id FROM gpkg_contents "
            "WHERE data_type = 'features' ORDER BY table_name"
        ).fetchall()
        if len(contents) != 4 or any(srs_id != 4326 for _, srs_id in contents):
            raise ValueError("Expected four feature tables, all in EPSG:4326")

        features: list[dict[str, Any]] = []
        used_coordinates: set[tuple[float, float]] = set()
        for table_name, _ in contents:
            quoted_table = '"' + table_name.replace('"', '""') + '"'
            for geometry, group, latitude, longitude in connection.execute(
                f"SELECT geom, \"Grupo\", lat, long FROM {quoted_table} ORDER BY fid"
            ):
                longitude_from_geometry, latitude_from_geometry = read_point(geometry)
                key = (longitude_from_geometry, latitude_from_geometry)
                csv_row = rows_by_coordinate.get(key)
                if csv_row is None:
                    raise ValueError(f"GeoPackage coordinates do not match CSV: {key}")
                if key in used_coordinates:
                    raise ValueError(f"Duplicate GeoPackage coordinate: {key}")
                if csv_row["Grupo"] != group:
                    raise ValueError(f"Group mismatch for {csv_row['Time']}")
                if not (
                    math.isclose(float(longitude), longitude_from_geometry, abs_tol=1e-8)
                    and math.isclose(float(latitude), latitude_from_geometry, abs_tol=1e-8)
                ):
                    raise ValueError(f"Attribute coordinates differ from geometry: {csv_row['Time']}")

                team = csv_row["Time"]
                icon_path = ICON_BY_TEAM.get(team)
                if icon_path is None:
                    raise ValueError(f"No icon mapping exists for {team}")
                if not (ROOT / icon_path).is_file():
                    raise FileNotFoundError(f"Missing team crest: {ROOT / icon_path}")

                features.append(
                    {
                        "type": "Feature",
                        "geometry": {
                            "type": "Point",
                            "coordinates": [longitude_from_geometry, latitude_from_geometry],
                        },
                        "properties": {
                            "Grupo": csv_row["Grupo"],
                            "Time": team,
                            "Estádio": csv_row["Estádio"],
                            "Cidade": csv_row["Cidade"],
                            "País": csv_row["País"],
                            "Participações": int(csv_row["Participações"]),
                            "Títulos": int(csv_row["Títulos"]),
                            "ESCUDO": icon_path,
                        },
                    }
                )
                used_coordinates.add(key)
    finally:
        connection.close()

    if len(features) != 16 or len(used_coordinates) != len(csv_rows):
        raise ValueError(f"Expected 16 matched locations, found {len(features)}")
    return features


def main() -> None:
    args = parse_args()
    features = build_features(args.geopackage, args.teams_csv)
    output = {
        "type": "FeatureCollection",
        "name": "libertadores_feminina_2026",
        "features": features,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(output, ensure_ascii=False, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )
    print(f"Exported {len(features)} locations to {args.output}")


if __name__ == "__main__":
    main()
