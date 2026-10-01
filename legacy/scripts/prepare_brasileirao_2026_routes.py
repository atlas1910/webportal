"""Convert fan travel routes and prepare pending away-trip route candidates."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import geopandas as gpd
import requests
from pyproj import Geod, Transformer
from shapely.geometry import LineString, Point, mapping
from shapely.ops import transform


ROOT = Path(__file__).resolve().parent.parent
SOURCE_DIR = Path(
    r"D:\0-ATLAS DO POVO\1-FEED\0-CARAVANAS PELO BRASIL"
    r"\BRASILEIRO 2026\BASE GIS"
)
OUTPUT_DIR = ROOT / "data" / "deslocamentos" / "brasileirao-2026"
ORIGIN = (-46.56809, -23.53096)
SIMPLIFY_TOLERANCE_METERS = 5
OSRM_URL = "https://router.project-osrm.org/route/v1/driving"
OSRM_USER_AGENT = "ATLAS1910 geoportal route preparation"
GEOD = Geod(ellps="WGS84")

SOURCE_ROUTES = (
    {
        "route_id": "arena-conda",
        "source_file": "ROTA - ARENA CONDA.shp",
        "venue": "Arena Condá",
        "city": "Chapecó",
        "state": "SC",
        "club": "Chapecoense",
        "match_status": "concluida",
    },
    {
        "route_id": "arena-da-baixada",
        "source_file": "ROTA - ARENA DA BAIXADA.shp",
        "venue": "Arena da Baixada",
        "city": "Curitiba",
        "state": "PR",
        "club": "Athletico Paranaense",
        "match_status": "concluida",
    },
    {
        "route_id": "arena-fonte-nova",
        "source_file": "ROTA - ARENA FONTE NOVA.shp",
        "venue": "Arena Fonte Nova",
        "city": "Salvador",
        "state": "BA",
        "club": "Bahia",
        "match_status": "concluida",
    },
    {
        "route_id": "arena-mrv",
        "source_file": "ROTA - ARENA MRV.shp",
        "venue": "Arena MRV",
        "city": "Belo Horizonte",
        "state": "MG",
        "club": "Atlético-MG",
        "match_status": "projecao",
    },
    {
        "route_id": "barradao",
        "source_file": "ROTA - BARRADAO.shp",
        "venue": "Barradão",
        "city": "Salvador",
        "state": "BA",
        "club": "Vitória",
        "match_status": "concluida",
    },
    {
        "route_id": "beira-rio",
        "source_file": "ROTA - BEIRA RIO.shp",
        "venue": "Estádio Beira-Rio",
        "city": "Porto Alegre",
        "state": "RS",
        "club": "Internacional",
        "match_status": "projecao",
    },
    {
        "route_id": "braganca-paulista",
        "source_file": "ROTA - BRAGANÇA PAULISTA.shp",
        "venue": "Estádio Municipal Cícero de Souza Marques",
        "city": "Bragança Paulista",
        "state": "SP",
        "club": "Red Bull Bragantino",
        "match_status": "concluida",
    },
    {
        "route_id": "couto-pereira",
        "source_file": "ROTA - COUTO PEREIRA.shp",
        "venue": "Estádio Major Antônio Couto Pereira",
        "city": "Curitiba",
        "state": "PR",
        "club": "Coritiba",
        "match_status": "concluida",
    },
    {
        "route_id": "engenhao",
        "source_file": "ROTA - ENGENHAO.shp",
        "venue": "Estádio Nilton Santos (Engenhão)",
        "city": "Rio de Janeiro",
        "state": "RJ",
        "club": "Botafogo",
        "match_status": "concluida",
    },
    {
        "route_id": "mangueirao",
        "source_file": "ROTA - MANGUEIRAO.shp",
        "venue": "Mangueirão",
        "city": "Belém",
        "state": "PA",
        "club": "Remo",
        "match_status": "projecao",
    },
    {
        "route_id": "vila-belmiro",
        "source_file": "ROTA - VILA BELMIRO.shp",
        "venue": "Vila Belmiro",
        "city": "Santos",
        "state": "SP",
        "club": "Santos",
        "match_status": "concluida",
    },
    {
        "route_id": "mirassol",
        "source_file": "ROTA MIRASSOL.shp",
        "venue": "Estádio José Maria de Campos Maia",
        "city": "Mirassol",
        "state": "SP",
        "club": "Mirassol",
        "match_status": "concluida",
    },
)

PENDING_ROUTE_CANDIDATES = (
    {
        "route_id": "allianz-parque",
        "venue": "Allianz Parque",
        "city": "São Paulo",
        "state": "SP",
        "club": "Palmeiras",
        "coordinates": (-46.6788, -23.5275),
    },
    {
        "route_id": "sao-januario",
        "venue": "São Januário",
        "city": "Rio de Janeiro",
        "state": "RJ",
        "club": "Vasco da Gama",
        "coordinates": (-43.2280427, -22.8911648),
    },
    {
        "route_id": "morumbis",
        "venue": "MorumBIS",
        "city": "São Paulo",
        "state": "SP",
        "club": "São Paulo",
        "coordinates": (-46.7200902, -23.6000888),
    },
)

PROJECTED_SOURCE_ROUTE_IDS = {"arena-mrv", "beira-rio", "mangueirao"}
PENDING_AWAY_CLUBS = (
    "Atlético-MG",
    "Internacional",
    "Remo",
    "Palmeiras",
    "Vasco da Gama",
    "São Paulo",
)
FIXTURE_SOURCE_URL = (
    "https://site.api.espn.com/apis/site/v2/sports/soccer/"
    "bra.1/teams/874/schedule?season=2026&region=br&lang=pt"
)


def round_coordinates(geometry: LineString) -> LineString:
    return LineString(
        [(round(coordinate[0], 6), round(coordinate[1], 6)) for coordinate in geometry.coords]
    )


def simplify_line(geometry: LineString) -> LineString:
    local_crs = (
        f"+proj=aeqd +lat_0={ORIGIN[1]} +lon_0={ORIGIN[0]} "
        "+datum=WGS84 +units=m +no_defs"
    )
    to_local = Transformer.from_crs("EPSG:4326", local_crs, always_xy=True).transform
    to_wgs84 = Transformer.from_crs(local_crs, "EPSG:4326", always_xy=True).transform
    projected = transform(to_local, geometry)
    simplified = projected.simplify(SIMPLIFY_TOLERANCE_METERS, preserve_topology=True)
    simplified_wgs84 = transform(to_wgs84, simplified)
    if not isinstance(simplified_wgs84, LineString):
        raise TypeError("A simplificação de uma rota deixou de produzir uma LineString.")
    return round_coordinates(simplified_wgs84)


def distance_km(geometry: LineString) -> float:
    coordinates = list(geometry.coords)
    return GEOD.line_length(
        [coordinate[0] for coordinate in coordinates],
        [coordinate[1] for coordinate in coordinates],
    ) / 1000


def route_feature_collection(
    route: dict[str, Any],
    geometry: LineString,
    route_source: str,
    route_method: str,
    distance: float,
    duration_seconds: float | None = None,
    source_name: str | None = None,
    origin_adjustment_m: float = 0,
) -> dict[str, Any]:
    projected = route["match_status"] == "projecao"
    status_label = (
        "Adversário, data e estádio sujeitos à confirmação oficial."
        if projected
        else "Traçado fornecido para deslocamento do Brasileirão 2026."
    )
    line_properties = {
        "route_id": route["route_id"],
        "tipo": "rota",
        "clube": route["club"],
        "estadio": route["venue"],
        "cidade": route["city"],
        "estado": route["state"],
        "distancia_km": round(distance, 1),
        "modo_rota": "carro",
        "match_status": route["match_status"],
        "status": status_label,
        "projecao": projected,
        "fonte_rota": route_source,
        "metodo_rota": route_method,
        "data_partida": None,
        "Name": source_name or f"Parque São Jorge → {route['venue']}, {route['city']} - {route['state']}",
        "ajuste_origem_m": round(origin_adjustment_m, 1),
    }
    if duration_seconds is not None:
        line_properties["duracao_estimativa_min"] = round(duration_seconds / 60)

    end_coordinate = list(geometry.coords[-1][:2])
    endpoint_properties = {
        "route_id": route["route_id"],
        "tipo": "estadio_destino",
        "clube": route["club"],
        "estadio": route["venue"],
        "cidade": route["city"],
        "estado": route["state"],
        "distancia_km": round(distance, 1),
        "status": status_label,
        "projecao": projected,
        "data_partida": None,
    }
    return {
        "type": "FeatureCollection",
        "name": route["route_id"],
        "features": [
            {
                "type": "Feature",
                "geometry": mapping(geometry),
                "properties": line_properties,
            },
            {
                "type": "Feature",
                "geometry": mapping(Point(end_coordinate)),
                "properties": endpoint_properties,
            },
        ],
    }


def write_geojson(output_path: Path, collection: dict[str, Any]) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(collection, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )


def prepare_source_route(source_dir: Path, route: dict[str, Any], output_dir: Path) -> None:
    source_path = source_dir / route["source_file"]
    if not source_path.is_file():
        raise FileNotFoundError(f"Shapefile de rota não encontrado: {source_path}")
    source = gpd.read_file(source_path, encoding="utf-8")
    if source.empty or source.geometry.iloc[0] is None:
        raise ValueError(f"Shapefile de rota sem geometria: {source_path}")
    geometry = source.geometry.iloc[0]
    if geometry.geom_type != "LineString":
        raise ValueError(f"Esperada LineString em {source_path}, recebido {geometry.geom_type}")
    if source.crs is None:
        raise ValueError(f"CRS não definido para {source_path}")
    geometry = gpd.GeoSeries([geometry], crs=source.crs).to_crs("EPSG:4326").iloc[0]
    coordinates = [(coordinate[0], coordinate[1]) for coordinate in geometry.coords]
    geometry = LineString(coordinates)
    original_name = str(source.iloc[0].get("Name") or "")
    origin_adjustment_m = 0.0
    first_coordinate = geometry.coords[0]
    origin_adjustment_m = GEOD.inv(
        first_coordinate[0], first_coordinate[1], ORIGIN[0], ORIGIN[1]
    )[2]
    if origin_adjustment_m > 50:
        if origin_adjustment_m > 1000:
            raise ValueError(
                f"Origem de {source_path.name} está a {origin_adjustment_m:.0f} m "
                "do Parque São Jorge; revise antes de ajustar."
            )
        geometry = LineString([ORIGIN, *list(geometry.coords)[1:]])

    distance = distance_km(geometry)
    simplified = simplify_line(geometry)
    route["match_status"] = (
        "projecao" if route["route_id"] in PROJECTED_SOURCE_ROUTE_IDS else "concluida"
    )
    collection = route_feature_collection(
        route,
        simplified,
        source_path.name,
        "Traçado viário existente convertido do shapefile do usuário.",
        distance,
        source_name=original_name,
        origin_adjustment_m=origin_adjustment_m,
    )
    write_geojson(output_dir / f"{route['route_id']}.geojson", collection)


def prepare_candidate_route(
    route: dict[str, Any], output_dir: Path, session: requests.Session
) -> None:
    coordinates = f"{ORIGIN[0]},{ORIGIN[1]};{route['coordinates'][0]},{route['coordinates'][1]}"
    response = session.get(
        f"{OSRM_URL}/{coordinates}",
        params={
            "overview": "full",
            "geometries": "geojson",
            "steps": "false",
            "alternatives": "false",
        },
        timeout=45,
    )
    response.raise_for_status()
    payload = response.json()
    if payload.get("code") != "Ok" or not payload.get("routes"):
        raise RuntimeError(
            f"Roteador OSRM não encontrou rota para {route['venue']}: {payload.get('code')}"
        )
    best_route = payload["routes"][0]
    geometry_data = best_route["geometry"]
    if geometry_data.get("type") != "LineString":
        raise ValueError(f"OSRM retornou geometria inesperada para {route['venue']}")
    coordinates = [tuple(coordinate[:2]) for coordinate in geometry_data["coordinates"]]
    first_coordinate = coordinates[0]
    origin_adjustment_m = GEOD.inv(
        first_coordinate[0], first_coordinate[1], ORIGIN[0], ORIGIN[1]
    )[2]
    if origin_adjustment_m > 1000:
        raise ValueError(
            f"A rota OSRM para {route['venue']} começa a {origin_adjustment_m:.0f} m "
            "do Parque São Jorge; revise a origem antes de ajustar."
        )
    coordinates[0] = ORIGIN
    geometry = LineString(coordinates)
    simplified = simplify_line(geometry)
    route["match_status"] = "projecao"
    collection = route_feature_collection(
        route,
        simplified,
        "OpenStreetMap via OSRM public driving router",
        "Rota rodoviária por carro; sem perfil específico para ônibus ou tráfego em tempo real.",
        float(best_route["distance"]) / 1000,
        duration_seconds=float(best_route["duration"]),
        origin_adjustment_m=origin_adjustment_m,
    )
    collection["metadata"] = {
        "fixture_source": FIXTURE_SOURCE_URL,
        "fixture_status": "Projeção; a agenda consultada não contém os jogos futuros restantes.",
        "route_service": "https://project-osrm.org/",
        "openstreetmap_copyright": "© OpenStreetMap contributors",
        "coordinates_accuracy": "Estádio habitual do mandante; sujeito a confirmação oficial.",
    }
    write_geojson(output_dir / f"{route['route_id']}.geojson", collection)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-dir", type=Path, default=SOURCE_DIR)
    parser.add_argument("--output-dir", type=Path, default=OUTPUT_DIR)
    args = parser.parse_args()

    for route in SOURCE_ROUTES:
        prepare_source_route(args.source_dir, route.copy(), args.output_dir)

    session = requests.Session()
    session.headers["User-Agent"] = OSRM_USER_AGENT
    for route in PENDING_ROUTE_CANDIDATES:
        prepare_candidate_route(route.copy(), args.output_dir, session)


if __name__ == "__main__":
    main()
