// Chat.ice - Definiciones de interfaces Ice para el sistema de chat

module Chat {
    
    // ========== ESTRUCTURAS DE DATOS ==========
    
    // Mensaje de texto o grupo
    struct Message {
        string from;
        string to;
        string content;
        long timestamp;
        bool isGroup;
    };
    
    // Usuario con estado
    struct User {
        string username;
        bool isOnline;
    };
    
    // Secuencias (deben definirse ANTES de usarse)
    sequence<Message> MessageSeq;
    sequence<User> UserSeq;
    sequence<string> StringSeq;
    sequence<byte> ByteSeq;
    
    // Información de grupo
    struct GroupInfo {
        string groupName;
        StringSeq members;
    };
    
    // Mapa de usuarios con estado
    dictionary<string, bool> UserStatusMap;
    
    // ========== CALLBACK INTERFACE (Para notificaciones push) ==========
    
    interface ChatCallback {
        // Notificación de nuevo mensaje en tiempo real
        void onNewMessage(Message msg);
        
        // Notificación de cambio de estado de usuario
        void onUserStatusChanged(User user);
        
        // Notificación de nuevo miembro en grupo
        void onGroupMemberAdded(string groupName, string username);
        
        // Notificación de nota de voz (from, to/groupName, audioData, isGroup)
        void onVoiceNoteReceived(string from, string to, ByteSeq audioData, bool isGroup);
        
        // ===== Llamadas WebRTC =====
        
        // Notificación de llamada entrante
        void onIncomingCall(string from);
        
        // Notificación de señal WebRTC (SDP offer/answer)
        void onWebRTCSignal(string from, string signalType, string signalData);
        
        // Notificación de candidato ICE para WebRTC
        void onICECandidate(string from, string candidate);
        
        // Notificación de llamada terminada
        void onCallEnded(string from);
    };
    
    // ========== RESPUESTA GENÉRICA ==========
    
    struct Response {
        bool success;
        string message;
    };
    
    // ========== SERVICIO PRINCIPAL ==========
    
    interface ChatService {
        
        // ===== Autenticación =====
        
        // Login con registro de callback para notificaciones push
        Response login(string username, ChatCallback* callback);
        
        // Logout y desregistro de callback
        Response logout(string username);
        
        // ===== Gestión de Usuarios =====
        
        // Obtener usuarios online
        StringSeq getOnlineUsers();
        
        // Obtener todos los usuarios con estado (online/offline)
        UserStatusMap getAllUsers();
        
        // ===== Mensajería de Texto =====
        
        // Enviar mensaje privado a usuario
        Response sendMessageToUser(string from, string to, string content);
        
        // Enviar mensaje a grupo
        Response sendMessageToGroup(string from, string groupName, string content);
        
        // Obtener mensajes pendientes (para sincronización)
        MessageSeq getPendingMessages(string username);
        
        // ===== Gestión de Grupos =====
        
        // Crear grupo nuevo
        Response createGroup(string groupName, string creator);
        
        // Agregar miembro a grupo
        Response addToGroup(string groupName, string username);
        
        // Obtener todos los grupos
        StringSeq getGroups();
        
        // Obtener grupos donde el usuario es miembro
        StringSeq getUserGroups(string username);
        
        // Obtener miembros de un grupo
        StringSeq getGroupMembers(string groupName);
        
        // ===== Historial =====
        
        // Obtener historial completo de mensajes (privados + grupos)
        StringSeq getHistory(string username);
        
        // ===== Notas de Voz (WebSocket) =====
        
        // Enviar nota de voz a usuario
        Response sendVoiceNoteToUser(string from, string to, ByteSeq audioData);
        
        // Enviar nota de voz a grupo
        Response sendVoiceNoteToGroup(string from, string groupName, ByteSeq audioData);
        
        // ===== Llamadas WebRTC =====
        
        // Iniciar llamada a usuario
        Response initiateCall(string from, string to);
        
        // Enviar señal WebRTC (offer/answer SDP)
        Response sendWebRTCSignal(string from, string to, string signalType, string signalData);
        
        // Enviar candidato ICE
        Response sendICECandidate(string from, string to, string candidate);
        
        // Terminar llamada
        Response endCall(string from, string to);
    };
};
