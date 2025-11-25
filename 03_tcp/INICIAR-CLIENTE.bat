@echo off
chcp 65001 > nul
echo ================================================================
echo    🌐 INICIANDO SERVIDOR WEB DEL CLIENTE
echo ================================================================
echo.

cd web-client
node simple-server.js
