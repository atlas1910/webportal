import json
import re
import unicodedata


COMMON_FIELDS = (
    "SECAO",
    "TIPO_REGISTRO",
    "NOME_ESTADIO",
    "NOME_ATUAL",
    "NOME_ANTIGO_1",
    "NOME_ANTIGO_2",
    "ESTADIO",
    "ESTÁDIO",
    "NOME_ANTIGO",
    "NOMES_ALTERNATIVOS",
    "CIDADE",
    "ESTADO",
    "PAÍS",
    "PAIS_ISO3",
    "CAPACIDADE",
    "LATITUDE",
    "LONGITUDE",
    "TOTAL_JOGOS",
    "VITORIAS",
    "VITÓRIAS",
    "EMPATES",
    "DERROTAS",
    "PONTOS_CAMPEONATO",
    "APROVEITAMENTO_PCT",
    "GOLS_MARCADOS",
    "GOLS_SOFRIDOS",
    "SALDO_GOLS",
    "GOLS_POR_PARTIDA",
    "ASSISTENCIAS",
    "ASSISTENCIAS_DISPONIVEIS",
    "ASSISTENCIAS_FONTE",
    "JOGOS_COM_PLACAR",
    "JOGOS_SEM_PLACAR",
    "PARTIDAS_DANIEL_KEPPLER",
    "PARTIDAS_MEUTIMAO",
    "FONTES_JOGOS",
    "DATA_PRIMEIRA_PARTIDA",
    "ANO_PRIMEIRA_PARTIDA",
    "PRIMEIRA_PARTIDA",
    "ADVERSARIO",
    "PLACAR",
    "COMPETICAO_PRIMEIRA_PARTIDA",
    "MANDO_PRIMEIRA_PARTIDA",
    "FONTE_PRIMEIRA_PARTIDA",
    "DATA_ULTIMA_PARTIDA",
    "ANO_ULTIMA_PARTIDA",
    "ULTIMA_PARTIDA",
    "ADVERSARIO_ULTIMA_PARTIDA",
    "PLACAR_ULTIMA_PARTIDA",
    "COMPETICAO_ULTIMA_PARTIDA",
    "MANDO_ULTIMA_PARTIDA",
    "FONTE_ULTIMA_PARTIDA",
    "NUM_ESTADIOS_NO_PONTO",
    "NUM_ESTADIOS_COM_JOGOS_NO_PONTO",
    "ESTADIOS_AGRUPADOS",
    "STATUS_GEOMETRIA",
    "PRECISAO_COORDENADAS",
    "FONTE_COORDENADAS",
    "URL_FONTE_COORDENADAS",
    "ATRIBUICAO_COORDENADAS",
)

CORE_STADIUM_NAMES = {
    "CAMPO DO LENHEIRO",
    "LENHEIRO",
    "PONTE GRANDE",
    "ALFREDO SCHURIG",
    "PARQUE SAO JORGE",
    "FAZENDINHA",
    "PACAEMBU",
    "ARENA CORINTHIANS",
    "NEO QUIMICA ARENA",
}


def _normalize(value):
    text = unicodedata.normalize("NFKD", str(value or ""))
    text = "".join(character for character in text if not unicodedata.combining(character))
    return re.sub(r"[^A-Z0-9]", "", text.upper())


def _number(properties, *fields):
    for field in fields:
        value = properties.get(field)
        try:
            return int(float(value))
        except (TypeError, ValueError):
            continue
    return 0


def _primary_name(properties):
    return str(
        properties.get("NOME_ATUAL")
        or properties.get("ESTÁDIO")
        or properties.get("ESTADIO")
        or properties.get("NOME_OFICIAL")
        or properties.get("Name")
        or "Estádio sem nome"
    ).strip()


def _names(properties):
    values = [
        properties.get("NOME_ATUAL"), properties.get("NOME_ANTIGO_1"),
        properties.get("NOME_ANTIGO_2"), properties.get("ESTÁDIO"), properties.get("ESTADIO"),
        properties.get("ESTÁDIO_ORIGINAL"), properties.get("NOME_OFICIAL"),
        properties.get("Name"), properties.get("NOME_ANTIGO"),
    ]
    alternatives = properties.get("NOMES_ALTERNATIVOS") or []
    if isinstance(alternatives, str):
        values.extend(re.split(r"\s*[|;]\s*", alternatives))
    elif isinstance(alternatives, (list, tuple, set)):
        values.extend(alternatives)
    return sorted({str(value).strip() for value in values if value and str(value).strip()})


