"""Build a web-ready layer from the global Who's On First country and dependency extracts."""

import csv
import json
import tarfile
import unicodedata
from pathlib import Path
from urllib.request import Request, urlopen

from shapely.geometry import Point, mapping, shape
from shapely.prepared import prep


ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "data/basemap/paises_limites_wof.geojson"
WOF_DATASET_URLS = (
    "https://data.geocode.earth/wof/dist/legacy/whosonfirst-data-country-latest.tar.bz2",
    "https://data.geocode.earth/wof/dist/legacy/whosonfirst-data-dependency-latest.tar.bz2",
)
ISO_CODES_URL = "https://raw.githubusercontent.com/datasets/country-codes/master/data/country-codes.csv"
SIMPLIFY_TOLERANCE = 0.008
COUNTRY_DATA_FILES = (
    "data/estadios/estadios_mundo.geojson",
    "data/estadios/estadios_mundo_internacionais.geojson",
    "data/estadios/estadios_estatisticas_unificadas.geojson",
    "data/as_brabas/as_brabas_estadios_unificadas.geojson",
    "data/as_brabas/as_brabas_estadios_mundo.geojson",
    "data/as_brabas/as_brabas_estadios_mandante.geojson",
    "data/as_brabas/as_brabas_jogos.geojson",
    "data/partidas/corinthians_masculino.geojson",
    "data/partidas/corinthians_feminino_meutimao.geojson",
)
COUNTRY_NAME_ALIASES = {
    "ALEMANHA": "DEU", "ARGENTINA": "ARG", "BELGICA": "BEL", "BOLIVIA": "BOL",
    "BOSNIAEHERZEGOVINA": "BIH", "BRASIL": "BRA", "CANADA": "CAN", "CHILE": "CHL",
    "CHINA": "CHN", "CURACAO": "CUW", "COLOMBIA": "COL", "DINAMARCA": "DNK",
    "EQUADOR": "ECU", "ESPANHA": "ESP", "HONGKONG": "HKG", "ESTADOSUNIDOS": "USA",
    "ESTADOSUNIDOSDAAMERICA": "USA", "EUA": "USA", "FINLANDIA": "FIN", "FRANCA": "FRA",
    "HOLANDA": "NLD", "PAISESBAIXOS": "NLD", "RUSSIA": "RUS", "GUATEMALA": "GTM",
    "INGLATERRA": "GBR", "REINOUNIDO": "GBR", "ITALIA": "ITA", "INDONESIA": "IDN",
    "JAMAICA": "JAM", "JAPAO": "JPN", "MARROCOS": "MAR", "MEXICO": "MEX",
    "PANAMA": "PAN", "PARAGUAI": "PRY", "PERU": "PER", "PORTUGAL": "PRT",
    "GRECIA": "GRC", "SERVIA": "SRB", "SUECIA": "SWE", "SUICA": "CHE",
    "TAIWAN": "TWN", "TAILANDIA": "THA", "TRINIDADETOBAGO": "TTO", "TURQUIA": "TUR",
    "URUGUAI": "URY", "VENEZUELA": "VEN", "MACAU": "MAC", "MACAUSAR": "MAC",
    "PALESTINA": "PSE", "ELSALVADOR": "SLV", "NICARAGUA": "NIC",
}


def open_url(url: str):
    request = Request(url, headers={"User-Agent": "ATLAS1910 WOF basemap builder"})
    return urlopen(request, timeout=180)


def load_iso3_codes():
    with open_url(ISO_CODES_URL) as response:
        rows = csv.DictReader(line.decode("utf-8") for line in response)
        return {
            row["ISO3166-1-Alpha-2"].upper(): row["ISO3166-1-Alpha-3"].upper()
            for row in rows
            if row.get("ISO3166-1-Alpha-2") and row.get("ISO3166-1-Alpha-3")
        }


def normalize_country_name(value):
    return "".join(
        character
        for character in unicodedata.normalize("NFD", str(value or "").upper())
        if character.isalnum()
    )


def prepare_country_boundaries(raw_boundaries):
    return [
        (code, name, geometry.area, prep(geometry), geometry)
        for code, name, geometry in raw_boundaries
    ]


def resolve_country(longitude, latitude, boundaries):
    point = Point(longitude, latitude)
    matches = [boundary for boundary in boundaries if boundary[3].covers(point)]
    if not matches:
        nearest = min(boundaries, key=lambda boundary: boundary[4].distance(point))
        if nearest[4].distance(point) <= 0.01:
            matches = [nearest]
    if not matches:
        return None
    code, name, _, _, _ = min(matches, key=lambda boundary: boundary[2])
    return code, name


def correct_country_properties(properties, coordinates, boundaries, name_codes):
    if not coordinates or len(coordinates) < 2:
        return False

    resolved = resolve_country(coordinates[0], coordinates[1], boundaries)
    if not resolved:
        return False

    country_code, country_name = resolved
    current_name = (
        properties.get("PAIS_ISO3")
        or properties.get("PAIS_FONTE")
        or properties.get("PAIS")
        or properties.get("PAÍS")
    )
    normalized_name = normalize_country_name(current_name)
    current_code = (
        str(properties.get("PAIS_ISO3") or "").upper()
        or COUNTRY_NAME_ALIASES.get(normalized_name)
        or name_codes.get(normalized_name)
    )
    changed = current_code != country_code
    properties["PAIS_ISO3"] = country_code

    if changed:
        country_keys = [key for key in ("PAIS_FONTE", "PAIS", "PAÍS") if key in properties]
        if not country_keys:
            country_keys = ["PAIS_FONTE"]
        for key in country_keys:
            properties[key] = country_name
        properties["FONTE_CORRECAO_PAIS"] = WOF_DATASET_URLS[0]

    return changed


