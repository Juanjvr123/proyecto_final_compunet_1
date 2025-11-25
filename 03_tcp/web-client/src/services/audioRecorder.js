/**
 * Audio Recorder Module
 * Graba audio desde el micrófono del navegador usando MediaRecorder API
 */

let mediaRecorder = null;
let audioChunks = [];
let stream = null;
let isRecording = false;

/**
 * Iniciar grabación de audio
 * @returns {Promise<boolean>} true si la grabación comenzó exitosamente
 */
export async function startRecording() {
    try {
        if (isRecording) {
            console.warn('[AUDIO] Ya hay una grabación en curso');
            return false;
        }

        console.log('[AUDIO] 🎤 Solicitando acceso al micrófono...');
        
        // Solicitar permiso de micrófono
        stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                sampleRate: 44100
            } 
        });

        console.log('[AUDIO] ✓ Acceso al micrófono concedido');

        // Determinar el tipo MIME soportado
        let mimeType = 'audio/webm';
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
            mimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
            mimeType = 'audio/ogg;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
            mimeType = 'audio/mp4';
        }

        console.log('[AUDIO] 📝 Using MIME type:', mimeType);

        // Crear MediaRecorder
        mediaRecorder = new MediaRecorder(stream, { mimeType });
        audioChunks = [];

        // Evento: se reciben datos de audio
        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
                console.log('[AUDIO] 📦 Chunk received:', event.data.size, 'bytes');
            }
        };

        // Evento: grabación iniciada
        mediaRecorder.onstart = () => {
            console.log('[AUDIO] ▶️ Grabación iniciada');
            isRecording = true;
        };

        // Evento: grabación detenida
        mediaRecorder.onstop = () => {
            console.log('[AUDIO] ⏹️ Grabación detenida');
            isRecording = false;
        };

        // Iniciar grabación (captura cada 1 segundo)
        mediaRecorder.start(1000);

        return true;

    } catch (error) {
        console.error('[AUDIO] ❌ Error iniciando grabación:', error);
        
        if (error.name === 'NotAllowedError') {
            alert('Permiso de micrófono denegado. Por favor, habilita el micrófono en la configuración del navegador.');
        } else if (error.name === 'NotFoundError') {
            alert('No se encontró ningún micrófono. Por favor, conecta un micrófono.');
        } else {
            alert('Error al acceder al micrófono: ' + error.message);
        }
        
        return false;
    }
}

/**
 * Detener grabación y obtener audio como Uint8Array
 * @returns {Promise<Uint8Array>} Audio en formato byte array
 */
export async function stopRecording() {
    return new Promise((resolve, reject) => {
        if (!mediaRecorder || mediaRecorder.state === 'inactive') {
            reject(new Error('[AUDIO] No hay grabación activa'));
            return;
        }

        console.log('[AUDIO] 🛑 Deteniendo grabación...');

        // Cuando se detenga, procesar el audio
        mediaRecorder.onstop = async () => {
            try {
                // Combinar chunks en un Blob
                const audioBlob = new Blob(audioChunks, { type: mediaRecorder.mimeType });
                console.log('[AUDIO] 💾 Audio Blob created:', audioBlob.size, 'bytes');

                // Convertir Blob a ArrayBuffer
                const arrayBuffer = await audioBlob.arrayBuffer();
                
                // Convertir a Uint8Array para enviar por Ice
                const uint8Array = new Uint8Array(arrayBuffer);
                
                console.log('[AUDIO] ✓ Audio procesado:', uint8Array.length, 'bytes');

                // Limpiar
                cleanup();
                
                resolve(uint8Array);

            } catch (error) {
                console.error('[AUDIO] ❌ Error procesando audio:', error);
                cleanup();
                reject(error);
            }
        };

        // Detener grabación
        mediaRecorder.stop();
    });
}

/**
 * Cancelar grabación sin guardar
 */
export function cancelRecording() {
    console.log('[AUDIO] ❌ Grabación cancelada');
    
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
    }
    
    cleanup();
}

/**
 * Limpiar recursos
 */
function cleanup() {
    // Detener todos los tracks del stream
    if (stream) {
        stream.getTracks().forEach(track => {
            track.stop();
            console.log('[AUDIO] 🔇 Track stopped');
        });
        stream = null;
    }

    // Resetear variables
    mediaRecorder = null;
    audioChunks = [];
    isRecording = false;
}

/**
 * Verificar si hay una grabación activa
 * @returns {boolean}
 */
export function isCurrentlyRecording() {
    return isRecording;
}

/**
 * Reproducir audio desde un Uint8Array
 * @param {Uint8Array} audioData - Datos de audio
 * @param {string} mimeType - Tipo MIME del audio (default: audio/webm)
 * @returns {Promise<void>}
 */
export async function playAudio(audioData, mimeType = 'audio/webm') {
    try {
        console.log('[AUDIO] 🔊 Reproduciendo audio:', audioData.length, 'bytes');

        // Convertir Uint8Array a Blob
        const audioBlob = new Blob([audioData], { type: mimeType });
        
        // Crear URL del blob
        const audioUrl = URL.createObjectURL(audioBlob);
        
        // Crear elemento de audio
        const audio = new Audio(audioUrl);
        
        // Reproducir
        await audio.play();
        
        console.log('[AUDIO] ▶️ Audio reproduciéndose');

        // Limpiar URL cuando termine
        audio.onended = () => {
            URL.revokeObjectURL(audioUrl);
            console.log('[AUDIO] ✓ Audio finalizado');
        };

    } catch (error) {
        console.error('[AUDIO] ❌ Error reproduciendo audio:', error);
        throw error;
    }
}

/**
 * Verificar si el navegador soporta grabación de audio
 * @returns {boolean}
 */
export function isAudioRecordingSupported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
}

/**
 * Obtener información sobre soporte de audio
 * @returns {Object}
 */
export function getAudioSupport() {
    return {
        mediaDevices: !!navigator.mediaDevices,
        getUserMedia: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
        mediaRecorder: !!window.MediaRecorder,
        supportedTypes: {
            webmOpus: MediaRecorder.isTypeSupported('audio/webm;codecs=opus'),
            webm: MediaRecorder.isTypeSupported('audio/webm'),
            oggOpus: MediaRecorder.isTypeSupported('audio/ogg;codecs=opus'),
            mp4: MediaRecorder.isTypeSupported('audio/mp4')
        }
    };
}
