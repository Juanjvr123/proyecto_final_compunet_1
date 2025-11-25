package ice;

import Chat.*;
import com.zeroc.Ice.Current;
import services.ChatServicesImpl;

import java.io.File;
import java.io.IOException;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Implementación del Servant Ice para ChatService
 * Actúa como wrapper sobre ChatServicesImpl existente
 */
public class ChatServiceImpl implements ChatService {
    
    private final ChatServicesImpl chatServices;
    
    // Callbacks registrados por usuario (para notificaciones push)
    private final Map<String, ChatCallbackPrx> callbacks = new ConcurrentHashMap<>();
    
    public ChatServiceImpl(ChatServicesImpl chatServices) {
        this.chatServices = chatServices;
    }
    
    // ========== AUTENTICACIÓN ==========
    
    @Override
    public Response login(String username, ChatCallbackPrx callback, Current current) {
        System.out.println("[ICE] Login request from: " + username);
        
        try {
            // Registrar callback para notificaciones push usando ice_fixed
            if (callback != null && current.con != null) {
                System.out.println("[ICE] Registering callback for: " + username);
                System.out.println("[ICE] Callback proxy: " + callback.toString());
                
                // CRÍTICO: Usar ice_fixed para vincular el callback a la conexión actual
                ChatCallbackPrx fixedCallback = callback.ice_fixed(current.con);
                callbacks.put(username, fixedCallback);
                
                // Manejar desconexión automática
                current.con.setCloseCallback(connection -> {
                    System.out.println("[ICE] ⚠️  Conexión cerrada, eliminando callback: " + username);
                    callbacks.remove(username);
                    try {
                        chatServices.logout(username);
                    } catch (Exception e) {
                        System.err.println("[ICE] Error en logout automático: " + e.getMessage());
                    }
                });
                
                System.out.println("[ICE] ✅ Callback registered successfully for: " + username);
                System.out.println("[ICE] Total callbacks now: " + callbacks.size());
            } else {
                System.err.println("[ICE] ❌ Callback is NULL or no connection for user: " + username);
            }
            
            // Delegar al servicio existente
            boolean success = chatServices.login(username, 0, null);
            
            if (success) {
                // Notificar a todos los usuarios online sobre el nuevo usuario
                notifyUserStatusChange(username, true);
                
                // Enviar notas de voz pendientes desde el historial
                sendPendingVoiceNotes(username);
                
                return new Response(true, "Login exitoso");
            } else {
                return new Response(false, "Error en login");
            }
            
        } catch (IOException e) {
            System.err.println("[ICE] Error en login: " + e.getMessage());
            return new Response(false, "Error: " + e.getMessage());
        }
    }
    
    @Override
    public Response logout(String username, Current current) {
        System.out.println("[ICE] Logout request from: " + username);
        
        // Remover callback
        callbacks.remove(username);
        
        // Delegar al servicio existente
        boolean success = chatServices.logout(username);
        
        if (success) {
            // Notificar cambio de estado
            notifyUserStatusChange(username, false);
            return new Response(true, "Logout exitoso");
        } else {
            return new Response(false, "Usuario no encontrado");
        }
    }
    
    // ========== GESTIÓN DE USUARIOS ==========
    
    @Override
    public String[] getOnlineUsers(Current current) {
        List<String> users = chatServices.getOnlineUsers();
        return users.toArray(new String[0]);
    }
    
    @Override
    public Map<String, Boolean> getAllUsers(Current current) {
        return chatServices.getAllUsersWithStatus();
    }
    
    // ========== MENSAJERÍA ==========
    
    @Override
    public Response sendMessageToUser(String from, String to, String content, Current current) {
        System.out.println("[ICE] Message from " + from + " to " + to + ": " + content);
        
        try {
            boolean success = chatServices.sendMessageToUser(from, to, content);
            
            if (success) {
                // Notificación push en tiempo real al destinatario
                System.out.println("[ICE] Looking for callback for user: " + to);
                System.out.println("[ICE] Total callbacks registered: " + callbacks.size());
                System.out.println("[ICE] Registered users: " + callbacks.keySet());
                
                ChatCallbackPrx callback = callbacks.get(to);
                if (callback != null) {
                    System.out.println("[ICE] ✓ Callback found for: " + to);
                    Message msg = new Message(from, to, content, System.currentTimeMillis(), false);
                    try {
                        System.out.println("[ICE] Sending async notification...");
                        callback.onNewMessageAsync(msg); // Async para no bloquear
                        System.out.println("[ICE] ✅ Push notification sent to: " + to);
                    } catch (Exception e) {
                        System.err.println("[ICE] ❌ Error sending push notification: " + e.getMessage());
                        e.printStackTrace();
                    }
                } else {
                    System.err.println("[ICE] ❌ No callback registered for user: " + to);
                }
                
                return new Response(true, "Mensaje enviado");
            } else {
                return new Response(false, "Error al enviar mensaje");
            }
            
        } catch (IOException e) {
            System.err.println("[ICE] Error sending message: " + e.getMessage());
            return new Response(false, "Error: " + e.getMessage());
        }
    }
    