def get_feature_coordinates(feature):
    properties = feature.get("properties") or feature
    geometry = feature.get("geometry")
    if isinstance(geometry, dict):
        if geometry.get("type") != "Point" or not geometry.get("coordinates"):
            return None
        return geometry["coordinates"][:2]
    if geometry is not None and hasattr(geometry, "x") and hasattr(geometry, "y"):
        return geometry.x, geometry.y
    longitude = properties.get("LONGITUDE")
    latitude = properties.get("LATITUDE")
    if longitude is None or latitude is None:
        return None
    return longitude, latitude


def correct_country_records(records, raw_boundaries, name_codes):
    boundaries = prepare_country_boundaries(raw_boundaries)
    corrected = 0
    assigned = 0
    for record in records:
        properties = record.get("properties") or record
        coordinates = get_feature_coordinates(record)
        if not coordinates:
            continue
        previous_code = properties.get("PAIS_ISO3")
        changed = correct_country_properties(properties, coordinates, boundaries, name_codes)
        if properties.get("PAIS_ISO3"):
            assigned += 1
        if changed:
            corrected += 1
        elif previous_code and previous_code != properties.get("PAIS_ISO3"):
            corrected += 1
    return assigned, corrected


def load_local_country_boundaries():
    collection = json.loads(OUTPUT.read_text(encoding="utf-8"))
    boundaries = []
    name_codes = {}
    for feature in collection.get("features", []):
        properties = feature.get("properties") or {}
        code = str(properties.get("ADM0_A3") or "").upper()
        if not code or not feature.get("geometry"):
            continue
        name = properties.get("ADMIN") or code
        geometry = shape(feature["geometry"])
        boundaries.append((code, name, geometry))
        for value in (name, properties.get("NAME"), properties.get("NAME_EN"), properties.get("ISO_A2"), code):
            normalized = normalize_country_name(value)
            if normalized:
                name_codes[normalized] = code
    return boundaries, name_codes


def correct_country_files(raw_boundaries, name_codes):
    for relative_path in COUNTRY_DATA_FILES:
        path = ROOT / relative_path
        if not path.exists():
            continue
        collection = json.loads(path.read_text(encoding="utf-8"))
        assigned, corrected = correct_country_records(
            collection.get("features", []),
            raw_boundaries,
            name_codes,
        )
        path.write_text(
            json.dumps(collection, ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8",
        )
        print(f"Reconciled {path.name}: {assigned} locations, {corrected} country corrections")


def correct_country_files_from_local_boundaries():
    boundaries, name_codes = load_local_country_boundaries()
    correct_country_files(boundaries, name_codes)


def main():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    iso3_by_iso2 = load_iso3_codes()
    country_features = {}
    raw_boundaries = []
    name_codes = {}

    for dataset_url in WOF_DATASET_URLS:
        with open_url(dataset_url) as response:
            with tarfile.open(fileobj=response, mode="r|bz2") as archive:
                for member in archive:
                    if not member.isfile() or not member.name.endswith(".geojson") or "-alt-" in member.name:
                        continue

                    source = archive.extractfile(member)
                    if source is None:
                        continue
                    feature = json.load(source)
                    properties = feature.get("properties") or {}
                    geometry = feature.get("geometry")
                    placetype = properties.get("wof:placetype")
                    if (
                        placetype not in {"country", "dependency"}
                        or properties.get("mz:is_current", 1) == 0
                        or not geometry
                    ):
                        continue

                    iso2 = str(properties.get("iso:country") or "").upper()
                    iso3 = iso3_by_iso2.get(iso2)
                    if not iso3:
                        continue

                    feature_id = properties.get("wof:id") or feature.get("id")
                    name = properties.get("wof:name") or iso3
                    source_geometry = shape(geometry)
                    raw_boundaries.append((iso3, name, source_geometry))
                    for value in (
                        name,
                        properties.get("wof:shortcode"),
                        properties.get("iso:country"),
                        iso2,
                        iso3,
                    ):
                        normalized = normalize_country_name(value)
                        if normalized:
                            name_codes[normalized] = iso3
                    if iso3 in country_features:
                        continue

                    simplified = source_geometry.simplify(
                        SIMPLIFY_TOLERANCE,
                        preserve_topology=True,
                    )
                    country_features[iso3] = {
                        "type": "Feature",
                        "properties": {
                            "ADMIN": name,
                            "ADM0_A3": iso3,
                            "NAME": name,
                            "NAME_EN": name,
                            "ISO_A2": iso2,
                            "WOF_ID": feature_id,
                            "WOF_PLACETYPE": placetype,
                        },
                        "geometry": mapping(simplified),
                    }

    features = list(country_features.values())
    if len(features) < 200:
        raise RuntimeError(f"Cobertura WOF incompleta: apenas {len(features)} países encontrados.")

    collection = {
        "type": "FeatureCollection",
        "name": "Who's On First country and dependency polygons",
        "source": list(WOF_DATASET_URLS),
        "license": "https://whosonfirst.org/docs/licenses/",
        "features": features,
    }
    OUTPUT.write_text(
        json.dumps(collection, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )

    print(
        f"Wrote {OUTPUT.name}: {len(features)} unique WOF boundaries, {OUTPUT.stat().st_size:,} bytes"
    )
    correct_country_files(raw_boundaries, name_codes)


if __name__ == "__main__":
    main()