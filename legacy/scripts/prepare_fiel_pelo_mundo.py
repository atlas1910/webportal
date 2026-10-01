"""Convert the user-provided Fiel Pelo Mundo KMZ into a compact GeoJSON."""

from __future__ import annotations

import argparse
import html
import json
import re
import shutil
import unicodedata
import zipfile
from pathlib import Path
from xml.etree import ElementTree

KML_NAMESPACE = "{http://www.opengis.net/kml/2.2}"
INSTAGRAM_URL = re.compile(
    r"https?://(?:www\.)?instagram\.com/[^\s\"'<>]+",
    re.IGNORECASE,
)
ICON_BY_PLACEMARK = {
    "Fiel Boston": "FIEL - BOSTON.png",
    "Fiel California (San Diego)": "FIEL - CALIFORNIA.png",
    "Fiel Florida": "FIEL-FLORIDA.png",
    "Fiel Texas": "FIEL TEXAS.png",
    "Fiel Kush - Toronto": "FIEL - KUSH.png",
    "Fiel Toronto": "FIEL-TORONTO.png",
    "Fiel Vancouver": "FIEL - VANCOUVER.png",
    "Fiel Kush - Vancouver": "FIEL - KUSH - PEQUENO -2.png",
    "Fiel Mar del Plata": "FIEL - MAR DEL PLATA.png",
    "Gaviões Subsede Japão": "GAVIOES - SUBSEDE JAPAO.png",
    "Fiel Algarve": "FIEL-ALGARVE.png",
    "Fiel Baixa Saxônia": "FIEL-BAIXA SAXÔNIA.png",
    "Fiel Alemanha": "FIEL - ALEMANHA.png",
    "Fiel Berlim": "fiel-berlim.png",
    "Fiel Barcelona": "FIEL - BARCELONA.png",
    "Fiel Braga": "FIEL - BRAGA.png",
    "Fiel Coimbra": "FIEL-COIMBRA.png",
    "Fiel Cork": "FIEL - CORK.png",
    "Fiel Drogheda": "FIEL - DROGHEDA.png",
    "Fiel Dublin": "FIEL - DUBLIN.png",
    "Fiel Malta": "FIEL - MALTA.png",
    "Fiel Madrid": "fiel-madrid.png",
    "Fiel Lisboa": "FIEL-LISBOA.png",
    "Fiel Londres": "FIEL LONDRES.png",
    "Fiel Munchen": "FIEL-MUNCHEN.png",
    "Fiel Paris": "FIEL-PARIS.png",
    "Fiel Porto": "FIEL - PORTO.png",
    "Fiel Valência": "FIEL - VALENCIA.png",
    "Fiel Brisbane": "FIEL-BRISBANE.png",
    "Fiel Melbourne": "FIEL - MELBOURNE.png",
    "Fiel Kush - Sydney": "FIEL - KUSH.png",
    "Fiel Sydney": "FIEL-SYDNEY.png",
    "Fiel Perth": "FIEL - PERTH.png",
    "Fiel Gold Coast": "FIEL - GOLD COAST.png",
}
ICON_OUTPUT_DIRECTORY = Path("assets/icones/torcidas")


def _icon_output_name(source_name: str) -> str:
    normalized = unicodedata.normalize("NFKD", Path(source_name).stem)
    ascii_name = normalized.encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-z0-9]+", "_", ascii_name.lower()).strip("_")
    return f"{slug}{Path(source_name).suffix.lower()}"


def _child_text(element: ElementTree.Element, name: str) -> str:
    child = element.find(f"{KML_NAMESPACE}{name}")
    return child.text.strip() if child is not None and child.text else ""


def _placemark_feature(
    placemark: ElementTree.Element, continent: str
) -> dict[str, object]:
    name = _child_text(placemark, "name")
    point = placemark.find(f".//{KML_NAMESPACE}Point")
    coordinates = point.find(f"{KML_NAMESPACE}coordinates") if point is not None else None
    if not name or coordinates is None or not coordinates.text:
        raise ValueError("Every placemark must have a name and Point coordinates.")

    coordinate = coordinates.text.strip().split()[0].split(",")
    if len(coordinate) < 2:
        raise ValueError(f"Invalid coordinates for placemark {name!r}.")
    longitude, latitude = float(coordinate[0]), float(coordinate[1])
    if not -180 <= longitude <= 180 or not -90 <= latitude <= 90:
        raise ValueError(f"Coordinates out of range for placemark {name!r}.")

    description = _child_text(placemark, "description")
    description = html.unescape(re.sub(r"<[^>]*>", " ", description))
    instagram_match = INSTAGRAM_URL.search(description)
    properties = {"nome": name, "continente": continent}
    icon_name = ICON_BY_PLACEMARK.get(name)
    if icon_name:
        properties["icone"] = (
            ICON_OUTPUT_DIRECTORY / _icon_output_name(icon_name)
        ).as_posix()
    if instagram_match:
        properties["instagram"] = instagram_match.group(0).rstrip(".,);")

    return {
        "type": "Feature",
        "properties": properties,
        "geometry": {
            "type": "Point",
            "coordinates": [longitude, latitude],
        },
    }


def convert_kmz(input_path: Path) -> dict[str, object]:
    with zipfile.ZipFile(input_path) as kmz:
        kml_names = [name for name in kmz.namelist() if name.lower().endswith(".kml")]
        if len(kml_names) != 1:
            raise ValueError(f"Expected one KML document in {input_path}, found {len(kml_names)}.")
        root = ElementTree.fromstring(kmz.read(kml_names[0]))

    features: list[dict[str, object]] = []

    def visit(element: ElementTree.Element, continent: str = "") -> None:
        if element.tag == f"{KML_NAMESPACE}Folder":
            continent = _child_text(element, "name") or continent
        if element.tag == f"{KML_NAMESPACE}Placemark":
            features.append(_placemark_feature(element, continent))
            return
        for child in element:
            visit(child, continent)

    visit(root)
    if not features:
        raise ValueError(f"No Point placemarks found in {input_path}.")

    return {
        "type": "FeatureCollection",
        "name": "Fiel Pelo Mundo",
        "features": features,
    }


def copy_icons(source_directory: Path, output_directory: Path) -> int:
    output_directory.mkdir(parents=True, exist_ok=True)
    copied = set()
    for source_name in ICON_BY_PLACEMARK.values():
        if source_name in copied:
            continue
        source_path = source_directory / source_name
        if not source_path.is_file():
            raise FileNotFoundError(f"Icon source file not found: {source_path}")
        destination_name = _icon_output_name(source_name)
        shutil.copyfile(source_path, output_directory / destination_name)
        copied.add(source_name)
    return len(copied)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("kmz", type=Path, help="Source KMZ file")
    parser.add_argument("geojson", type=Path, help="Output GeoJSON file")
    parser.add_argument(
        "--icons-dir",
        type=Path,
        help="Source directory containing the matching PNG icons",
    )
    args = parser.parse_args()
    collection = convert_kmz(args.kmz)
    if args.icons_dir:
        icon_count = copy_icons(args.icons_dir, ICON_OUTPUT_DIRECTORY)
        print(f"Copied {icon_count} icons to {ICON_OUTPUT_DIRECTORY}")
    args.geojson.parent.mkdir(parents=True, exist_ok=True)
    args.geojson.write_text(
        json.dumps(collection, ensure_ascii=False, separators=(",", ":")) + "\n",
        encoding="utf-8",
    )
    print(f"Converted {len(collection['features'])} placemarks to {args.geojson}")


if __name__ == "__main__":
    main()
