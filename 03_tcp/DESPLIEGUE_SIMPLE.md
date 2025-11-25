# 🚀 Despliegue Simple - Sistema de Chat Ice

## 📋 Requisitos Previos

Antes de ejecutar el proyecto, asegúrate de tener instalado:

1. **Java 17 o superior**
   - Descargar desde: https://adoptium.net/
   - Verificar instalación: `java -version`

2. **Node.js 16 o superior**
   - Descargar desde: https://nodejs.org/
   - Verificar instalación: `node --version`

> ⚠️ **Importante**: Estos son los ÚNICOS requisitos. NO necesitas instalar Ice, Gradle, ni nada más.

---

## 🎯 Inicio Rápido (1 Comando)

### Opción 1: Uso Local (Solo en tu máquina)

```powershell
.\INICIAR.bat
```

Cuando pregunte si configurar IP automáticamente, responde **N** (No).

**Accede en**: http://localhost:8080

---

### Opción 2: Acceso desde Red Local (Otras máquinas)

```powershell
.\INICIAR.bat
```

Cuando pregunte si configurar IP automáticamente, responde **S** (Sí).

El script detectará automáticamente tu IP local (ej: 192.168.1.100) y configurará todo.

**Accede desde**:
- Tu máquina: http://localhost:8080
- Otras máquinas en la red: http://192.168.1.100:8080

---

## 🔥 Configuración del Firewall (Solo para acceso en red)

Si quieres que otras personas en tu red accedan, ejecuta esto **UNA VEZ**:

```powershell
netsh advfirewall firewall add rule name="Chat Ice - Web" dir=in action=allow protocol=TCP localport=8080
netsh advfirewall firewall add rule name="Chat Ice - WebSocket" dir=in action=allow protocol=TCP localport=10001
netsh advfirewall firewall add rule name="Chat Ice - TCP" dir=in action=allow protocol=TCP localport=10000
```

> 💡 **Tip**: Copia y pega estos 3 comandos en PowerShell como **Administrador**

---

## ✅ ¿Qué Hace el Script INICIAR.bat?

El script automáticamente:

1. ✅ Detecta tu IP local
2. ✅ Verifica que tengas Java y Node.js
3. ✅ Instala dependencias de npm (si es necesario)
4. ✅ Compila el servidor Java
5. ✅ Compila el cliente web
6. ✅ (Opcional) Configura el cliente para acceso en red
7. ✅ Inicia el servidor Ice
8. ✅ Inicia el servidor web del cliente
9. ✅ Abre tu navegador automáticamente

**TODO EN UN SOLO COMANDO** 🎉

---

## 🌐 Acceso desde Otras Máquinas

### Paso 1: Obtén tu IP local

El script `INICIAR.bat` te muestra tu IP automáticamente. Por ejemplo:

```
✅ Tu IP local es: 192.168.1.100
```

### Paso 2: Comparte la URL

Dile a otros usuarios que accedan a:

```
http://192.168.1.100:8080
```

> ⚠️ Reemplaza `192.168.1.100` con **TU IP** que el script mostró

### Paso 3: ¡Listo!

Cada usuario ingresa con su nombre y pueden chatear en tiempo real.

---

## 🎤 IMPORTANTE: Acceso al Micrófono en Red Local

⚠️ **Si accedes desde otra máquina por HTTP, el navegador bloqueará el micrófono por seguridad.**

### Soluciones Rápidas:

**Opción A: HTTPS con Certificado (Recomendado)**
```powershell
# Instalar OpenSSL primero: https://slproweb.com/products/Win32OpenSSL.html
cd 03_tcp
.\INICIAR-CLIENTE-HTTPS.bat
# Acceder: https://TU_IP:8443
```

**Opción B: Configurar Chrome (Más Rápido)**
1. En Chrome, ir a: `chrome://flags/#unsafely-treat-insecure-origin-as-secure`
2. Agregar: `http://TU_IP:8080`
3. Seleccionar "Enabled"
4. Reiniciar Chrome

**📖 Guía Completa:** Ver `MICROFONO_RED_LOCAL.md` para instrucciones detalladas

---

## 🛠️ Solución de Problemas

### ❌ Error: "Java no está instalado"

**Solución**:
1. Descargar Java 17+ desde: https://adoptium.net/
2. Instalar con opciones por defecto
3. Reiniciar la terminal
4. Ejecutar `INICIAR.bat` de nuevo

---

### ❌ Error: "Node.js no está instalado"

**Solución**:
1. Descargar Node.js desde: https://nodejs.org/
2. Instalar la versión LTS (recomendada)
3. Reiniciar la terminal
4. Ejecutar `INICIAR.bat` de nuevo

---

### ❌ Error: "Puerto 10001 ya está en uso"

**Causa**: Ya hay una instancia del servidor corriendo.

**Solución**:
```powershell
# Buscar el proceso
netstat -ano | findstr :10001

# Matar el proceso (reemplazar 1234 con el PID real)
taskkill /PID 1234 /F
```

Luego ejecutar `INICIAR.bat` de nuevo.

---

### ❌ No puedo acceder desde otra máquina

**Verificar**:

1. **¿El firewall está configurado?**
   - Ejecuta los comandos de firewall mencionados arriba
   - O desactiva temporalmente el firewall para probar

2. **¿Están en la misma red?**
   - Ambas máquinas deben estar en la misma WiFi/red local
   - No funcionará con datos móviles o redes diferentes

3. **¿Usaste la IP correcta?**
   - Usa la IP que el script mostró (192.168.x.x)
   - NO uses 127.0.0.1 ni localhost desde otra máquina

4. **¿El servidor está corriendo?**
   - Debe haber una ventana que diga "Servidor Ice iniciado"
   - Si se cerró, ejecuta `INICIAR.bat` de nuevo

