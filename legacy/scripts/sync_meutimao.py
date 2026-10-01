"""Import completed Corinthians football results from Meu Timão season pages."""

import json
import difflib
import re
import sys
import time
import unicodedata
from copy import deepcopy
from datetime import date, datetime, timezone
from pathlib import Path
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup


ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
CURRENT_YEAR = date.today().year
SOURCE_URLS = {
    "Masculino": "https://www.meutimao.com.br/resultados-dos-jogos-do-corinthians/",
    "Feminino": "https://www.meutimao.com.br/resultados-dos-jogos-do-corinthians-feminino/"
}
USER_AGENT = "Mozilla/5.0 (compatible; ATLAS1910/1.0; +https://atlas1910.vercel.app/)"
GEOCODE_CACHE = DATA / "estadio_geocoding_cache.json"
VENUE_DETAIL_CACHE = DATA / "meutimao_venue_details.json"
LOCATION_METADATA_CACHE = DATA / "estadio_location_cache.json"
NOMINATIM_REVERSE_URL = "https://nominatim.openstreetmap.org/reverse"
STADIUM_NAME_HISTORY_PATH = DATA / "estadio_name_history.json"
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
WIKIPEDIA_API = "https://pt.wikipedia.org/w/api.php"
WIKIDATA_API = "https://www.wikidata.org/w/api.php"
GEOCODER_VERSION = 4
VENUE_DETAIL_CACHE_TTL_DAYS = 30
MIN_NAME_MATCH = 0.78
_last_nominatim_request = 0.0
_last_reverse_geocode_request = 0.0
_last_match_detail_request = 0.0
MONTHS = {
    "jan": 1, "fev": 2, "mar": 3, "abr": 4, "mai": 5, "jun": 6,
    "jul": 7, "ago": 8, "set": 9, "out": 10, "nov": 11, "dez": 12
}
BRAZIL_STATES = {
    "AC": "Acre", "AL": "Alagoas", "AP": "Amapá", "AM": "Amazonas", "BA": "Bahia",
    "CE": "Ceará", "DF": "Distrito Federal", "ES": "Espírito Santo", "GO": "Goiás",
    "MA": "Maranhão", "MT": "Mato Grosso", "MS": "Mato Grosso do Sul", "MG": "Minas Gerais",
    "PA": "Pará", "PB": "Paraíba", "PR": "Paraná", "PE": "Pernambuco", "PI": "Piauí",
    "RJ": "Rio de Janeiro", "RN": "Rio Grande do Norte", "RS": "Rio Grande do Sul",
    "RO": "Rondônia", "RR": "Roraima", "SC": "Santa Catarina", "SP": "São Paulo",
    "SE": "Sergipe", "TO": "Tocantins"
}
VENUE_LOCALITY_CORRECTIONS = {
    "hongkongstadium": {
        "city": "Hong Kong",
        "country": "Hong Kong",
        "source_url": "https://www.lcsd.gov.hk/en/stadium/hs.html"
    },
    "leda": {
        "city": "Dourados",
        "state": "MS",
        "country": "Brasil",
        "source_url": "https://www.ibge.gov.br/cidades-e-estados/ms/dourados.html"
    },
    "olimpicoregional": {
        "city": "Cascavel",
        "state": "PR",
        "country": "Brasil",
        "source_url": "https://www.meutimao.com.br/estadio/olimpico_regional/"
    },
    "estadioolimpicoatahualpa": {
        "city": "Quito",
        "state": "Pichincha",
        "country": "Equador",
        "source_url": "https://www.meutimao.com.br/estadio/estadio_olimpico_atahualpa?genero=feminino"
    },
    "independencia": {
        "city": "Belo Horizonte",
        "state": "MG",
        "country": "Brasil",
        "coordinates": [-43.9180009, -19.9087708],
        "source_url": "https://www.meutimao.com.br/estadio/independencia/"
    },
    "arenainindependencia": {
        "city": "Belo Horizonte",
        "state": "MG",
        "country": "Brasil",
        "coordinates": [-43.9180009, -19.9087708],
        "source_url": "https://www.meutimao.com.br/estadio/independencia/"
    },
    "laindependencia": {
        "city": "Tunja",
        "state": "Boyacá",
        "country": "Colombia",
        "coordinates": [-73.3533681, 5.5420478],
        "source_url": "https://www.openstreetmap.org/node/5548746213"
    }
}


def normalize_name(value):
    text = unicodedata.normalize("NFKD", str(value or ""))
    text = text.encode("ascii", "ignore").decode("ascii").lower()
    return re.sub(r"[^a-z0-9]", "", text)


STADIUM_NAME_HISTORY = json.loads(STADIUM_NAME_HISTORY_PATH.read_text(encoding="utf-8")).get("stadiums", [])


def stadium_names_match(name, alias):
    normalized_name = normalize_name(name)
    normalized_alias = normalize_name(alias)
    if not normalized_name or not normalized_alias:
        return False
    if normalized_name == normalized_alias:
        return True

    ignored = {"estadio", "arena", "municipal", "stadium", "de", "da", "do", "das", "dos", "the"}
    name_tokens = set(re.findall(r"[a-z0-9]+", unicodedata.normalize("NFKD", str(name or "")).encode("ascii", "ignore").decode("ascii").lower()))
    alias_tokens = set(re.findall(r"[a-z0-9]+", unicodedata.normalize("NFKD", str(alias or "")).encode("ascii", "ignore").decode("ascii").lower()))
    shared_tokens = (name_tokens & alias_tokens) - ignored
    if len(shared_tokens) >= 2:
        return True
    return min(len(normalized_name), len(normalized_alias)) >= 16 and (
        normalized_name in normalized_alias or normalized_alias in normalized_name
    )


def renamed_stadium_group(value):
    if isinstance(value, dict):
        names = list(feature_names(value))
    elif isinstance(value, (list, tuple, set)):
        names = [str(item) for item in value if item]
    else:
        names = [str(value or "")]
    normalized_names = {normalize_name(name) for name in names if normalize_name(name)}

    for group in STADIUM_NAME_HISTORY:
        aliases = [group.get("current_name"), group.get("previous_name"), *(group.get("aliases") or [])]
        if any(
            stadium_names_match(name, alias)
            for name in names
            for alias in aliases
            if alias
        ):
            return group
    return None


def canonical_stadium_name(name):
    group = renamed_stadium_group(name)
    return group["current_name"] if group else str(name or "").strip()


SHARED_STADIUM_ALIAS_GROUPS = (
    ("Estadio Olímpico Atahualpa", ("Olímpico Atahualpa",)),
    ("Arena Independência", ("Independência", "Estádio Raimundo Sampaio")),
)


def canonical_stadium_alias(name):
    normalized = normalize_name(name)
    for canonical, aliases in SHARED_STADIUM_ALIAS_GROUPS:
        if normalized == normalize_name(canonical) or any(
            normalized == normalize_name(alias) for alias in aliases
        ):
            return canonical
    return str(name or "").strip()


FEMALE_HISTORY_START_YEAR = 1997
FEMALE_MEUTIMAO_START_YEAR = 2016
FEMALE_STADIUM_ALIAS_GROUPS = (
    ("Ilha do Retiro", ("Adelmar da Costa Carvalho (Ilha do Retiro)",)),
    ("Anísio Haddad", ("Anísio Haddad (Rio Pretão)", "Rio Pretão")),
    ("Arena BRB Mané Garrincha", ("Arena BRB Mané Garrincha (Estádio Nacional de Brasília)", "Estádio Nacional de Brasília", "Mané Garrincha")),
    ("Arena da Amazônia", ("Arena da Amazônia - Vivaldo Lima", "Vivaldo Lima")),
    ("Arena Barueri", ("Orlando Batista Noveli (Arena Barueri / Crefisa)",)),
    ("Teixeirão", ("Benedito Teixeira (Teixeirão)",)),
    ("Bruno José Daniel", ("Bruno José Daniel (Brunão)", "Estádio Municipal Bruno José Daniel", "Brunão")),
    ("Baetão", ("Gúglio Portugal Pichinin (Baetão)",)),
    ("Batistão", ("Lourival Baptista (Arena Batistão)", "Lourival Baptista")),
    ("Beira-Rio", ("José Pinheiro Borda (Beira-Rio)", "José Pinheiro Borda")),
    ("Arena Fonte Nova", ("Complexo Esportivo Cultural Octávio Mangabeira (Casa de Apostas Arena Fonte Nova)", "Fonte Nova")),
    ("Canindé", ("Oswaldo Teixeira Duarte (Canindé)", "Oswaldo Teixeira Duarte")),
    ("Rodrigo Paz Delgado", ("Casa Blanca", "Rodrigo Paz Delgado (Casa Blanca)")),
    ("Morumbi", ("Cícero Pompeu de Toledo - Morumbis", "Cícero Pompeu de Toledo", "Morumbis")),
    ("Ressacada", ("Doutor Aderbal Ramos da Silva (Ressacada)", "Aderbal Ramos da Silva")),
    ("Jayme Cintra", ("Doutor Jayme Pinheiro de Ulhêa Cintra (Jayme Cintra)", "Jaime Cintra")),
    ("Vélez Sarsfield", ("José Amalfitani (El Fortín de Liniers)", "José Amalfitani", "El Fortín")),
    ("Gonzalo Pozo Ripalda", ("Gonzalo Pozo Ripalda (Chillogallo)", "Chillogallo")),
    ("Estadio Olímpico Atahualpa", ("Olímpico Atahualpa",)),
    ("Giulite Coutinho", ("Giulite Coutinho (Edson Passos)", "Edson Passos")),
    ("Joaquim de Morais Filho", ("Joaquim de Morais Filho (Joaquinzão)", "Joaquinzão")),
    ("Pascual Guerrero", ("Olímpico Pascual Guerrero (El Pascual)", "El Pascual")),
    ("Vila Belmiro", ("Urbano Caldeira (Vila Belmiro)", "Urbano Caldeira")),
    ("Neo Química Arena", ("Neo Química Arena (Arena Corinthians)", "Arena Corinthians"))
)


def canonical_female_stadium_name(name):
    name = canonical_stadium_alias(name)
    normalized = normalize_name(name)
    for canonical, aliases in FEMALE_STADIUM_ALIAS_GROUPS:
        if normalized == normalize_name(canonical) or any(
            normalized == normalize_name(alias) for alias in aliases
        ):
            return canonical
    return str(name or "").strip()

GEOCODE_QUERY_ALIASES = {
    normalize_name("Arena Botafogo"): ["Estádio Luso-Brasileiro"],
    normalize_name("Arena Botafogo (Ilha do Governador)"): ["Estádio Luso-Brasileiro"],
    normalize_name("Lencho"): ["Estadio Florencio Sola"],
    normalize_name("Lencho (Buenos Aires)"): ["Estadio Florencio Sola"],
    normalize_name("Vélez Sarsfield"): ["Estadio Jose Amalfitani"],
    normalize_name("Vélez Sarsfield (Buenos Aires)"): ["Estadio Jose Amalfitani"],
    normalize_name("Palestra Itália"): ["Allianz Parque"],
    normalize_name("Palestra Itália (São Paulo)"): ["Allianz Parque"],
    normalize_name("Estádio Olímpico-GO"): ["Estádio Olímpico Pedro Ludovico Teixeira"],
    normalize_name("Independência"): ["Arena Independência"]
}
GEOCODE_CONTEXT_OVERRIDES = {
    normalize_name("Arena Botafogo"): {
        "city": "Rio de Janeiro", "state": "Rio de Janeiro", "country": "Brasil"
    },
    normalize_name("Arena Botafogo (Ilha do Governador)"): {
        "city": "Rio de Janeiro", "state": "Rio de Janeiro", "country": "Brasil"
    },
    normalize_name("Lencho"): {
        "city": "Banfield", "state": "Buenos Aires", "country": "Argentina"
    },
    normalize_name("Lencho (Buenos Aires)"): {
        "city": "Banfield", "state": "Buenos Aires", "country": "Argentina"
    },
    normalize_name("Estádio Olímpico-GO"): {
        "city": "Goiânia", "state": "Goiás", "country": "Brasil"
    },
    normalize_name("Independência"): {
        "city": "Belo Horizonte", "state": "Minas Gerais", "country": "Brasil"
    }
}


