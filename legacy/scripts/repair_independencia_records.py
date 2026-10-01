"""Repair Corinthians Independência fixtures that were geocoded to Tunja."""

from collections import Counter
from pathlib import Path

import sync_meutimao as sync


DATA = Path(__file__).resolve().parent.parent / "data"
ARENA_NAME = "Arena Independência"
BH_COORDINATES = [-43.9180009, -19.9087708]
TUNJA_COORDINATES = [-73.3533681, 5.5420478]
BH_CORRECTION = sync.VENUE_LOCALITY_CORRECTIONS["arenainindependencia"]
TUNJA_CORRECTION = sync.VENUE_LOCALITY_CORRECTIONS["laindependencia"]


def read(relative_path):
    return sync.read_collection(DATA / relative_path)


def write(relative_path, collection):
    sync.write_collection(
        DATA / relative_path,
        collection.get("name") or Path(relative_path).stem,
        collection.get("features", [])
    )


def set_locality(properties, correction, coordinates):
    properties["CIDADE"] = correction["city"]
    properties["ESTADO"] = "Minas Gerais" if correction["country"] == "Brasil" else correction["state"]
    properties["PAIS"] = correction["country"]
    if "PAÍS" in properties:
        properties["PAÍS"] = correction["country"]
    if "CIDADE_FONTE" in properties or "COMPETIÇÃO" in properties:
        properties["CIDADE_FONTE"] = correction["city"]
        properties["ESTADO_FONTE"] = properties["ESTADO"]
        properties["PAIS_FONTE"] = correction["country"]
    properties["LONGITUDE"], properties["LATITUDE"] = coordinates
    properties["FONTE_CORRECAO_LOCALIDADE"] = correction["source_url"]


def move_belo_horizonte_fixtures(collection):
    updated = 0
    for feature in collection.get("features", []):
        properties = feature.get("properties") or {}
        if sync.normalize_name(properties.get("ESTÁDIO_ORIGINAL")) != sync.normalize_name("Independência"):
            continue
        set_locality(properties, BH_CORRECTION, BH_COORDINATES)
        properties["ESTÁDIO"] = ARENA_NAME
        properties["ESTÁDIO_DETALHE"] = ARENA_NAME
        feature["geometry"] = {"type": "Point", "coordinates": BH_COORDINATES}
        updated += 1
    return updated


def set_tunja_statistics(feature):
    properties = feature.get("properties") or {}
    set_locality(properties, TUNJA_CORRECTION, TUNJA_COORDINATES)
    properties["TOTAL_JOGOS"] = 1
    properties["VITORIAS"] = 0
    properties["VITÓRIAS"] = 0
    properties["EMPATES"] = 1
    properties["DERROTAS"] = 0
    properties["APROVEITAMENTO_PCT"] = 33.3
    properties["GOLS_MARCADOS"] = 1
    properties["GOLS_SOFRIDOS"] = 1
    properties["PRIMEIRA_PARTIDA"] = "Patriotas 1 x 1 Corinthians"
    properties["DATA_PRIMEIRA_PARTIDA"] = "2017-06-28"
    properties["ANO_PRIMEIRA_PARTIDA"] = 2017
    properties["ADVERSARIO"] = "Patriotas"
    properties["PLACAR"] = "1 x 1"
    properties["COMPETICAO_PRIMEIRA_PARTIDA"] = "Copa Sul-Americana 2017"
    properties["MANDO_PRIMEIRA_PARTIDA"] = "Visitante"
    feature["geometry"] = {"type": "Point", "coordinates": TUNJA_COORDINATES}


def normalize_location_collections(world, male_statistics):
    for collection in (world, male_statistics):
        for feature in collection.get("features", []):
            properties = feature.get("properties") or {}
            name = properties.get("ESTADIO") or properties.get("ESTÁDIO") or ""
            normalized_name = sync.normalize_name(name)
            if normalized_name == sync.normalize_name(ARENA_NAME):
                set_locality(properties, BH_CORRECTION, BH_COORDINATES)
                feature["geometry"] = {"type": "Point", "coordinates": BH_COORDINATES}
            elif normalized_name == sync.normalize_name("La Independencia"):
                set_tunja_statistics(feature)


