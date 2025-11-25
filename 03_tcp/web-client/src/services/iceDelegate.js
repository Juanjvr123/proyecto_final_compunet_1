/**
 * ICE Delegate Service - Comunicación con el backend Java vía Ice con WebSocket
 * Incluye callbacks para notificaciones en tiempo real
 */

import { Ice } from 'ice';

// Importar el módulo generado - se carga globalmente
import '../generated/Chat.js';
const Chat = window.Chat || Ice._ModuleRegistry.module("Chat");

const HOSTNAME = 'localhost';
const ICE_PORT = 10001; // WebSocket port

let communicator = null;
let chatServicePrx = null;
let callbackAdapter = null;
let currentUsername = null;

// Callbacks para notificaciones en tiempo real
let onMessageReceivedCallback = null;
let onUserStatusChangedCallback = null;
let onGroupMemberAddedCallback = null;
let onVoiceNoteReceivedCallback = null;

// Callbacks para llamadas WebRTC
let onIncomingCallCallback = null;
let onWebRTCSignalCallback = null;
let onICECandidateCallback = null;
let onCallEndedCallback = null;

/**
 * Implementación del callback ChatCallback
 * Hereda de la clase generada Chat.ChatCallback
 */
const ChatCallbackI = class extends Chat.ChatCallback {
    
    onNewMessage(msg, current) {
        console.log('[ICE CALLBACK] 📨 ¡¡¡onNewMessage INVOCADO!!!');
        console.log('[ICE CALLBACK] Message:', msg);
        console.log('[ICE CALLBACK] From:', msg.from, 'To:', msg.to, 'Content:', msg.content);
        
        try {
            if (onMessageReceivedCallback) {
                onMessageReceivedCallback({
                    from: msg.from,
                    to: msg.to,
                    content: msg.content,
                    timestamp: msg.timestamp,
                    isGroup: msg.isGroup
                });
                console.log('[ICE CALLBACK] ✅ Message callback executed');
            } else {
                console.error('[ICE CALLBACK] ❌ No message callback registered!');
            }
        } catch (error) {
            console.error('[ICE CALLBACK] Error in callback:', error);
        }
    }
    
    onUserStatusChanged(user, current) {
        console.log('[ICE CALLBACK] 👤 User status changed:', user);
        try {
            if (onUserStatusChangedCallback) {
                onUserStatusChangedCallback({
                    username: user.username,
                    isOnline: user.isOnline
                });
            }
        } catch (error) {
            console.error('[ICE CALLBACK] Error in status callback:', error);
        }
    }
    
    onGroupMemberAdded(groupName, username, current) {
        console.log('[ICE CALLBACK] 👥 Group member added:', groupName, username);
        try {
            if (onGroupMemberAddedCallback) {
                onGroupMemberAddedCallback(groupName, username);
            }
        } catch (error) {
            console.error('[ICE CALLBACK] Error in group callback:', error);
        }
    }
    
    onVoiceNoteReceived(from, to, audioData, isGroup, current) {
        console.log('[ICE CALLBACK] 🎤 Voice note received from:', from, 'to:', to, 'isGroup:', isGroup, 'Size:', audioData.length);
        try {
            if (onVoiceNoteReceivedCallback) {
                onVoiceNoteReceivedCallback(from, to, audioData, isGroup);
            }
        } catch (error) {
            console.error('[ICE CALLBACK] Error in voice callback:', error);
        }
    }
    
    // ===== CALLBACKS DE LLAMADAS WEBRTC =====
    
    onIncomingCall(from, current) {
        console.log('[ICE CALLBACK] 📞 Incoming call from:', from);
        try {
            if (onIncomingCallCallback) {
                onIncomingCallCallback(from);
            }
        } catch (error) {
            console.error('[ICE CALLBACK] Error in incoming call callback:', error);
        }
    }
    
    onWebRTCSignal(from, signalType, signalData, current) {
        console.log('[ICE CALLBACK] 🔄 WebRTC signal from:', from, 'type:', signalType);
        try {
            if (onWebRTCSignalCallback) {
                onWebRTCSignalCallback(from, signalType, signalData);
            }
        } catch (error) {
            console.error('[ICE CALLBACK] Error in WebRTC signal callback:', error);
        }
    }
    
    onICECandidate(from, candidate, current) {
        console.log('[ICE CALLBACK] 🧊 ICE candidate from:', from);
        try {
            if (onICECandidateCallback) {
                onICECandidateCallback(from, candidate);
            }
        } catch (error) {
            console.error('[ICE CALLBACK] Error in ICE candidate callback:', error);
        }
    }
    
    onCallEnded(from, current) {
        console.log('[ICE CALLBACK] ☎️ Call ended by:', from);
        try {
            if (onCallEndedCallback) {
                onCallEndedCallback(from);
            }
        } catch (error) {
            console.error('[ICE CALLBACK] Error in call ended callback:', error);
        }
    }
}