def read_collection(path):
    with path.open(encoding="utf-8") as source:
        return json.load(source)


def write_collection(path, name, features):
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = path.with_suffix(path.suffix + ".tmp")
    payload = {"type": "FeatureCollection", "name": name, "features": features}
    with temporary_path.open("w", encoding="utf-8") as destination:
        json.dump(payload, destination, ensure_ascii=False, separators=(",", ":"))
    temporary_path.replace(path)


def coordinate_of(feature):
    geometry = feature.get("geometry") or {}
    coordinates = geometry.get("coordinates") or []
    if geometry.get("type") == "Point" and len(coordinates) >= 2:
        return float(coordinates[0]), float(coordinates[1])
    return None


def feature_names(properties):
    for key in ("ESTÁDIO_ORIGINAL", "ESTADIO_ORIGINAL", "ESTADIO", "ESTÁDIO", "NOME_OFICIAL", "Name", "Estadio", "NOME_ANTIGO", "NOMES_ALTERNATIVOS"):
        value = properties.get(key)
        values = value if isinstance(value, (list, tuple, set)) else [value]
        for name in values:
            if name:
                yield str(name).strip()


def venue_locality_correction(properties):
    for name in feature_names(properties):
        correction = (
            VENUE_LOCALITY_CORRECTIONS.get(normalize_name(name))
            or VENUE_LOCALITY_CORRECTIONS.get(normalize_name(canonical_stadium_alias(name)))
        )
        if correction:
            return correction
    return None


def apply_venue_locality_correction(properties):
    correction = venue_locality_correction(properties)
    if not correction:
        return properties
    if correction.get("city"):
        properties["CIDADE"] = correction["city"]
        if "CIDADE_FONTE" in properties or "COMPETIÇÃO" in properties:
            properties["CIDADE_FONTE"] = correction["city"]
    if correction.get("state"):
        full_state = BRAZIL_STATES.get(correction["state"], correction["state"])
        properties["ESTADO"] = full_state
        if "ESTADO_FONTE" in properties or "COMPETIÇÃO" in properties:
            properties["ESTADO_FONTE"] = full_state
    if correction.get("country"):
        country_key = "PAÍS" if "PAÍS" in properties else "PAIS"
        properties[country_key] = correction["country"]
        if "PAIS_FONTE" in properties or "COMPETIÇÃO" in properties:
            properties["PAIS_FONTE"] = correction["country"]
    if correction.get("coordinates"):
        properties["LONGITUDE"], properties["LATITUDE"] = correction["coordinates"]
    properties["FONTE_CORRECAO_LOCALIDADE"] = correction.get("source_url", "")
    return properties


def venue_context(properties):
    properties = properties or {}
    return {
        "city": properties.get("CIDADE_FONTE") or properties.get("CIDADE"),
        "state": properties.get("ESTADO_FONTE") or properties.get("ESTADO/PROVÍNCIA") or properties.get("ESTADO"),
        "country": properties.get("PAIS_FONTE") or properties.get("PAÍS") or properties.get("PAIS")
    }


def stadium_record_identity(record):
    longitude, latitude = record["coordinates"]
    return (
        normalize_name(record["name"]),
        round(float(longitude), 3),
        round(float(latitude), 3)
    )


def add_registry_record(registry, alias, record, prioritize=False):
    key = normalize_name(alias)
    if not key:
        return
    candidates = registry.setdefault(key, [])
    identity = stadium_record_identity(record)
    for index, candidate in enumerate(candidates):
        if stadium_record_identity(candidate) == identity:
            for property_name, value in record.get("properties", {}).items():
                if candidate.get("properties", {}).get(property_name) in (None, "") and value not in (None, ""):
                    candidate["properties"][property_name] = value
            if prioritize and index:
                candidates.insert(0, candidates.pop(index))
            return
    if prioritize:
        candidates.insert(0, record)
    else:
        candidates.append(record)


def build_coordinate_registry(collections):
    registry = {}
    for collection in collections:
        for feature in collection.get("features", []):
            coordinates = coordinate_of(feature)
            if not coordinates:
                continue
            properties = deepcopy(feature.get("properties") or {})
            apply_venue_locality_correction(properties)
            correction = venue_locality_correction(properties)
            if correction and correction.get("coordinates"):
                coordinates = tuple(correction["coordinates"])
            names = list(feature_names(properties))
            if not names:
                continue
            renamed_group = renamed_stadium_group(names)
            current_name = renamed_group["current_name"] if renamed_group else names[0]
            record = {
                "name": current_name,
                "coordinates": coordinates,
                "properties": properties
            }
            aliases = names
            if renamed_group:
                aliases = [
                    *names,
                    renamed_group["current_name"],
                    renamed_group["previous_name"],
                    *(renamed_group.get("aliases") or [])
                ]
            current_record = renamed_group and any(
                stadium_names_match(name, current_name) for name in names
            )
            for name in aliases:
                add_registry_record(registry, name, record, bool(current_record))
    return registry


def stadium_registry_candidates(name, registry):
    renamed_group = renamed_stadium_group(name)
    key = normalize_name(renamed_group["current_name"] if renamed_group else name)
    if not key:
        return []

    candidates = []
    seen = set()

    def add(records):
        for record in records if isinstance(records, (list, tuple)) else [records]:
            if not isinstance(record, dict) or not record.get("coordinates"):
                continue
            identity = stadium_record_identity(record)
            if identity not in seen:
                seen.add(identity)
                candidates.append(record)

    exact = registry.get(key)
    if exact:
        add(exact)
        if len(key) > 10:
            return candidates

    for registry_key, records in registry.items():
        if registry_key == key:
            continue
        if len(key) >= 6 and (key in registry_key or registry_key in key):
            add(records)

    if candidates:
        return candidates

    close_matches = []
    for registry_key, records in registry.items():
        if len(key) < 8 or len(registry_key) < 8:
            continue
        similarity = difflib.SequenceMatcher(None, key, registry_key).ratio()
        if similarity >= 0.94:
            close_matches.extend((similarity, record) for record in (records if isinstance(records, list) else [records]))
    if close_matches:
        best_score = max(score for score, _ in close_matches)
        for score, record in close_matches:
            if best_score - score <= 0.02:
                add([record])
    return candidates


def normalized_state(value):
    key = normalize_name(value)
    if len(key) == 2:
        full_state = BRAZIL_STATES.get(key.upper())
        if full_state:
            return normalize_name(full_state)
    return key


def match_context_score(record, context):
    record_context = venue_context(record.get("properties"))
    score = 0
    for field in ("city", "state", "country"):
        requested = str((context or {}).get(field) or "").strip()
        candidate = str(record_context.get(field) or "").strip()
        if not requested or not candidate:
            continue
        if field == "country":
            requested_code = country_code_for_name(requested)
            candidate_code = country_code_for_name(candidate)
            matches = requested_code == candidate_code if requested_code and candidate_code else normalize_name(requested) == normalize_name(candidate)
        elif field == "state":
            matches = normalized_state(requested) == normalized_state(candidate)
        else:
            requested_city = normalize_name(requested)
            candidate_city = normalize_name(candidate)
            matches = requested_city == candidate_city or (
                min(len(requested_city), len(candidate_city)) >= 6
                and (requested_city in candidate_city or candidate_city in requested_city)
            )
        if not matches:
            return None
        score += 1
    return score


def resolve_stadium(name, registry, context=None):
    candidates = stadium_registry_candidates(name, registry)
    if not candidates:
        return None
    ranked = [(match_context_score(candidate, context), candidate) for candidate in candidates]
    compatible = [(score, candidate) for score, candidate in ranked if score is not None]
    if not compatible:
        return None
    if len(compatible) == 1:
        score, candidate = compatible[0]
        if len(candidates) > 1 and score == 0:
            return None
        return candidate
    best_score = max(score for score, _ in compatible)
    best = [candidate for score, candidate in compatible if score == best_score]
    return best[0] if best_score > 0 and len(best) == 1 else None


def read_geocode_cache():
    if not GEOCODE_CACHE.exists():
        return {}
    try:
        return json.loads(GEOCODE_CACHE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        print("Aviso: cache de geocodificação inválido; será reconstruído.")
        return {}


def write_geocode_cache(cache):
    temporary_path = GEOCODE_CACHE.with_suffix(".json.tmp")
    temporary_path.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")
    temporary_path.replace(GEOCODE_CACHE)


def is_unknown_venue(name):
    return normalize_name(name) in {
        "", "desconhecido", "desconhecida", "indefinido", "indefinida", "naoinformado", "na", "nd", "unknown", "semestadio"
    }


def is_placeholder_venue(name):
    return is_unknown_venue(name)


def enrich_venues_from_match_details(games, registries):
    global _last_match_detail_request
    cache = {}
    if VENUE_DETAIL_CACHE.exists():
        try:
            cache = json.loads(VENUE_DETAIL_CACHE.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            cache = {}

    unresolved = {}
    for game in games:
        properties = game.get("properties") or {}
        venue = properties.get("ESTÁDIO_ORIGINAL") or properties.get("ESTÁDIO") or ""
        if is_unknown_venue(venue):
            match_url = properties.get("URL_FONTE")
            if match_url:
                match_id = properties.get("MEUTIMAO_ID") or match_url.rstrip("/").rsplit("/", 1)[-1]
                key = f"match:{match_id}"
                unresolved.setdefault(key, {"name": match_url, "games": []})["games"].append(game)
        elif not any(resolve_stadium(venue, registry) for registry in registries):
            unresolved.setdefault(normalize_name(venue), {"name": venue, "games": []})["games"].append(game)

    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT, "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.5"})
    for index, (key, entry) in enumerate(sorted(unresolved.items()), start=1):
        record = cache.get(key)
        checked_at = None
        if record and record.get("last_checked"):
            try:
                checked_at = datetime.fromisoformat(record["last_checked"])
            except ValueError:
                print(f"Aviso: data de consulta inválida no cache do estádio {entry['name']}; será consultado novamente.")
        cache_is_fresh = bool(
            checked_at
            and (datetime.now(timezone.utc) - checked_at).days < VENUE_DETAIL_CACHE_TTL_DAYS
        )
        if record and (record.get("stadium_name") or cache_is_fresh):
            pass
        else:
            candidates = sorted(
                entry["games"],
                key=lambda game: game.get("properties", {}).get("DATA", ""),
                reverse=True
            )[:3]
            record = None
            for game in candidates:
                url = (game.get("properties") or {}).get("URL_FONTE")
                if not url:
                    continue
                print(f"Detalhe Meu Timão {index}/{len(unresolved)}: {entry['name']}", flush=True)
                try:
                    wait_seconds = 0.5 - (time.monotonic() - _last_match_detail_request)
                    if wait_seconds > 0:
                        time.sleep(wait_seconds)
                    response = session.get(url, timeout=35)
                    _last_match_detail_request = time.monotonic()
                    response.raise_for_status()
                    soup = BeautifulSoup(response.text, "html.parser")
                    header = soup.select_one("h2.campeonato")
                    stadium_link = header.select_one('a[href*="/estadio/"]') if header else None
                    stadium_name = stadium_link.get_text(" ", strip=True) if stadium_link else None
                    place_text = ""
                    if stadium_link:
                        for sibling in stadium_link.next_siblings:
                            if getattr(sibling, "name", None):
                                break
                            place_text += str(sibling)
                    place_match = re.search(r",\s*([^,]+),\s*([A-Z]{2})\b", BeautifulSoup(place_text, "html.parser").get_text(" ", strip=True))
                    city = place_match.group(1).strip() if place_match else None
                    state = place_match.group(2).strip() if place_match else None
                    country = "Brasil" if state else None
                    if not city:
                        international_match = re.search(r",\s*([^,]+),\s*([^,.]+)\.?\s*$", BeautifulSoup(place_text, "html.parser").get_text(" ", strip=True))
                        if international_match:
                            city = international_match.group(1).strip()
                            country = international_match.group(2).strip()
                    if not city:
                        description = soup.select_one('[itemprop="description"]')
                        if description:
                            local_anchor = description.select_one('a[href*="/estadio/"]')
                            if local_anchor:
                                paragraph = local_anchor.find_parent("p")
                                paragraph_text = paragraph.get_text(" ", strip=True) if paragraph else ""
                                place_match = re.search(r",\s*([^,]+),\s*([A-Z]{2})\b", paragraph_text)
                                if place_match:
                                    city, state = place_match.group(1).strip(), place_match.group(2).strip()
                                    country = "Brasil"
                    record = {
                        "original_name": entry["name"],
                        "stadium_name": stadium_name if stadium_name and not is_placeholder_venue(stadium_name) else None,
                        "stadium_url": urljoin(url, stadium_link.get("href", "")) if stadium_link else None,
                        "city": city if city and not is_placeholder_venue(city) else None,
                        "state": state,
                        "country": country,
                        "match_url": url,
                        "last_checked": datetime.now(timezone.utc).isoformat()
                    }
                    correction = (
                        VENUE_LOCALITY_CORRECTIONS.get(key)
                        or VENUE_LOCALITY_CORRECTIONS.get(normalize_name(canonical_stadium_alias(key)))
                    )
                    if correction:
                        record["city"] = correction.get("city") or record.get("city")
                        record["state"] = correction.get("state") or record.get("state")
                        record["country"] = correction.get("country") or record.get("country")
                        record["locality_correction_source"] = correction["source_url"]
                    if record["stadium_name"] or record["city"]:
                        break
                except requests.RequestException as error:
                    print(f"  Detalhe indisponível: {error}", flush=True)
                time.sleep(0.4)
            if record:
                cache[key] = record
                temporary_path = VENUE_DETAIL_CACHE.with_suffix(".json.tmp")
                temporary_path.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")
                temporary_path.replace(VENUE_DETAIL_CACHE)

        correction = (
            VENUE_LOCALITY_CORRECTIONS.get(key)
            or VENUE_LOCALITY_CORRECTIONS.get(normalize_name(canonical_stadium_alias(key)))
        )
        if record and correction:
            record["city"] = correction.get("city") or record.get("city")
            record["state"] = correction.get("state") or record.get("state")
            record["country"] = correction.get("country") or record.get("country")
            record["locality_correction_source"] = correction["source_url"]
            cache[key] = record
            temporary_path = VENUE_DETAIL_CACHE.with_suffix(".json.tmp")
            temporary_path.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")
            temporary_path.replace(VENUE_DETAIL_CACHE)

        if not record:
            continue
        for game in entry["games"]:
            properties = game.get("properties") or {}
            if record.get("stadium_name"):
                properties["ESTÁDIO_DETALHE"] = record["stadium_name"]
                properties["URL_ESTADIO_FONTE"] = record.get("stadium_url")
                properties["ESTÁDIO"] = record["stadium_name"]
                if is_unknown_venue(properties.get("ESTÁDIO_ORIGINAL")):
                    properties["ESTÁDIO_ORIGINAL"] = record["stadium_name"]
            if record.get("city"):
                properties["CIDADE_FONTE"] = record["city"]
                properties["ESTADO_FONTE"] = record.get("state")
                properties["PAIS_FONTE"] = record.get("country")
                if record.get("locality_correction_source"):
                    properties["FONTE_CORRECAO_LOCALIDADE"] = record["locality_correction_source"]

    return cache


