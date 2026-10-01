"""
ATLAS1910 - Enriquecimento e Organização Estruturada da Base de Estádios do Corinthians
Atualiza ESTADIOS_MUNDO.gpkg, estadios_mundo.geojson, estadios_mundo_internacionais.geojson
e estadios_masculinos_estatisticas.geojson com atributos separados e padronizados.
"""

import json
import re
import html
import unicodedata
from datetime import datetime
from pathlib import Path
import geopandas as gpd
import pyogrio

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
ESTADIOS_DIR = DATA_DIR / "estadios"
PARTIDAS_DIR = DATA_DIR / "partidas"
STADIUM_NAME_HISTORY_PATH = DATA_DIR / "estadio_name_history.json"

def normalize_name(val):
    if not val:
        return ""
    text = unicodedata.normalize("NFKD", str(val))
    text = text.encode("ascii", "ignore").decode("ascii").lower()
    return re.sub(r"[^a-z0-9]", "", text)


STADIUM_NAME_HISTORY = json.loads(STADIUM_NAME_HISTORY_PATH.read_text(encoding="utf-8")).get("stadiums", [])


def renamed_stadium_group(value):
    values = value if isinstance(value, (list, tuple, set)) else [value]
    normalized_names = {normalize_name(name) for name in values if normalize_name(name)}
    for group in STADIUM_NAME_HISTORY:
        aliases = [group.get("current_name"), group.get("previous_name"), *(group.get("aliases") or [])]
        if normalized_names.intersection(normalize_name(alias) for alias in aliases if alias):
            return group
    return None

# Dicionário de Sinônimos e Mapeamento de Estádios para o acervo histórico
ESTADIO_ALIASES = {
    normalize_name("Neo Quimica Arena"): [normalize_name("Arena Corinthians"), normalize_name("Neo Quimica Arena")],
    normalize_name("Pacaembu"): [normalize_name("Pacaembu"), normalize_name("Estadio do Pacaembu"), normalize_name("Paulo Machado de Carvalho")],
    normalize_name("Morumbi"): [normalize_name("Morumbi"), normalize_name("Cicero Pompeu de Toledo")],
    normalize_name("Parque Sao Jorge"): [normalize_name("Parque Sao Jorge"), normalize_name("Fazendinha"), normalize_name("Alfredo Schurig"), normalize_name("Estadio Alfredo Schurig")],
    normalize_name("Caninde"): [normalize_name("Caninde"), normalize_name("Estadio do Caninde"), normalize_name("Oswaldo Teixeira Duarte")],
    normalize_name("Parque Antarctica"): [normalize_name("Palestra Italia"), normalize_name("Parque Antarctica"), normalize_name("Parque Antarctica"), normalize_name("Allianz Parque")],
    normalize_name("Allianz Parque"): [normalize_name("Allianz Parque"), normalize_name("Palestra Italia"), normalize_name("Parque Antarctica")],
    normalize_name("Maracana"): [normalize_name("Maracana"), normalize_name("Estadio do Maracana"), normalize_name("Jornalista Mario Filho")],
    normalize_name("Vila Belmiro"): [normalize_name("Vila Belmiro"), normalize_name("Urbano Caldeira")],
    normalize_name("Nissam Stadium"): [normalize_name("Internacional de Yokohama"), normalize_name("Yokohama"), normalize_name("Nissan Stadium")],
    normalize_name("Centenario"): [normalize_name("Centenario"), normalize_name("Estadio Centenario")],
    normalize_name("Defensores del Chaco"): [normalize_name("Defensores del Chaco")],
    normalize_name("La Bombonera"): [normalize_name("Bombonera"), normalize_name("Alberto J Armando")],
    normalize_name("El Cilindro"): [normalize_name("Presidente Peron"), normalize_name("El Cilindro")],
    normalize_name("Monumental de Nunez"): [normalize_name("Monumental de Nunez"), normalize_name("Antonio Vespucio Liberti"), normalize_name("Monumental de Nunez")],
    normalize_name("Arena Botafogo"): [normalize_name("Arena Botafogo"), normalize_name("Estadio Luso-Brasileiro")],
    normalize_name("Arena Botafogo (Ilha do Governador)"): [normalize_name("Arena Botafogo"), normalize_name("Estadio Luso-Brasileiro")],
    normalize_name("Lencho"): [normalize_name("Lencho"), normalize_name("Estadio Florencio Sola")],
    normalize_name("Velez Sarsfield"): [normalize_name("Velez Sarsfield"), normalize_name("Estadio Jose Amalfitani")],
    normalize_name("Arena Independência"): [normalize_name("Arena Independência"), normalize_name("Independência"), normalize_name("Estádio Raimundo Sampaio")],
    normalize_name("Palestra Italia"): [normalize_name("Palestra Italia"), normalize_name("Allianz Parque")],
    normalize_name("Taquaritinga"): [normalize_name("Taquarao"), normalize_name("Adolfo Cavalari"), normalize_name("Antonio Storti")],
    normalize_name("Mirassol"): [normalize_name("Jose Maria de Campos Maia"), normalize_name("Giocondo Zancaner")],
    normalize_name("Prudentina"): [normalize_name("Prudentao"), normalize_name("Felix de Castro")],
    normalize_name("Estadio dos Eucaliptos"): [normalize_name("Gigante de Madeira"), normalize_name("Gilberto Siqueira Lopes")],
    normalize_name("Pachuca"): [normalize_name("Estadio Hidalgo"), normalize_name("Revolucion Mexicana")]
}