def rebuild_brabas_independencia(collection, matches):
    venue_matches = [
        feature for feature in matches.get("features", [])
        if sync.normalize_name((feature.get("properties") or {}).get("ESTÁDIO_ORIGINAL"))
        == sync.normalize_name("Independência")
    ]
    if not venue_matches:
        raise ValueError("Nenhuma partida feminina original da Arena Independência foi encontrada")

    wins = sum((feature.get("properties") or {}).get("RESULTADO") == "VITÓRIA" for feature in venue_matches)
    draws = sum((feature.get("properties") or {}).get("RESULTADO") == "EMPATE" for feature in venue_matches)
    losses = sum((feature.get("properties") or {}).get("RESULTADO") == "DERROTA" for feature in venue_matches)
    goals_for = sum(int((feature.get("properties") or {}).get("GOLS SCCP") or 0) for feature in venue_matches)
    goals_against = sum(int((feature.get("properties") or {}).get("GOLS ADVERSÁRIO") or 0) for feature in venue_matches)

    candidates = [
        feature for feature in collection.get("features", [])
        if "independencia" in sync.normalize_name(
            (feature.get("properties") or {}).get("ESTÁDIO")
            or (feature.get("properties") or {}).get("ESTADIO")
        )
        or "raimundosampaio" in sync.normalize_name(
            (feature.get("properties") or {}).get("ESTÁDIO")
            or (feature.get("properties") or {}).get("ESTADIO")
        )
    ]
    if not candidates:
        raise ValueError("Agregado feminino da Independência não foi encontrado")

    target = max(candidates, key=lambda feature: int((feature.get("properties") or {}).get("TOTAL_JOGOS") or 0))
    properties = target.get("properties") or {}
    properties.update({
        "ESTÁDIO": ARENA_NAME,
        "ESTADIO": ARENA_NAME,
        "NOME_OFICIAL": "Estádio Raimundo Sampaio",
        "CIDADE": "Belo Horizonte",
        "ESTADO": "Minas Gerais",
        "PAÍS": "Brasil",
        "CAPACIDADE": "23950",
        "TOTAL_JOGOS": len(venue_matches),
        "VITÓRIAS": wins,
        "VITORIAS": wins,
        "EMPATES": draws,
        "DERROTAS": losses,
        "APROVEITAMENTO_PCT": round(((wins * 3 + draws) / (len(venue_matches) * 3)) * 100, 1),
        "GOLS_MARCADOS": goals_for,
        "GOLS_SOFRIDOS": goals_against,
        "LATITUDE": -19.90848330206083,
        "LONGITUDE": -43.91854807059611,
        "NOMES_ALTERNATIVOS": ["Independência", "Estádio Raimundo Sampaio"]
    })
    target["geometry"] = {"type": "Point", "coordinates": [-43.91854807059611, -19.90848330206083]}
    collection["features"] = [
        feature for feature in collection["features"]
        if feature not in candidates or feature is target
    ]
    return len(venue_matches), wins, draws, losses


