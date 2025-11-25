@echo off
REM Script para compilar archivos Slice (.ice) a Java

echo ================================================
echo Compilando archivos Slice a Java
echo ================================================

REM Verificar que slice2java esté en el PATH
where slice2java >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: slice2java no esta en el PATH
    echo Por favor instale ZeroC Ice y agregue el directorio bin al PATH
    echo Descarga: https://zeroc.com/downloads/ice
    exit /b 1
)

REM Directorios
set SLICE_DIR=..\slice
set OUTPUT_DIR=src\main\java

echo.
echo Slice directory: %SLICE_DIR%
echo Output directory: %OUTPUT_DIR%
echo.

REM Compilar Chat.ice
echo Compilando Chat.ice...
slice2java --output-dir %OUTPUT_DIR% %SLICE_DIR%\Chat.ice

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ================================================
    echo Compilacion exitosa!
    echo Los archivos Java fueron generados en: %OUTPUT_DIR%\Chat\
    echo ================================================
) else (
    echo.
    echo ================================================
    echo ERROR en la compilacion
    echo ================================================
    exit /b 1
)

pause