def venue_name_match(query, candidate):
    query_key = normalize_name(query)
    candidate_key = normalize_name(candidate)
    if not query_key or not candidate_key:
        return 0
    direct = difflib.SequenceMatcher(None, query_key, candidate_key).ratio()
    query_tokens = {token for token in re.findall(r"[a-z0-9]+", normalize_name_for_tokens(query)) if len(token) > 2}
    candidate_tokens = {token for token in re.findall(r"[a-z0-9]+", normalize_name_for_tokens(candidate)) if len(token) > 2}
    overlap = len(query_tokens & candidate_tokens) / max(len(query_tokens), 1)
    return max(direct, overlap)


def normalize_name_for_tokens(value):
    text = unicodedata.normalize("NFKD", str(value or ""))
    return text.encode("ascii", "ignore").decode("ascii").lower()


def cache_record(name, longitude, latitude, source, source_url, display_name, score, address=None, precision="Estádio identificado"):
    return {
        "name": name,
        "longitude": float(longitude),
        "latitude": float(latitude),
        "source": source,
        "source_url": source_url,
        "display_name": display_name,
        "match_score": round(float(score), 3),
        "precision": precision,
        "resolver_version": GEOCODER_VERSION,
        "address": address or {},
        "attribution": "© OpenStreetMap contributors, ODbL 1.0" if source.startswith("OpenStreetMap") else "Wikidata (CC0)" if source == "Wikidata" else "Wikimedia / Wikipedia"
    }


def country_code_for_name(country):
    key = normalize_name(country)
    return {
        "brasil": "br",
        "brazil": "br",
        "estadosunidosdaamerica": "us",
        "estadosunidos": "us",
        "unitedstates": "us",
        "argentina": "ar",
        "chile": "cl",
        "paraguai": "py",
        "paraguay": "py",
        "uruguai": "uy",
        "uruguay": "uy",
        "colombia": "co",
        "equador": "ec",
        "ecuador": "ec",
        "marrocos": "ma",
        "marruecos": "ma",
        "mexico": "mx",
        "venezuela": "ve",
        "honduras": "hn",
        "servia": "rs",
        "serbia": "rs",
        "bolivia": "bo",
        "turquia": "tr",
        "türkiye": "tr",
        "italia": "it",
        "finlandia": "fi",
        "suecia": "se",
        "suecia": "se",
        "suica": "ch",
        "alemanha": "de",
        "portugal": "pt",
        "dinamarca": "dk",
        "espanha": "es",
        "tailandia": "th",
        "inglaterra": "gb",
        "franca": "fr",
        "paisesbaixos": "nl",
        "holanda": "nl",
        "austria": "at",
        "belgica": "be",
        "japao": "jp"
    }.get(key)


BRAZILIAN_DOMESTIC_COMPETITION_TERMS = (
    "COPADOBRASIL",
    "CAMPEONATOBRASILEIRO",
    "BRASILEIRAO",
    "ROBERTAO",
    "TACABRASIL",
    "CAMPEONATOPAULISTA",
    "COPAPAULISTA",
    "SUPERCOPADOBRASIL",
    "TORNEIORIOSAOPAULO"
)


def validate_domestic_competition_locations(games):
    for game in games:
        properties = game.get("properties") or game
        competition = normalize_name(properties.get("COMPETIÇÃO") or properties.get("COMPETICAO"))
        if not any(term in competition for term in BRAZILIAN_DOMESTIC_COMPETITION_TERMS):
            continue

        venue = properties.get("ESTÁDIO") or properties.get("ESTADIO") or properties.get("ESTÁDIO_ORIGINAL") or ""
        country = venue_context(properties).get("country")
        country_code = country_code_for_name(country)
        coordinates = coordinate_of(game)
        outside_brazil = coordinates and not (
            -75 <= coordinates[0] <= -32 and -35 <= coordinates[1] <= 6
        )
        if (country and country_code != "br") or outside_brazil:
            match_id = properties.get("MEUTIMAO_ID") or properties.get("URL_FONTE") or properties.get("DATA") or "sem identificador"
            raise ValueError(
                f"Partida de competição nacional fora do Brasil: {competition}; "
                f"estádio={venue}; país={country}; coordenadas={coordinates}; jogo={match_id}"
            )


def geocode_record_matches_context(record, context):
    if not record:
        return False
    address = record.get("address") or {}
    expected_country = country_code_for_name((context or {}).get("country"))
    actual_country = address.get("country_code")
    if expected_country and actual_country and expected_country != actual_country.casefold():
        return False

    expected_city = normalize_name((context or {}).get("city"))
    if expected_city:
        actual_localities = [
            normalize_name(address.get(key))
            for key in ("city", "town", "village", "municipality", "city_district", "county", "suburb")
            if address.get(key)
        ]
        if actual_localities:
            best_match = max(difflib.SequenceMatcher(None, expected_city, actual).ratio() for actual in actual_localities)
            if best_match < 0.55:
                return False
        elif expected_city not in normalize_name(record.get("display_name", "")):
            return False
    expected_state = normalize_name((context or {}).get("state"))
    if expected_state:
        expected_state = normalize_name(BRAZIL_STATES.get(str((context or {}).get("state", "")).upper(), (context or {}).get("state")))
        actual_states = [normalize_name(address.get(key)) for key in ("state", "province", "region") if address.get(key)]
        if actual_states and not any(difflib.SequenceMatcher(None, expected_state, value).ratio() >= 0.55 for value in actual_states):
            return False
    return True


def geocode_with_nominatim(session, name, context=None):
    global _last_nominatim_request
    if is_unknown_venue(name) or len(normalize_name(name)) < 4 or (len(normalize_name(name)) < 6 and not (context or {}).get("city")):
        return None
    locality = " ".join(part for part in (context or {}).values() if part)
    expected_country = (context or {}).get("country")
    country_code = country_code_for_name(expected_country)
    query_variants = []
    if locality:
        query_variants.append((f"{name} stadium {locality}", country_code))
    if not expected_country:
        query_variants.append((f"{name} stadium Brazil", "br"))
    query_variants.extend([(f"{name} estádio futebol {locality}", country_code), (f"{name} stadium {locality}", country_code), (f"{name} stadium", country_code)])
    for query, country_code in query_variants:
        wait_seconds = 1.05 - (time.monotonic() - _last_nominatim_request)
        if wait_seconds > 0:
            time.sleep(wait_seconds)
        response = session.get(NOMINATIM_URL, params={
            "q": query,
            "format": "jsonv2",
            "limit": 5,
            "addressdetails": 1,
            "namedetails": 1,
            "extratags": 1,
            **({"countrycodes": country_code} if country_code else {})
        }, timeout=30)
        _last_nominatim_request = time.monotonic()
        response.raise_for_status()
        candidates = response.json()
        ranked = []
        for candidate in candidates:
            candidate_name = candidate.get("name") or candidate.get("namedetails", {}).get("name") or ""
            score = venue_name_match(name, candidate_name)
            category = candidate.get("category", "")
            feature_type = candidate.get("type", "")
            is_sport_feature = category in {"leisure", "sport", "historic"} and feature_type in {
                "stadium", "sports_centre", "sports_hall", "pitch", "sports_ground", "track"
            }
            if score >= MIN_NAME_MATCH and is_sport_feature and geocode_record_matches_context(candidate, context):
                ranked.append((score, candidate))
        ranked.sort(key=lambda item: item[0], reverse=True)
        if ranked:
            score, candidate = ranked[0]
            if len(ranked) == 1 or score - ranked[1][0] >= 0.05:
                osm_type = candidate.get("osm_type", "way")
                osm_id = candidate.get("osm_id", "")
                source_url = f"https://www.openstreetmap.org/{osm_type}/{osm_id}"
                return cache_record(
                    candidate_name, candidate["lon"], candidate["lat"], "OpenStreetMap Nominatim",
                    source_url, candidate.get("display_name", candidate_name), score,
                    candidate.get("address")
                )
    return None


def geocode_with_wikipedia(session, name, context=None):
    if is_unknown_venue(name) or len(normalize_name(name)) < 4 or (len(normalize_name(name)) < 6 and not (context or {}).get("city")):
        return None
    response = session.get(WIKIPEDIA_API, params={
        "action": "query",
        "generator": "search",
        "gsrsearch": f'"{name}" estádio futebol {" ".join(part for part in (context or {}).values() if part)}',
        "gsrlimit": 8,
        "prop": "coordinates|info|extracts",
        "inprop": "url",
        "exintro": 1,
        "explaintext": 1,
        "format": "json",
        "formatversion": 2
    }, timeout=30)
    response.raise_for_status()
    pages = response.json().get("query", {}).get("pages", [])
    ranked = []
    for page in pages:
        coordinates = page.get("coordinates") or []
        if not coordinates:
            continue
        score = venue_name_match(name, page.get("title", ""))
        page_context = normalize_name(f"{page.get('title', '')} {page.get('extract', '')}")
        expected_city = normalize_name((context or {}).get("city"))
        expected_country = normalize_name((context or {}).get("country"))
        if expected_city and expected_city not in page_context:
            continue
        country_aliases = {
            "brasil": {"brasil", "brazil"},
            "italia": {"italia", "italy"},
            "suecia": {"suecia", "sweden"},
            "argentina": {"argentina"},
            "equador": {"equador", "ecuador"},
            "mexico": {"mexico"},
            "marrocos": {"marrocos", "morocco"},
            "turquia": {"turquia", "turkey"},
            "peru": {"peru"},
            "chile": {"chile"},
            "finlandia": {"finlandia", "finland"},
            "alemanha": {"alemanha", "germany"}
        }
        if expected_country and not any(alias in page_context for alias in country_aliases.get(expected_country, {expected_country})):
            continue
        if score >= 0.82:
            ranked.append((score, page, coordinates[0]))
    ranked.sort(key=lambda item: item[0], reverse=True)
    if ranked:
        score, page, point = ranked[0]
        if len(ranked) == 1 or score - ranked[1][0] >= 0.05:
            return cache_record(
                name, point["lon"], point["lat"], "Wikipedia",
                page.get("fullurl", "https://pt.wikipedia.org/"), page.get("title", ""), score,
                {"city": (context or {}).get("city"), "state": (context or {}).get("state"), "country": (context or {}).get("country"), "country_code": country_code_for_name((context or {}).get("country"))}
            )
    return None