    @Override
    public Response sendMessageToGroup(String from, String groupName, String content, Current current) {
        System.out.println("[ICE] Group message from " + from + " to " + groupName + ": " + content);
        
        try {
            boolean success = chatServices.sendMessageToGroup(from, groupName, content);
            
            if (success) {
                // Notificar a todos los miembros del grupo (excepto el remitente)
                List<String> members = chatServices.getGroupMembers(groupName);
                Message msg = new Message(from, groupName, content, System.currentTimeMillis(), true);
                
                for (String member : members) {
                    if (!member.equals(from)) {
                        ChatCallbackPrx callback = callbacks.get(member);
                        if (callback != null) {
                            try {
                                callback.onNewMessageAsync(msg);
                                System.out.println("[ICE] Push notification sent to group member: " + member);
                            } catch (Exception e) {
                                System.err.println("[ICE] Error sending push to " + member + ": " + e.getMessage());
                            }
                        }
                    }
                }
                
                return new Response(true, "Mensaje enviado al grupo");
            } else {
                return new Response(false, "Error al enviar mensaje al grupo");
            }
            
        } catch (IOException e) {
            System.err.println("[ICE] Error sending group message: " + e.getMessage());
            return new Response(false, "Error: " + e.getMessage());
        }
    }
    
    @Override
    public Message[] getPendingMessages(String username, Current current) {
        List<String> pending = chatServices.getPendingMessages(username);
        List<Message> messages = new ArrayList<>();
        
        for (String msg : pending) {
            // Parsear formato: "MSG|from|content" o "GROUP|groupName|from|content"
            String[] parts = msg.split("\\|");
            
            if (parts[0].equals("MSG") && parts.length >= 3) {
                messages.add(new Message(parts[1], username, parts[2], System.currentTimeMillis(), false));
            } else if (parts[0].equals("GROUP") && parts.length >= 4) {
                messages.add(new Message(parts[2], parts[1], parts[3], System.currentTimeMillis(), true));
            }
        }
        
        return messages.toArray(new Message[0]);
    }
    
    // ========== GESTIÓN DE GRUPOS ==========
    
    @Override
    public Response createGroup(String groupName, String creator, Current current) {
        System.out.println("[ICE] Creating group: " + groupName + " by " + creator);
        
        boolean success = chatServices.createGroup(groupName, creator);
        
        if (success) {
            return new Response(true, "Grupo creado exitosamente");
        } else {
            return new Response(false, "Error al crear grupo");
        }
    }
    
    @Override
    public Response addToGroup(String groupName, String username, Current current) {
        System.out.println("[ICE] Adding " + username + " to group: " + groupName);
        
        boolean success = chatServices.addToGroup(groupName, username);
        
        if (success) {
            // Notificar a todos los miembros del grupo
            List<String> members = chatServices.getGroupMembers(groupName);
            for (String member : members) {
                ChatCallbackPrx callback = callbacks.get(member);
                if (callback != null) {
                    try {
                        callback.onGroupMemberAddedAsync(groupName, username);
                    } catch (Exception e) {
                        System.err.println("[ICE] Error notifying member: " + e.getMessage());
                    }
                }
            }
            
            return new Response(true, "Usuario agregado al grupo");
        } else {
            return new Response(false, "Error al agregar usuario");
        }
    }
    
    @Override
    public String[] getGroups(Current current) {
        List<String> groups = chatServices.getGroups();
        return groups.toArray(new String[0]);
    }
    
    @Override
    public String[] getUserGroups(String username, Current current) {
        List<String> groups = chatServices.getUserGroups(username);
        return groups.toArray(new String[0]);
    }
    
    @Override
    public String[] getGroupMembers(String groupName, Current current) {
        List<String> members = chatServices.getGroupMembers(groupName);
        return members.toArray(new String[0]);
    }
    
    // ========== HISTORIAL ==========
    
    @Override
    public String[] getHistory(String username, Current current) {
        try {
            List<String> history = chatServices.getHistory(username);
            return history.toArray(new String[0]);
        } catch (IOException e) {
            System.err.println("[ICE] Error getting history: " + e.getMessage());
            return new String[0];
        }
    }
    
    // ========== NOTAS DE VOZ ==========
    
