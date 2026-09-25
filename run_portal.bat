@echo off
title ATLAS1910 - Geoportal Local
cd /d "%~dp0"
echo =======================================================
echo   ATLAS1910 - Geoportal Analitico e Espacial
echo   Iniciando servidor local (http://localhost:8080)...
echo =======================================================
start "" "http://localhost:8080"
python -m http.server 8080
pause
