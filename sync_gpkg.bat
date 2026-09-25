@echo off
chcp 65001 > nul
echo ========================================================
echo   ATLAS1910 — Sincronizador de GeoPackage (.gpkg)
echo ========================================================
echo.
python sync_gpkg.py
echo.
echo Pressione qualquer tecla para sair...
pause > nul
