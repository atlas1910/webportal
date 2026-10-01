"""Fill missing stadium capacities from StadiumDB country tables."""

import json
import re
import time
import unicodedata
from pathlib import Path
from datetime import datetime, timezone
from urllib.parse import urljoin, urlsplit

import requests
from bs4 import BeautifulSoup


ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
STADIUMS_URL = "https://stadiumdb.com/stadiums"
USER_AGENT = "Mozilla/5.0 (compatible; ATLAS1910/1.0; +https://atlas1910.vercel.app/)"
MEUTIMAO_CACHE_PATH = DATA / "meutimao_capacity_cache.json"
MEUTIMAO_CACHE_TTL_DAYS = 90
DATASET_PATHS = (
    DATA / "estadios" / "estadios_mundo.geojson",
    DATA / "estadios" / "estadios_masculinos_estatisticas.geojson",
    DATA / "estadios" / "estadios_estatisticas_unificadas.geojson",
    DATA / "as_brabas" / "as_brabas_estadios.geojson",
    DATA / "as_brabas" / "as_brabas_estadios_unificadas.geojson",
    DATA / "as_brabas" / "as_brabas_estadios_mundo.geojson",
    DATA / "as_brabas" / "as_brabas_estadios_mandante.geojson",
)


def normalize(value):
    text = unicodedata.normalize("NFKD", str(value or ""))
    text = text.encode("ascii", "ignore").decode("ascii").lower()
    return re.sub(r"[^a-z0-9]", "", text)


def numeric_capacity(value):
    digits = re.sub(r"\D", "", str(value or ""))
    try:
        capacity = int(digits)
    except ValueError:
        return None
    return capacity if 100 <= capacity <= 500000 else None


def existing_capacity(properties):
    try:
        capacity = int(float(str(properties.get("CAPACIDADE", "")).replace(",", ".")))
    except (TypeError, ValueError):
        return None
    return capacity if 0 < capacity <= 500000 else None


def feature_names(properties):
    names = [
        properties.get("ESTÁDIO"), properties.get("ESTADIO"),
        properties.get("ESTÁDIO_ORIGINAL"), properties.get("NOME_OFICIAL"),
        properties.get("Name"), properties.get("NOME_ANTIGO"),
        properties.get("ESTÁDIO_DETALHE"), properties.get("ESTADIO_DETALHE"),
    ]
    names.extend(properties.get("NOMES_ALTERNATIVOS") or [])
    return [name for name in names if isinstance(name, str) and name.strip()]


def load_collection(path):
    return json.loads(path.read_text(encoding="utf-8"))


def get_stadiumdb_countries(session):
    response = session.get(STADIUMS_URL, timeout=30)
    response.raise_for_status()
    soup = BeautifulSoup(response.text, "html.parser")
    urls = set()
    for anchor in soup.select('a[href^="/stadiums/"]'):
        path = urlsplit(anchor.get("href", "")).path.strip("/")
        parts = path.split("/")
        if len(parts) == 2 and parts[0] == "stadiums" and re.fullmatch(r"[a-z]{3}", parts[1]):
            urls.add(urljoin(STADIUMS_URL, f"/{path}"))
    for anchor in soup.select('a[href*="stadiumdb.com/stadiums/"]'):
        parsed = urlsplit(anchor.get("href", ""))
        parts = parsed.path.strip("/").split("/")
        if parsed.hostname == "stadiumdb.com" and len(parts) == 2 and parts[0] == "stadiums" and re.fullmatch(r"[a-z]{3}", parts[1]):
            urls.add(f"https://stadiumdb.com/{'/'.join(parts)}")
    if not urls:
        title = soup.title.get_text(" ", strip=True) if soup.title else "sem título"
        raise RuntimeError(
            f"StadiumDB não retornou links de país (HTTP {response.status_code}, "
            f"título: {title!r}); nada foi alterado."
        )
    return sorted(urls)