/**
 * Inicializar conexión Ice con callbacks bidireccionales
 */
export async function initIce(username, callbacks = {}) {
    try {
        console.log('[ICE] 🚀 Initializing Ice communicator...');
        
        // Guardar callbacks
        onMessageReceivedCallback = callbacks.onMessageReceived;
        onUserStatusChangedCallback = callbacks.onUserStatusChanged;
        onGroupMemberAddedCallback = callbacks.onGroupMemberAdded;
        onVoiceNoteReceivedCallback = callbacks.onVoiceNoteReceived;
        
        // Callbacks de llamadas
        onIncomingCallCallback = callbacks.onIncomingCall;
        onWebRTCSignalCallback = callbacks.onWebRTCSignal;
        onICECandidateCallback = callbacks.onICECandidate;
        onCallEndedCallback = callbacks.onCallEnded;
        
        currentUsername = username;
        
        // Inicializar comunicador Ice
        const initData = new Ice.InitializationData();
        initData.properties = Ice.createProperties();
        initData.properties.setProperty("Ice.Default.Protocol", "ws");
        
        communicator = Ice.initialize(initData);
        console.log('[ICE] ✓ Communicator initialized');
        
        // Crear proxy al servicio ChatService via WebSocket
        const proxyString = `ChatService:ws -h ${HOSTNAME} -p ${ICE_PORT}`;
        console.log('[ICE] 📡 Connecting to:', proxyString);
        
        const proxy = communicator.stringToProxy(proxyString);
        
        // Hacer checkedCast con el proxy del servicio
        chatServicePrx = await Chat.ChatServicePrx.checkedCast(proxy);
        
        if (!chatServicePrx) {
            throw new Error("Invalid proxy - ChatService not available");
        }
        
        console.log('[ICE] ✓ Connected to ChatService');
        
        // Crear adaptador para callbacks (comunicación bidireccional)
        console.log('[ICE] 🔄 Creating callback adapter...');
        callbackAdapter = await communicator.createObjectAdapter("");
        
        // CRÍTICO: Obtener la conexión cacheada y vincular el adaptador
        const connection = chatServicePrx.ice_getCachedConnection();
        connection.setAdapter(callbackAdapter);
        console.log('[ICE] ✓ Adapter linked to connection');
        
        // Crear callback servant
        const callbackServant = new ChatCallbackI();
        
        // Agregar servant con UUID automático (patrón del profesor)
        const callbackPrx = Chat.ChatCallbackPrx.uncheckedCast(
            callbackAdapter.addWithUUID(callbackServant)
        );
        
        console.log('[ICE] ✓ Callback proxy created:', callbackPrx.toString());
        
        // Login con callback para notificaciones push
        console.log('[ICE] 🔐 Logging in user:', username);
        const response = await chatServicePrx.login(username, callbackPrx);
        
        console.log('[ICE] ✅ Login complete:', response.message);
        
        return {
            success: response.success,
            message: response.message
        };
        
    } catch (error) {
        console.error('[ICE] ❌ Error initializing Ice:', error);
        return {
            success: false,
            message: error.message || 'Error connecting to Ice server'
        };
    }
}

/**
 * Cerrar conexión Ice
 */