def geocode_with_wikidata(session, name, context=None):
    if is_unknown_venue(name) or len(normalize_name(name)) < 4:
        return None
    response = session.get(WIKIDATA_API, params={
        "action": "wbsearchentities",
        "search": name,
        "language": "pt",
        "uselang": "pt",
        "limit": 10,
        "format": "json"
    }, timeout=30)
    response.raise_for_status()
    entities = response.json().get("search", [])
    ranked = []
    for entity in entities:
        label = entity.get("label", "")
        description = entity.get("description", "")
        score = venue_name_match(name, label)
        context_text = normalize_name(f"{label} {description}")
        expected_city = normalize_name((context or {}).get("city"))
        if expected_city and expected_city not in context_text:
            continue
        expected_country = normalize_name((context or {}).get("country"))
        country_aliases = {
            "brasil": {"brasil", "brazil"},
            "italia": {"italia", "italy"},
            "suecia": {"suecia", "sweden"},
            "estadosunidosdaamerica": {"estadosunidosdaamerica", "unitedstates", "unitedstatesofamerica"},
            "alemanha": {"alemanha", "germany"},
            "equador": {"equador", "ecuador"},
            "colombia": {"colombia"},
            "turquia": {"turquia", "turkey"},
            "argentina": {"argentina"},
            "mexico": {"mexico"},
            "portugal": {"portugal"},
            "dinamarca": {"dinamarca", "denmark"},
            "finlandia": {"finlandia", "finland"}
        }
        if expected_country and not any(alias in context_text for alias in country_aliases.get(expected_country, {expected_country})):
            continue
        if score >= 0.78:
            ranked.append((score, entity))
    ranked.sort(key=lambda item: item[0], reverse=True)
    if not ranked or (len(ranked) > 1 and ranked[0][0] - ranked[1][0] < 0.05):
        return None

    score, entity = ranked[0]
    entity_response = session.get(WIKIDATA_API, params={
        "action": "wbgetentities",
        "ids": entity["id"],
        "props": "claims|labels|descriptions",
        "languages": "pt|en",
        "format": "json"
    }, timeout=30)
    entity_response.raise_for_status()
    claims = entity_response.json().get("entities", {}).get(entity["id"], {}).get("claims", {})
    coordinate_claims = claims.get("P625", [])
    if not coordinate_claims:
        return None
    point = coordinate_claims[0].get("mainsnak", {}).get("datavalue", {}).get("value", {})
    if "latitude" not in point or "longitude" not in point:
        return None
    return cache_record(
        entity.get("label") or name, point["longitude"], point["latitude"], "Wikidata",
        f"https://www.wikidata.org/wiki/{entity['id']}",
        f"{entity.get('label', name)} - {entity.get('description', '')}", score
    )


def geocode_city_approximation(session, name, context):
    global _last_nominatim_request
    city = (context or {}).get("city")
    state = (context or {}).get("state")
    country = (context or {}).get("country")
    if is_unknown_venue(name) and not any((city, state, country)):
        return None
    if city and not is_placeholder_venue(city):
        locality_name = city
        locality_precision = "Município (estádio exato não identificado)"
    elif state and not is_placeholder_venue(state):
        locality_name = BRAZIL_STATES.get(str(state).upper(), state)
        locality_precision = "Estado (município e estádio não identificados)"
    elif country and not is_placeholder_venue(country):
        locality_name = country
        locality_precision = "País (município e estádio não identificados)"
    else:
        return None
    locality_parts = [locality_name]
    if city and state:
        locality_parts.append(state)
    if (city or state) and country:
        locality_parts.append(country)
    locality = ", ".join(locality_parts)
    wait_seconds = 1.05 - (time.monotonic() - _last_nominatim_request)
    if wait_seconds > 0:
        time.sleep(wait_seconds)
    response = session.get(NOMINATIM_URL, params={
        "q": locality,
        "format": "jsonv2",
        "limit": 5,
        "addressdetails": 1,
        **({"countrycodes": country_code_for_name((context or {}).get("country"))} if country_code_for_name((context or {}).get("country")) else {})
    }, timeout=30)
    _last_nominatim_request = time.monotonic()
    response.raise_for_status()
    candidates = []
    for candidate in response.json():
        place_type = candidate.get("type", "")
        category = candidate.get("category", "")
        candidate_name = candidate.get("name", "")
        score = venue_name_match(locality_name, candidate_name)
        address_type = candidate.get("addresstype", "")
        if city and not is_placeholder_venue(city):
            is_locality = (category == "place" and place_type in {"city", "town", "village", "municipality", "suburb"}) or (category == "boundary" and place_type == "administrative" and address_type in {"city", "town", "municipality", "suburb"})
        elif state and not is_placeholder_venue(state):
            is_locality = category == "boundary" and place_type == "administrative" and address_type == "state"
        else:
            is_locality = category == "boundary" and place_type == "administrative" and address_type == "country"
        if is_locality and score >= 0.55 and geocode_record_matches_context(candidate, context):
            candidates.append((score, candidate))
    candidates.sort(key=lambda item: item[0], reverse=True)
    if not candidates:
        return None
    score, candidate = candidates[0]
    if len(candidates) > 1:
        candidates = [item for item in candidates if item[1].get("addresstype") == candidate.get("addresstype")]
        candidates.sort(key=lambda item: item[0], reverse=True)
        score, candidate = candidates[0]
    return cache_record(
        name, candidate["lon"], candidate["lat"], "OpenStreetMap Nominatim (localidade aproximada)",
        f"https://www.openstreetmap.org/{candidate.get('osm_type', 'relation')}/{candidate.get('osm_id', '')}",
        candidate.get("display_name", candidate_name), score, candidate.get("address"), locality_precision
    )


def add_geocoded_venues(games, registries):
    cache = read_geocode_cache()
    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT, "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.5"})
    missing_names = {}
    for game in games:
        properties = game.get("properties") or {}
        name = properties.get("ESTÁDIO_ORIGINAL") or properties.get("ESTÁDIO") or ""
        if not is_unknown_venue(name) and not any(resolve_stadium(name, registry) for registry in registries):
            key = normalize_name(name)
            entry = missing_names.setdefault(key, {"name": name.strip(), "context": {}})
            entry["name"] = properties.get("ESTÁDIO_DETALHE") or entry["name"]
            entry["context"] = {
                "city": properties.get("CIDADE_FONTE"),
                "state": properties.get("ESTADO_FONTE"),
                "country": properties.get("PAIS_FONTE")
            }

    for index, (original_key, entry) in enumerate(sorted(missing_names.items()), start=1):
        name = entry["name"]
        context = GEOCODE_CONTEXT_OVERRIDES.get(original_key, entry["context"])
        context_key = "_".join(normalize_name(context.get(field)) for field in ("city", "state") if context.get(field))
        cache_key = f"{original_key}__{context_key}" if context_key else original_key
        cached = cache.get(cache_key)
        if cached and cached.get("longitude") is not None and cached.get("latitude") is not None and geocode_record_matches_context(cached, context):
            record = cached
        elif cached and cached.get("last_checked") and cached.get("resolver_version", 1) >= GEOCODER_VERSION:
            checked_at = datetime.fromisoformat(cached["last_checked"])
            if (datetime.now(timezone.utc) - checked_at).days < 180:
                record = cached
                print(f"Pendente em cache ({index}/{len(missing_names)}): {name}", flush=True)
            else:
                record = None
        else:
            record = None

        if not cached or (record is None):
            print(f"Geocodificando {index}/{len(missing_names)}: {name} ({context.get('city') or 'localidade não informada'})", flush=True)
            record = None
            try:
                record = geocode_with_nominatim(session, name, context)
            except requests.RequestException as error:
                print(f"  OSM indisponível para {name}: {error}")
            if not record:
                try:
                    record = geocode_with_wikipedia(session, name, context)
                except requests.RequestException as error:
                    print(f"  Wikipédia indisponível para {name}: {error}")
            if not record:
                try:
                    record = geocode_with_wikidata(session, name, context)
                except requests.RequestException as error:
                    print(f"  Wikidata indisponível para {name}: {error}")
            if not record:
                for alias in GEOCODE_QUERY_ALIASES.get(original_key, []):
                    try:
                        record = geocode_with_nominatim(session, alias, context)
                    except requests.RequestException as error:
                        print(f"  OSM indisponível para {alias}: {error}")
                    if record:
                        break
            if not record:
                try:
                    record = geocode_city_approximation(session, name, context)
                except requests.RequestException as error:
                    print(f"  Localidade indisponível para {name}: {error}")
            if record:
                cache[cache_key] = record
                write_geocode_cache(cache)
                print(f"  Encontrado: {record['display_name']} [{record['source']}]", flush=True)
            else:
                record = {
                    "name": name,
                    "longitude": None,
                    "latitude": None,
                    "source": None,
                    "status": "não localizado",
                    "last_checked": datetime.now(timezone.utc).isoformat()
                }
                cache[cache_key] = record
                write_geocode_cache(cache)
                print("  Sem resultado validável; mantido na lista de pendências.", flush=True)

        if record.get("longitude") is None or record.get("latitude") is None:
            continue
        location = {
            "name": record.get("name") or name,
            "coordinates": (record["longitude"], record["latitude"]),
            "properties": {
                "ESTÁDIO": record.get("name") or name,
                "CIDADE": record.get("address", {}).get("city") or record.get("address", {}).get("town") or record.get("address", {}).get("municipality"),
                "ESTADO": record.get("address", {}).get("state"),
                "PAÍS": record.get("address", {}).get("country"),
                "FONTE_COORDENADAS": record["source"],
                "URL_FONTE_COORDENADAS": record["source_url"],
                "ATRIBUICAO_COORDENADAS": record.get("attribution")
            },
            "geocoding": record
        }
        for registry in registries:
            registry[original_key] = location
            registry[normalize_name(location["name"])] = location

    return cache