# Dados históricos oficiais para estádios de registros remotos/varzeanos
for _stadium_group in STADIUM_NAME_HISTORY:
    _verified_aliases = [
        normalize_name(name)
        for name in [
            _stadium_group.get("current_name"),
            _stadium_group.get("previous_name"),
            *(_stadium_group.get("aliases") or [])
        ]
        if name
    ]
    for _alias in _verified_aliases:
        ESTADIO_ALIASES[_alias] = list(dict.fromkeys([
            *ESTADIO_ALIASES.get(_alias, []),
            *_verified_aliases
        ]))

# Dados históricos oficiais para estádios de registros remotos/varzeanos
HISTORICO_COMPLEMENTAR = {
    normalize_name("Gymnasio de Jau"): {
        "partida": "XV de Jaú 0 x 2 Corinthians", "data": "1935-08-25", "ano": 1935,
        "adversario": "XV de Jaú", "placar": "0 x 2", "competicao": "Amistoso",
        "cidade": "Jaú", "estado": "SP", "pais": "Brasil"
    },
    normalize_name("Ismet Inonu/Mitatpasa"): {
        "partida": "Beşiktaş 0 x 1 Corinthians", "data": "1952-05-24", "ano": 1952,
        "adversario": "Beşiktaş", "placar": "0 x 1", "competicao": "Torneio de Istambul",
        "cidade": "Istambul", "estado": None, "pais": "Turquia"
    },
    normalize_name("Municipal de Garca"): {
        "partida": "Garça 0 x 2 Corinthians", "data": "1954-07-09", "ano": 1954,
        "adversario": "Garça", "placar": "0 x 2", "competicao": "Amistoso",
        "cidade": "Garça", "estado": "SP", "pais": "Brasil"
    },
    normalize_name("Municipal de Taquaritinga"): {
        "partida": "Taquaritinga 1 x 4 Corinthians", "data": "1959-02-22", "ano": 1959,
        "adversario": "Taquaritinga", "placar": "1 x 4", "competicao": "Amistoso",
        "cidade": "Taquaritinga", "estado": "SP", "pais": "Brasil"
    },
    normalize_name("Municipal de Aguas de Lindoia"): {
        "partida": "Seleção de Águas de Lindóia 0 x 5 Corinthians", "data": "1951-04-08", "ano": 1951,
        "adversario": "Seleção de Águas de Lindóia", "placar": "0 x 5", "competicao": "Amistoso",
        "cidade": "Águas de Lindóia", "estado": "SP", "pais": "Brasil"
    },
    normalize_name("Nacional de Bangcoc"): {
        "partida": "Tailândia 1 x 2 Corinthians", "data": "1984-01-18", "ano": 1984,
        "adversario": "Seleção da Tailândia", "placar": "1 x 2", "competicao": "Torneio Internacional da Tailândia",
        "cidade": "Bangcoc", "estado": None, "pais": "Tailândia"
    },
    normalize_name("Nacional de Brasilia"): {
        "partida": "Atlético-MG 0 x 1 Corinthians", "data": "1967-04-21", "ano": 1967,
        "adversario": "Atlético-MG", "placar": "0 x 1", "competicao": "Torneio Gov. Roberto Santos",
        "cidade": "Brasília", "estado": "DF", "pais": "Brasil"
    },
    normalize_name("Nacional de Copenhague"): {
        "partida": "Dinamarca 1 x 2 Corinthians", "data": "1984-06-05", "ano": 1984,
        "adversario": "Seleção da Dinamarca", "placar": "1 x 2", "competicao": "Amistoso Internacional",
        "cidade": "Copenhague", "estado": None, "pais": "Dinamarca"
    },
    normalize_name("Rua Paraiba (Conde Francisco Matarazzo)"): {
        "partida": "São Caetano EC 1 x 4 Corinthians", "data": "1928-06-24", "ano": 1928,
        "adversario": "São Caetano EC", "placar": "1 x 4", "competicao": "Amistoso",
        "cidade": "São Caetano do Sul", "estado": "SP", "pais": "Brasil"
    },
    normalize_name("Rua Sao Jorge (Campo do Lusitano e Comercial)"): {
        "partida": "Lusitano 0 x 3 Corinthians", "data": "1917-08-12", "ano": 1917,
        "adversario": "Lusitano", "placar": "0 x 3", "competicao": "Amistoso",
        "cidade": "São Paulo", "estado": "SP", "pais": "Brasil"
    },
    normalize_name("Campo do General Motors (Eucaliptos)"): {
        "partida": "General Motors 1 x 5 Corinthians", "data": "1938-05-01", "ano": 1938,
        "adversario": "General Motors", "placar": "1 x 5", "competicao": "Amistoso",
        "cidade": "São Caetano do Sul", "estado": "SP", "pais": "Brasil"
    },
    normalize_name("Municipal de Americana"): {
        "partida": "Rio Branco-SP 1 x 3 Corinthians", "data": "1923-05-13", "ano": 1923,
        "adversario": "Rio Branco-SP", "placar": "1 x 3", "competicao": "Amistoso",
        "cidade": "Americana", "estado": "SP", "pais": "Brasil"
    },
    normalize_name("Municipal de Mirassol"): {
        "partida": "Mirassol 0 x 3 Corinthians", "data": "1948-03-21", "ano": 1948,
        "adversario": "Mirassol", "placar": "0 x 3", "competicao": "Amistoso",
        "cidade": "Mirassol", "estado": "SP", "pais": "Brasil"
    },
    normalize_name("Municipal de Moji das Cruzes"): {
        "partida": "União Mogi 1 x 4 Corinthians", "data": "1931-11-15", "ano": 1931,
        "adversario": "União Mogi", "placar": "1 x 4", "competicao": "Amistoso",
        "cidade": "Mogi das Cruzes", "estado": "SP", "pais": "Brasil"
    },
    normalize_name("Municipal de Presidente Prudente"): {
        "partida": "Prudentina 1 x 2 Corinthians", "data": "1949-03-20", "ano": 1949,
        "adversario": "Prudentina", "placar": "1 x 2", "competicao": "Amistoso",
        "cidade": "Presidente Prudente", "estado": "SP", "pais": "Brasil"
    }
}