    @Override
    public Response sendVoiceNoteToUser(String from, String to, byte[] audioData, Current current) {
        System.out.println("[ICE] Voice note from " + from + " to " + to + " (" + audioData.length + " bytes)");
        
        try {
            boolean success = chatServices.sendVoiceNoteToUser(from, to, audioData);
            
            if (success) {
                // Notificación push con audio (privado)
                ChatCallbackPrx callback = callbacks.get(to);
                if (callback != null) {
                    try {
                        callback.onVoiceNoteReceivedAsync(from, to, audioData, false);
                        System.out.println("[ICE] Voice note push sent to: " + to);
                    } catch (Exception e) {
                        System.err.println("[ICE] Error sending voice note push: " + e.getMessage());
                    }
                }
                
                return new Response(true, "Nota de voz enviada");
            } else {
                return new Response(false, "Error al enviar nota de voz");
            }
            
        } catch (IOException e) {
            System.err.println("[ICE] Error sending voice note: " + e.getMessage());
            return new Response(false, "Error: " + e.getMessage());
        }
    }
    
    @Override
    public Response sendVoiceNoteToGroup(String from, String groupName, byte[] audioData, Current current) {
        System.out.println("[ICE] Voice note from " + from + " to group " + groupName + " (" + audioData.length + " bytes)");
        
        try {
            boolean success = chatServices.sendVoiceNoteToGroup(from, groupName, audioData);
            
            if (success) {
                // Notificar a todos los miembros del grupo
                List<String> members = chatServices.getGroupMembers(groupName);
                for (String member : members) {
                    if (!member.equals(from)) {
                        ChatCallbackPrx callback = callbacks.get(member);
                        if (callback != null) {
                            try {
                                callback.onVoiceNoteReceivedAsync(from, groupName, audioData, true);
                                System.out.println("[ICE] Voice note push sent to group member: " + member);
                            } catch (Exception e) {
                                System.err.println("[ICE] Error sending voice note to " + member);
                            }
                        }
                    }
                }
                
                return new Response(true, "Nota de voz enviada al grupo");
            } else {
                return new Response(false, "Error al enviar nota de voz al grupo");
            }
            
        } catch (IOException e) {
            System.err.println("[ICE] Error sending group voice note: " + e.getMessage());
            return new Response(false, "Error: " + e.getMessage());
        }
    }
    
    // ========== LLAMADAS WEBRTC ==========
    
    @Override
    public Response initiateCall(String from, String to, Current current) {
        System.out.println("[ICE] Call from " + from + " to " + to);
        
        ChatCallbackPrx callback = callbacks.get(to);
        if (callback != null) {
            try {
                callback.onIncomingCallAsync(from);
                System.out.println("[ICE] ✅ Call notification sent to " + to);
                return new Response(true, "Llamada iniciada");
            } catch (Exception e) {
                System.err.println("[ICE] Error notifying incoming call: " + e.getMessage());
                return new Response(false, "Usuario no disponible");
            }
        } else {
            return new Response(false, "Usuario offline");
        }
    }
    
    @Override
    public Response sendWebRTCSignal(String from, String to, String signalType, String signalData, Current current) {
        System.out.println("[ICE] WebRTC " + signalType + " from " + from + " to " + to);
        
        ChatCallbackPrx callback = callbacks.get(to);
        if (callback != null) {
            try {
                callback.onWebRTCSignalAsync(from, signalType, signalData);
                return new Response(true, "Señal enviada");
            } catch (Exception e) {
                System.err.println("[ICE] Error sending WebRTC signal: " + e.getMessage());
                return new Response(false, "Error al enviar señal");
            }
        } else {
            return new Response(false, "Usuario offline");
        }
    }
    
    @Override
    public Response sendICECandidate(String from, String to, String candidate, Current current) {
        System.out.println("[ICE] ICE candidate from " + from + " to " + to);
        
        ChatCallbackPrx callback = callbacks.get(to);
        if (callback != null) {
            try {
                callback.onICECandidateAsync(from, candidate);
                return new Response(true, "Candidato ICE enviado");
            } catch (Exception e) {
                System.err.println("[ICE] Error sending ICE candidate: " + e.getMessage());
                return new Response(false, "Error al enviar candidato");
            }
        } else {
            return new Response(false, "Usuario offline");
        }
    }
    
    @Override
    public Response endCall(String from, String to, Current current) {
        System.out.println("[ICE] Call ended from " + from + " to " + to);
        
        ChatCallbackPrx callback = callbacks.get(to);
        if (callback != null) {
            try {
                callback.onCallEndedAsync(from);
                return new Response(true, "Llamada terminada");
            } catch (Exception e) {
                System.err.println("[ICE] Error ending call: " + e.getMessage());
                return new Response(false, "Error");
            }
        } else {
            return new Response(true, "Llamada terminada");
        }
    }
    
    // ========== STREAMING DE AUDIO POR WEBSOCKET ==========
    