def _identity(properties):
    names = {_normalize(name) for name in _names(properties) if _normalize(name)}
    locality = tuple(_normalize(properties.get(field)) for field in ("CIDADE", "ESTADO", "PAÍS", "PAIS"))
    return names, locality


def _identity_context_matches(first, second):
    first_names, first_locality = first
    second_names, second_locality = second
    if not first_names.intersection(second_names):
        return False

    first_city, first_state, first_country, first_country_alt = first_locality
    second_city, second_state, second_country, second_country_alt = second_locality
    for first_value, second_value in ((first_city, second_city), (first_state, second_state)):
        if first_value and second_value and first_value != second_value:
            if min(len(first_value), len(second_value)) < 6 or (
                first_value not in second_value and second_value not in first_value
            ):
                return False

    first_country = first_country or first_country_alt
    second_country = second_country or second_country_alt
    country_aliases = {
        "BRASIL": "BRA", "BRAZIL": "BRA", "BR": "BRA",
        "ESTADOSUNIDOS": "USA", "UNITEDSTATES": "USA", "EUA": "USA", "US": "USA",
    }
    first_country = country_aliases.get(first_country, first_country)
    second_country = country_aliases.get(second_country, second_country)
    return not first_country or not second_country or first_country == second_country


def _geometry_key(feature):
    geometry = feature.get("geometry") or {}
    coordinates = geometry.get("coordinates") or []
    if geometry.get("type") != "Point" or len(coordinates) < 2:
        return None
    try:
        return tuple(round(float(value), 6) for value in coordinates[:2])
    except (TypeError, ValueError):
        return None


def _qgis_scalar(value):
    if isinstance(value, dict):
        return json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    if isinstance(value, (list, tuple, set)):
        values = sorted(value) if isinstance(value, set) else value
        return " | ".join(str(item) for item in values if item is not None)
    return value


def _first_last(members, date_field):
    values = [member.get(date_field) for member in members if member.get(date_field)]
    return min(values) if values else None, max(values) if values else None


def _venue_detail(feature):
    properties = feature.get("properties") or {}
    return {
        "nome": _primary_name(properties),
        "nome_atual": properties.get("NOME_ATUAL") or _primary_name(properties),
        "nome_antigo_1": properties.get("NOME_ANTIGO_1"),
        "nome_antigo_2": properties.get("NOME_ANTIGO_2"),
        "nomes_alternativos": _names(properties),
        "cidade": properties.get("CIDADE"),
        "estado": properties.get("ESTADO"),
        "pais": properties.get("PAÍS") or properties.get("PAIS"),
        "capacidade": properties.get("CAPACIDADE"),
        "jogos": _number(properties, "TOTAL_JOGOS"),
        "vitorias": _number(properties, "VITORIAS", "VITÓRIAS"),
        "empates": _number(properties, "EMPATES"),
        "derrotas": _number(properties, "DERROTAS"),
        "gols_marcados": _number(properties, "GOLS_MARCADOS"),
        "gols_sofridos": _number(properties, "GOLS_SOFRIDOS"),
        "data_primeira_partida": properties.get("DATA_PRIMEIRA_PARTIDA"),
        "data_ultima_partida": properties.get("DATA_ULTIMA_PARTIDA"),
    }


def _representative_score(feature):
    properties = feature.get("properties") or {}
    normalized_names = {_normalize(name) for name in _names(properties)}
    core_match = any(
        _normalize(core_name) in normalized_names
        or any(_normalize(core_name) in name for name in normalized_names)
        for core_name in CORE_STADIUM_NAMES
    )
    has_coordinate_source = bool(properties.get("FONTE_COORDENADAS") or properties.get("PRECISAO_COORDENADAS"))
    return core_match, has_coordinate_source, _number(properties, "TOTAL_JOGOS"), _primary_name(properties)


