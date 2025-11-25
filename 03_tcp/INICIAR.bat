@echo off
chcp 65001 > nul
echo ================================================================
echo    💬 SISTEMA DE CHAT ICE - INICIO AUTOMÁTICO
echo ================================================================
echo.
echo 🚀 Este script iniciará todo el proyecto automáticamente
echo.

REM Obtener IP local
echo 🔍 Detectando dirección IP local...
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /C:"IPv4"') do (
    set IP_TEMP=%%a
    goto :found_ip
)
:found_ip
set LOCAL_IP=%IP_TEMP:~1%
echo ✅ Tu IP local es: %LOCAL_IP%
echo.

REM Verificar Java
echo 🔍 Verificando Java...
java -version > nul 2>&1
if errorlevel 1 (
    echo ❌ ERROR: Java no está instalado
    echo 📥 Descarga Java 17+ desde: https://adoptium.net/
    pause
    exit /b 1
)
echo ✅ Java detectado correctamente
echo.

REM Verificar Node.js
echo 🔍 Verificando Node.js...
node --version > nul 2>&1
if errorlevel 1 (
    echo ❌ ERROR: Node.js no está instalado
    echo 📥 Descarga Node.js desde: https://nodejs.org/
    pause
    exit /b 1
)
echo ✅ Node.js detectado correctamente
echo.

REM Instalar dependencias del cliente si es necesario
echo 🔍 Verificando dependencias del cliente...
if not exist "web-client\node_modules\" (
    echo 📦 Instalando dependencias de npm...
    cd web-client
    call npm install
    cd ..
    echo ✅ Dependencias instaladas
) else (
    echo ✅ Dependencias ya instaladas
)
echo.

REM Compilar servidor
echo 🔨 Compilando servidor Java...
call gradlew :server:build --quiet
if errorlevel 1 (
    echo ❌ ERROR: Falló la compilación del servidor
    pause
    exit /b 1
)
echo ✅ Servidor compilado correctamente
echo.

REM Compilar cliente para producción
echo 🔨 Compilando cliente web...
cd web-client
call npm run build --silent
if errorlevel 1 (
    echo ❌ ERROR: Falló la compilación del cliente
    pause
    exit /b 1
)
cd ..
echo ✅ Cliente compilado correctamente
echo.

echo ================================================================
echo    ✅ COMPILACIÓN COMPLETADA
echo ================================================================
echo.
echo 📝 INFORMACIÓN IMPORTANTE:
echo.
echo 🌐 Para acceder desde esta máquina:
echo    http://localhost:8080
echo.
echo 🌐 Para acceder desde otras máquinas en la red:
echo    http://%LOCAL_IP%:8080
echo.
echo ⚠️  IMPORTANTE: Asegúrate de que el firewall permita los puertos:
echo    - 8080 (Cliente web)
echo    - 10000 (Ice TCP)
echo    - 10001 (Ice WebSocket)
echo.
echo ================================================================
echo.

REM Crear archivo con la IP para el cliente
echo %LOCAL_IP% > web-client\server-ip.txt

REM Preguntar si configurar IP automáticamente
echo ❓ ¿Quieres que el cliente se conecte automáticamente a %LOCAL_IP%?
echo    (Recomendado para acceso desde otras máquinas en la red)
echo.
set /p CONFIG_IP="   Sí (S) / No (N) - Dejar localhost (N): "

if /i "%CONFIG_IP%"=="S" (
    echo.
    echo 🔧 Configurando cliente para usar %LOCAL_IP%...
    
    REM Backup del archivo original
    copy /Y web-client\src\services\iceDelegate.js web-client\src\services\iceDelegate.js.backup > nul
    
    REM Reemplazar localhost por la IP local
    powershell -Command "(Get-Content web-client\src\services\iceDelegate.js) -replace 'localhost', '%LOCAL_IP%' | Set-Content web-client\src\services\iceDelegate.js"
    
    echo ✅ Cliente configurado para %LOCAL_IP%
    echo.
    echo 🔨 Recompilando cliente con nueva configuración...
    cd web-client
    call npm run build --silent > nul 2>&1
    cd ..
    echo ✅ Cliente recompilado
    echo.
    
    REM Preguntar si usar HTTPS para acceso al micrófono
    echo.
    echo 🎤 ¿Quieres usar HTTPS para permitir acceso al micrófono desde otras máquinas?
    echo    (Recomendado si usarás llamadas de audio o notas de voz)
    echo.
    set /p USE_HTTPS="   Sí (S) / No (N) - Usar HTTP normal (N): "
)

echo ================================================================
echo    🚀 INICIANDO SERVICIOS
echo ================================================================
echo.

REM Iniciar servidor en background
echo 🟢 Iniciando servidor Ice...
start "Servidor Ice" cmd /c "cd /d %CD% && gradlew :server:run"
timeout /t 5 /nobreak > nul
echo ✅ Servidor iniciado en background
echo.

REM Iniciar cliente web
echo 🟢 Iniciando servidor web para el cliente...
echo.
echo ================================================================
echo    ✨ TODO LISTO - SISTEMA INICIADO
echo ================================================================
echo.

REM Mostrar URLs según el protocolo elegido
if /i "%USE_HTTPS%"=="S" (
    echo 🌐 Accede a la aplicación en:
    echo.
    echo    🔒 HTTPS: https://%LOCAL_IP%:8443
    echo    📱 Local: https://localhost:8443
    echo.
    echo ⚠️  IMPORTANTE: El navegador mostrará advertencia de seguridad
    echo    1. Haz clic en "Avanzado" o "Advanced"
    echo    2. Luego en "Continuar al sitio" o "Proceed to site"
    echo    3. Esto es normal para certificados autofirmados
    echo.
) else (
    echo 🌐 Accede a la aplicación en:
    echo.
if /i "%CONFIG_IP%"=="S" (
    echo    Desde esta máquina: http://localhost:8080
    echo    Desde otras máquinas: http://%LOCAL_IP%:8080
) else (
    echo    http://localhost:8080
)
echo.
echo 📋 El servidor seguirá ejecutándose en otra ventana
echo 🛑 Para detener todo: cierra las ventanas o presiona Ctrl+C
echo.
echo ================================================================
echo.

REM Iniciar servidor web con Node.js (HTTP o HTTPS según elección)
cd web-client
if /i "%USE_HTTPS%"=="S" (
    echo 🔒 Iniciando servidor HTTPS en puerto 8443...
    echo.
    node https-server.js
) else (
    echo 🌐 Iniciando servidor HTTP en puerto 8080...
    echo.
    node simple-server.js
)