---

### ❌ Error: "Cannot find module 'ice'"

**Solución**:
```powershell
cd web-client
Remove-Item -Recurse -Force node_modules
npm install
```

Luego ejecutar `INICIAR.bat` de nuevo.

---

## 🔄 Reiniciar el Sistema

Si algo falla o quieres reiniciar:

1. **Cerrar todas las ventanas** del servidor y cliente
2. Ejecutar de nuevo:
   ```powershell
   .\INICIAR.bat
   ```

---

## 🛑 Detener el Sistema

Para detener todo:

1. Presiona **Ctrl+C** en la ventana del servidor web
2. Cierra la ventana del servidor Ice
3. ¡Listo!

---

## 📦 Estructura Después del Despliegue

```
03_tcp/
├── INICIAR.bat                 # ← Script principal (ejecuta esto)
├── DESPLIEGUE_SIMPLE.md        # ← Este archivo
├── server/
│   └── build/
│       └── libs/
│           └── server.jar      # Servidor compilado
└── web-client/
    ├── dist/
    │   ├── bundle.js           # Cliente compilado
    │   └── index.html
    └── src/services/
        └── iceDelegate.js      # Configurado con tu IP
```

---

## 🎓 Para el Evaluador

### ¿Cómo probar el proyecto?

1. Clonar el repositorio
2. Abrir terminal en la carpeta `03_tcp`
3. Ejecutar:
   ```powershell
   .\INICIAR.bat
   ```
4. Responder **N** cuando pregunte por configuración de IP
5. Esperar a que se abra el navegador
6. Ingresar con un nombre de usuario
7. Abrir otra pestaña/ventana de incógnito
8. Acceder a http://localhost:8080
9. Ingresar con otro usuario
10. Probar todas las funcionalidades

**Tiempo estimado**: 3-5 minutos (incluyendo compilación)

### Funcionalidades a probar:

- ✅ Chat privado entre usuarios
- ✅ Creación de grupos
- ✅ Mensajes a grupos
- ✅ Notas de voz (mantener presionado 🎤)
- ✅ Llamadas de audio (botón 📞)
- ✅ Historial persistente (cerrar y abrir navegador)

---

## 🌐 Despliegue en Red Local (Para demostración)

### Escenario: Demostrar a 3+ personas

1. **En tu máquina (servidor)**:
   ```powershell
   .\INICIAR.bat
   ```
   Responder **S** (Sí) para configuración automática de IP

2. **Configurar firewall** (una sola vez):
   ```powershell
   # Ejecutar como Administrador
   netsh advfirewall firewall add rule name="Chat Ice - Web" dir=in action=allow protocol=TCP localport=8080
   netsh advfirewall firewall add rule name="Chat Ice - WebSocket" dir=in action=allow protocol=TCP localport=10001
   netsh advfirewall firewall add rule name="Chat Ice - TCP" dir=in action=allow protocol=TCP localport=10000
   ```

3. **Compartir URL** con los demás:
   ```
   http://TU_IP:8080
   ```
   (El script te muestra tu IP, ej: 192.168.1.100)

4. **Cada persona**:
   - Conecta a la misma WiFi
   - Abre la URL en su navegador
   - Ingresa con su nombre
   - ¡A chatear! 🎉

---

## 🐳 Alternativa: Docker (Opcional - Más Complejo)

Si prefieres usar Docker (NO recomendado para simplicidad):

```powershell
docker-compose up -d
```

Pero esto requiere instalar Docker Desktop, lo cual añade complejidad innecesaria.

**Recomendación**: Usa `INICIAR.bat` que es mucho más simple.

---

## 💡 Tips Adicionales

### Para desarrollo (editar código):

Si necesitas hacer cambios al código:

```powershell
# Terminal 1: Servidor con auto-reload
cd 03_tcp
.\gradlew :server:run --continuous

# Terminal 2: Cliente con hot-reload
cd web-client
npm start
```

Accede en http://localhost:8080 y verás cambios en tiempo real.

---

### Para producción real (Internet público):

El script actual es para **red local solamente**. Para desplegar en Internet:

1. Contratar servidor cloud (AWS, Azure, DigitalOcean)
2. Instalar Java y Node.js en el servidor
3. Subir el proyecto
4. Ejecutar `INICIAR.bat` (funciona igual en el servidor)
5. Configurar dominio y SSL (https://)

Ver `DESPLIEGUE.md` para instrucciones detalladas de cloud.

---

## ✅ Checklist de Despliegue Exitoso

Usa esto para verificar que todo funciona:

- [ ] Ejecuté `INICIAR.bat` sin errores
- [ ] Se abrió el navegador automáticamente
- [ ] Pude ingresar con un usuario
- [ ] Abrí otra ventana/incógnito con otro usuario
- [ ] Ambos usuarios se ven en la lista
- [ ] Puedo enviar mensajes privados
- [ ] Puedo crear un grupo
- [ ] Puedo enviar mensajes al grupo
- [ ] Puedo grabar y enviar nota de voz
- [ ] Puedo hacer una llamada de audio
- [ ] El audio se escucha en ambos lados
- [ ] Al cerrar y abrir, el historial persiste

Si marcaste TODO, ¡el despliegue es exitoso! ✅

---

## 📞 Soporte

Si encuentras problemas:

1. Revisa la sección **Solución de Problemas** arriba
2. Verifica que cumples los **Requisitos Previos**
3. Intenta reiniciar el sistema (cerrar todo y ejecutar de nuevo)
4. Revisa la consola del navegador (F12) para errores JavaScript
5. Revisa la ventana del servidor para errores Java

---

**¡Eso es todo! Tu sistema está listo para usar. 🚀**