def enrich_location_metadata(features, reconcile_country=False):
    global _last_reverse_geocode_request
    try:
        cache = json.loads(LOCATION_METADATA_CACHE.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        cache = {}

    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT, "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.5"})
    updated = 0
    queried = 0
    for feature in features:
        is_geojson_feature = "properties" in feature
        properties = feature.get("properties") or {} if is_geojson_feature else feature
        country_key = "PAÍS" if "PAÍS" in properties else "PAIS"

        geometry = feature.get("geometry") or {}
        if hasattr(geometry, "x") and hasattr(geometry, "y"):
            longitude, latitude = geometry.x, geometry.y
        else:
            coordinates = geometry.get("coordinates") or []
            longitude = coordinates[0] if geometry.get("type") == "Point" and len(coordinates) >= 2 else properties.get("LONGITUDE")
            latitude = coordinates[1] if geometry.get("type") == "Point" and len(coordinates) >= 2 else properties.get("LATITUDE")
        try:
            longitude, latitude = float(longitude), float(latitude)
        except (TypeError, ValueError):
            continue

        cache_key = f"{longitude:.5f},{latitude:.5f}"
        metadata = cache.get(cache_key)
        has_admin_metadata = bool(properties.get("CIDADE") and properties.get("ESTADO") and properties.get(country_key))
        if has_admin_metadata and metadata is None and not reconcile_country:
            continue
        if metadata is None:
            wait_seconds = 1.05 - (time.monotonic() - _last_reverse_geocode_request)
            if wait_seconds > 0:
                time.sleep(wait_seconds)
            try:
                response = session.get(NOMINATIM_REVERSE_URL, params={
                    "lat": latitude,
                    "lon": longitude,
                    "format": "jsonv2",
                    "addressdetails": 1,
                    "zoom": 10
                }, timeout=30)
                _last_reverse_geocode_request = time.monotonic()
                queried += 1
                if queried % 25 == 0:
                    print(f"Geocodificação reversa: {queried} coordenadas consultadas.", flush=True)
                response.raise_for_status()
                result = response.json()
            except (requests.RequestException, ValueError) as error:
                print(f"  Localização administrativa indisponível em {cache_key}: {error}", flush=True)
                continue

            address = result.get("address") or {}
            metadata = {
                "CIDADE": address.get("city") or address.get("town") or address.get("village") or address.get("municipality") or address.get("county"),
                "ESTADO": address.get("state"),
                "PAIS": address.get("country"),
                "FONTE_COORDENADAS": "OpenStreetMap Nominatim (geocodificação reversa)",
                "URL_FONTE_COORDENADAS": f"https://www.openstreetmap.org/{result.get('osm_type', 'relation')}/{result.get('osm_id', '')}",
                "ATRIBUICAO_COORDENADAS": "© OpenStreetMap contributors, ODbL 1.0"
            }
            cache[cache_key] = metadata
            LOCATION_METADATA_CACHE.parent.mkdir(parents=True, exist_ok=True)
            LOCATION_METADATA_CACHE.write_text(json.dumps(cache, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

        for field in ("CIDADE", "ESTADO"):
            if not properties.get(field) and metadata.get(field):
                properties[field] = metadata[field]
                updated += 1
        if metadata.get("PAIS"):
            current_country = str(properties.get(country_key) or "").strip()
            current_country_code = country_code_for_name(current_country)
            reverse_country_code = country_code_for_name(metadata["PAIS"])
            country_mismatch = current_country and (
                current_country_code != reverse_country_code
                if current_country_code and reverse_country_code
                else normalize_name(current_country) != normalize_name(metadata["PAIS"])
            )
            if country_mismatch:
                properties.setdefault("PAIS_REGISTRO_ANTERIOR", current_country)
            if not current_country or country_mismatch:
                properties[country_key] = metadata["PAIS"]
                updated += 1
        for field in ("FONTE_COORDENADAS", "URL_FONTE_COORDENADAS", "ATRIBUICAO_COORDENADAS"):
            if not properties.get(field) and metadata.get(field):
                properties[field] = metadata[field]

    print(f"Metadados administrativos preenchidos: {updated} campos.", flush=True)
    return features


def parse_card(card, modality, season, page_url):
    link = card.select_one("a.link_over_node[href*='/jogo/']")
    if not link:
        return None

    card_classes = set(card.get("class", []))
    if "encerrado" not in card_classes:
        return None

    sport_label = card.select_one(".mais_info_jogo .esporte_jogo")
    if sport_label:
        sport = sport_label.get_text(" ", strip=True).casefold()
        if modality.casefold() not in sport:
            return None

    time_node = card.select_one("time[datetime]")
    if time_node:
        match_date = datetime.fromisoformat(time_node["datetime"].replace("Z", "+00:00")).date()
    else:
        day_node = card.select_one("time .dia")
        month_node = card.select_one("time .mes")
        if not day_node or not month_node:
            raise ValueError(f"Partida sem data legível em {page_url}: {link.get('href')}")
        month = MONTHS.get(month_node.get_text(strip=True)[:3].casefold())
        if not month:
            raise ValueError(f"Mês desconhecido em {page_url}: {month_node.get_text(strip=True)}")
        match_date = date(season, month, int(day_node.get_text(strip=True)))

    score_block = card.select_one("h3.placar")
    home_team = score_block.select_one("strong.mandante") if score_block else None
    away_team = score_block.select_one("strong.visitante") if score_block else None
    home_goals_node = score_block.select_one("em.mandante") if score_block else None
    away_goals_node = score_block.select_one("em.visitante") if score_block else None
    if not home_team or not away_team:
        raise ValueError(f"Times não encontrados em {page_url}: {link.get('href')}")

    def parse_goals(node):
        value = node.get_text(strip=True) if node else ""
        return int(value) if value.isdigit() else None

    home_goals = parse_goals(home_goals_node)
    away_goals = parse_goals(away_goals_node)
    home_name = home_team.get_text(" ", strip=True)
    away_name = away_team.get_text(" ", strip=True)
    competition_node = card.select_one("p.campeonato")
    stadium_node = card.select_one("p.estadio")
    competition = competition_node.get_text(" ", strip=True) if competition_node else ""
    stadium = stadium_node.get_text(" ", strip=True) if stadium_node else ""

    is_corinthians_home = "corinth" in normalize_name(home_name)
    opponent = away_name if is_corinthians_home else home_name
    own_goals = home_goals if is_corinthians_home else away_goals
    opponent_goals = away_goals if is_corinthians_home else home_goals
    result = "ND"
    if own_goals is not None and opponent_goals is not None:
        result = "VITÓRIA" if own_goals > opponent_goals else "DERROTA" if own_goals < opponent_goals else "EMPATE"

    game_id_match = re.search(r"/jogo/(\d+)", link.get("href", ""))
    return {
        "MEUTIMAO_ID": game_id_match.group(1) if game_id_match else "",
        "DATA": match_date.isoformat(),
        "ANO JOGO": match_date.year,
        "MODALIDADE": modality,
        "MANDANTE / VISITANTE (SCCP)": "Sim" if is_corinthians_home else "Não",
        "TIME MANDANTE": home_name.upper(),
        "GOLS MANDANTE": home_goals,
        "TIME VISITANTE": away_name.upper(),
        "GOLS VISITANTE": away_goals,
        "PLACAR": f"{home_goals}x{away_goals}" if home_goals is not None and away_goals is not None else "ND",
        "RESULTADO": result,
        "ADVERSÁRIO": opponent.upper(),
        "GOLS SCCP": own_goals,
        "GOLS ADVERSÁRIO": opponent_goals,
        "SALDO DE GOLS": own_goals - opponent_goals if own_goals is not None and opponent_goals is not None else None,
        "COMPETIÇÃO": competition,
        "ESTÁDIO": stadium,
        "ESTÁDIO_ORIGINAL": stadium,
        "FONTE": "Meu Timão",
        "URL_FONTE": urljoin(page_url, link.get("href", "")),
        "LATITUDE": None,
        "LONGITUDE": None,
        "ERA": "2016-Presente" if match_date.year >= 2016 else "Até 2016"
    }


def fetch_season(session, modality, season):
    base_url = SOURCE_URLS[modality]
    page_url = f"{base_url}{season}"
    response = session.get(page_url, timeout=45)
    response.raise_for_status()
    text = response.text
    if "Just a moment" in text or "Attention Required" in text or "cf-chl-" in text:
        raise RuntimeError(f"Meu Timão respondeu com um desafio antibot em {page_url}; a base local foi mantida.")

    soup = BeautifulSoup(text, "html.parser")
    title = soup.title.get_text(" ", strip=True) if soup.title else ""
    if str(season) not in title or "Corinthians" not in title:
        raise RuntimeError(f"Título inesperado para {page_url}: {title!r}; a base local foi mantida.")

    cards = soup.select("li.calendar")
    if not cards:
        raise RuntimeError(f"A página não contém cartões de partidas em {page_url}; a base local foi mantida.")
    games = [
        game for card in cards
        if (game := parse_card(card, modality, season, page_url)) is not None
    ]
    return games, page_url


def scrape_all_matches():
    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT, "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.5"})
    results = {"Masculino": [], "Feminino": []}
    years = {
        "Masculino": range(1910, CURRENT_YEAR + 1),
        "Feminino": range(2016, CURRENT_YEAR + 1)
    }

    for modality, seasons in years.items():
        for season in seasons:
            games, page_url = fetch_season(session, modality, season)
            if modality == "Masculino" and not games:
                raise RuntimeError(f"Nenhum jogo masculino lido para {season} em {page_url}; a base local foi mantida.")
            results[modality].extend(games)
            print(f"{modality} {season}: {len(games)} partidas")
            time.sleep(0.25)
    return results


def game_signature(properties):
    date_value = str(properties.get("DATA", ""))[:10]
    home = normalize_name(properties.get("TIME MANDANTE"))
    away = normalize_name(properties.get("TIME VISITANTE"))

    def goal(value):
        try:
            return int(float(value))
        except (TypeError, ValueError):
            return None

    return date_value, home, away, goal(properties.get("GOLS MANDANTE")), goal(properties.get("GOLS VISITANTE"))


def female_game_year(properties):
    date_match = re.match(r"^(\d{4})", str(properties.get("DATA") or "").strip())
    if date_match:
        return int(date_match.group(1))
    try:
        return int(float(properties.get("ANO JOGO")))
    except (TypeError, ValueError):
        return None


def merge_female_game_sources(historical_games, meutimao_games):
    selected = {}
    sources = (
        (historical_games, "Daniel Keppler", FEMALE_HISTORY_START_YEAR, FEMALE_MEUTIMAO_START_YEAR, "1997-2015"),
        (meutimao_games, "Meu Timão", FEMALE_MEUTIMAO_START_YEAR, CURRENT_YEAR + 1, "2016-Presente")
    )

    for features, source, start_year, end_year, era in sources:
        for feature in features:
            properties = (feature.get("properties") or {})
            year = female_game_year(properties)
            if year is None or not start_year <= year < end_year:
                continue

            normalized_feature = deepcopy(feature)
            normalized_properties = dict(normalized_feature.get("properties") or {})
            normalized_properties["FONTE"] = source
            normalized_properties["MODALIDADE"] = "Feminino"
            normalized_properties["ANO JOGO"] = year
            normalized_properties["ERA"] = era
            normalized_feature["properties"] = normalized_properties

            signature = game_signature(normalized_properties)
            existing = selected.get(signature)
            if existing is None:
                selected[signature] = normalized_feature
                continue

            existing_properties = existing["properties"]
            for key, value in normalized_properties.items():
                if existing_properties.get(key) in (None, "") and value not in (None, ""):
                    existing_properties[key] = value

    return list(selected.values())


def brabas_competition_filter(properties):
    competition = normalize_name(properties.get("COMPETIÇÃO") or properties.get("COMPETICAO"))
    if "copadascampeas" in competition:
        return "COPA_DAS_CAMPEAS"
    if "copapaulista" in competition:
        return "COPA_PAULISTA"
    if "copadobrasil" in competition:
        return "COPA_DO_BRASIL"
    if "libertadores" in competition:
        return "LIBERTADORES"
    if "brasileiro" in competition or "brasileirao" in competition:
        return "BRASILEIRO"
    if "supercopa" in competition:
        return "SUPERCOPA"
    if "paulista" in competition:
        return "PAULISTA"
    if "amistoso" in competition:
        return "AMISTOSO"

    international_terms = (
        "mundial", "sulamericana", "mercosul", "mercosur", "conmebol",
        "feiradehidalgo", "ramondecarranza", "torneiointernacional",
        "internacional", "international", "intercontinental", "recopa",
        "interamericana", "copario", "fifa", "teal", "rosario"
    )
    if any(term in competition for term in international_terms):
        return "INTERNACIONAL"

    country = normalize_name(
        properties.get("PAIS_FONTE") or properties.get("PAIS") or properties.get("PAÍS")
    )
    if country and country not in {"brasil", "brazil", "br"}:
        return "INTERNACIONAL"
    return "OUTRAS"


