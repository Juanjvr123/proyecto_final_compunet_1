/**
 * Servidor HTTPS con certificado autofirmado para desarrollo
 * Permite acceso al micrófono desde otras máquinas en la red
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 8443; // Puerto HTTPS estándar alternativo
const DIST_DIR = path.join(__dirname, 'dist');
const CERT_DIR = path.join(__dirname, 'certs');

// Tipos MIME
const mimeTypes = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

// Función para generar certificado autofirmado
function generateSelfSignedCert() {
    if (!fs.existsSync(CERT_DIR)) {
        fs.mkdirSync(CERT_DIR, { recursive: true });
    }

    const keyPath = path.join(CERT_DIR, 'server.key');
    const certPath = path.join(CERT_DIR, 'server.crt');

    // Si ya existen, no regenerar
    if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
        console.log('✅ Certificados existentes encontrados');
        return { keyPath, certPath };
    }

    console.log('🔐 Generando certificado autofirmado...');
    
    try {
        // Generar clave privada
        execSync(`openssl genrsa -out "${keyPath}" 2048`, { stdio: 'inherit' });
        
        // Generar certificado (válido por 365 días)
        execSync(
            `openssl req -new -x509 -key "${keyPath}" -out "${certPath}" -days 365 -subj "/CN=localhost"`,
            { stdio: 'inherit' }
        );
        
        console.log('✅ Certificado generado exitosamente');
    } catch (error) {
        console.error('❌ Error generando certificado. Asegúrate de tener OpenSSL instalado.');
        console.error('   Descarga OpenSSL: https://slproweb.com/products/Win32OpenSSL.html');
        process.exit(1);
    }

    return { keyPath, certPath };
}

// Generar o cargar certificados
const { keyPath, certPath } = generateSelfSignedCert();

const options = {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath)
};

const server = https.createServer(options, (req, res) => {
    console.log(`📥 ${req.method} ${req.url}`);

    // Resolver la ruta del archivo
    let filePath = path.join(DIST_DIR, req.url === '/' ? 'index.html' : req.url);

    // Si la ruta no tiene extensión, asumir que es index.html (para SPA routing)
    if (!path.extname(filePath)) {
        filePath = path.join(DIST_DIR, 'index.html');
    }

    // Determinar el tipo MIME
    const extname = path.extname(filePath);
    const contentType = mimeTypes[extname] || 'application/octet-stream';

    // Leer y servir el archivo
    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                // Archivo no encontrado - servir index.html (para SPA routing)
                fs.readFile(path.join(DIST_DIR, 'index.html'), (err, indexContent) => {
                    if (err) {
                        res.writeHead(500);
                        res.end('Error del servidor: ' + err.code);
                    } else {
                        res.writeHead(200, { 'Content-Type': 'text/html' });
                        res.end(indexContent, 'utf-8');
                    }
                });
            } else {
                // Error del servidor
                res.writeHead(500);
                res.end('Error del servidor: ' + error.code);
            }
        } else {
            // Éxito - servir el archivo
            res.writeHead(200, { 
                'Content-Type': contentType,
                'Cache-Control': 'no-cache, no-store, must-revalidate'
            });
            res.end(content, 'utf-8');
            console.log(`✅ Archivo servido: ${filePath}`);
        }
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log('================================================================');
    console.log('   🔒 SERVIDOR HTTPS INICIADO (DESARROLLO)');
    console.log('================================================================');
    console.log('');
    console.log(`📂 Sirviendo archivos desde: ${DIST_DIR}`);
    console.log('');
    console.log('🌐 Acceso local:');
    console.log(`   https://localhost:${PORT}`);
    console.log(`   https://127.0.0.1:${PORT}`);
    console.log('');
    console.log('🌐 Acceso desde red local:');
    
    // Obtener IPs locales
    const networkInterfaces = os.networkInterfaces();
    for (const name of Object.keys(networkInterfaces)) {
        for (const net of networkInterfaces[name]) {
            // Solo IPv4 y no loopback
            if (net.family === 'IPv4' && !net.internal) {
                console.log(`   https://${net.address}:${PORT}`);
            }
        }
    }
    
    console.log('');
    console.log('⚠️  IMPORTANTE - CERTIFICADO AUTOFIRMADO:');
    console.log('   1. Al acceder, el navegador mostrará una advertencia de seguridad');
    console.log('   2. Haz clic en "Avanzado" o "Advanced"');
    console.log('   3. Luego en "Continuar al sitio" o "Proceed to site"');
    console.log('   4. Esto es normal para certificados autofirmados en desarrollo');
    console.log('');
    console.log('🎤 Con HTTPS, el navegador permitirá acceso al micrófono');
    console.log('');
    console.log('🛑 Presiona Ctrl+C para detener');
    console.log('================================================================');
    console.log('');
});
