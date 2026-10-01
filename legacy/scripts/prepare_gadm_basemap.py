"""Build a compact GADM 4.1 overlay for countries in the stadium archive."""

from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path
from urllib.request import Request, urlopen

from shapely import simplify
from shapely.geometry import mapping, shape
from shapely.ops import unary_union


ROOT = Path(__file__).resolve().parent.parent
COUNTRY_SOURCE = ROOT / "data/estadios/paises_limites_50m.geojson"
OUTPUT = ROOT / "data/estadios/gadm_base.geojson"
GADM_JSON_URL = "https://geodata.ucdavis.edu/gadm/gadm4.1/json/gadm41_{code}_{level}.json"
COUNTRY_TOLERANCE = 0.005
STATE_TOLERANCE = 0.002


def load_gadm(code, level):
    request = Request(
        GADM_JSON_URL.format(code=code, level=level),
        headers={"User-Agent": "ATLAS1910 GADM basemap builder"},
    )
    with urlopen(request, timeout=60) as response:
        return json.load(response)


def main():
    source = json.loads(COUNTRY_SOURCE.read_text(encoding="utf-8"))
    country_codes = sorted({
        feature["properties"]["ADM0_A3"]
        for feature in source["features"]
        if feature.get("properties", {}).get("ADM0_A3") not in (None, "-99")
    })

    with ThreadPoolExecutor(max_workers=8) as executor:
        country_data = dict(zip(
            country_codes,
            executor.map(lambda code: load_gadm(code, 0), country_codes),
        ))

    features = []
    brazil_geometry = None
    for code in country_codes:
        feature = country_data[code]["features"][0]
        geometry = shape(feature["geometry"])
        if code == "BRA":
            brazil_geometry = geometry
        geometry = simplify(geometry, COUNTRY_TOLERANCE, preserve_topology=True)
        properties = feature.get("properties", {})
        features.append({
            "type": "Feature",
            "properties": {
                "LEVEL": 0,
                "GID": properties.get("GID_0", code),
                "NAME": properties.get("COUNTRY", code),
            },
            "geometry": mapping(geometry),
        })

    brazil_states = load_gadm("BRA", 1)["features"]
    state_boundaries = unary_union([
        shape(feature["geometry"]).boundary
        for feature in brazil_states
    ])
    if brazil_geometry is not None:
        state_boundaries = state_boundaries.difference(brazil_geometry.boundary.buffer(1e-7))
    state_boundaries = simplify(state_boundaries, STATE_TOLERANCE, preserve_topology=True)
    features.append({
        "type": "Feature",
        "properties": {
            "LEVEL": 1,
            "GID": "BRA",
            "NAME": "Brazilian state boundaries",
        },
        "geometry": mapping(state_boundaries),
    })

    collection = {
        "type": "FeatureCollection",
        "name": "GADM 4.1 administrative basemap",
        "source": "https://gadm.org/",
        "features": features,
    }
    OUTPUT.write_text(
        json.dumps(collection, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(f"Wrote {OUTPUT.name}: {len(country_codes)} countries and Brazil state borders, {OUTPUT.stat().st_size:,} bytes")


if __name__ == "__main__":
    main()