    @Override
    public Response sendAudioChunk(String from, String to, byte[] audioData, Current current) {
        System.out.println("[ICE] Audio chunk from " + from + " to " + to + " (" + audioData.length + " bytes)");
        
        ChatCallbackPrx callback = callbacks.get(to);
        if (callback != null) {
            try {
                callback.onAudioChunkAsync(from, audioData);
                return new Response(true, "Audio chunk enviado");
            } catch (Exception e) {
                System.err.println("[ICE] Error sending audio chunk: " + e.getMessage());
                return new Response(false, "Error al enviar audio");
            }
        } else {
            return new Response(false, "Usuario offline");
        }
    }
    
    @Override
    public Response acceptCall(String from, String to, Current current) {
        System.out.println("[ICE] Call accepted: " + from + " accepted call from " + to);
        
        ChatCallbackPrx callback = callbacks.get(to);
        if (callback != null) {
            try {
                callback.onCallAcceptedAsync(from);
                return new Response(true, "Llamada aceptada");
            } catch (Exception e) {
                System.err.println("[ICE] Error notifying call acceptance: " + e.getMessage());
                return new Response(false, "Error");
            }
        } else {
            return new Response(false, "Usuario offline");
        }
    }
    
    // ========== HELPERS ==========
    
    /**
     * Notifica a todos los usuarios online sobre cambio de estado
     */
    private void notifyUserStatusChange(String username, boolean isOnline) {
        User user = new User(username, isOnline);
        
        for (Map.Entry<String, ChatCallbackPrx> entry : callbacks.entrySet()) {
            try {
                entry.getValue().onUserStatusChangedAsync(user);
            } catch (Exception e) {
                System.err.println("[ICE] Error notifying user status change: " + e.getMessage());
            }
        }
    }
    
    /**
     * Envía notas de voz pendientes desde el historial al usuario que acaba de hacer login
     * Solo envía las notas de voz que el usuario NO pudo recibir en tiempo real porque estaba offline
     */
    private void sendPendingVoiceNotes(String username) {
        System.out.println("[ICE] Checking pending voice notes for: " + username);
        
        ChatCallbackPrx callback = callbacks.get(username);
        if (callback == null) {
            System.out.println("[ICE] No callback registered for " + username);
            return;
        }
        
        try {
            // Obtener historial del usuario
            List<String> history = chatServices.getHistory(username);
            
            // Track de notas de voz ya enviadas para evitar duplicados
            Set<String> processedFiles = new HashSet<>();
            
            for (String record : history) {
                // Buscar registros de notas de voz
                if (record.contains("type:voice_note")) {
                    // Parsear el registro (formato: {type:voice_note,from:X,target:Y,isGroup:false,file:/path/to/file.raw,ts:timestamp})
                    String from = extractField(record, "from");
                    String target = extractField(record, "target");
                    String isGroupStr = extractField(record, "isGroup");
                    String filePath = extractField(record, "file");
                    
                    if (from != null && filePath != null && !processedFiles.contains(filePath)) {
                        boolean isGroup = "true".equals(isGroupStr);
                        
                        // Leer el archivo de audio
                        File audioFile = new File(filePath);
                        if (audioFile.exists()) {
                            byte[] audioData = java.nio.file.Files.readAllBytes(audioFile.toPath());
                            
                            // Enviar al cliente usando el callback
                            callback.onVoiceNoteReceivedAsync(from, target, audioData, isGroup);
                            System.out.println("[ICE] ✅ Sent pending voice note from " + from + " to " + username + " (isGroup=" + isGroup + ")");
                            
                            processedFiles.add(filePath);
                        } else {
                            System.err.println("[ICE] ❌ Voice note file not found: " + filePath);
                        }
                    }
                }
            }
            
            System.out.println("[ICE] Sent " + processedFiles.size() + " pending voice notes to " + username);
        } catch (Exception e) {
            System.err.println("[ICE] Error sending pending voice notes: " + e.getMessage());
            e.printStackTrace();
        }
    }
    
    /**
     * Extrae un campo de un registro en formato {key:value,key:value,...}
     */
    private String extractField(String record, String fieldName) {
        String pattern = fieldName + ":";
        int startIndex = record.indexOf(pattern);
        if (startIndex == -1) return null;
        
        startIndex += pattern.length();
        int endIndex = record.indexOf(",", startIndex);
        if (endIndex == -1) {
            endIndex = record.indexOf("}", startIndex);
        }
        
        if (endIndex == -1) return null;
        return record.substring(startIndex, endIndex);
    }
    
    /**
     * Obtiene el número de callbacks registrados (para debug)
     */
    public int getRegisteredCallbacksCount() {
        return callbacks.size();
    }
}