def parse_country_table(html_text, country_url):
    soup = BeautifulSoup(html_text, "html.parser")
    records = []
    for table in soup.find_all("table"):
        rows = table.find_all("tr")
        if not rows:
            continue
        headers = [normalize(cell.get_text(" ", strip=True)) for cell in rows[0].find_all(["th", "td"])]
        if not {"name", "city", "capacity"}.issubset(headers):
            continue
        indexes = {header: index for index, header in enumerate(headers)}
        for row in rows[1:]:
            cells = row.find_all(["th", "td"])
            if len(cells) <= max(indexes.values()):
                continue
            name_cell = cells[indexes["name"]]
            anchor = name_cell.find("a", href=True)
            name = (anchor or name_cell).get_text(" ", strip=True)
            city = cells[indexes["city"]].get_text(" ", strip=True)
            capacity = numeric_capacity(cells[indexes["capacity"]].get_text(" ", strip=True))
            if not name or not city or not capacity:
                continue
            records.append({
                "name": name,
                "city": city,
                "capacity": capacity,
                "url": urljoin(country_url, anchor["href"]) if anchor else country_url,
            })
    return records


def parse_meutimao_capacity(html_text):
    soup = BeautifulSoup(html_text, "html.parser")
    text_nodes = [re.sub(r"\s+", " ", value).strip() for value in soup.stripped_strings]
    capacities = []
    for index, value in enumerate(text_nodes):
        if normalize(value.rstrip(":")) != "capacidade":
            continue
        for candidate in text_nodes[index + 1:index + 4]:
            match = re.search(r"(?<!\d)(\d{1,3}(?:\.\d{3})+|\d{3,})(?!\d)", candidate)
            if match:
                capacity = numeric_capacity(match.group(1))
                if capacity:
                    capacities.append(capacity)
                    break
    return capacities[-1] if capacities else None


def safe_meutimao_url(value):
    if not value:
        return None
    url = urljoin("https://www.meutimao.com.br/", value)
    parsed = urlsplit(url)
    if parsed.hostname not in {"meutimao.com.br", "www.meutimao.com.br"}:
        return None
    return url if parsed.path.startswith("/estadio/") else None


def build_meutimao_url_index(match_collections, venue_cache):
    url_index = {}

    def add(names, value):
        url = safe_meutimao_url(value)
        if not url:
            return
        for name in names:
            key = normalize(name)
            if key:
                url_index.setdefault(key, url)

    for collection in match_collections:
        for feature in collection.get("features") or []:
            properties = feature.get("properties") or {}
            add(feature_names(properties), properties.get("URL_ESTADIO_FONTE"))
    for record in venue_cache.values():
        add([record.get("original_name"), record.get("stadium_name")], record.get("stadium_url"))
    return url_index


def get_meutimao_sitemap_urls(session):
    sitemap_urls = {}
    sitemap_paths = (
        "https://www.meutimao.com.br/xml/sitemap-dinamicas.xml",
        "https://www.meutimao.com.br/xml/sitemap-dinamicas-4.xml",
    )
    for sitemap_url in sitemap_paths:
        response = session.get(sitemap_url, timeout=30)
        response.raise_for_status()
        locations = re.findall(r"<loc>\s*(.*?)\s*</loc>", response.text, flags=re.I | re.S)
        for location in locations:
            url = safe_meutimao_url(location.strip())
            if not url:
                continue
            parsed = urlsplit(url)
            slug = normalize(parsed.path.rstrip("/").rsplit("/", 1)[-1])
            if slug:
                sitemap_urls.setdefault(slug, f"{parsed.scheme}://{parsed.netloc}{parsed.path}")
    return sitemap_urls


def meutimao_cache_is_fresh(entry):
    try:
        checked = datetime.fromisoformat(entry.get("checked_at", ""))
    except ValueError:
        return False
    if checked.tzinfo is None:
        checked = checked.replace(tzinfo=timezone.utc)
    return (datetime.now(timezone.utc) - checked).days < MEUTIMAO_CACHE_TTL_DAYS