# Países internacionais conhecidos para classificação
PAISES_INTERNACIONAIS = {
    "argentina": "Argentina",
    "uruguai": "Uruguai",
    "paraguai": "Paraguai",
    "chile": "Chile",
    "peru": "Peru",
    "colombia": "Colômbia",
    "venezuela": "Venezuela",
    "equador": "Equador",
    "bolivia": "Bolívia",
    "mexico": "México",
    "estados unidos": "Estados Unidos",
    "usa": "Estados Unidos",
    "turquia": "Turquia",
    "inglaterra": "Inglaterra",
    "espanha": "Espanha",
    "alemanha": "Alemanha",
    "italia": "Itália",
    "franca": "França",
    "suecia": "Suécia",
    "dinamarca": "Dinamarca",
    "tailandia": "Tailândia",
    "hong kong": "Hong Kong",
    "macau": "Macau",
    "taiwan": "Taiwan",
    "japao": "Japão",
    "yokohama": "Japão",
    "tokyo": "Japão",
    "toyota": "Japão"
}

def load_matches_database():
    matches_file = PARTIDAS_DIR / "corinthians_masculino.geojson"
    if not matches_file.exists():
        print(f"Arquivo de partidas não encontrado em {matches_file}")
        return [], {}, {}
    with open(matches_file, encoding="utf-8") as f:
        matches = json.load(f).get("features", [])

    matches_by_date = {}
    matches_by_stadium = {}

    for m in matches:
        p = m.get("properties") or {}
        d = p.get("DATA")
        if d:
            matches_by_date.setdefault(d, []).append(p)
        stadium_keys = set()
        for st_key in ["ESTÁDIO", "ESTADIO", "ESTÁDIO_ORIGINAL", "ESTÁDIO_DETALHE"]:
            st_val = p.get(st_key)
            if st_val:
                k = normalize_name(st_val)
                if k and k not in stadium_keys:
                    matches_by_stadium.setdefault(k, []).append(p)
                    stadium_keys.add(k)

    return matches, matches_by_date, matches_by_stadium

