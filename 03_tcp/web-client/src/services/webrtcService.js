/**
 * Audio Streaming Service - Manejo de llamadas de audio vía WebSocket
 */

import { sendAudioChunk, endCall, acceptCall } from './iceDelegate.js';

let localStream = null;
let remoteUsername = null;
let currentUsername = null;
let mediaRecorder = null;
let isStreaming = false;
let audioContext = null;
let audioQueue = [];
let isPlaying = false;
let audioElement = null;
let sourceBuffer = null;
let mediaSource = null;
let pendingChunks = [];
let isCallActive = false; // Flag para saber si la llamada está activa

/**
 * Inicializar el servicio WebRTC
 */
export function initWebRTC(username) {
    currentUsername = username;
    console.log('[WebRTC] Service initialized for user:', username);
}

/**
 * Activar la llamada (para cuando se acepta desde el otro lado)
 */
export function activateCall() {
    isCallActive = true;
    console.log('[AUDIO-WS] Call activated - audio reception enabled');
}

/**
 * Iniciar llamada (iniciar streaming de audio)
 */
export async function startCall(from, to, audioOnly = false) {
    try {
        console.log('[AUDIO-WS] Starting call from', from, 'to', to);
        remoteUsername = to;
        currentUsername = from;
        
        // Desbloquear autoplay con audio silencioso (user interaction)
        await unlockAudioPlayback();
        
        // IMPORTANTE: Inicializar MediaSource para recibir audio (bidireccional)
        await initMediaSource();
        console.log('[AUDIO-WS] MediaSource ready for receiving audio');
        
        // Obtener stream local
        const constraints = { audio: true, video: false };
        localStream = await navigator.mediaDevices.getUserMedia(constraints);
        console.log('[AUDIO-WS] Local stream obtained');
        
        // MARCAR LLAMADA COMO ACTIVA antes de iniciar streaming
        isCallActive = true;
        
        // Iniciar streaming de audio
        await startAudioStreaming(from, to);
        console.log('[AUDIO-WS] Audio streaming active - bidirectional ready');
        
        return { success: true, localStream };
        
    } catch (error) {
        console.error('[AUDIO-WS] Error starting call:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Iniciar streaming de audio por WebSocket
 */
async function startAudioStreaming(from, to) {
    try {
        // Configurar MediaRecorder para capturar audio en chunks pequeños
        const options = { mimeType: 'audio/webm;codecs=opus' };
        mediaRecorder = new MediaRecorder(localStream, options);
        
        // Enviar chunks de audio en tiempo real
        mediaRecorder.ondataavailable = async (event) => {
            if (event.data.size > 0 && isStreaming) {
                const arrayBuffer = await event.data.arrayBuffer();
                const uint8Array = new Uint8Array(arrayBuffer);
                
                // Enviar chunk por WebSocket
                await sendAudioChunk(from, to, uint8Array);
                console.log('[AUDIO-WS] Sent audio chunk:', uint8Array.length, 'bytes');
            }
        };
        
        mediaRecorder.onstart = () => {
            console.log('[AUDIO-WS] ▶️ Audio streaming started');
            isStreaming = true;
        };
        
        mediaRecorder.onstop = () => {
            console.log('[AUDIO-WS] ⏹️ Audio streaming stopped');
            isStreaming = false;
        };
        
        // Iniciar grabación con chunks de 500ms 
        // (necesario para que cada chunk tenga headers WebM válidos)
        mediaRecorder.start(500);
        
    } catch (error) {
        console.error('[AUDIO-WS] Error starting audio streaming:', error);
        throw error;
    }
}

/**
 * Responder a una llamada entrante
 */
export async function answerCall(from, to, audioOnly = false) {
    try {
        console.log('[AUDIO-WS] Answering call from', from);
        remoteUsername = from;
        currentUsername = to;
        
        // Desbloquear autoplay con audio silencioso (user interaction)
        await unlockAudioPlayback();
        
        // Inicializar MediaSource para recibir audio
        await initMediaSource();
        
        // Obtener stream local
        const constraints = { audio: true, video: false };
        localStream = await navigator.mediaDevices.getUserMedia(constraints);
        console.log('[AUDIO-WS] Local stream obtained');
        
        // MARCAR LLAMADA COMO ACTIVA antes de aceptar
        isCallActive = true;
        
        // Notificar aceptación al servidor
        await acceptCall(to, from);
        
        // Iniciar streaming de audio
        await startAudioStreaming(to, from);
        
        return { success: true, localStream };
        
    } catch (error) {
        console.error('[AUDIO-WS] Error answering call:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Desbloquear reproducción de audio (soluciona NotAllowedError)
 */
async function unlockAudioPlayback() {
    try {
        // Crear audio context y reproducir silencio brevemente
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        // Crear buffer de silencio
        const buffer = audioContext.createBuffer(1, 1, 22050);
        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContext.destination);
        source.start(0);
        
        console.log('[AUDIO-WS] Audio playback unlocked');
    } catch (error) {
        console.warn('[AUDIO-WS] Could not unlock audio:', error);
    }
}

/**
 * Inicializar MediaSource para streaming de audio
 */
function initMediaSource() {
    return new Promise((resolve, reject) => {
        if (audioElement && mediaSource && mediaSource.readyState === 'open') {
            resolve();
            return;
        }
        
        // Limpiar existentes
        if (audioElement) {
            audioElement.pause();
            audioElement.src = '';
        }
        
        audioElement = new Audio();
        audioElement.autoplay = true;
        audioElement.volume = 1.0;
        
        mediaSource = new MediaSource();
        audioElement.src = URL.createObjectURL(mediaSource);
        
        mediaSource.addEventListener('sourceopen', () => {
            if (mediaSource.readyState === 'open' && !sourceBuffer) {
                try {
                    sourceBuffer = mediaSource.addSourceBuffer('audio/webm; codecs="opus"');
                    sourceBuffer.mode = 'sequence';
                    
                    sourceBuffer.addEventListener('updateend', () => {
                        if (pendingChunks.length > 0 && !sourceBuffer.updating) {
                            const nextChunk = pendingChunks.shift();
                            try {
                                sourceBuffer.appendBuffer(nextChunk);
                            } catch (e) {
                                console.warn('[AUDIO-WS] Error appending queued chunk:', e.message);
                            }
                        }
                    });
                    
                    sourceBuffer.addEventListener('error', (e) => {
                        console.error('[AUDIO-WS] SourceBuffer error:', e);
                    });
                    
                    console.log('[AUDIO-WS] MediaSource initialized for streaming');
                    resolve();
                } catch (error) {
                    console.error('[AUDIO-WS] Error creating SourceBuffer:', error);
                    reject(error);
                }
            }
        });
        
        mediaSource.addEventListener('sourceended', () => {
            console.log('[AUDIO-WS] MediaSource ended');
        });
        
        mediaSource.addEventListener('error', (e) => {
            console.error('[AUDIO-WS] MediaSource error:', e);
            reject(e);
        });
        
        // Timeout si no se inicializa en 5 segundos
        setTimeout(() => {
            if (!sourceBuffer) {
                reject(new Error('MediaSource initialization timeout'));
            }
        }, 5000);
    });
}

/**
 * Recibir y reproducir chunk de audio
 */
export async function receiveAudioChunk(audioData) {
    try {
        // Ignorar chunks muy pequeños
        if (audioData.length < 100) {
            return;
        }
        
        // CRÍTICO: Solo procesar audio si la llamada está activa
        if (!isCallActive) {
            console.log('[AUDIO-WS] Ignorando chunk - llamada no activa aún');
            return;
        }
        
        // Inicializar MediaSource si no existe
        if (!mediaSource || mediaSource.readyState !== 'open') {
            pendingChunks.push(audioData);
            if (!mediaSource) {
                await initMediaSource();
            }
            return;
        }
        
        // Si sourceBuffer está listo y no está actualizando
        if (sourceBuffer && !sourceBuffer.updating && mediaSource.readyState === 'open') {
            try {
                sourceBuffer.appendBuffer(audioData);
                console.log('[AUDIO-WS] 🔊 Appended audio chunk:', audioData.length, 'bytes');
            } catch (error) {
                console.warn('[AUDIO-WS] Error appending chunk:', error.message);
                // Si falla, agregar a cola
                pendingChunks.push(audioData);
            }
        } else {
            // Agregar a cola de pendientes
            pendingChunks.push(audioData);
        }
        
    } catch (error) {
        console.error('[AUDIO-WS] Error receiving audio chunk:', error);
    }
}

/**
 * Terminar llamada
 */
export async function hangUp(from, to) {
    try {
        console.log('[AUDIO-WS] Hanging up call');
        
        // Resetear flag de llamada activa
        isCallActive = false;
        
        // Detener streaming
        if (mediaRecorder && mediaRecorder.state !== 'inactive') {
            mediaRecorder.stop();
        }
        isStreaming = false;
        
        // Detener tracks locales
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            localStream = null;
        }
        
        // Limpiar MediaSource
        if (mediaSource && mediaSource.readyState === 'open') {
            try {
                mediaSource.endOfStream();
            } catch (e) {}
        }
        
        if (audioElement) {
            audioElement.pause();
            audioElement.src = '';
            audioElement = null;
        }
        
        mediaSource = null;
        sourceBuffer = null;
        pendingChunks = [];
        
        // Limpiar colas de audio
        audioQueue = [];
        isPlaying = false;
        
        // Cerrar AudioContext
        if (audioContext && audioContext.state !== 'closed') {
            await audioContext.close();
            audioContext = null;
        }
        
        // Notificar al servidor
        if (to) {
            await endCall(from, to);
        }
        
        // Limpiar UI
        clearCallUI();
        
        console.log('[AUDIO-WS] Call ended');
        
    } catch (error) {
        console.error('[AUDIO-WS] Error hanging up:', error);
    }
}

/**
 * Obtener stream local actual
 */
export function getLocalStream() {
    return localStream;
}

/**
 * Mostrar indicador de audio remoto en la UI
 */
function displayRemoteStream() {
    console.log('[AUDIO-WS] Audio streaming active');
    
    const remoteAudioIndicator = document.getElementById('remoteAudioIndicator');
    if (remoteAudioIndicator) {
        remoteAudioIndicator.style.display = 'block';
        remoteAudioIndicator.innerHTML = '🔊 Recibiendo audio...';
    }
}

/**
 * Limpiar UI de llamada
 */
function clearCallUI() {
    const remoteVideo = document.getElementById('remoteVideo');
    if (remoteVideo) {
        remoteVideo.srcObject = null;
        remoteVideo.remove();
    }
    
    const localVideo = document.getElementById('localVideo');
    if (localVideo) {
        localVideo.srcObject = null;
    }
}