def _merge_point_group(features, section):
    by_identity = []
    for feature in features:
        properties = feature.get("properties") or {}
        identity = _identity(properties)
        previous_index = next((
            index for index, previous in enumerate(by_identity)
            if _identity_context_matches(_identity(previous.get("properties") or {}), identity)
        ), None)
        if previous_index is None:
            by_identity.append({**feature, "properties": dict(properties)})
            continue

        previous = by_identity[previous_index]
        previous_properties = previous.get("properties") or {}
        duplicate_metrics = (
            _number(previous_properties, "TOTAL_JOGOS"),
            _number(previous_properties, "VITORIAS", "VITÓRIAS"),
            _number(previous_properties, "EMPATES"),
            _number(previous_properties, "DERROTAS"),
            _number(previous_properties, "GOLS_MARCADOS"),
            _number(previous_properties, "GOLS_SOFRIDOS"),
        )
        current_metrics = (
            _number(properties, "TOTAL_JOGOS"),
            _number(properties, "VITORIAS", "VITÓRIAS"),
            _number(properties, "EMPATES"),
            _number(properties, "DERROTAS"),
            _number(properties, "GOLS_MARCADOS"),
            _number(properties, "GOLS_SOFRIDOS"),
        )
        if duplicate_metrics != current_metrics:
            previous_games = duplicate_metrics[0]
            current_games = current_metrics[0]
            if previous_games == 0 < current_games:
                representative = {**feature, "properties": dict(properties)}
            elif current_games == 0 < previous_games:
                representative = previous
            else:
                raise ValueError(
                    f"Agregados conflitantes para o mesmo estádio em {section}: {_primary_name(properties)}"
                )
        else:
            representative = feature if _representative_score(feature) > _representative_score(previous) else previous

        merged_properties = dict(representative.get("properties") or {})
        aliases = sorted({
            name
            for candidate in (previous, feature)
            for name in _names(candidate.get("properties") or {})
            if _normalize(name) != _normalize(_primary_name(merged_properties))
        })
        if aliases:
            merged_properties["NOMES_ALTERNATIVOS"] = aliases
        by_identity[previous_index] = {**representative, "properties": merged_properties}

    members = by_identity
    representative = max(members, key=_representative_score)
    properties = dict(representative.get("properties") or {})
    details = sorted((_venue_detail(feature) for feature in members), key=lambda item: _normalize(item["nome"]))
    names = sorted({name for feature in members for name in _names(feature.get("properties") or {})})
    primary_name = _primary_name(representative.get("properties") or {})
    aliases = [name for name in names if _normalize(name) != _normalize(primary_name)]
    total_games = sum(item["jogos"] for item in details)
    wins = sum(item["vitorias"] for item in details)
    draws = sum(item["empates"] for item in details)
    losses = sum(item["derrotas"] for item in details)
    goals_for = sum(item["gols_marcados"] for item in details)
    goals_against = sum(item["gols_sofridos"] for item in details)
    first_date = min((item["data_primeira_partida"] for item in details if item["data_primeira_partida"]), default=None)
    last_date = max((item["data_ultima_partida"] for item in details if item["data_ultima_partida"]), default=None)
    known_results = wins + draws + losses

    properties.update({
        "SECAO": section,
        "TIPO_REGISTRO": "PONTO",
        "NOME_ESTADIO": primary_name,
        "NOME_ATUAL": (representative.get("properties") or {}).get("NOME_ATUAL") or primary_name,
        "NOME_ANTIGO_1": (representative.get("properties") or {}).get("NOME_ANTIGO_1"),
        "NOME_ANTIGO_2": (representative.get("properties") or {}).get("NOME_ANTIGO_2"),
        "ESTADIO": primary_name,
        "ESTÁDIO": primary_name,
        "NOMES_ALTERNATIVOS": " | ".join(aliases),
        "TOTAL_JOGOS": total_games,
        "VITORIAS": wins,
        "VITÓRIAS": wins,
        "EMPATES": draws,
        "DERROTAS": losses,
        "PONTOS_CAMPEONATO": wins * 3 + draws,
        "APROVEITAMENTO_PCT": round(((wins * 3 + draws) / (known_results * 3)) * 100, 1) if known_results else 0,
        "GOLS_MARCADOS": goals_for,
        "GOLS_SOFRIDOS": goals_against,
        "SALDO_GOLS": goals_for - goals_against,
        "GOLS_POR_PARTIDA": round(goals_for / total_games, 2) if total_games else 0,
        "ASSISTENCIAS": None,
        "ASSISTENCIAS_DISPONIVEIS": False,
        "ASSISTENCIAS_FONTE": "Não consta nos arquivos locais do Meu Timão ou Daniel Keppler.",
        "DATA_PRIMEIRA_PARTIDA": first_date,
        "DATA_ULTIMA_PARTIDA": last_date,
        "NUM_ESTADIOS_NO_PONTO": len(details),
        "NUM_ESTADIOS_COM_JOGOS_NO_PONTO": sum(item["jogos"] > 0 for item in details),
        "ESTADIOS_AGRUPADOS": json.dumps(details, ensure_ascii=False, separators=(",", ":")),
        "STATUS_GEOMETRIA": "PONTO_CONSOLIDADO",
        "LATITUDE": (representative.get("geometry") or {}).get("coordinates", [None, None])[1],
        "LONGITUDE": (representative.get("geometry") or {}).get("coordinates", [None, None])[0],
    })
    properties["FONTES_JOGOS"] = " | ".join(sorted({
        str(source)
        for feature in members
        for source in ((feature.get("properties") or {}).get("FONTES_JOGOS") or [])
        if source
    }))
    properties["PARTIDAS_DANIEL_KEPPLER"] = sum(_number(feature.get("properties") or {}, "PARTIDAS_DANIEL_KEPPLER") for feature in members)
    properties["PARTIDAS_MEUTIMAO"] = sum(_number(feature.get("properties") or {}, "PARTIDAS_MEUTIMAO") for feature in members)
    properties["JOGOS_COM_PLACAR"] = sum(_number(feature.get("properties") or {}, "JOGOS_COM_PLACAR") for feature in members)
    properties["JOGOS_SEM_PLACAR"] = sum(_number(feature.get("properties") or {}, "JOGOS_SEM_PLACAR") for feature in members)
    properties["JOGOS_SEM_GEOMETRIA"] = 0
    return {"type": "Feature", "geometry": representative.get("geometry"), "properties": properties}