def load_venue_details():
    vfile = DATA_DIR / "meutimao_venue_details.json"
    if vfile.exists():
        try:
            with open(vfile, encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}

def extract_match_from_description(description):
    """Extrai informações da primeira partida a partir do texto original de forma tolerante."""
    raw = html.unescape(description or "")
    text = re.sub(r"<br\s*/?>", "\n", raw, flags=re.I)
    text = re.sub(r"<[^>]+>", "", text).strip()
    
    # 1. Procura por data (DD/MM/AAAA)
    date_val = None
    ano_val = None
    dm = re.search(r"\b(\d{1,2})/(\d{1,2})/(\d{4})\b", text)
    if dm:
        day, month, year = int(dm.group(1)), int(dm.group(2)), int(dm.group(3))
        try:
            dt = datetime(year, month, day)
            date_val = dt.strftime("%Y-%m-%d")
            ano_val = year
        except ValueError:
            pass

    placar = None
    adversario = None
    match_str = None
    competicao = None
    first_match_line = next(
        (line.strip() for line in text.splitlines() if re.match(r"^\s*Primeira partida\s*[:;]", line, re.I)),
        ""
    )
    fixture_text = re.sub(r"^\s*Primeira partida\s*[:;]\s*", "", first_match_line, flags=re.I)
    fixture_text = re.split(r"\s+\d{1,2}/\d{1,2}/\d{4}\b", fixture_text, maxsplit=1)[0].strip(" -:")
    score_text = fixture_text or text
    score_match = re.search(
        r"(?P<home>.+?)\s+(?P<home_goals>\d+|\?)\s*[xX]\s*(?P<away_goals>\d+|\?)\s+(?P<away>.+)",
        score_text
    )
    if score_match:
        home = score_match.group("home").strip(" -:\n\r\t")
        g_home = score_match.group("home_goals")
        g_away = score_match.group("away_goals")
        away = score_match.group("away").strip(" -:\n\r\t")
        placar = f"{g_home} x {g_away}"
        if "corinth" in home.casefold():
            adversario = away
            match_str = f"{home} {placar} {away}"
        elif "corinth" in away.casefold():
            adversario = home
            match_str = f"{home} {placar} {away}"
        else:
            adversario = away
            match_str = f"{home} {placar} {away}"

    # Competição na mesma linha da data
    if date_val:
        comp_m = re.search(r"\d{1,2}/\d{1,2}/\d{4}\s*-\s*([^\n\r]+)", text)
        if comp_m:
            competicao = comp_m.group(1).strip()

    # Link/fonte se houver
    url_m = re.search(r"https?://[^\s<>]+", text)
    url_fonte = url_m.group(0) if url_m else None

    return {
        "text": text,
        "date": date_val,
        "year": ano_val,
        "placar": placar,
        "adversario": adversario,
        "partida": match_str,
        "competicao": competicao,
        "url_fonte": url_fonte
    }

