/**
 * WebRTC Service - Manejo de llamadas de audio/video
 */

import { sendWebRTCSignal, sendICECandidate, endCall } from './iceDelegate.js';

let peerConnection = null;
let localStream = null;
let remoteUsername = null;
let currentUsername = null;

// Buffer para almacenar offer/candidates que llegan antes de aceptar
let pendingOffer = null;
let pendingCandidates = [];

// Configuración de servidores STUN/TURN (Google public STUN servers)
const iceServers = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
    ]
};

/**
 * Inicializar el servicio WebRTC
 */
export function initWebRTC(username) {
    currentUsername = username;
    console.log('[WebRTC] Service initialized for user:', username);
}

/**
 * Iniciar llamada (crear offer)
 */
export async function startCall(from, to, audioOnly = false) {
    try {
        console.log('[WebRTC] Starting call from', from, 'to', to);
        remoteUsername = to;
        
        // Obtener stream local (audio y/o video)
        const constraints = audioOnly ? { audio: true, video: false } : { audio: true, video: true };
        localStream = await navigator.mediaDevices.getUserMedia(constraints);
        console.log('[WebRTC] Local stream obtained');
        console.log('[WebRTC] Local audio tracks:', localStream.getAudioTracks().length);
        console.log('[WebRTC] Local video tracks:', localStream.getVideoTracks().length);
        
        // Verificar que los tracks de audio estén habilitados
        localStream.getAudioTracks().forEach(track => {
            console.log('[WebRTC] Local audio track:', track.id, 'enabled:', track.enabled, 'muted:', track.muted);
        });
        
        // Crear PeerConnection
        peerConnection = new RTCPeerConnection(iceServers);
        console.log('[WebRTC] PeerConnection created for calling');
        
        // Agregar tracks del stream local
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
            console.log('[WebRTC] Added local track to peer:', track.kind, 'enabled:', track.enabled);
        });
        
        // Manejar ICE candidates
        peerConnection.onicecandidate = async (event) => {
            if (event.candidate) {
                console.log('[WebRTC] Sending ICE candidate');
                await sendICECandidate(from, to, JSON.stringify(event.candidate));
            }
        };
        
        // Manejar stream remoto
        peerConnection.ontrack = (event) => {
            console.log('[WebRTC] 🎵 Remote track received (caller):', event.track.kind);
            console.log('[WebRTC] Track enabled:', event.track.enabled);
            console.log('[WebRTC] Track muted:', event.track.muted);
            console.log('[WebRTC] Track readyState:', event.track.readyState);
            
            const [remoteStream] = event.streams;
            if (remoteStream) {
                console.log('[WebRTC] Remote stream tracks:', remoteStream.getTracks().map(t => `${t.kind}: enabled=${t.enabled}, muted=${t.muted}, readyState=${t.readyState}`));
                displayRemoteStream(remoteStream);
            } else {
                console.error('[WebRTC] No remote stream in event!');
            }
        };
        
        // Manejar cambios en el estado de conexión
        peerConnection.onconnectionstatechange = () => {
            console.log('[WebRTC] Connection state:', peerConnection.connectionState);
        };
        
        peerConnection.oniceconnectionstatechange = () => {
            console.log('[WebRTC] ICE connection state:', peerConnection.iceConnectionState);
        };
        
        // Crear offer
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        console.log('[WebRTC] Offer created');
        
        // Enviar offer al otro usuario
        await sendWebRTCSignal(from, to, 'offer', JSON.stringify(offer));
        
        return { success: true, localStream };
        
    } catch (error) {
        console.error('[WebRTC] Error starting call:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Responder a una llamada entrante (crear answer)
 */
export async function answerCall(from, to, audioOnly = false) {
    try {
        console.log('[WebRTC] Answering call from', from);
        remoteUsername = from;
        
        // Obtener stream local
        const constraints = audioOnly ? { audio: true, video: false } : { audio: true, video: true };
        localStream = await navigator.mediaDevices.getUserMedia(constraints);
        console.log('[WebRTC] Local stream obtained');
        console.log('[WebRTC] Local audio tracks:', localStream.getAudioTracks().length);
        console.log('[WebRTC] Local video tracks:', localStream.getVideoTracks().length);
        
        // Crear PeerConnection
        peerConnection = new RTCPeerConnection(iceServers);
        console.log('[WebRTC] PeerConnection created for answering');
        
        // Agregar tracks del stream local
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
            console.log('[WebRTC] Added local track to peer:', track.kind, 'enabled:', track.enabled);
        });
        
        // Manejar ICE candidates
        peerConnection.onicecandidate = async (event) => {
            if (event.candidate) {
                console.log('[WebRTC] Sending ICE candidate');
                await sendICECandidate(to, from, JSON.stringify(event.candidate));
            }
        };
        
        // Manejar stream remoto
        peerConnection.ontrack = (event) => {
            console.log('[WebRTC] 🎵 Remote track received (answer):', event.track.kind);
            console.log('[WebRTC] Track enabled:', event.track.enabled);
            console.log('[WebRTC] Track muted:', event.track.muted);
            console.log('[WebRTC] Track readyState:', event.track.readyState);
            
            const [remoteStream] = event.streams;
            if (remoteStream) {
                console.log('[WebRTC] Remote stream tracks:', remoteStream.getTracks().map(t => `${t.kind}: enabled=${t.enabled}, muted=${t.muted}, readyState=${t.readyState}`));
                displayRemoteStream(remoteStream);
            } else {
                console.error('[WebRTC] No remote stream in event!');
            }
        };
        
        // Manejar cambios en el estado de conexión
        peerConnection.onconnectionstatechange = () => {
            console.log('[WebRTC] Connection state:', peerConnection.connectionState);
        };
        
        peerConnection.oniceconnectionstatechange = () => {
            console.log('[WebRTC] ICE connection state:', peerConnection.iceConnectionState);
        };
        
        // Procesar offer y candidates pendientes
        if (pendingOffer) {
            console.log('[WebRTC] Processing pending offer...');
            const { from: offerFrom, to: offerTo, offerData } = pendingOffer;
            pendingOffer = null;
            
            const offer = JSON.parse(offerData);
            await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
            console.log('[WebRTC] ✅ Pending offer processed');
            
            // Crear answer
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            console.log('[WebRTC] Answer created');
            
            // Enviar answer
            await sendWebRTCSignal(offerTo, offerFrom, 'answer', JSON.stringify(answer));
        }
        
        // Procesar candidates pendientes
        if (pendingCandidates.length > 0) {
            console.log(`[WebRTC] Processing ${pendingCandidates.length} pending ICE candidates...`);
            for (const { candidateData } of pendingCandidates) {
                try {
                    const candidate = JSON.parse(candidateData);
                    await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
                    console.log('[WebRTC] ✅ Pending ICE candidate added');
                } catch (err) {
                    console.error('[WebRTC] Error adding pending candidate:', err);
                }
            }
            pendingCandidates = [];
        }
        
        return { success: true, localStream };
        
    } catch (error) {
        console.error('[WebRTC] Error answering call:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Manejar offer recibido
 */
export async function handleOffer(from, to, offerData) {
    try {
        console.log('[WebRTC] Handling offer from', from);
        
        if (!peerConnection) {
            console.warn('[WebRTC] PeerConnection not initialized yet, storing offer for later');
            pendingOffer = { from, to, offerData };
            return;
        }
        
        const offer = JSON.parse(offerData);
        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        console.log('[WebRTC] Remote description set');
        
        // Crear answer
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        console.log('[WebRTC] Answer created');
        
        // Enviar answer
        await sendWebRTCSignal(to, from, 'answer', JSON.stringify(answer));
        
    } catch (error) {
        console.error('[WebRTC] Error handling offer:', error);
    }
}

/**
 * Manejar answer recibido
 */
export async function handleAnswer(from, answerData) {
    try {
        console.log('[WebRTC] Handling answer from', from);
        
        if (!peerConnection) {
            console.error('[WebRTC] PeerConnection not initialized');
            return;
        }
        
        const answer = JSON.parse(answerData);
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        console.log('[WebRTC] Remote description set');
        
    } catch (error) {
        console.error('[WebRTC] Error handling answer:', error);
    }
}

/**
 * Agregar candidato ICE recibido
 */
export async function addICECandidate(from, candidateData) {
    try {
        console.log('[WebRTC] Adding ICE candidate from', from);
        
        if (!peerConnection) {
            console.warn('[WebRTC] PeerConnection not initialized yet, storing candidate for later');
            pendingCandidates.push({ from, candidateData });
            return;
        }
        
        const candidate = JSON.parse(candidateData);
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        console.log('[WebRTC] ICE candidate added');
        
    } catch (error) {
        console.error('[WebRTC] Error adding ICE candidate:', error);
    }
}

/**
 * Terminar llamada
 */
export async function hangUp(from, to) {
    try {
        console.log('[WebRTC] Hanging up call');
        
        // Detener tracks locales
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            localStream = null;
        }
        
        // Cerrar PeerConnection
        if (peerConnection) {
            peerConnection.close();
            peerConnection = null;
        }
        
        // Limpiar buffers pendientes
        pendingOffer = null;
        pendingCandidates = [];
        
        // Notificar al servidor
        if (to) {
            await endCall(from, to);
        }
        
        // Limpiar UI
        clearCallUI();
        
        console.log('[WebRTC] Call ended');
        
    } catch (error) {
        console.error('[WebRTC] Error hanging up:', error);
    }
}

/**
 * Obtener stream local actual
 */
export function getLocalStream() {
    return localStream;
}

/**
 * Mostrar stream remoto en la UI
 */
function displayRemoteStream(stream) {
    console.log('[WebRTC] Displaying remote stream');
    console.log('[WebRTC] Stream has audio tracks:', stream.getAudioTracks().length);
    console.log('[WebRTC] Stream has video tracks:', stream.getVideoTracks().length);
    
    // Función para intentar configurar el video remoto
    const trySetRemoteVideo = (retries = 0) => {
        const remoteVideo = document.getElementById('remoteVideo');
        
        if (!remoteVideo) {
            if (retries < 10) {
                console.log(`[WebRTC] Remote video not found, retry ${retries + 1}/10`);
                setTimeout(() => trySetRemoteVideo(retries + 1), 100);
            } else {
                console.error('[WebRTC] Remote video element not found after 10 retries');
            }
            return;
        }
        
        console.log('[WebRTC] Remote video element found, configuring...');
        
        // Configurar y asignar stream
        remoteVideo.srcObject = stream;
        remoteVideo.muted = false; // IMPORTANTE: no mutear el audio remoto
        remoteVideo.volume = 1.0; // Volumen al máximo
        
        // Forzar reproducción
        remoteVideo.play().then(() => {
            console.log('[WebRTC] ✅ Remote video playing successfully with audio');
            console.log('[WebRTC] Audio tracks enabled:', stream.getAudioTracks().map(t => t.enabled));
        }).catch(err => {
            console.error('[WebRTC] Error playing remote video:', err);
        });
    };
    
    // Intentar inmediatamente o con reintentos
    trySetRemoteVideo();
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