def _summarize_unlocated_matches(matches, names, section):
    grouped = {}
    allowed_names = {_normalize(name) for name in names}
    unknown_names = {"DESCONHECIDO", "DESCONHECIDA", "INDEFINIDO", "INDEFINIDA", "NAOINFORMADO", "UNKNOWN", "SEMESTADIO"}
    for feature in matches:
        properties = feature.get("properties") or {}
        venue = properties.get("ESTÁDIO_DETALHE") or properties.get("ESTÁDIO") or properties.get("ESTADIO") or ""
        normalized_venue = _normalize(venue)
        if normalized_venue not in unknown_names and normalized_venue not in allowed_names:
            continue
        grouped.setdefault(normalized_venue or "SEMESTADIO", {"name": str(venue or "Estádio não identificado"), "matches": []})["matches"].append(properties)

    output = []
    for entry in grouped.values():
        records = entry["matches"]
        dates = sorted(str(record.get("DATA") or "") for record in records if record.get("DATA"))
        wins = sum(record.get("RESULTADO") == "VITÓRIA" for record in records)
        draws = sum(record.get("RESULTADO") == "EMPATE" for record in records)
        losses = sum(record.get("RESULTADO") == "DERROTA" for record in records)
        goals_for = sum(int(float(record.get("GOLS SCCP") or 0)) for record in records)
        goals_against = sum(int(float(record.get("GOLS ADVERSÁRIO") or 0)) for record in records)
        sources = sorted({str(record.get("FONTE")) for record in records if record.get("FONTE")})
        first = min(records, key=lambda record: str(record.get("DATA") or "9999"))
        last = max(records, key=lambda record: str(record.get("DATA") or ""))
        properties = {
            "SECAO": section,
            "TIPO_REGISTRO": "SEM_GEOMETRIA",
            "NOME_ESTADIO": entry["name"],
            "NOME_ATUAL": entry["name"],
            "ESTADIO": entry["name"],
            "ESTÁDIO": entry["name"],
            "CIDADE": first.get("CIDADE") or first.get("CIDADE_FONTE"),
            "ESTADO": first.get("ESTADO") or first.get("ESTADO_FONTE"),
            "PAÍS": first.get("PAÍS") or first.get("PAIS_FONTE"),
            "LATITUDE": None,
            "LONGITUDE": None,
            "TOTAL_JOGOS": len(records),
            "VITORIAS": wins,
            "VITÓRIAS": wins,
            "EMPATES": draws,
            "DERROTAS": losses,
            "PONTOS_CAMPEONATO": wins * 3 + draws,
            "APROVEITAMENTO_PCT": round(((wins * 3 + draws) / ((wins + draws + losses) * 3)) * 100, 1) if wins + draws + losses else 0,
            "GOLS_MARCADOS": goals_for,
            "GOLS_SOFRIDOS": goals_against,
            "SALDO_GOLS": goals_for - goals_against,
            "GOLS_POR_PARTIDA": round(goals_for / len(records), 2) if records else 0,
            "ASSISTENCIAS": None,
            "ASSISTENCIAS_DISPONIVEIS": False,
            "ASSISTENCIAS_FONTE": "Não consta nos arquivos locais do Meu Timão ou Daniel Keppler.",
            "JOGOS_COM_PLACAR": sum(record.get("GOLS SCCP") is not None and record.get("GOLS ADVERSÁRIO") is not None for record in records),
            "JOGOS_SEM_PLACAR": sum(record.get("GOLS SCCP") is None or record.get("GOLS ADVERSÁRIO") is None for record in records),
            "PARTIDAS_DANIEL_KEPPLER": sum(_normalize(record.get("FONTE")) == "DANIELKEPPLER" for record in records),
            "PARTIDAS_MEUTIMAO": sum(_normalize(record.get("FONTE")) == "MEUTIMAO" for record in records),
            "FONTES_JOGOS": " | ".join(sources),
            "DATA_PRIMEIRA_PARTIDA": dates[0] if dates else None,
            "DATA_ULTIMA_PARTIDA": dates[-1] if dates else None,
            "PRIMEIRA_PARTIDA": " ".join(str(first.get(key) or "") for key in ("TIME MANDANTE", "PLACAR", "TIME VISITANTE")).strip(),
            "ULTIMA_PARTIDA": " ".join(str(last.get(key) or "") for key in ("TIME MANDANTE", "PLACAR", "TIME VISITANTE")).strip(),
            "ADVERSARIO": first.get("ADVERSÁRIO"),
            "PLACAR": first.get("PLACAR"),
            "COMPETICAO_PRIMEIRA_PARTIDA": first.get("COMPETIÇÃO"),
            "MANDO_PRIMEIRA_PARTIDA": first.get("MANDANTE / VISITANTE (SCCP)"),
            "FONTE_PRIMEIRA_PARTIDA": first.get("URL_FONTE"),
            "ADVERSARIO_ULTIMA_PARTIDA": last.get("ADVERSÁRIO"),
            "PLACAR_ULTIMA_PARTIDA": last.get("PLACAR"),
            "COMPETICAO_ULTIMA_PARTIDA": last.get("COMPETIÇÃO"),
            "MANDO_ULTIMA_PARTIDA": last.get("MANDANTE / VISITANTE (SCCP)"),
            "FONTE_ULTIMA_PARTIDA": last.get("URL_FONTE"),
            "NUM_ESTADIOS_NO_PONTO": 0,
            "NUM_ESTADIOS_COM_JOGOS_NO_PONTO": 0,
            "ESTADIOS_AGRUPADOS": "[]",
            "STATUS_GEOMETRIA": "ESTADIO_NAO_IDENTIFICADO",
            "JOGOS_SEM_GEOMETRIA": len(records),
        }
        output.append({"type": "Feature", "geometry": None, "properties": properties})
    return output


def build_qgis_stadium_features(features, matches, unlocated_names, section):
    coordinate_groups = {}
    for feature in features:
        geometry = feature.get("geometry") or {}
        coordinates = geometry.get("coordinates") or []
        if geometry.get("type") != "Point" or len(coordinates) < 2:
            continue
        key = tuple(round(float(value), 6) for value in coordinates[:2])
        coordinate_groups.setdefault(key, []).append(feature)

    output = [
        _merge_point_group(members, section)
        for _, members in sorted(coordinate_groups.items())
    ]
    output.extend(_summarize_unlocated_matches(matches, unlocated_names, section))

    fields = set(COMMON_FIELDS)
    for feature in output:
        fields.update((feature.get("properties") or {}).keys())
    ordered_fields = [*COMMON_FIELDS, *sorted(fields - set(COMMON_FIELDS))]
    for feature in output:
        properties = feature.get("properties") or {}
        feature["properties"] = {
            field: _qgis_scalar(properties.get(field)) for field in ordered_fields
        }
    return output