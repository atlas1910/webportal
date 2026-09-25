"""
ATLAS1910 — Sincronizador Automático de GeoPackage (.gpkg) para GeoJSON
Lê os arquivos .gpkg na pasta data/ e atualiza os arquivos .geojson correspondentes para carregamento ultrarrápido no Leaflet e deploy na Vercel.
"""

import os
import glob
try:
    import geopandas as gpd
    import pandas as pd
    import pyogrio
except ImportError:
    print("Aviso: Instale o geopandas executando: pip install geopandas pyogrio")
    exit(1)

def sync_estadios():
    base_dir = os.path.dirname(os.path.abspath(__file__))
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
                gdf["geometry"] = gdf["geometry"].apply(lambda g: type(g)([g.x, g.y]) if g else None)
                gdf = gpd.GeoDataFrame(gdf, geometry="geometry", crs="EPSG:4326")
                out_path = os.path.join(estadios_dir, "estadios_mundo.geojson")
                gdf.to_file(out_path, driver="GeoJSON")
                print(f" -> Gerado {os.path.basename(out_path)} ({len(gdf)} estadios no mundo)")
            break

def sync_brabas():
    base_dir = os.path.dirname(os.path.abspath(__file__))
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
    print("Sincronização concluída com sucesso!")