def fetch_meutimao_capacity(url):
    try:
        response = requests.get(
            url,
            headers={"User-Agent": USER_AGENT, "Accept-Language": "pt-BR,pt;q=0.9"},
            timeout=25,
        )
        if response.status_code == 404:
            return {"status": 404, "capacity": None}
        response.raise_for_status()
        return {"status": response.status_code, "capacity": parse_meutimao_capacity(response.text)}
    except requests.RequestException as error:
        return {"status": "error", "capacity": None, "error": str(error)}


def is_name_match(feature_names_list, source_name):
    source_key = normalize(source_name)
    if not source_key:
        return False
    for feature_name in feature_names_list:
        feature_key = normalize(feature_name)
        if feature_key == source_key:
            return True
        if min(len(feature_key), len(source_key)) >= 8 and (
            feature_key in source_key or source_key in feature_key
        ):
            return True
    return False


def match_records(collections, stadium_records):
    matches = []
    for relative_path, collection in collections.items():
        for feature in collection.get("features") or []:
            properties = feature.setdefault("properties", {})
            names = feature_names(properties)
            city = normalize(properties.get("CIDADE"))
            if not names or not city:
                continue
            candidates = [
                record for record in stadium_records
                if is_name_match(names, record["name"])
                and normalize(record["city"]) == city
            ]
            if len(candidates) == 1:
                matches.append({
                    "path": relative_path,
                    "feature": feature,
                    "record": candidates[0],
                })
    return matches