def brabas_competition_display(properties, category):
    competition = str(properties.get("COMPETIÇÃO") or properties.get("COMPETICAO") or "").strip()
    competition_year = re.search(r"(?<!\d)(?:19|20)\d{2}(?!\d)", competition)
    year = int(competition_year.group()) if competition_year else female_game_year(properties)
    year_suffix = f" {year}" if year else ""
    if category == "COPA_DAS_CAMPEAS":
        return f"Copa das Campeãs{year_suffix}"
    if category == "LIBERTADORES":
        return f"Copa Libertadores Feminina{year_suffix}"
    if category == "BRASILEIRO":
        return f"Campeonato Brasileiro Feminino{year_suffix}"
    if category == "COPA_DO_BRASIL":
        return f"Copa do Brasil Feminina{year_suffix}"
    if category == "COPA_PAULISTA":
        return f"Copa Paulista Feminina{year_suffix}"
    if category == "PAULISTA":
        normalized = normalize_name(competition)
        organizer = "FPF" if "fpf" in normalized else "LINAF" if "linaf" in normalized else ""
        if organizer:
            return f"Campeonato Paulista Feminino / {organizer}"
        return f"Campeonato Paulista Feminino{year_suffix}"
    if category == "SUPERCOPA":
        return f"Supercopa Feminina{year_suffix}"

    normalized_labels = {
        "amistoso": "Amistoso",
        "jogosabertosdointerior": "Jogos Abertos do Interior",
        "tacabrasil": "Taça Brasil",
        "torneiodaprimavera": "Torneio da Primavera",
        "torneioinicio": "Torneio Início"
    }
    normalized = normalize_name(competition)
    return normalized_labels.get(normalized, competition)


def brabas_stadium_display(properties):
    names = (
        properties.get("ESTÁDIO"),
        properties.get("ESTADIO"),
        properties.get("ESTÁDIO_ORIGINAL")
    )
    aliases = {
        "emiratesstadiumarsenalstadium": "Emirates Stadium",
        "gtechcommunitystadium": "Gtech Community Stadium"
    }
    for name in names:
        label = aliases.get(normalize_name(name))
        if label:
            return label
    return ""


def write_brabas_bootstrap(matches=None):
    if matches is None:
        matches = read_collection(DATA / "as_brabas" / "as_brabas_jogos.geojson").get("features", [])

    match_records = []
    for feature in matches:
        properties = dict(feature.get("properties") or {})
        category = brabas_competition_filter(properties)
        properties["COMPETICAO_FILTRO"] = category
        properties["COMPETICAO_EXIBICAO"] = brabas_competition_display(properties, category)
        stadium_display = brabas_stadium_display(properties)
        if stadium_display:
            properties["ESTADIO_EXIBICAO"] = stadium_display
        match_records.append(properties)

    match_records.sort(key=lambda properties: str(properties.get("DATA") or ""), reverse=True)

    payload = {
        "schema_version": 3,
        "matches": match_records
    }
    serialized = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    output_paths = [DATA / "as_brabas" / "brabas_bootstrap.json"]
    local_data_dir = ROOT.parent / "AS BRABAS" / "DADOS-LOCAIS"
    if local_data_dir.is_dir():
        output_paths.append(local_data_dir / "brabas_bootstrap.json")

    for output_path in output_paths:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        temporary_path = output_path.with_suffix(output_path.suffix + ".tmp")
        temporary_path.write_text(serialized, encoding="utf-8")
        temporary_path.replace(output_path)


def write_map_ready_stadium_files(
    male_features=None,
    male_matches=None,
    male_unlocated=(),
    female_features=None,
    female_matches=None,
    female_unlocated=()
):
    from qgis_stadium_export import build_qgis_stadium_features

    if male_features is not None:
        male_export = build_qgis_stadium_features(
            male_features,
            male_matches or [],
            male_unlocated,
            "MASCULINO"
        )
        write_collection(
            DATA / "estadios" / "estadios_estatisticas_unificadas.geojson",
            "estadios_estatisticas_unificadas",
            male_export
        )

    if female_features is not None:
        female_export = build_qgis_stadium_features(
            female_features,
            female_matches or [],
            female_unlocated,
            "BRABAS"
        )
        write_collection(
            DATA / "as_brabas" / "as_brabas_estadios_unificadas.geojson",
            "as_brabas_estadios_unificadas",
            female_export
        )
        write_brabas_bootstrap(female_matches or [])


def rebuild_map_ready_stadium_layers():
    world = read_collection(DATA / "estadios" / "estadios_mundo.geojson")
    brabas_stats = read_collection(DATA / "as_brabas" / "as_brabas_estadios.geojson")
    brabas_matches = read_collection(DATA / "as_brabas" / "as_brabas_jogos.geojson")
    male_matches = read_collection(DATA / "partidas" / "corinthians_masculino.geojson")

    male_registry = build_coordinate_registry([world, brabas_stats, brabas_matches])
    female_registry = build_coordinate_registry([brabas_stats, brabas_matches, world])
    male_features, male_unlocated = aggregate_stadiums(
        male_matches.get("features", []),
        male_registry,
        world.get("features", []),
        recalculate_empty_statistics=True
    )
    female_features, female_unlocated = aggregate_stadiums(
        brabas_matches.get("features", []),
        female_registry,
        brabas_stats.get("features", []),
        canonicalize_female_stadiums=True,
        recalculate_empty_statistics=True
    )

    write_map_ready_stadium_files(
        male_features=male_features,
        male_matches=male_matches.get("features", []),
        male_unlocated=male_unlocated,
        female_features=female_features,
        female_matches=brabas_matches.get("features", []),
        female_unlocated=female_unlocated
    )
    print({
        "male_matches": len(male_matches.get("features", [])),
        "male_stadium_features": len(male_features),
        "male_games_in_stadiums": sum(int((feature.get("properties") or {}).get("TOTAL_JOGOS") or 0) for feature in male_features),
        "male_unlocated": len(male_unlocated),
        "brabas_matches": len(brabas_matches.get("features", [])),
        "brabas_stadium_features": len(female_features),
        "brabas_games_in_stadiums": sum(int((feature.get("properties") or {}).get("TOTAL_JOGOS") or 0) for feature in female_features),
        "brabas_unlocated": len(female_unlocated)
    })


def as_feature(properties, coordinates=None, geometry=None):
    if geometry is None and coordinates:
        geometry = {"type": "Point", "coordinates": [coordinates[0], coordinates[1]]}
    return {"type": "Feature", "properties": properties, "geometry": geometry}


def format_address_from_geocoding(geocoding):
    if not geocoding:
        return None
    address = geocoding.get("address") or {}
    road = address.get("road") or address.get("street") or address.get("pedestrian") or address.get("footway") or address.get("amenity") or address.get("leisure")
    if road:
        return road

    display_name = geocoding.get("display_name") or ""
    if display_name:
        parts = [part.strip() for part in display_name.split(",") if part.strip()]
        road_like = next((part for part in parts if re.search(r"(?:rua|avenida|av\.|alameda|praça|travessa|estrada|rodovia|boulevard|logradouro|street|road|calle)", part, flags=re.I)), None)
        if road_like:
            return road_like
    return None


def attach_location(game, registry):
    properties = game["properties"]
    apply_venue_locality_correction(properties)
    original_name = properties.get("ESTÁDIO_ORIGINAL") or properties.get("ESTÁDIO_DETALHE") or properties.get("ESTÁDIO") or ""
    location = resolve_stadium(original_name, registry, venue_context(properties))
    if not location:
        return game

    longitude, latitude = location["coordinates"]
    properties["ESTÁDIO"] = location["name"]
    if "ESTÁDIO_DETALHE" in properties:
        properties["ESTÁDIO_DETALHE"] = location["name"]
    properties["LATITUDE"] = latitude
    properties["LONGITUDE"] = longitude
    geocoding = location.get("geocoding") or {}
    if geocoding:
        properties["PRECISAO_COORDENADAS"] = geocoding.get("precision") or "Estádio identificado"
        properties["FONTE_COORDENADAS"] = geocoding.get("source")
        properties["URL_FONTE_COORDENADAS"] = geocoding.get("source_url")
        properties["ATRIBUICAO_COORDENADAS"] = geocoding.get("attribution")
        address = format_address_from_geocoding(geocoding)
        if address:
            properties["ENDERECO"] = address
            properties["ENDERECO_FORMATADO"] = address
    game["geometry"] = {"type": "Point", "coordinates": [longitude, latitude]}
    return game


def enrich_existing_women_game(feature, registry):
    properties = feature.get("properties") or {}
    apply_venue_locality_correction(properties)
    stadium = properties.get("ESTÁDIO_ORIGINAL") or properties.get("ESTÁDIO") or properties.get("ESTÁDIO_DETALHE") or properties.get("ESTADIO") or ""
    location = resolve_stadium(stadium, registry, venue_context(properties))
    if location:
        properties.setdefault("FONTE", "Acervo histórico ATLAS1910")
        properties["ESTÁDIO"] = location["name"]
        properties["LATITUDE"] = location["coordinates"][1]
        properties["LONGITUDE"] = location["coordinates"][0]
        geocoding = location.get("geocoding") or {}
        if geocoding:
            properties["PRECISAO_COORDENADAS"] = geocoding.get("precision") or "Estádio identificado"
            properties["FONTE_COORDENADAS"] = geocoding.get("source")
            properties["URL_FONTE_COORDENADAS"] = geocoding.get("source_url")
            properties["ATRIBUICAO_COORDENADAS"] = geocoding.get("attribution")
            address = format_address_from_geocoding(geocoding)
            if address:
                properties["ENDERECO"] = address
                properties["ENDERECO_FORMATADO"] = address
        feature["geometry"] = {"type": "Point", "coordinates": list(location["coordinates"])}
    return feature