export async function shutdownIce() {
    try {
        if (currentUsername && chatServicePrx) {
            await chatServicePrx.logout(currentUsername);
        }
        
        if (callbackAdapter) {
            await callbackAdapter.destroy();
        }
        
        if (communicator) {
            await communicator.destroy();
        }
        
        console.log('[ICE] 🛑 Ice connection closed');
    } catch (error) {
        console.error('[ICE] Error shutting down Ice:', error);
    }
}

/**
 * Initialize Ice communicator and get proxy (helper interno)
 */
async function getProxy() {
    if (chatServicePrx) {
        return chatServicePrx;
    }
    throw new Error('[ICE] Not connected. Call initIce() first.');
}

/**
 * Login to chat (legacy - use initIce instead)
 */
export async function login(username) {
    // El login real se hace en initIce
    return { success: true, message: 'Use initIce instead' };
}

/**
 * Logout from chat
 */
export async function logout(username) {
    try {
        const proxy = await getProxy();
        const response = await proxy.logout(username);
        await shutdownIce();
        
        return {
            success: response.success,
            message: response.message
        };
    } catch (error) {
        console.error('[ICE] Logout error:', error);
        return { success: false, message: error.message };
    }
}

/**
 * Get online users
 */
export async function getOnlineUsers() {
    try {
        const proxy = await getProxy();
        const users = await proxy.getOnlineUsers();
        
        // Convertir Ice sequence a array JavaScript
        const usersArray = users ? Array.from(users) : [];
        
        console.log('[ICE] getOnlineUsers result:', usersArray);
        
        return {
            success: true,
            users: usersArray
        };
    } catch (error) {
        console.error('[ICE] Get users error:', error);
        return { success: false, message: error.message };
    }
}

/**
 * Get all users with status
 */
export async function getAllUsers() {
    try {
        const proxy = await getProxy();
        const usersMap = await proxy.getAllUsers();
        
        // Convertir Ice Map a objeto JavaScript
        const usersObj = {};
        if (usersMap) {
            if (usersMap instanceof Map) {
                usersMap.forEach((value, key) => {
                    usersObj[key] = value;
                });
            } else {
                // Ya es un objeto plano
                Object.assign(usersObj, usersMap);
            }
        }
        
        console.log('[ICE] getAllUsers result:', usersObj);
        
        return {
            success: true,
            users: usersObj
        };
    } catch (error) {
        console.error('[ICE] Get all users error:', error);
        return { success: false, message: error.message };
    }
}

/**
 * Create a group
 */
export async function createGroup(groupName, creator) {
    try {
        const proxy = await getProxy();
        const response = await proxy.createGroup(groupName, creator);
        
        return {
            success: response.success,
            message: response.message
        };
    } catch (error) {
        console.error('[ICE] Create group error:', error);
        return { success: false, message: error.message };
    }
}

/**
 * Add user to group
 */
export async function addMemberToGroup(groupName, username) {
    try {
        const proxy = await getProxy();
        const response = await proxy.addToGroup(groupName, username);
        
        return {
            success: response.success,
            message: response.message
        };
    } catch (error) {
        console.error('[ICE] Add to group error:', error);
        return { success: false, message: error.message };
    }
}

/**
 * Get all groups
 */
export async function getGroups() {
    try {
        const proxy = await getProxy();
        const groups = await proxy.getGroups();
        
        return {
            success: true,
            groups: groups || []
        };
    } catch (error) {
        console.error('[ICE] Get groups error:', error);
        return { success: false, message: error.message };
    }
}

/**
 * Get user groups
 */
export async function getUserGroups(username) {
    try {
        const proxy = await getProxy();
        const groups = await proxy.getUserGroups(username);
        
        return {
            success: true,
            groups: groups || []
        };
    } catch (error) {
        console.error('[ICE] Get user groups error:', error);
        return { success: false, message: error.message };
    }
}

/**
 * Get group members
 */
export async function getGroupMembers(groupName) {
    try {
        const proxy = await getProxy();
        const members = await proxy.getGroupMembers(groupName);
        
        return {
            success: true,
            members: members || []
        };
    } catch (error) {
        console.error('[ICE] Get group members error:', error);
        return { success: false, message: error.message };
    }
}

