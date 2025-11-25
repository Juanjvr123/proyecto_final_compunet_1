@echo off
chcp 65001 > nul
echo ================================================================
echo    🔒 INICIANDO SERVIDOR HTTPS (DESARROLLO)
echo ================================================================
echo.

cd web-client

REM Verificar si existe OpenSSL
where openssl >nul 2>&1
if errorlevel 1 (
    echo ⚠️  OpenSSL no encontrado en el sistema
    echo.
    echo Para usar HTTPS, necesitas instalar OpenSSL:
    echo 📥 Descarga: https://slproweb.com/products/Win32OpenSSL.html
    echo.
    echo O usa la Opción 2: Configurar excepciones en el navegador
    echo Ver DESPLIEGUE_SIMPLE.md para más detalles
    echo.
    pause
    exit /b 1
)

node https-server.js
