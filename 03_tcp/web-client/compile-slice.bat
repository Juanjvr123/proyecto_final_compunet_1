@echo off
REM Script para compilar archivos Slice (.ice) a JavaScript

echo ================================================
echo Compilando archivos Slice a JavaScript
echo ================================================

REM Verificar que slice2js esté en el PATH
where slice2js >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: slice2js no esta en el PATH
    echo Por favor instale ZeroC Ice y agregue el directorio bin al PATH
    echo Descarga: https://zeroc.com/downloads/ice
    exit /b 1
)

REM Directorios
set SLICE_DIR=..\slice
set OUTPUT_DIR=src\generated

echo.
echo Slice directory: %SLICE_DIR%
echo Output directory: %OUTPUT_DIR%
echo.

REM Crear directorio de salida si no existe
if not exist %OUTPUT_DIR% mkdir %OUTPUT_DIR%

REM Compilar Chat.ice
echo Compilando Chat.ice...
slice2js --output-dir %OUTPUT_DIR% %SLICE_DIR%\Chat.ice

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ================================================
    echo Compilacion exitosa!
    echo Los archivos JavaScript fueron generados en: %OUTPUT_DIR%\
    echo Archivos generados:
    dir /B %OUTPUT_DIR%\*.js
    echo ================================================
) else (
    echo.
    echo ================================================
    echo ERROR en la compilacion
    echo ================================================
    exit /b 1
)

pause