def enrich_all_stadiums(write_statistics=True):
    from sync_meutimao import (
        SHARED_STADIUM_ALIAS_GROUPS,
        apply_venue_locality_correction,
        canonical_stadium_alias,
        enrich_location_metadata
    )
    from prepare_wof_basemap import correct_country_files_from_local_boundaries

    gpkg_path = ESTADIOS_DIR / "ESTADIOS_MUNDO.gpkg"
    geojson_path = ESTADIOS_DIR / "estadios_mundo.geojson"
    
    print(f"Lendo base geográfica de {gpkg_path}...")
    layers = pyogrio.list_layers(gpkg_path)
    target_layer = layers[0][0]
    for lyr in layers:
        if "CORINTHIANS" in lyr[0].upper():
            target_layer = lyr[0]
            break
            
    gdf = gpd.read_file(gpkg_path, layer=target_layer)
    print(f"Carregados {len(gdf)} registros da camada '{target_layer}'")

    matches, matches_by_date, matches_by_stadium = load_matches_database()
    for canonical, aliases in SHARED_STADIUM_ALIAS_GROUPS:
        alias_keys = {normalize_name(name) for name in (canonical, *aliases)}
        alias_matches = [
            match.get("properties") or {}
            for match in matches
            if any(
                normalize_name((match.get("properties") or {}).get(field)) in alias_keys
                for field in ("ESTÁDIO", "ESTADIO", "ESTÁDIO_ORIGINAL", "ESTÁDIO_DETALHE")
                if (match.get("properties") or {}).get(field)
            )
        ]
        for alias_key in alias_keys:
            matches_by_stadium[alias_key] = alias_matches
    venue_details = load_venue_details()

    enriched_records = []
    
    for _, row in gdf.iterrows():
        props = row.to_dict()
        geom = props.pop("geometry", None)
        
        # Nome do estádio e oficial
        st_name = str(props.get("ESTADIO") or props.get("Name") or "").strip()
        st_clean = st_name.rstrip("*").strip()
        of_name = str(props.get("NOME_OFICIAL") or "").strip()
        renamed_group = renamed_stadium_group([st_clean, of_name])
        if renamed_group:
            st_clean = renamed_group["current_name"]
        st_clean = canonical_stadium_alias(st_clean)
        if not of_name and "DESCRICAO_ORIGINAL" in props:
            # Pega primeira linha que não seja vazia
            first_line = str(props["DESCRICAO_ORIGINAL"]).split("<br>")[0].split("\n")[0].strip()
            if first_line and not re.search(r"(?:Primeira partida|\d{1,2}/\d{1,2}/\d{4})", first_line, re.I):
                of_name = re.sub(r"<[^>]+>", "", first_line).strip()
        if of_name == st_clean:
            of_name = ""

        desc_raw = str(props.get("DESCRICAO_ORIGINAL") or props.get("descriptio") or "")
        parsed = extract_match_from_description(desc_raw)
        cidade = None
        estado = None
        pais = "Brasil"

        # Busca partidas correspondentes no Meu Timão
        matched_games = []
        
        # 1. Busca por data exata extraída da descrição
        if parsed["date"] and parsed["date"] in matches_by_date:
            date_stadium_names = {
                normalize_name(name)
                for name in (st_clean, of_name)
                if normalize_name(name)
            }
            for stadium_name in tuple(date_stadium_names):
                date_stadium_names.update(ESTADIO_ALIASES.get(stadium_name, []))
            matched_games = [
                match for match in matches_by_date[parsed["date"]]
                if any(
                    normalize_name(match.get(field)) in date_stadium_names
                    for field in ("ESTÁDIO", "ESTADIO", "ESTÁDIO_ORIGINAL", "ESTÁDIO_DETALHE")
                    if match.get(field)
                )
            ]
            
        # 2. Busca por nome do estádio ou apelidos conhecidos
        if not matched_games:
            candidates = [normalize_name(st_clean), normalize_name(of_name)]
            expanded = list(candidates)
            for c in candidates:
                if c in ESTADIO_ALIASES:
                    for a in ESTADIO_ALIASES[c]:
                        if a not in expanded:
                            expanded.append(a)
            for c in expanded:
                if c and c in matches_by_stadium:
                    matched_games = matches_by_stadium[c]
                    break

        # Se encontrou partidas no banco de dados oficial do Meu Timão
        partidas_do_estadio = []
        if matched_games:
            # Pega o nome do estádio usado no Meu Timão
            target_st = matched_games[0].get("ESTÁDIO") or matched_games[0].get("ESTADIO")
            target_norm = normalize_name(target_st)
            if target_norm in matches_by_stadium:
                partidas_do_estadio = sorted(matches_by_stadium[target_norm], key=lambda x: str(x.get("DATA") or ""))
            else:
                partidas_do_estadio = sorted(matched_games, key=lambda x: str(x.get("DATA") or ""))

        # Atributos de Primeira Partida
        primeira_partida_str = parsed["partida"]
        data_primeira = parsed["date"]
        ano_primeira = parsed["year"]
        adversario = parsed["adversario"]
        placar = parsed["placar"]
        competicao = parsed["competicao"]
        mando = None
        url_fonte = parsed["url_fonte"]

        if partidas_do_estadio:
            first_game = partidas_do_estadio[0]
            first_game_date = first_game.get("DATA")
            if first_game_date and (not data_primeira or first_game_date < data_primeira):
                data_primeira = first_game_date
                ano_primeira = first_game.get("ANO JOGO") or int(first_game_date[:4])
                adversario = first_game.get("ADVERSÁRIO")
                placar = first_game.get("PLACAR")
                competicao = first_game.get("COMPETIÇÃO")
                home = first_game.get("TIME MANDANTE") or "Corinthians"
                away = first_game.get("TIME VISITANTE") or (adversario or "")
                primeira_partida_str = f"{home} {placar or 'x'} {away}".strip()
                url_fonte = first_game.get("URL_FONTE") or url_fonte

            mando = "Mandante" if first_game.get("MANDANTE / VISITANTE (SCCP)") == "Sim" else "Visitante"

        # Consulta dados históricos complementares se não encontrou data
        comp_key = normalize_name(st_clean)
        if not data_primeira and comp_key in HISTORICO_COMPLEMENTAR:
            h = HISTORICO_COMPLEMENTAR[comp_key]
            primeira_partida_str = h["partida"]
            data_primeira = h["data"]
            ano_primeira = h["ano"]
            adversario = h["adversario"]
            placar = h["placar"]
            competicao = h["competicao"]
            cidade = h.get("cidade")
            estado = h.get("estado")
            pais = h.get("pais") or pais

        # Estatísticas acumuladas
        total_jogos = len(partidas_do_estadio) if partidas_do_estadio else (1 if data_primeira else 0)
        vitorias = sum(1 for g in partidas_do_estadio if g.get("RESULTADO") == "VITÓRIA")
        empates = sum(1 for g in partidas_do_estadio if g.get("RESULTADO") == "EMPATE")
        derrotas = sum(1 for g in partidas_do_estadio if g.get("RESULTADO") == "DERROTA")
        
        gols_pro = 0
        gols_contra = 0
        for g in partidas_do_estadio:
            try:
                gols_pro += int(float(g.get("GOLS SCCP") or 0))
                gols_contra += int(float(g.get("GOLS ADVERSÁRIO") or 0))
            except (ValueError, TypeError):
                pass

        conhecidos = vitorias + empates + derrotas
        aproveitamento = round(((vitorias * 3 + empates) / (conhecidos * 3)) * 100, 1) if conhecidos > 0 else 0.0

        # Localização (Cidade, Estado, País)
        # Procura em venue_details ou primeira partida
        v_key = normalize_name(st_clean)
        v_info = venue_details.get(v_key, {})
        if not v_info and of_name:
            v_info = venue_details.get(normalize_name(of_name), {})

        if v_info:
            cidade = v_info.get("city") or v_info.get("CIDADE")
            estado = v_info.get("state") or v_info.get("ESTADO")
            pais = v_info.get("country") or v_info.get("PAIS") or pais
        elif partidas_do_estadio:
            sample = partidas_do_estadio[0]
            cidade = sample.get("CIDADE_FONTE")
            estado = sample.get("ESTADO_FONTE")
            pais = sample.get("PAIS_FONTE") or pais

        # Detecção de país internacional por texto e coordenadas
        combined_text = f"{st_clean} {of_name} {desc_raw}".lower()
        for k_pais, v_pais in PAISES_INTERNACIONAIS.items():
            if k_pais in combined_text:
                pais = v_pais
                break

        # Coordenadas geográficas
        coords = [geom.x, geom.y] if geom else [None, None]
        # Se coordenadas caírem fora da América do Sul e o país for Brasil, checar nomes
        lon, lat = coords[0], coords[1]
        if lon is not None and (lon > -30 or lon < -80 or lat > 10 or lat < -40):
            if pais == "Brasil":
                # Verifica nomes especiais
                if "yokohama" in combined_text or "tokyo" in combined_text or "nissan" in combined_text:
                    pais = "Japão"
                elif "copenhague" in combined_text or "parken" in combined_text:
                    pais = "Dinamarca"
                elif "bangcoc" in combined_text or "bangkok" in combined_text:
                    pais = "Tailândia"
                elif "orlando" in combined_text or "florida" in combined_text or "icahn" in combined_text:
                    pais = "Estados Unidos"
                elif "kuip" in combined_text or "feyenoord" in combined_text:
                    pais = "Holanda"
                elif "turquia" in combined_text or "inonu" in combined_text:
                    pais = "Turquia"
                elif "ullevi" in combined_text:
                    pais = "Suécia"

        # Observações limpas
        obs_lines = []
        for line in parsed["text"].splitlines():
            line_str = line.strip()
            if not line_str:
                continue
            if line_str == st_clean or line_str == of_name:
                continue
            if re.search(r"^(?:Primeira|Ultima|Última) partida|^\d{1,2}/\d{1,2}/\d{4}|^\w+\s+\d+\s*x\s*\d+", line_str, re.I):
                continue
            obs_lines.append(line_str)
        observacoes = " | ".join(obs_lines) if obs_lines else None

        # Monta registro com colunas limpas, padronizadas e sem caracteres corrompidos
        record = {
            "ESTADIO": st_clean,
            "NOME_OFICIAL": of_name or None,
            "NOME_ANTIGO": renamed_group.get("previous_name") if renamed_group else None,
            "FONTES_NOME_ANTIGO": renamed_group.get("sources", []) if renamed_group else [],
            "NOMES_ALTERNATIVOS": [renamed_group.get("previous_name"), *(renamed_group.get("aliases") or [])] if renamed_group else [],
            "CIDADE": cidade,
            "ESTADO": estado,
            "PAIS": pais,
            "LATITUDE": geom.y if geom else None,
            "LONGITUDE": geom.x if geom else None,
            "PRIMEIRA_PARTIDA": primeira_partida_str,
            "DATA_PRIMEIRA_PARTIDA": data_primeira,
            "ANO_PRIMEIRA_PARTIDA": int(ano_primeira) if ano_primeira else None,
            "ADVERSARIO": adversario,
            "PLACAR": placar,
            "COMPETICAO_PRIMEIRA_PARTIDA": competicao,
            "MANDO_PRIMEIRA_PARTIDA": mando,
            "TOTAL_JOGOS": total_jogos,
            "VITORIAS": vitorias,
            "EMPATES": empates,
            "DERROTAS": derrotas,
            "APROVEITAMENTO_PCT": aproveitamento,
            "GOLS_MARCADOS": gols_pro,
            "GOLS_SOFRIDOS": gols_contra,
            "OBSERVACOES": observacoes,
            "FONTE_PRIMEIRA_PARTIDA": url_fonte or "Meu Timão / Acervo ATLAS1910",
            "DESCRICAO_ORIGINAL": desc_raw,
            "geometry": geom
        }
        enriched_records.append(record)

    enrich_location_metadata(enriched_records)
    for record in enriched_records:
        apply_venue_locality_correction(record)

    # Calcular contagem por década de estreia
    decade_counts = {}
    for r in enriched_records:
        ano = r["ANO_PRIMEIRA_PARTIDA"]
        if ano:
            dec = (ano // 10) * 10
            decade_counts[dec] = decade_counts.get(dec, 0) + 1

    for r in enriched_records:
        ano = r["ANO_PRIMEIRA_PARTIDA"]
        dec = (ano // 10) * 10 if ano else None
        r["ESTADIOS_COM_ESTREIA_NA_DECADA"] = decade_counts.get(dec, 0) if dec else 0

    enriched_gdf = gpd.GeoDataFrame(enriched_records, geometry="geometry", crs="EPSG:4326")

    # Ordenação de colunas elegante e padronizada
    col_order = [
        "ESTADIO",
        "NOME_OFICIAL",
        "NOME_ANTIGO",
        "FONTES_NOME_ANTIGO",
        "NOMES_ALTERNATIVOS",
        "CIDADE",
        "ESTADO",
        "PAIS",
        "LATITUDE",
        "LONGITUDE",
        "PRIMEIRA_PARTIDA",
        "DATA_PRIMEIRA_PARTIDA",
        "ANO_PRIMEIRA_PARTIDA",
        "ADVERSARIO",
        "PLACAR",
        "COMPETICAO_PRIMEIRA_PARTIDA",
        "MANDO_PRIMEIRA_PARTIDA",
        "TOTAL_JOGOS",
        "VITORIAS",
        "EMPATES",
        "DERROTAS",
        "APROVEITAMENTO_PCT",
        "GOLS_MARCADOS",
        "GOLS_SOFRIDOS",
        "ESTADIOS_COM_ESTREIA_NA_DECADA",
        "OBSERVACOES",
        "FONTE_PRIMEIRA_PARTIDA",
        "DESCRICAO_ORIGINAL",
        "geometry"
    ]
    enriched_gdf = enriched_gdf[col_order]

    missing_geometry = enriched_gdf[enriched_gdf.geometry.isna()]
    if not missing_geometry.empty:
        names = ", ".join(missing_geometry["ESTADIO"].astype(str).head(10))
        raise ValueError(f"{len(missing_geometry)} estádios sem geometria no GeoPackage original: {names}")

    # 1. Salva ESTADIOS_MUNDO.gpkg
    print(f"Gravando {gpkg_path}...")
    enriched_gdf.to_file(gpkg_path, layer="ESTADIOS CORINTHIANS", driver="GPKG", mode="w")

    # 2. Salva estadios_mundo.geojson
    print(f"Gravando {geojson_path}...")
    enriched_gdf.to_file(geojson_path, driver="GeoJSON")

    # 3. Salva estadios_mundo_internacionais.geojson (fora do Brasil)
    internacionais_gdf = enriched_gdf[enriched_gdf["PAIS"] != "Brasil"].copy()
    intl_path = ESTADIOS_DIR / "estadios_mundo_internacionais.geojson"
    print(f"Gravando {intl_path} com {len(internacionais_gdf)} estádios internacionais...")
    internacionais_gdf.to_file(intl_path, driver="GeoJSON")

    # 4. Preserva a camada agregada por todos os jogos quando a sincronização a gera.
    if write_statistics:
        stats_gdf = enriched_gdf.copy()
        stats_path = ESTADIOS_DIR / "estadios_masculinos_estatisticas.geojson"
        print(f"Gravando {stats_path} com {len(stats_gdf)} estádios masculinos...")
        stats_gdf.to_file(stats_path, driver="GeoJSON")

    correct_country_files_from_local_boundaries()

    with_dates = sum(1 for r in enriched_records if r["DATA_PRIMEIRA_PARTIDA"])
    with_years = sum(1 for r in enriched_records if r["ANO_PRIMEIRA_PARTIDA"])
    with_matches = sum(1 for r in enriched_records if r["PRIMEIRA_PARTIDA"])

    print("==================================================================")
    print("RESUMO DA ESTRUTURAÇÃO DE DADOS:")
    print(f" Total de estádios processados: {len(enriched_gdf)}")
    print(f" Estádios com PRIMEIRA_PARTIDA preenchida: {with_matches} ({with_matches/len(enriched_gdf)*100:.1f}%)")
    print(f" Estádios com DATA_PRIMEIRA_PARTIDA estruturada: {with_dates} ({with_dates/len(enriched_gdf)*100:.1f}%)")
    print(f" Estádios com ANO_PRIMEIRA_PARTIDA estruturado: {with_years} ({with_years/len(enriched_gdf)*100:.1f}%)")
    print(f" Estádios internacionais mapeados: {len(internacionais_gdf)}")
    print("==================================================================")

if __name__ == "__main__":
    enrich_all_stadiums()
