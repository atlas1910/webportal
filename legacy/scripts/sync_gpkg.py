"""
ATLAS1910 - Sincronizador Automático de GeoPackage (.gpkg) para GeoJSON
Lê os arquivos .gpkg na pasta data/ e atualiza os arquivos .geojson correspondentes para carregamento ultrarrápido no Leaflet e deploy na Vercel.
"""

import os
import re
import html
from datetime import datetime
try:
    import geopandas as gpd
    import pandas as pd
    import pyogrio
except ImportError:
    print("Aviso: Instale o geopandas executando: pip install geopandas pyogrio")
    exit(1)

def normalize_world_stadiums(gdf):
    descriptions = gdf.get("DESCRICAO_ORIGINAL", gdf.get("descriptio", pd.Series("", index=gdf.index)))
    names = gdf.get("ESTADIO", gdf.get("Name", pd.Series("", index=gdf.index)))
    descriptions = descriptions.fillna("").astype(str)
    plain_descriptions = []

    for description in descriptions:
        text = re.sub(r"<br\s*/?>", "\n", html.unescape(description), flags=re.I)
        text = re.sub(r"<[^>]+>", "", text)
        plain_descriptions.append(text)

    def parse_first_match(description):
        match_start = re.search(r"(?:Data\s+)?Primeira partida\s*[:;]", description, re.I)
        if not match_start:
            return {
                "PRIMEIRA_PARTIDA": None,
                "ADVERSARIO": None,
                "PLACAR": None,
                "DATA_PRIMEIRA_PARTIDA": None,
                "ANO_PRIMEIRA_PARTIDA": None,
                "COMPETICAO_PRIMEIRA_PARTIDA": None
            }

        fixture = description[match_start.start():]
        fixture = re.split(r"\b(?:Data\s+)?(?:Última partida|Ultima partida)|\b(?:OBS\.?|Observação|Referência|Referencias|Fontes?)\s*:?|https?://", fixture, maxsplit=1, flags=re.I)[0]
        fixture = re.sub(r"^.*?Primeira partida\s*[:;]\s*", "", fixture, flags=re.I).strip()
        date_match = re.search(r"\b(\d{1,2}/\d{1,2}/\d{4})\b", fixture)
        match_date = competition = None

        if date_match:
            try:
                parsed_date = datetime.strptime(date_match.group(1), "%d/%m/%Y")
                match_date = parsed_date
                date_line = fixture[fixture.rfind("\n", 0, date_match.start()) + 1:]
                competition_match = re.search(r"\d{1,2}/\d{1,2}/\d{4}\s*-\s*([^\n]+)", date_line)
                competition = competition_match.group(1).strip() or None if competition_match else None
            except ValueError:
                date_match = None

        match_text = fixture[:date_match.start()].strip(" -") if date_match else fixture
        score_match = re.search(r"(.+?)\s+(\d+)\s*[xX]\s*(\d+)\s+(.+)", match_text)
        opponent = score = None
        if score_match:
            home, home_goals, away_goals, away = (part.strip() for part in score_match.groups())
            score = f"{home_goals} x {away_goals}"
            if "corinth" in home.casefold():
                opponent = away
            elif "corinth" in away.casefold():
                opponent = home
        if not opponent:
            icon_match = re.search(r"Ícone\s*:\s*([^,\n]+),\s*adversário", description, re.I)
            if icon_match:
                opponent = icon_match.group(1).strip()

        return {
            "PRIMEIRA_PARTIDA": match_text or None,
            "ADVERSARIO": opponent,
            "PLACAR": score,
            "DATA_PRIMEIRA_PARTIDA": match_date.strftime("%Y-%m-%d") if match_date else None,
            "ANO_PRIMEIRA_PARTIDA": match_date.year if match_date else None,
            "COMPETICAO_PRIMEIRA_PARTIDA": competition
        }

    matches = [parse_first_match(description) for description in plain_descriptions]
    debut_counts = {}
    for match in matches:
        year = match["ANO_PRIMEIRA_PARTIDA"]
        if year:
            decade = year // 10 * 10
            debut_counts[decade] = debut_counts.get(decade, 0) + 1

    normalized = gdf[["geometry"]].copy()
    normalized["ESTADIO"] = names.fillna("").astype(str).str.strip().values
    normalized["NOME_OFICIAL"] = [
        next((line.strip() for line in description.splitlines() if line.strip() and not re.search(r"(?:Data\s+)?Primeira partida\s*[:;]", line, re.I)), None)
        for description in plain_descriptions
    ]
    for field in matches[0] if matches else []:
        normalized[field] = [match[field] for match in matches]
    normalized["ANO_PRIMEIRA_PARTIDA"] = pd.array(normalized["ANO_PRIMEIRA_PARTIDA"], dtype="Int64")
    normalized["ESTADIOS_COM_ESTREIA_NA_DECADA"] = [debut_counts.get((match["ANO_PRIMEIRA_PARTIDA"] // 10) * 10, 0) if match["ANO_PRIMEIRA_PARTIDA"] else 0 for match in matches]
    normalized["OBSERVACOES"] = [
        " | ".join(
            line.strip() for line in description.splitlines()
            if line.strip()
            and line.strip() != normalized.iloc[index]["NOME_OFICIAL"]
            and not re.match(r"(?:Data\s+)?(?:Primeira|Última|Ultima) partida\s*[:;]|Ícone\s*:|[- ]*(?:Vitórias|Derrotas|Empates)\s*:", line.strip(), re.I)
        ) or None
        for index, description in enumerate(plain_descriptions)
    ]
    normalized["FONTE_PRIMEIRA_PARTIDA"] = [next(iter(re.findall(r"https?://[^\s<>]+", description)), "GeoPackage original: ESTADIOS_MUNDO.gpkg") for description in plain_descriptions]
    normalized["DESCRICAO_ORIGINAL"] = descriptions.values
    return gpd.GeoDataFrame(normalized, geometry="geometry", crs=gdf.crs or "EPSG:4326")

def sync_estadios():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    estadios_dir = os.path.join(base_dir, "data", "estadios")
    
    # 1. CAMPOS-DE-JOGO.gpkg (Mandante)
    gpkg_mandante = os.path.join(estadios_dir, "CAMPOS-DE-JOGO.gpkg")
    if os.path.exists(gpkg_mandante):
        print(f"Sincronizando {os.path.basename(gpkg_mandante)}...")
        layers = pyogrio.list_layers(gpkg_mandante)
        gdfs = []
        for lyr_info in layers:
            lyr = lyr_info[0]
            if lyr == "layer_styles":
                continue
            gdf = gpd.read_file(gpkg_mandante, layer=lyr)
            gdf["Estadio"] = lyr
            gdf["geometry"] = gdf["geometry"].apply(lambda g: type(g)([g.x, g.y]) if g else None)
            gdfs.append(gdf)
        if gdfs:
            mandantes = pd.concat(gdfs, ignore_index=True)
            mandantes = gpd.GeoDataFrame(mandantes, geometry="geometry", crs="EPSG:4326")
            out_path = os.path.join(estadios_dir, "estadios_mandante.geojson")
            mandantes.to_file(out_path, driver="GeoJSON")
            print(f" -> Gerado {os.path.basename(out_path)} ({len(mandantes)} estadios mandantes)")

    # 2. ESTADIOS_MUNDO.gpkg ou ESTADIOS DO MUNDO.gpkg
    for fname in ["ESTADIOS_MUNDO.gpkg", "ESTADIOS DO MUNDO.gpkg"]:
        gpkg_mundo = os.path.join(estadios_dir, fname)
        if os.path.exists(gpkg_mundo):
            print(f"Sincronizando {fname}...")
            layers = pyogrio.list_layers(gpkg_mundo)
            target_layer = None
            for lyr_info in layers:
                if "CORINTHIANS" in lyr_info[0].upper():
                    target_layer = lyr_info[0]
                    break
            if not target_layer and len(layers) > 0:
                target_layer = layers[0][0]
            
            if target_layer:
                gdf = gpd.read_file(gpkg_mundo, layer=target_layer)
                gdf = normalize_world_stadiums(gdf)
                gdf.to_file(gpkg_mundo, layer=target_layer, driver="GPKG", mode="w")
                out_path = os.path.join(estadios_dir, "estadios_mundo.geojson")
                gdf.to_file(out_path, driver="GeoJSON")
                print(f" -> Gerado {os.path.basename(out_path)} ({len(gdf)} estadios no mundo)")
            break
    # 2. ESTADIOS_MUNDO.gpkg (Estruturação completa com dados do Meu Timão e separação de camadas)
    try:
        from enrich_estadios_mundo import enrich_all_stadiums
        enrich_all_stadiums()
    except Exception as e:
        print(f"Aviso ao executar enrich_all_stadiums: {e}")

def sync_brabas():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    brabas_dir = os.path.join(base_dir, "data", "as_brabas")
    gpkg_brabas = os.path.join(brabas_dir, "AS_BRABAS.gpkg")

    if os.path.exists(gpkg_brabas):
        print(f"Sincronizando {os.path.basename(gpkg_brabas)}...")
        layers = pyogrio.list_layers(gpkg_brabas)
        layer_names = [l[0] for l in layers]

        # 1. Jogos consolidado
        gdfs = []
        for lyr in ["Ate_2016", "Depois_da_reativacao"]:
            if lyr in layer_names:
                gdf = gpd.read_file(gpkg_brabas, layer=lyr)
                gdfs.append(gdf)
        if gdfs:
            all_jogos = pd.concat(gdfs, ignore_index=True)
            all_jogos = gpd.GeoDataFrame(all_jogos, geometry="geometry", crs="EPSG:4326")
            out_jogos = os.path.join(brabas_dir, "as_brabas_jogos.geojson")
            all_jogos.to_file(out_jogos, driver="GeoJSON")
            print(f" -> Gerado {os.path.basename(out_jogos)} ({len(all_jogos)} jogos)")

        # 2. Estadios consolidado
        if "Estadios_As_Brabas" in layer_names:
            gdf_est = gpd.read_file(gpkg_brabas, layer="Estadios_As_Brabas")
            gdf_est = gpd.GeoDataFrame(gdf_est, geometry="geometry", crs="EPSG:4326")
            out_est = os.path.join(brabas_dir, "as_brabas_estadios.geojson")
            gdf_est.to_file(out_est, driver="GeoJSON")
            print(f" -> Gerado {os.path.basename(out_est)} ({len(gdf_est)} estádios)")

if __name__ == "__main__":
    sync_estadios()
    sync_brabas()
    from sync_meutimao import rebuild_female_data
    rebuild_female_data()
    print("Sincronização concluída com sucesso!")