def save_json(path, value):
    temporary_path = path.with_suffix(path.suffix + ".tmp")
    temporary_path.write_text(
        json.dumps(value, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    temporary_path.replace(path)


def main():
    session = requests.Session()
    session.headers.update({
        "User-Agent": USER_AGENT,
        "Accept-Language": "en-US,en;q=0.9",
    })
    country_urls = get_stadiumdb_countries(session)
    stadium_records = {}
    failed_countries = []
    for index, url in enumerate(country_urls, start=1):
        try:
            response = session.get(url, timeout=30)
            response.raise_for_status()
            for record in parse_country_table(response.text, url):
                stadium_records[record["url"]] = record
        except requests.RequestException as error:
            failed_countries.append((url, str(error)))
        if index % 10 == 0:
            print(f"StadiumDB: consultados {index}/{len(country_urls)} países", flush=True)
        time.sleep(0.25)

    collections = {
        str(path.relative_to(ROOT)): load_collection(path)
        for path in DATASET_PATHS if path.exists()
    }
    matches = match_records(collections, list(stadium_records.values()))
    match_collections = [
        load_collection(path) for path in (
            DATA / "partidas" / "corinthians_masculino.geojson",
            DATA / "as_brabas" / "as_brabas_jogos.geojson",
        ) if path.exists()
    ]
    venue_cache = json.loads((DATA / "meutimao_venue_details.json").read_text(encoding="utf-8"))
    meutimao_urls = build_meutimao_url_index(match_collections, venue_cache)
    meutimao_sitemap_urls = get_meutimao_sitemap_urls(session)
    meutimao_page_cache = (
        json.loads(MEUTIMAO_CACHE_PATH.read_text(encoding="utf-8"))
        if MEUTIMAO_CACHE_PATH.exists() else {}
    )
    missing_features = []
    for relative_path, collection in collections.items():
        for feature in collection.get("features") or []:
            properties = feature.get("properties") or {}
            if existing_capacity(properties):
                continue
            url = next((
                meutimao_urls.get(normalize(name))
                for name in feature_names(properties)
                if meutimao_urls.get(normalize(name))
            ), None)
            if not url:
                url = next((
                    meutimao_sitemap_urls.get(normalize(name))
                    for name in feature_names(properties)
                    if meutimao_sitemap_urls.get(normalize(name))
                ), None)
            if url:
                missing_features.append((relative_path, feature, url))

    meutimao_targets = sorted({
        url for _, _, url in missing_features
        if url not in meutimao_page_cache
        or not meutimao_cache_is_fresh(meutimao_page_cache[url])
    })
    for index, url in enumerate(meutimao_targets, start=1):
        meutimao_page_cache[url] = {
            **fetch_meutimao_capacity(url),
            "checked_at": datetime.now(timezone.utc).isoformat(),
        }
        if index % 25 == 0:
            print(f"Meu Timão: consultadas {index}/{len(meutimao_targets)} fichas", flush=True)
        time.sleep(0.35)

    meutimao_updates = 0
    for _, feature, url in missing_features:
        properties = feature["properties"]
        capacity = (meutimao_page_cache.get(url) or {}).get("capacity")
        if not capacity or existing_capacity(properties):
            continue
        properties["CAPACIDADE"] = str(capacity)
        properties["CAPACIDADE_FONTE"] = "Meu Timão"
        properties["URL_FONTE_CAPACIDADE"] = url
        meutimao_updates += 1

    updates = 0
    conflicts = []
    matched_features = set()
    for match in matches:
        feature = match["feature"]
        properties = feature["properties"]
        record = match["record"]
        matched_features.add((match["path"], id(feature)))
        old_capacity = existing_capacity(properties)
        if old_capacity is None:
            properties["CAPACIDADE"] = str(record["capacity"])
            properties["CAPACIDADE_FONTE"] = "StadiumDB.com"
            properties["URL_FONTE_CAPACIDADE"] = record["url"]
            updates += 1
        elif old_capacity != record["capacity"]:
            properties["CAPACIDADE_STADIUMDB"] = str(record["capacity"])
            properties["FONTE_CAPACIDADE_STADIUMDB"] = "StadiumDB.com"
            properties["URL_CAPACIDADE_STADIUMDB"] = record["url"]
            conflicts.append({
                "arquivo": match["path"],
                "estadio": next(iter(feature_names(properties)), record["name"]),
                "capacidade_atlas": old_capacity,
                "capacidade_stadiumdb": record["capacity"],
                "fonte_stadiumdb": record["url"],
            })

    for relative_path, collection in collections.items():
        save_json(ROOT / relative_path, collection)
    save_json(MEUTIMAO_CACHE_PATH, meutimao_page_cache)

    pending = []
    counts = {}
    for relative_path, collection in collections.items():
        features = collection.get("features") or []
        known = 0
        for feature in features:
            if existing_capacity(feature.get("properties") or {}):
                known += 1
            else:
                pending.append({
                    "arquivo": relative_path,
                    "estadio": next(iter(feature_names(feature.get("properties") or {})), "Estádio sem nome"),
                })
        counts[relative_path] = {"total": len(features), "com_capacidade": known}

    save_json(DATA / "estadios_capacidade_pendente.json", pending)
    save_json(DATA / "stadiumdb_capacity_conflicts.json", conflicts)
    print(f"Perfis de países disponíveis: {len(country_urls)}")
    print(f"Estádios listados pelo StadiumDB: {len(stadium_records)}")
    print(f"Correspondências seguras por nome e cidade: {len(matches)}")
    print(f"Capacidades adicionadas onde estavam ausentes: {updates}")
    print(f"Capacidades adicionadas a partir do Meu Timão: {meutimao_updates}")
    print(f"Fichas disponíveis no sitemap do Meu Timão: {len(meutimao_sitemap_urls)}")
    print(f"Conflitos preservados para revisão: {len(conflicts)}")
    print(f"Sem capacidade após a consulta: {len(pending)}")
    print(f"Falhas ao consultar países: {len(failed_countries)}")
    for relative_path, result in counts.items():
        print(f"{relative_path}: {result['com_capacidade']}/{result['total']}")
    if failed_countries:
        for url, error in failed_countries:
            print(f"Falha StadiumDB {url}: {error}")


if __name__ == "__main__":
    main()