def main():
    paths = {
        "male": "partidas/corinthians_masculino.geojson",
        "female_external": "partidas/corinthians_feminino_meutimao.geojson",
        "female_games": "as_brabas/as_brabas_jogos.geojson",
        "world": "estadios/estadios_mundo.geojson",
        "male_statistics": "estadios/estadios_masculinos_estatisticas.geojson",
        "international": "estadios/estadios_mundo_internacionais.geojson",
        "brabas_statistics": "as_brabas/as_brabas_estadios.geojson",
        "brabas_world": "as_brabas/as_brabas_estadios_mundo.geojson",
        "brabas_home": "as_brabas/as_brabas_estadios_mandante.geojson"
    }
    collections = {key: read(path) for key, path in paths.items() if (DATA / path).exists()}
    moved = {key: move_belo_horizonte_fixtures(collections[key]) for key in ("male", "female_external", "female_games")}
    if moved["male"] != 26 or moved["female_external"] != 3 or moved["female_games"] != 3:
        raise ValueError(f"Quantidade inesperada de jogos Independência: {moved}")

    copa = [
        feature for feature in collections["male"]["features"]
        if "COPA DO BRASIL" in str((feature.get("properties") or {}).get("COMPETIÇÃO", "")).upper()
        and sync.normalize_name((feature.get("properties") or {}).get("ESTÁDIO_ORIGINAL"))
        == sync.normalize_name("Independência")
    ]
    results = Counter((feature.get("properties") or {}).get("RESULTADO") for feature in copa)
    if len(copa) != 4 or results != Counter({"VITÓRIA": 1, "EMPATE": 1, "DERROTA": 2}):
        raise ValueError(f"Resultados inesperados da Copa do Brasil na Arena: {len(copa)} jogos, {dict(results)}")
    sync.validate_domestic_competition_locations(copa)

    sula_game = next(
        feature for feature in collections["male"]["features"]
        if str((feature.get("properties") or {}).get("MEUTIMAO_ID")) == "722"
    )
    set_locality(sula_game["properties"], TUNJA_CORRECTION, TUNJA_COORDINATES)
    sula_game["properties"].update({"ESTÁDIO": "La Independencia", "ESTÁDIO_DETALHE": "La Independencia"})
    sula_game["geometry"] = {"type": "Point", "coordinates": TUNJA_COORDINATES}

    normalize_location_collections(collections["world"], collections["male_statistics"])
    brabas_metrics = rebuild_brabas_independencia(collections["brabas_statistics"], collections["female_games"])

    tunja_feature = next(
        feature for feature in collections["world"]["features"]
        if sync.normalize_name((feature.get("properties") or {}).get("ESTADIO")) == sync.normalize_name("La Independencia")
    )
    arena_feature = next(
        feature for feature in collections["world"]["features"]
        if sync.normalize_name((feature.get("properties") or {}).get("ESTADIO")) == sync.normalize_name(ARENA_NAME)
    )
    if tunja_feature["geometry"]["coordinates"] != TUNJA_COORDINATES or (tunja_feature.get("properties") or {}).get("PAIS") != "Colombia":
        raise ValueError("A localização de La Independencia em Tunja não foi preservada")
    if arena_feature["geometry"]["coordinates"] != BH_COORDINATES or (arena_feature.get("properties") or {}).get("PAIS") != "Brasil":
        raise ValueError("A Arena Independência não está em Belo Horizonte")

    international = collections["international"]["features"]
    if not any(sync.normalize_name((feature.get("properties") or {}).get("ESTADIO")) == sync.normalize_name("La Independencia") for feature in international):
        international.append(tunja_feature)
    for key in ("brabas_world", "brabas_home"):
        if key in collections:
            collections[key]["features"] = [
                feature for feature in collections[key].get("features", [])
                if sync.normalize_name((feature.get("properties") or {}).get("ESTÁDIO") or (feature.get("properties") or {}).get("ESTADIO")) != sync.normalize_name("La Independencia")
            ]

    for key, collection in collections.items():
        write(paths[key], collection)

    sync.rebuild_map_ready_stadium_layers()

    print({
        "moved_matches_to_belo_horizonte": moved,
        "copa_do_brasil": dict(results),
        "sul_americana_2017": sula_game["geometry"]["coordinates"],
        "tunja_games": (tunja_feature["properties"].get("TOTAL_JOGOS"), tunja_feature["properties"].get("VITORIAS"), tunja_feature["properties"].get("EMPATES"), tunja_feature["properties"].get("DERROTAS")),
        "brabas_statistics": brabas_metrics
    })


if __name__ == "__main__":
    main()