def aggregate_stadiums(
    games,
    registry,
    base_stats=None,
    canonicalize_female_stadiums=False,
    recalculate_empty_statistics=False
):
    base_stats = base_stats or []
    base_by_name = {}
    base_aliases = {}

    def canonical_name(name):
        name = canonical_stadium_name(name)
        name = canonical_stadium_alias(name)
        if canonicalize_female_stadiums:
            return canonical_female_stadium_name(name)
        return name

    def resolve_location(feature, stadium):
        properties = feature.get("properties") or {}
        location = resolve_stadium(stadium, registry, venue_context(properties))
        if location:
            return location

        coordinates = coordinate_of(feature)
        if not coordinates:
            properties = feature.get("properties") or {}
            try:
                coordinates = (float(properties["LONGITUDE"]), float(properties["LATITUDE"]))
            except (KeyError, TypeError, ValueError):
                return None
        return {
            "name": stadium,
            "coordinates": coordinates,
            "properties": feature.get("properties") or {}
        }

    def identity_for_location(location, name):
        renamed = renamed_stadium_group(name) or renamed_stadium_group(location.get("properties") or {})
        if renamed:
            return ("renamed", normalize_name(renamed["current_name"]))
        coordinates = location.get("coordinates") or ()
        rounded_coordinates = tuple(round(float(value), 6) for value in coordinates[:2])
        return ("venue", normalize_name(name), *rounded_coordinates)

    for feature in base_stats:
        properties = feature.get("properties") or {}
        name = properties.get("ESTÁDIO") or properties.get("ESTADIO") or ""
        if name:
            location = resolve_location(feature, name)
            normalized_name = canonical_name(location["name"] if location else name)
            key = identity_for_location(location or {"properties": properties}, normalized_name)
            base_aliases.setdefault(key, set()).update(feature_names(properties))
            base_aliases[key].add(str(name).strip())
            if key not in base_by_name:
                base_by_name[key] = deepcopy(feature)
                base_by_name[key].setdefault("properties", {})
                base_by_name[key]["properties"]["ESTÁDIO"] = normalized_name
                continue

            merged_properties = base_by_name[key].setdefault("properties", {})
            for property_name, value in properties.items():
                if merged_properties.get(property_name) in (None, "") and value not in (None, ""):
                    merged_properties[property_name] = value
            if not base_by_name[key].get("geometry") and feature.get("geometry"):
                base_by_name[key]["geometry"] = deepcopy(feature["geometry"])

    groups = {}
    unlocated = set()
    for feature in games:
        properties = feature.get("properties") or {}
        stadium = properties.get("ESTÁDIO") or properties.get("ESTADIO") or properties.get("ESTÁDIO_ORIGINAL") or properties.get("ESTÁDIO_DETALHE") or ""
        if is_unknown_venue(stadium):
            continue
        location = resolve_location(feature, stadium)
        if not location:
            unlocated.add(stadium)
            continue
        canonical_stadium = canonical_name(location["name"])
        location = {**location, "name": canonical_stadium}
        key = identity_for_location(location, canonical_stadium)
        base_aliases.setdefault(key, set()).add(str(stadium).strip())
        properties["ESTÁDIO"] = canonical_stadium
        longitude, latitude = location["coordinates"]
        properties["LATITUDE"] = latitude
        properties["LONGITUDE"] = longitude
        feature["geometry"] = {"type": "Point", "coordinates": [longitude, latitude]}
        group = groups.setdefault(key, {
            "location": location,
            "games": 0,
            "first_game": None,
            "last_game": None,
            "wins": 0,
            "draws": 0,
            "losses": 0,
            "goals_for": 0,
            "goals_against": 0,
            "known_results": 0,
            "sources": set(),
            "source_counts": {},
            "scored_games": 0,
            "aliases": set(base_aliases.get(key, set()))
        })
        group["aliases"].add(str(stadium).strip())
        source = properties.get("FONTE")
        if source:
            group["sources"].add(source)
            group["source_counts"][source] = group["source_counts"].get(source, 0) + 1
        group["games"] += 1
        first_game = group["first_game"]
        game_date = str(properties.get("DATA") or "")
        if game_date and (not first_game or game_date < str(first_game.get("DATA") or "")):
            group["first_game"] = properties
        last_game = group["last_game"]
        if game_date and (not last_game or game_date > str(last_game.get("DATA") or "")):
            group["last_game"] = properties
        result = properties.get("RESULTADO")
        if result in {"VITÓRIA", "EMPATE", "DERROTA"}:
            group["known_results"] += 1
            group["wins"] += result == "VITÓRIA"
            group["draws"] += result == "EMPATE"
            group["losses"] += result == "DERROTA"
        try:
            goals_for = int(float(properties.get("GOLS SCCP")))
        except (TypeError, ValueError):
            goals_for = None
        try:
            goals_against = int(float(properties.get("GOLS ADVERSÁRIO")))
        except (TypeError, ValueError):
            goals_against = None
        if goals_for is not None:
            group["goals_for"] += goals_for
        if goals_against is not None:
            group["goals_against"] += goals_against
        if goals_for is not None and goals_against is not None:
            group["scored_games"] += 1

    for key, feature in base_by_name.items():
        if key in groups:
            groups[key]["aliases"].update(base_aliases.get(key, set()))
            continue
        properties = feature.get("properties") or {}
        stadium = properties.get("ESTÁDIO") or properties.get("ESTADIO") or ""
        location = resolve_location(feature, stadium)
        if not location:
            if not is_unknown_venue(stadium):
                unlocated.add(stadium)
            continue
        location = {**location, "name": canonical_name(location["name"])}
        groups[key] = {
            "location": location,
            "games": 0,
            "first_game": None,
            "last_game": None,
            "wins": 0,
            "draws": 0,
            "losses": 0,
            "goals_for": 0,
            "goals_against": 0,
            "known_results": 0,
            "sources": set(),
            "source_counts": {},
            "scored_games": 0,
            "aliases": set(base_aliases.get(key, set()))
        }

    features = []
    for key, group in groups.items():
        location = group["location"]
        base = base_by_name.get(key, {})
        location_properties = location["properties"]
        base_properties = base.get("properties") or {}
        first_game = group["first_game"] or {}
        first_home = first_game.get("TIME MANDANTE") or ""
        first_away = first_game.get("TIME VISITANTE") or ""
        first_score = first_game.get("PLACAR") or ""
        last_game = group["last_game"] or {}
        last_home = last_game.get("TIME MANDANTE") or ""
        last_away = last_game.get("TIME VISITANTE") or ""
        last_score = last_game.get("PLACAR") or ""
        has_game_data = group["games"] > 0
        use_recomputed_values = has_game_data or recalculate_empty_statistics
        first_match = " ".join(part for part in (first_home, first_score, first_away) if part)
        first_date = first_game.get("DATA")
        first_year = female_game_year(first_game) if first_game else None
        if not use_recomputed_values:
            first_match = first_match or base_properties.get("PRIMEIRA_PARTIDA")
            first_date = first_date or base_properties.get("DATA_PRIMEIRA_PARTIDA")
            first_year = first_year or base_properties.get("ANO_PRIMEIRA_PARTIDA")
        renamed_group = renamed_stadium_group(location["name"])
        current_name = renamed_group["current_name"] if renamed_group else location["name"]
        history_names = [
            renamed_group.get("current_name"),
            renamed_group.get("previous_name"),
            *(renamed_group.get("aliases") or [])
        ] if renamed_group else []
        alternative_names = sorted({
            alias for alias in [*group["aliases"], *history_names]
            if alias and normalize_name(alias) != normalize_name(current_name)
        })
        if normalize_name(current_name) == normalize_name("Nubank Parque"):
            old_name_1, old_name_2 = "Parque Antarctica", "Allianz Parque"
        else:
            previous_name = renamed_group.get("previous_name") if renamed_group else None
            old_name_1 = previous_name or (alternative_names[0] if alternative_names else None)
            old_name_2 = next((name for name in alternative_names if normalize_name(name) != normalize_name(old_name_1)), None)
        properties = {
            "ESTÁDIO": current_name,
            "NOME_ATUAL": current_name,
            "NOME_ANTIGO_1": old_name_1,
            "NOME_ANTIGO_2": old_name_2,
            "CIDADE": base_properties.get("CIDADE") or location_properties.get("CIDADE") or location_properties.get("CITY"),
            "ESTADO": base_properties.get("ESTADO") or location_properties.get("ESTADO") or location_properties.get("STATE"),
            "PAÍS": base_properties.get("PAÍS") or location_properties.get("PAÍS") or location_properties.get("PAIS") or location_properties.get("COUNTRY"),
            "CAPACIDADE": base_properties.get("CAPACIDADE") or location_properties.get("CAPACIDADE"),
            "PRIMEIRA_PARTIDA": first_match or (None if recalculate_empty_statistics else base_properties.get("PRIMEIRA_PARTIDA")),
            "DATA_PRIMEIRA_PARTIDA": first_date,
            "ANO_PRIMEIRA_PARTIDA": first_year,
            "ADVERSARIO": first_game.get("ADVERSÁRIO") or (None if recalculate_empty_statistics else base_properties.get("ADVERSARIO")),
            "PLACAR": first_score or (None if recalculate_empty_statistics else base_properties.get("PLACAR")),
            "COMPETICAO_PRIMEIRA_PARTIDA": first_game.get("COMPETIÇÃO") or (None if recalculate_empty_statistics else base_properties.get("COMPETICAO_PRIMEIRA_PARTIDA")),
            "MANDO_PRIMEIRA_PARTIDA": first_game.get("MANDANTE / VISITANTE (SCCP)") or (None if recalculate_empty_statistics else base_properties.get("MANDO_PRIMEIRA_PARTIDA")),
            "FONTE_PRIMEIRA_PARTIDA": first_game.get("URL_FONTE") or (None if recalculate_empty_statistics else base_properties.get("FONTE_PRIMEIRA_PARTIDA")),
            "TOTAL_JOGOS": group["games"] if use_recomputed_values else base_properties.get("TOTAL_JOGOS", 0),
            "VITÓRIAS": group["wins"] if use_recomputed_values else base_properties.get("VITORIAS", base_properties.get("VITÓRIAS", 0)),
            "EMPATES": group["draws"] if use_recomputed_values else base_properties.get("EMPATES", 0),
            "DERROTAS": group["losses"] if use_recomputed_values else base_properties.get("DERROTAS", 0),
            "APROVEITAMENTO_PCT": round(((group["wins"] * 3 + group["draws"]) / (group["known_results"] * 3)) * 100, 1) if group["known_results"] else (0 if recalculate_empty_statistics else base_properties.get("APROVEITAMENTO_PCT", 0)),
            "GOLS_MARCADOS": group["goals_for"] if use_recomputed_values else base_properties.get("GOLS_MARCADOS", 0),
            "GOLS_SOFRIDOS": group["goals_against"] if use_recomputed_values else base_properties.get("GOLS_SOFRIDOS", 0),
            "SALDO_GOLS": group["goals_for"] - group["goals_against"] if use_recomputed_values else base_properties.get("SALDO_GOLS"),
            "GOLS_POR_PARTIDA": round(group["goals_for"] / group["games"], 2) if group["games"] else 0,
            "PONTOS_CAMPEONATO": group["wins"] * 3 + group["draws"],
            "JOGOS_COM_PLACAR": group["scored_games"],
            "JOGOS_SEM_PLACAR": group["games"] - group["scored_games"],
            "PARTIDAS_DANIEL_KEPPLER": sum(count for source, count in group["source_counts"].items() if normalize_name(source) == "danielkeppler"),
            "PARTIDAS_MEUTIMAO": sum(count for source, count in group["source_counts"].items() if normalize_name(source) == "meutimao"),
            "ASSISTENCIAS": base_properties.get("ASSISTENCIAS"),
            "ASSISTENCIAS_DISPONIVEIS": bool(base_properties.get("ASSISTENCIAS_DISPONIVEIS", False)),
            "DATA_ULTIMA_PARTIDA": last_game.get("DATA"),
            "ANO_ULTIMA_PARTIDA": female_game_year(last_game) if last_game else None,
            "ULTIMA_PARTIDA": " ".join(part for part in (last_home, last_score, last_away) if part),
            "ADVERSARIO_ULTIMA_PARTIDA": last_game.get("ADVERSÁRIO"),
            "PLACAR_ULTIMA_PARTIDA": last_score or None,
            "COMPETICAO_ULTIMA_PARTIDA": last_game.get("COMPETIÇÃO"),
            "MANDO_ULTIMA_PARTIDA": last_game.get("MANDANTE / VISITANTE (SCCP)"),
            "FONTE_ULTIMA_PARTIDA": last_game.get("FONTE"),
            "NOMES_ALTERNATIVOS": alternative_names,
            "FONTES_JOGOS": sorted(group["sources"]),
            "LATITUDE": location["coordinates"][1],
            "LONGITUDE": location["coordinates"][0]
        }
        if renamed_group:
            properties["NOME_ANTIGO"] = renamed_group["previous_name"]
            properties["FONTES_NOME_ANTIGO"] = renamed_group.get("sources", [])
        if location.get("geocoding"):
            properties["PRECISAO_COORDENADAS"] = location["geocoding"].get("precision") or "Estádio identificado"
            address = format_address_from_geocoding(location["geocoding"])
            if address:
                properties["ENDERECO"] = address
                properties["ENDERECO_FORMATADO"] = address
        for field in ("PRECISAO_COORDENADAS", "FONTE_COORDENADAS", "URL_FONTE_COORDENADAS", "ATRIBUICAO_COORDENADAS"):
            if location_properties.get(field):
                properties[field] = location_properties[field]
            elif location.get("geocoding") and field == "FONTE_COORDENADAS":
                properties[field] = location["geocoding"].get("source")
            elif location.get("geocoding") and field == "URL_FONTE_COORDENADAS":
                properties[field] = location["geocoding"].get("source_url")
            elif location.get("geocoding") and field == "ATRIBUICAO_COORDENADAS":
                properties[field] = location["geocoding"].get("attribution")
        features.append(as_feature(properties, location["coordinates"]))
    return sorted(features, key=lambda feature: feature["properties"]["ESTÁDIO"]), sorted(unlocated)


