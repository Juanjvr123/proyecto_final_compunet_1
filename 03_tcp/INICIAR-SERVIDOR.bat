@echo off
chcp 65001 > nul
echo ================================================================
echo    🚀 INICIANDO SERVIDOR ICE
echo ================================================================
echo.

gradlew :server:run