/**
 * Send message to user
 */
export async function sendMessageToUser(from, to, content) {
    try {
        const proxy = await getProxy();
        const response = await proxy.sendMessageToUser(from, to, content);
        
        return {
            success: response.success,
            message: response.message
        };
    } catch (error) {
        console.error('[ICE] Send message error:', error);
        return { success: false, message: error.message };
    }
}

/**
 * Send message to group
 */
export async function sendMessageToGroup(from, groupName, content) {
    try {
        const proxy = await getProxy();
        const response = await proxy.sendMessageToGroup(from, groupName, content);
        
        return {
            success: response.success,
            message: response.message
        };
    } catch (error) {
        console.error('[ICE] Send group message error:', error);
        return { success: false, message: error.message };
    }
}

/**
 * Get message history
 */
export async function getHistory(username) {
    try {
        const proxy = await getProxy();
        const history = await proxy.getHistory(username);
        
        return {
            success: true,
            history: history || []
        };
    } catch (error) {
        console.error('[ICE] Get history error:', error);
        return { success: false, message: error.message };
    }
}

/**
 * Get pending messages (for initial sync)
 */
export async function getPendingMessages(username) {
    try {
        const proxy = await getProxy();
        const messages = await proxy.getPendingMessages(username);
        
        return {
            success: true,
            messages: messages || []
        };
    } catch (error) {
        console.error('[ICE] Get pending messages error:', error);
        return { success: false, message: error.message };
    }
}

/**
 * Send voice note to user
 */
export async function sendVoiceNoteToUser(from, to, audioData) {
    try {
        const proxy = await getProxy();
        const byteArray = audioData instanceof Uint8Array ? audioData : new Uint8Array(audioData);
        const response = await proxy.sendVoiceNoteToUser(from, to, byteArray);
        
        return {
            success: response.success,
            message: response.message
        };
    } catch (error) {
        console.error('[ICE] Send voice note error:', error);
        return { success: false, message: error.message };
    }
}

/**
 * Send voice note to group
 */
export async function sendVoiceNoteToGroup(from, groupName, audioData) {
    try {
        const proxy = await getProxy();
        const byteArray = audioData instanceof Uint8Array ? audioData : new Uint8Array(audioData);
        const response = await proxy.sendVoiceNoteToGroup(from, groupName, byteArray);
        
        return {
            success: response.success,
            message: response.message
        };
    } catch (error) {
        console.error('[ICE] Send group voice note error:', error);
        return { success: false, message: error.message };
    }
}

// ========== LLAMADAS WEBRTC ==========

/**
 * Iniciar llamada a un usuario
 */
export async function initiateCall(from, to) {
    try {
        const proxy = await getProxy();
        const response = await proxy.initiateCall(from, to);
        
        return {
            success: response.success,
            message: response.message
        };
    } catch (error) {
        console.error('[ICE] Initiate call error:', error);
        return { success: false, message: error.message };
    }
}

/**
 * Enviar señal WebRTC (offer/answer)
 */
export async function sendWebRTCSignal(from, to, signalType, signalData) {
    try {
        const proxy = await getProxy();
        const response = await proxy.sendWebRTCSignal(from, to, signalType, signalData);
        
        return {
            success: response.success,
            message: response.message
        };
    } catch (error) {
        console.error('[ICE] Send WebRTC signal error:', error);
        return { success: false, message: error.message };
    }
}

/**
 * Enviar candidato ICE
 */
export async function sendICECandidate(from, to, candidate) {
    try {
        const proxy = await getProxy();
        const response = await proxy.sendICECandidate(from, to, candidate);
        
        return {
            success: response.success,
            message: response.message
        };
    } catch (error) {
        console.error('[ICE] Send ICE candidate error:', error);
        return { success: false, message: error.message };
    }
}

/**
 * Terminar llamada
 */
export async function endCall(from, to) {
    try {
        const proxy = await getProxy();
        const response = await proxy.endCall(from, to);
        
        return {
            success: response.success,
            message: response.message
        };
    } catch (error) {
        console.error('[ICE] End call error:', error);
        return { success: false, message: error.message };
    }
}