def rebuild_female_data():
    old_collection = read_collection(DATA / "as_brabas" / "as_brabas_jogos.geojson")
    meutimao_collection = read_collection(DATA / "partidas" / "corinthians_feminino_meutimao.geojson")
    base_stats_collection = read_collection(DATA / "as_brabas" / "as_brabas_estadios.geojson")
    world_collection = read_collection(DATA / "estadios" / "estadios_mundo.geojson")
    female_registry = build_coordinate_registry([
        base_stats_collection,
        old_collection,
        meutimao_collection,
        world_collection
    ])

    meutimao_games = merge_female_game_sources([], meutimao_collection.get("features", []))
    female_games = merge_female_game_sources(
        old_collection.get("features", []),
        meutimao_games
    )
    female_games = [attach_location(game, female_registry) for game in female_games]
    meutimao_games = [attach_location(game, female_registry) for game in meutimao_games]
    validate_domestic_competition_locations(female_games)

    female_stats, female_unlocated = aggregate_stadiums(
        female_games,
        female_registry,
        base_stats_collection.get("features", []),
        canonicalize_female_stadiums=True,
        recalculate_empty_statistics=True
    )
    female_stats = enrich_location_metadata(female_stats)
    female_home_games = [
        game for game in female_games
        if normalize_name((game.get("properties") or {}).get("MANDANTE / VISITANTE (SCCP)")) == "sim"
    ]
    female_home_stats, _ = aggregate_stadiums(
        female_home_games,
        female_registry,
        canonicalize_female_stadiums=True,
        recalculate_empty_statistics=True
    )
    female_home_stats = enrich_location_metadata(female_home_stats)
    female_world_stats = [
        feature for feature in female_stats
        if normalize_name((feature.get("properties") or {}).get("PAÍS")
                          or (feature.get("properties") or {}).get("PAIS"))
        not in {"", "brasil", "brazil"}
    ]

    write_collection(DATA / "partidas" / "corinthians_feminino_meutimao.geojson", "corinthians_feminino_meutimao", meutimao_games)
    write_collection(DATA / "as_brabas" / "as_brabas_jogos.geojson", "as_brabas_jogos", female_games)
    write_collection(DATA / "as_brabas" / "as_brabas_estadios.geojson", "as_brabas_estadios", female_stats)
    write_collection(DATA / "as_brabas" / "as_brabas_estadios_mandante.geojson", "as_brabas_estadios_mandante", female_home_stats)
    write_collection(DATA / "as_brabas" / "as_brabas_estadios_mundo.geojson", "as_brabas_estadios_mundo", female_world_stats)
    write_map_ready_stadium_files(
        female_features=female_stats,
        female_matches=female_games,
        female_unlocated=female_unlocated
    )

    sync_path = DATA / "meutimao_sync.json"
    sync_state = {}
    if sync_path.exists():
        try:
            sync_state = json.loads(sync_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            sync_state = {}
    female_state = sync_state.setdefault("feminino", {})
    unidentified_female_matches = unidentified_venue_matches(female_games)
    female_state.update({
        "fontes": {
            "Daniel Keppler": [FEMALE_HISTORY_START_YEAR, FEMALE_MEUTIMAO_START_YEAR - 1],
            "Meu Timão": [FEMALE_MEUTIMAO_START_YEAR, CURRENT_YEAR]
        },
        "temporadas_daniel_keppler": [FEMALE_HISTORY_START_YEAR, FEMALE_MEUTIMAO_START_YEAR - 1],
        "temporadas_meutimao": [FEMALE_MEUTIMAO_START_YEAR, CURRENT_YEAR],
        "partidas_daniel_keppler": sum(1 for game in female_games if (game.get("properties") or {}).get("FONTE") == "Daniel Keppler"),
        "partidas_meutimao": len(meutimao_games),
        "partidas_total_com_acervo_local": len(female_games),
        "partidas_total_unificadas": len(female_games),
        "estádios_com_coordenadas": len(female_stats),
        "estádios_sem_coordenadas": female_unlocated,
        "estádios_sem_coordenadas_total": len(female_unlocated),
        "partidas_sem_estadio_identificado": unidentified_female_matches,
        "partidas_sem_estadio_identificado_total": len(unidentified_female_matches)
    })
    sync_state["atualizado_em_utc"] = datetime.now(timezone.utc).isoformat()
    sync_path.write_text(json.dumps(sync_state, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"Feminino unificado: {len(female_games)} partidas ({female_state['partidas_daniel_keppler']} Daniel Keppler + {len(meutimao_games)} Meu Timão)")
    print(f"Estádios consolidados: {len(female_stats)}; pendências geográficas: {len(female_unlocated)}")
    print(f"Neo Química Arena: {next((p['TOTAL_JOGOS'] for p in (f.get('properties') or {} for f in female_stats) if normalize_name(p.get('ESTÁDIO')) == normalize_name('Neo Química Arena')), 0)} jogos")

def unidentified_venue_matches(games):
    pending = []
    seen = set()
    for feature in games:
        properties = feature.get("properties") or {}
        venue = properties.get("ESTÁDIO_DETALHE") or properties.get("ESTÁDIO") or properties.get("ESTADIO") or ""
        if is_unknown_venue(venue):
            signature = properties.get("MEUTIMAO_ID") or properties.get("URL_FONTE") or (
                properties.get("DATA"),
                properties.get("TIME MANDANTE"),
                properties.get("TIME VISITANTE")
            )
            if signature in seen:
                continue
            seen.add(signature)
            pending.append({
                "meutimao_id": properties.get("MEUTIMAO_ID"),
                "data": properties.get("DATA"),
                "url_fonte": properties.get("URL_FONTE")
            })
    return pending


def main():
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8", errors="backslashreplace")

    if "--rebuild-feminino-only" in sys.argv:
        rebuild_female_data()
        return

    if "--rebuild-map-ready-stadium-layers-only" in sys.argv:
        rebuild_map_ready_stadium_layers()
        return

    if "--build-brabas-bootstrap-only" in sys.argv:
        write_brabas_bootstrap()
        return

    if "--location-metadata-only" in sys.argv:
        relative_paths = (
            "estadios/estadios_mundo.geojson",
            "estadios/estadios_masculinos_estatisticas.geojson",
            "partidas/corinthians_masculino.geojson",
            "as_brabas/as_brabas_estadios.geojson",
            "as_brabas/as_brabas_estadios_mandante.geojson",
            "as_brabas/as_brabas_estadios_mundo.geojson",
            "as_brabas/as_brabas_jogos.geojson",
            "partidas/corinthians_feminino_meutimao.geojson"
        )
        for relative_path in relative_paths:
            path = DATA / relative_path
            collection = read_collection(path)
            features = enrich_location_metadata(collection.get("features", []), reconcile_country=True)
            write_collection(path, collection.get("name", path.stem), features)
        rebuild_map_ready_stadium_layers()
        return

    male_registry = build_coordinate_registry([
        read_collection(DATA / "estadios" / "estadios_mundo.geojson"),
        read_collection(DATA / "as_brabas" / "as_brabas_estadios.geojson"),
        read_collection(DATA / "as_brabas" / "as_brabas_jogos.geojson")
    ])
    female_registry = build_coordinate_registry([
        read_collection(DATA / "as_brabas" / "as_brabas_estadios.geojson"),
        read_collection(DATA / "as_brabas" / "as_brabas_jogos.geojson"),
        read_collection(DATA / "estadios" / "estadios_mundo.geojson")
    ])

    if "--geocode-only" in sys.argv:
        print("Usando arquivos de partidas locais; coleta Meu Timão ignorada.", flush=True)
        male_games = read_collection(DATA / "partidas" / "corinthians_masculino.geojson").get("features", [])
        external_female_games = read_collection(DATA / "partidas" / "corinthians_feminino_meutimao.geojson").get("features", [])
        old_female_collection = read_collection(DATA / "as_brabas" / "as_brabas_jogos.geojson")
        female_games = merge_female_game_sources(
            old_female_collection.get("features", []),
            external_female_games
        )
    else:
        scraped = scrape_all_matches()
        male_games = [as_feature(game) for game in scraped["Masculino"]]
        external_female_games = [as_feature(game) for game in scraped["Feminino"]]
        old_female_collection = read_collection(DATA / "as_brabas" / "as_brabas_jogos.geojson")
        female_games = merge_female_game_sources(
            old_female_collection.get("features", []),
            external_female_games
        )

    enrich_venues_from_match_details(male_games + external_female_games + female_games, [male_registry, female_registry])
    male_matches_without_venue = unidentified_venue_matches(male_games)
    female_matches_without_venue = unidentified_venue_matches(female_games)
    geocode_cache = add_geocoded_venues(male_games + external_female_games + female_games, [male_registry, female_registry])
    male_games = [attach_location(game, male_registry) for game in male_games]
    external_female_games = [attach_location(game, female_registry) for game in external_female_games]
    female_games = [attach_location(game, female_registry) for game in female_games]
    validate_domestic_competition_locations(male_games + external_female_games + female_games)

    base_male_stats = read_collection(DATA / "estadios" / "estadios_mundo.geojson").get("features", [])
    male_stats, male_unlocated = aggregate_stadiums(
        male_games,
        male_registry,
        base_male_stats,
        recalculate_empty_statistics=True
    )
    base_female_stats = read_collection(DATA / "as_brabas" / "as_brabas_estadios.geojson").get("features", [])
    female_stats, female_unlocated = aggregate_stadiums(
        female_games,
        female_registry,
        base_female_stats,
        canonicalize_female_stadiums=True,
        recalculate_empty_statistics=True
    )
    male_stats = enrich_location_metadata(male_stats)
    female_stats = enrich_location_metadata(female_stats)

    write_collection(DATA / "partidas" / "corinthians_masculino.geojson", "corinthians_masculino", male_games)
    write_collection(DATA / "partidas" / "corinthians_feminino_meutimao.geojson", "corinthians_feminino_meutimao", external_female_games)
    write_collection(DATA / "as_brabas" / "as_brabas_jogos.geojson", "as_brabas_jogos", female_games)
    write_collection(DATA / "estadios" / "estadios_masculinos_estatisticas.geojson", "estadios_masculinos_estatisticas", male_stats)
    write_collection(DATA / "as_brabas" / "as_brabas_estadios.geojson", "as_brabas_estadios", female_stats)
    from enrich_estadios_mundo import enrich_all_stadiums
    enrich_all_stadiums(write_statistics=False)
    rebuild_map_ready_stadium_layers()

    state = {
        "fonte": "Meu Timão",
        "atualizado_em_utc": datetime.now(timezone.utc).isoformat(),
        "masculino": {
            "temporadas": [1910, CURRENT_YEAR],
            "partidas": len(male_games),
            "estádios_com_coordenadas": len(male_stats),
            "estádios_sem_coordenadas": male_unlocated,
            "estádios_sem_coordenadas_total": len(male_unlocated),
            "partidas_sem_estadio_identificado": male_matches_without_venue,
            "partidas_sem_estadio_identificado_total": len(male_matches_without_venue)
        },
        "feminino": {
            "fontes": {
                "Daniel Keppler": [FEMALE_HISTORY_START_YEAR, FEMALE_MEUTIMAO_START_YEAR - 1],
                "Meu Timão": [FEMALE_MEUTIMAO_START_YEAR, CURRENT_YEAR]
            },
            "partidas_daniel_keppler": sum(
                1 for feature in female_games
                if (feature.get("properties") or {}).get("FONTE") == "Daniel Keppler"
            ),
            "temporadas_meutimao": [2016, CURRENT_YEAR],
            "partidas_meutimao": len(external_female_games),
            "partidas_total_com_acervo_local": len(female_games),
            "partidas_total_unificadas": len(female_games),
            "estádios_com_coordenadas": len(female_stats),
            "estádios_sem_coordenadas": female_unlocated,
            "estádios_sem_coordenadas_total": len(female_unlocated),
            "partidas_sem_estadio_identificado": female_matches_without_venue,
            "partidas_sem_estadio_identificado_total": len(female_matches_without_venue)
        }
    }
    state["geocodificacao"] = {
        "cache": "data/estadio_geocoding_cache.json",
        "detalhes_partidas_cache": "data/meutimao_venue_details.json",
        "estádios_geocodificados": sum(1 for record in geocode_cache.values() if record.get("longitude") is not None),
        "fontes": ["Meu Timão", "OpenStreetMap Nominatim", "Wikipedia", "Wikidata"],
        "atribuição_osm": "© OpenStreetMap contributors, ODbL 1.0"
    }
    DATA.joinpath("meutimao_sync.json").write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Masculino: {len(male_games)} partidas, {len(male_stats)} estádios localizados")
    print(f"Feminino: {len(female_games)} partidas totais ({len(external_female_games)} lidas no Meu Timão), {len(female_stats)} estádios localizados")
    print(f"Sem coordenadas no masculino: {len(male_unlocated)} estádios únicos")
    print(f"Sem coordenadas no feminino: {len(female_unlocated)} estádios únicos")
    if male_unlocated or female_unlocated:
        print("Pendências geográficas gravadas em data/meutimao_sync.json; não foram atribuídas coordenadas por aproximação.")


if __name__ == "__main__":
    main()