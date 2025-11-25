import { navigateTo } from '../router/Router.js';
import { 
    initIce,
    shutdownIce,
    getOnlineUsers,
    getAllUsers,
    sendMessageToUser, 
    sendMessageToGroup,
    createGroup,
    addMemberToGroup,
    getUserGroups,
    getHistory,
    getPendingMessages,
    initiateCall
} from '../services/iceDelegate.js';
import { 
    startRecording, 
    stopRecording, 
    isCurrentlyRecording,
    playAudio,
    isAudioRecordingSupported
} from '../services/audioRecorder.js';
import {
    initWebRTC,
    startCall,
    answerCall,
    handleOffer,
    handleAnswer,
    addICECandidate,
    hangUp,
    getLocalStream
} from '../services/webrtcService.js';

function Chat() {
    const username = sessionStorage.getItem('username');
    
    if (!username) {
        window.location.href = '/';
        return document.createElement('div');
    }

    const container = document.createElement('div');
    container.className = 'chat-container';

    // Sidebar
    const sidebar = createSidebar(username);
    container.appendChild(sidebar);

    // Chat Area
    const chatArea = createChatArea();
    container.appendChild(chatArea);

    // Initialize connection
    initializeChat(username);

    return container;
}

function createSidebar(username) {
    const sidebar = document.createElement('div');
    sidebar.className = 'sidebar';

    // Header
    const header = document.createElement('div');
    header.className = 'sidebar-header';
    
    const userTitle = document.createElement('h2');
    userTitle.innerText = username;
    header.appendChild(userTitle);
    
    const status = document.createElement('p');
    status.innerText = '� Chat';
    header.appendChild(status);
    
    sidebar.appendChild(header);

    // Tabs
    const tabs = document.createElement('div');
    tabs.className = 'sidebar-tabs';
    
    const usersTab = document.createElement('button');
    usersTab.innerText = 'Users';
    usersTab.className = 'active';
    usersTab.onclick = () => {
        usersTab.classList.add('active');
        groupsTab.classList.remove('active');
        showUsers();
    };
    
    const groupsTab = document.createElement('button');
    groupsTab.innerText = 'Groups';
    groupsTab.onclick = () => {
        groupsTab.classList.add('active');
        usersTab.classList.remove('active');
        showGroups();
    };
    
    tabs.appendChild(usersTab);
    tabs.appendChild(groupsTab);
    sidebar.appendChild(tabs);

    // Content
    const content = document.createElement('div');
    content.className = 'sidebar-content';
    content.id = 'sidebar-content';
    sidebar.appendChild(content);

    return sidebar;
}

function createChatArea() {
    const chatArea = document.createElement('div');
    chatArea.className = 'chat-area';

    // Header
    const header = document.createElement('div');
    header.className = 'chat-header';
    
    const title = document.createElement('h3');
    title.id = 'chat-title';
    title.innerText = 'Select a conversation';
    header.appendChild(title);
    
    // Botón de llamada
    const callButton = document.createElement('button');
    callButton.className = 'call-btn';
    callButton.innerHTML = '📞';
    callButton.title = 'Iniciar llamada';
    callButton.id = 'call-button';
    callButton.style.display = 'none'; // Oculto por defecto
    callButton.onclick = handleCallButton;
    header.appendChild(callButton);
    
    chatArea.appendChild(header);
    
    // Contenedor de llamada (videos)
    const callContainer = document.createElement('div');
    callContainer.className = 'call-container';
    callContainer.id = 'callContainer';
    callContainer.style.display = 'none';
    chatArea.appendChild(callContainer);

    // Messages
    const messages = document.createElement('div');
    messages.className = 'chat-messages';
    messages.id = 'chat-messages';
    chatArea.appendChild(messages);

    // Input (inicialmente oculto)
    const inputArea = document.createElement('div');
    inputArea.className = 'chat-input';
    inputArea.id = 'chat-input-area';
    inputArea.style.display = 'none'; // Oculto por defecto
    
    // Botón de grabación de audio
    const voiceButton = document.createElement('button');
    voiceButton.className = 'voice-btn';
    voiceButton.innerHTML = '🎤';
    voiceButton.title = 'Grabar nota de voz';
    voiceButton.onclick = toggleVoiceRecording;
    
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Type a message...';
    input.id = 'message-input';
    input.onkeypress = (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    };
    
    const sendBtn = document.createElement('button');
    sendBtn.innerText = 'Send';
    sendBtn.onclick = sendMessage;
    
    inputArea.appendChild(voiceButton);
    inputArea.appendChild(input);
    inputArea.appendChild(sendBtn);
    chatArea.appendChild(inputArea);

    return chatArea;
}

async function initializeChat(username) {
    try {
        console.log('[CHAT] 🚀 Inicializando Ice para usuario:', username);
        
        // Inicializar Ice con callbacks para notificaciones en tiempo real
        const loginResult = await initIce(username, {
            // Callback: mensaje nuevo recibido
            onMessageReceived: (msg) => {
                console.log('[CHAT] 📨 Mensaje recibido via Ice:', msg);
                processIncomingMessageFromIce(msg);
            },
            
            // Callback: cambio de estado de usuario
            onUserStatusChanged: (user) => {
                console.log('[CHAT] 👤 Estado de usuario cambió:', user);
                updateUserStatusInUI(user);
            },
            
            // Callback: nuevo miembro agregado a grupo
            onGroupMemberAdded: (groupName, username) => {
                console.log('[CHAT] 👥 Miembro agregado al grupo:', groupName, username);
                refreshGroupIfVisible(groupName);
            },
            
            // Callback: nota de voz recibida
            onVoiceNoteReceived: (from, to, audioData, isGroup) => {
                console.log('[CHAT] 🎤 Nota de voz recibida de:', from, 'para:', to, 'isGroup:', isGroup);
                playReceivedVoiceNote(from, to, audioData, isGroup);
            },
            
            // Callbacks de llamadas WebRTC
            onIncomingCall: (from) => {
                console.log('[CHAT] 📞 Llamada entrante de:', from);
                handleIncomingCall(from);
            },
            
            onWebRTCSignal: (from, signalType, signalData) => {
                console.log('[CHAT] 🔄 Señal WebRTC de:', from, 'tipo:', signalType);
                handleWebRTCSignal(from, signalType, signalData);
            },
            
            onICECandidate: (from, candidate) => {
                console.log('[CHAT] 🧊 Candidato ICE de:', from);
                addICECandidate(from, candidate);
            },
            
            onCallEnded: (from) => {
                console.log('[CHAT] ☎️ Llamada terminada por:', from);
                endCallUI();
            }
        });
        
        if (!loginResult.success) {
            alert('Error al conectar con Ice: ' + loginResult.message);
            return;
        }
        
        console.log('[CHAT] ✅ Conectado a Ice:', loginResult.message);
        
        // Inicializar WebRTC
        initWebRTC(username);
        console.log('[CHAT] ✅ WebRTC inicializado');
        
        // Cargar usuarios
        await showUsers();
        
        // NO MÁS POLLING - Ice usa notificaciones push en tiempo real
        // El servidor enviará mensajes automáticamente via callbacks
        console.log('[CHAT] ℹ️ Sistema de tiempo real activo (sin polling)');
        
        // Cargar historial de mensajes
        await loadMessageHistory(username);
        
        // Verificar soporte de audio
        if (isAudioRecordingSupported()) {
            console.log('[CHAT] 🎤 Grabación de audio soportada');
        } else {
            console.warn('[CHAT] ⚠️ Grabación de audio NO soportada en este navegador');
        }
        
    } catch (error) {
        console.error('[CHAT] ❌ Error inicializando chat:', error);
        alert('Error al conectar con el servidor Ice: ' + error.message);
    }
}

async function loadMessageHistory(username) {
    try {
        const result = await getHistory(username);
        
        if (result.success && result.history) {
            console.log('[DEBUG] Loading history, total entries:', result.history.length);
            
            // Procesar mensajes históricos
            result.history.forEach(entry => {
                try {
                    // Parsear el registro (formato: {type:text,from:X,target:Y,isGroup:false,msg:...,ts:...})
                    const from = entry.match(/from:([^,]+)/)?.[1];
                    const target = entry.match(/target:([^,]+)/)?.[1];
                    const isGroup = entry.includes('isGroup:true');
                    const msg = entry.match(/msg:([^,]+)/)?.[1];
                    
                    if (!from || !target || !msg) return;
                    
                    // Determinar la clave del chat
                    let chatKey;
                    let messageFrom;
                    
                    if (isGroup) {
                        chatKey = `group_${target}`;
                        messageFrom = from;
                    } else {
                        // Para mensajes privados, la clave es el otro usuario
                        chatKey = from === username ? `user_${target}` : `user_${from}`;
                        messageFrom = from;
                    }
                    
                    // Agregar al cache SIN DUPLICAR
                    if (!messageCache[chatKey]) {
                        messageCache[chatKey] = [];
                    }
                    
                    // Verificar si el mensaje ya existe (por contenido y from)
                    const isDuplicate = messageCache[chatKey].some(m => 
                        m.from === messageFrom && m.content === msg
                    );
                    
                    if (!isDuplicate) {
                        messageCache[chatKey].push({
                            from: messageFrom,
                            content: msg,
                            isSent: (from === username),
                            timestamp: new Date()
                        });
                    }
                } catch (err) {
                    console.error('Error parsing history entry:', entry, err);
                }
            });
            
            console.log('[DEBUG] Loaded message history, cache:', messageCache);
        }
    } catch (error) {
        console.error('Error loading message history:', error);
    }
}

// ============================================
// POLLING ELIMINADO - Ice usa push notifications
// ============================================
// Ya no se necesita polling, Ice envía mensajes en tiempo real via callbacks
// El servidor llama directamente a onMessageReceived cuando llega un mensaje

/**
 * Procesar mensaje recibido desde Ice callback (tiempo real)
 */
function processIncomingMessageFromIce(msg) {
    console.log('[CHAT] 📨 Procesando mensaje Ice:', msg);
    
    const username = sessionStorage.getItem('username');
    const chatKey = msg.isGroup ? `group_${msg.to}` : `user_${msg.from}`;
    
    // Agregar al cache
    if (!messageCache[chatKey]) {
        messageCache[chatKey] = [];
    }
    
    // Verificar duplicados
    const isDuplicate = messageCache[chatKey].some(m => 
        m.from === msg.from && m.content === msg.content
    );
    
    if (!isDuplicate) {
        messageCache[chatKey].push({
            from: msg.from,
            content: msg.content,
            isSent: false,
            timestamp: new Date(msg.timestamp)
        });
        
        // Mostrar si está en la conversación actual
        if (currentChat) {
            const isCurrentChat = msg.isGroup 
                ? (currentChat.type === 'group' && currentChat.name === msg.to)
                : (currentChat.type === 'user' && currentChat.name === msg.from);
            
            if (isCurrentChat) {
                addMessageToUI(msg.from, msg.content, false);
                
                // Notificación sonora o visual opcional
                showNewMessageNotification(msg.from);
            }
        }
    }
}

/**
 * Actualizar estado de usuario en la UI
 */
function updateUserStatusInUI(user) {
    console.log('[CHAT] 🔄 Actualizando estado de usuario:', user.username, user.isOnline ? 'online' : 'offline');
    
    // Refrescar lista de usuarios si está visible
    const sidebarContent = document.getElementById('sidebar-content');
    if (sidebarContent && document.querySelector('.sidebar-tabs button.active')?.innerText === 'Users') {
        loadUsersList();
    }
}

/**
 * Refrescar grupo si está visible
 */
function refreshGroupIfVisible(groupName) {
    console.log('[CHAT] 🔄 Refrescando grupo:', groupName);
    
    // Si estamos viendo grupos, refrescar
    const sidebarContent = document.getElementById('sidebar-content');
    if (sidebarContent && document.querySelector('.sidebar-tabs button.active')?.innerText === 'Groups') {
        loadGroupsList();
    }
}

/**
 * Mostrar notificación de nuevo mensaje
 */
function showNewMessageNotification(from) {
    // Cambiar título de la página temporalmente
    const originalTitle = document.title;
    document.title = `💬 Mensaje de ${from}`;
    
    setTimeout(() => {
        document.title = originalTitle;
    }, 3000);
    
    // Podrías agregar un sonido aquí
    // new Audio('/notification.mp3').play();
}

// ============================================
// FUNCIÓN ANTIGUA DE POLLING - YA NO SE USA
// ============================================
// Esta función procesaba mensajes del formato string "MSG|from|content"
// Ahora usamos processIncomingMessageFromIce() que recibe objetos Message directamente
/*
function processIncomingMessage(msg) {
    // Format: "MSG|from|content" or "GROUP|groupName|from|content"
    const parts = msg.split('|');
    
    console.log('Processing incoming message:', msg, 'Parts:', parts);
    
    if (parts[0] === 'MSG') {
        // Direct message
        const from = parts[1];
        const content = parts[2];
        const chatKey = `user_${from}`;
        
        console.log('Direct message from:', from, 'Current chat:', currentChat);
        
        // Agregar al cache SIN DUPLICAR
        if (!messageCache[chatKey]) {
            messageCache[chatKey] = [];
        }
        
        // Verificar si el mensaje ya existe
        const isDuplicate = messageCache[chatKey].some(m => 
            m.from === from && m.content === content
        );
        
        if (!isDuplicate) {
            messageCache[chatKey].push({ from, content, isSent: false, timestamp: new Date() });
            
            // Only show if we're in that conversation
            if (currentChat && currentChat.type === 'user' && currentChat.name === from) {
                addMessageToUI(from, content, false);
            }
        }
    } else if (parts[0] === 'GROUP') {
        // Group message
        const groupName = parts[1];
        const from = parts[2];
        const content = parts[3];
        const chatKey = `group_${groupName}`;
        
        console.log('Group message - Group:', groupName, 'From:', from, 'Current chat:', currentChat);
        
        // Agregar al cache SIN DUPLICAR
        if (!messageCache[chatKey]) {
            messageCache[chatKey] = [];
        }
        
        // Verificar si el mensaje ya existe
        const isDuplicate = messageCache[chatKey].some(m => 
            m.from === from && m.content === content
        );
        
        if (!isDuplicate) {
            messageCache[chatKey].push({ from, content, isSent: false, timestamp: new Date() });
            
            // Only show if we're in that group conversation
            if (currentChat && currentChat.type === 'group' && currentChat.name === groupName) {
                addMessageToUI(from, content, false);
            }
        }
    }
}
*/

async function showUsers() {
    const content = document.getElementById('sidebar-content');
    content.innerHTML = '<p style="padding: 20px; text-align: center;">Loading users...</p>';
    
    // Clear group polling interval if active
    if (groupListInterval) {
        clearInterval(groupListInterval);
        groupListInterval = null;
    }
    
    // Start user list polling
    if (!userListInterval) {
        userListInterval = setInterval(loadUsersList, 5000); // Refresh every 5 seconds
    }
    
    await loadUsersList();
}

async function loadUsersList() {
    const content = document.getElementById('sidebar-content');
    
    try {
        const result = await getAllUsers();
        content.innerHTML = '';
        
        if (!result.success || !result.users) {
            content.innerHTML = '<p style="padding: 20px; text-align: center; color: #999;">No users found</p>';
            return;
        }
        
        const currentUsername = sessionStorage.getItem('username');
        const usersMap = result.users; // {username: isOnline}
        
        // Mostrar todos los usuarios sin distinción de estado
        const allUsers = Object.keys(usersMap).filter(username => username !== currentUsername);
        
        if (allUsers.length === 0) {
            content.innerHTML = '<p style="padding: 20px; text-align: center; color: #999;">No other users</p>';
            return;
        }
        
        // Crear header simple
        const header = document.createElement('div');
        header.style.cssText = 'padding: 10px 15px; font-weight: 600; color: #667eea; font-size: 0.85rem;';
        header.innerText = `� USERS (${allUsers.length})`;
        content.appendChild(header);
        
        // Mostrar todos los usuarios
        allUsers.forEach(username => {
            const userItem = document.createElement('div');
            userItem.className = 'user-item';
            userItem.onclick = () => selectUser(username);
            
            const avatar = document.createElement('div');
            avatar.className = 'user-avatar';
            avatar.innerText = username.charAt(0).toUpperCase();
            avatar.style.background = '#667eea';
            
            const info = document.createElement('div');
            info.className = 'user-info';
            
            const name = document.createElement('div');
            name.className = 'user-name';
            name.innerText = username;
            
            info.appendChild(name);
            userItem.appendChild(avatar);
            userItem.appendChild(info);
            content.appendChild(userItem);
        });
        
    } catch (error) {
        console.error('Error loading users:', error);
        content.innerHTML = '<p style="padding: 20px; text-align: center; color: red;">Error loading users</p>';
    }
}

async function showGroups() {
    const content = document.getElementById('sidebar-content');
    content.innerHTML = '<p style="padding: 20px; text-align: center;">Loading groups...</p>';
    
    // Clear user polling interval if active
    if (userListInterval) {
        clearInterval(userListInterval);
        userListInterval = null;
    }
    
    // Start group list polling
    if (!groupListInterval) {
        groupListInterval = setInterval(loadGroupsList, 5000); // Refresh every 5 seconds
    }
    
    await loadGroupsList();
}

async function loadGroupsList() {
    const content = document.getElementById('sidebar-content');
    
    try {
        const username = sessionStorage.getItem('username');
        const result = await getUserGroups(username);
        content.innerHTML = '';
        
        // Add "Create Group" button
        const createBtn = document.createElement('button');
        createBtn.className = 'create-group-btn';
        createBtn.innerText = '+ Create Group';
        createBtn.style.cssText = 'margin: 10px; padding: 10px; width: calc(100% - 20px); background: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer;';
        createBtn.onclick = showCreateGroupDialog;
        content.appendChild(createBtn);
        
        if (!result.success || !result.groups || result.groups.length === 0) {
            const noGroups = document.createElement('p');
            noGroups.style.cssText = 'padding: 20px; text-align: center; color: #999;';
            noGroups.innerText = 'No groups yet. Create one!';
            content.appendChild(noGroups);
            return;
        }
        
        result.groups.forEach(groupName => {
            const groupItem = document.createElement('div');
            groupItem.className = 'user-item';
            groupItem.onclick = () => selectGroup(groupName);
            
            const avatar = document.createElement('div');
            avatar.className = 'user-avatar';
            avatar.innerText = groupName.charAt(0).toUpperCase();
            avatar.style.background = '#28a745';
            
            const info = document.createElement('div');
            info.className = 'user-info';
            
            const name = document.createElement('div');
            name.className = 'user-name';
            name.innerText = groupName;
            
            const status = document.createElement('div');
            status.className = 'user-status';
            status.innerText = 'group';
            
            info.appendChild(name);
            info.appendChild(status);
            groupItem.appendChild(avatar);
            groupItem.appendChild(info);
            content.appendChild(groupItem);
        });
    } catch (error) {
        console.error('Error loading groups:', error);
        content.innerHTML = '<p style="padding: 20px; text-align: center; color: red;">Error loading groups</p>';
    }
}

async function showCreateGroupDialog() {
    // Crear modal
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex';
    
    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';
    modalContent.style.maxWidth = '500px';
    
    const title = document.createElement('h2');
    title.innerText = '👥 Create New Group';
    title.style.marginBottom = '20px';
    
    const groupNameLabel = document.createElement('label');
    groupNameLabel.innerText = 'Group Name:';
    groupNameLabel.style.display = 'block';
    groupNameLabel.style.marginBottom = '8px';
    groupNameLabel.style.fontWeight = '600';
    
    const groupNameInput = document.createElement('input');
    groupNameInput.type = 'text';
    groupNameInput.placeholder = 'Enter group name...';
    groupNameInput.style.marginBottom = '15px';
    
    const membersLabel = document.createElement('label');
    membersLabel.innerText = 'Select Members:';
    membersLabel.style.display = 'block';
    membersLabel.style.marginBottom = '8px';
    membersLabel.style.fontWeight = '600';
    
    const usersList = document.createElement('div');
    usersList.className = 'group-modal-users';
    usersList.innerHTML = '<p style="text-align: center; padding: 20px;">Loading users...</p>';
    
    // Obtener TODOS los usuarios (no solo online)
    try {
        const result = await getAllUsers();
        const currentUsername = sessionStorage.getItem('username');
        
        if (result.success && result.users) {
            usersList.innerHTML = '';
            
            // result.users es un objeto {username: isOnline}
            const allUsernames = Object.keys(result.users).filter(u => u !== currentUsername);
            
            if (allUsernames.length > 0) {
                allUsernames.forEach(username => {
                    const item = document.createElement('div');
                    item.className = 'user-checkbox-item';
                    
                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.id = `user-${username}`;
                    checkbox.value = username;
                    
                    const label = document.createElement('label');
                    label.htmlFor = `user-${username}`;
                    label.innerText = username;
                    
                    item.appendChild(checkbox);
                    item.appendChild(label);
                    usersList.appendChild(item);
                    
                    // Make entire item clickable
                    item.onclick = (e) => {
                        if (e.target !== checkbox) {
                            checkbox.checked = !checkbox.checked;
                        }
                    };
                });
                
                const info = document.createElement('div');
                info.className = 'group-modal-info';
                info.innerText = `You will be added as admin automatically`;
                usersList.appendChild(info);
            } else {
                usersList.innerHTML = '<p style="text-align: center; padding: 20px; color: #999;">No other users available</p>';
            }
        } else {
            usersList.innerHTML = '<p style="text-align: center; padding: 20px; color: #999;">No other users available</p>';
        }
    } catch (error) {
        usersList.innerHTML = '<p style="text-align: center; padding: 20px; color: red;">Error loading users</p>';
    }
    
    const actions = document.createElement('div');
    actions.className = 'modal-actions';
    
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn-cancel';
    cancelBtn.innerText = 'Cancel';
    cancelBtn.onclick = () => {
        document.body.removeChild(modal);
    };
    
    const createBtn = document.createElement('button');
    createBtn.className = 'btn-create';
    createBtn.innerText = 'Create Group';
    createBtn.onclick = async () => {
        const groupName = groupNameInput.value.trim();
        if (!groupName) {
            alert('Please enter a group name');
            return;
        }
        
        const username = sessionStorage.getItem('username');
        const checkboxes = usersList.querySelectorAll('input[type="checkbox"]:checked');
        const selectedUsers = Array.from(checkboxes).map(cb => cb.value);
        
        try {
            // Crear grupo
            const result = await createGroup(groupName, username);
            if (!result.success) {
                alert('Error creating group: ' + result.message);
                return;
            }
            
            // Agregar miembros seleccionados
            for (const member of selectedUsers) {
                await addMemberToGroup(groupName, member);
            }
            
            document.body.removeChild(modal);
            alert(`Group "${groupName}" created with ${selectedUsers.length} members!`);
            showGroups(); // Refresh
        } catch (error) {
            alert('Error creating group: ' + error.message);
        }
    };
    
    actions.appendChild(cancelBtn);
    actions.appendChild(createBtn);
    
    modalContent.appendChild(title);
    modalContent.appendChild(groupNameLabel);
    modalContent.appendChild(groupNameInput);
    modalContent.appendChild(membersLabel);
    modalContent.appendChild(usersList);
    modalContent.appendChild(actions);
    
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
    
    groupNameInput.focus();
}

async function showAddMembersDialog(groupName) {
    try {
        // Get online users
        const result = await getOnlineUsers();
        if (!result.success || !result.users) {
            alert('Error loading users');
            return;
        }
        
        const username = sessionStorage.getItem('username');
        const otherUsers = result.users.filter(u => u !== username);
        
        if (otherUsers.length === 0) {
            alert('No other users online');
            showGroups();
            return;
        }
        
        const membersToAdd = prompt(
            'Enter usernames to add (comma-separated):\nAvailable: ' + otherUsers.join(', ')
        );
        
        if (!membersToAdd) {
            showGroups();
            return;
        }
        
        const members = membersToAdd.split(',').map(m => m.trim());
        
        // Add each member
        for (const member of members) {
            if (otherUsers.includes(member)) {
                await addMemberToGroup(groupName, member);
            }
        }
        
        alert('Members added successfully!');
        showGroups();
        
    } catch (error) {
        console.error('Error adding members:', error);
        alert('Failed to add members');
        showGroups();
    }
}

async function selectGroup(groupName) {
    currentChat = { type: 'group', name: groupName };
    
    document.getElementById('chat-title').innerText = '👥 ' + groupName;
    
    // Mostrar input de mensaje
    const inputArea = document.getElementById('chat-input-area');
    if (inputArea) {
        inputArea.style.display = 'flex';
    }
    
    // Ocultar botón de llamada para grupos
    const callButton = document.getElementById('call-button');
    if (callButton) {
        callButton.style.display = 'none';
    }
    
    // Clear previous selection
    document.querySelectorAll('.user-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // Mark selected
    event.currentTarget.classList.add('active');
    
    // Auto-join group if not already a member
    const username = sessionStorage.getItem('username');
    try {
        await addMemberToGroup(groupName, username);
    } catch (error) {
        console.log('Already in group or error joining:', error);
    }
    
    // Load messages from cache (texto y voz)
    const messagesArea = document.getElementById('chat-messages');
    messagesArea.innerHTML = '';
    
    const chatKey = `group_${groupName}`;
    if (messageCache[chatKey] && messageCache[chatKey].length > 0) {
        messageCache[chatKey].forEach(msg => {
            if (msg.isVoiceNote) {
                addVoiceNoteToUI(msg.from, msg.isSent, msg.audioData);
            } else {
                addMessageToUI(msg.from, msg.content, msg.isSent);
            }
        });
    } else {
        messagesArea.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">Group chat: ' + groupName + '</p>';
    }
}

let currentChat = null;
let messageCache = {}; // Cache de mensajes por conversación
let userListInterval = null;
let groupListInterval = null;

function selectUser(username) {
    currentChat = { type: 'user', name: username };
    
    document.getElementById('chat-title').innerText = username;
    
    // Mostrar input de mensaje
    const inputArea = document.getElementById('chat-input-area');
    if (inputArea) {
        inputArea.style.display = 'flex';
    }
    
    // Mostrar botón de llamada para usuarios (no para grupos)
    const callButton = document.getElementById('call-button');
    if (callButton) {
        callButton.style.display = 'block';
    }
    
    // Clear previous selection
    document.querySelectorAll('.user-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // Mark selected
    event.currentTarget.classList.add('active');
    
    // Load messages from cache (texto y voz)
    const messagesArea = document.getElementById('chat-messages');
    messagesArea.innerHTML = '';
    
    const chatKey = `user_${username}`;
    if (messageCache[chatKey] && messageCache[chatKey].length > 0) {
        messageCache[chatKey].forEach(msg => {
            if (msg.isVoiceNote) {
                addVoiceNoteToUI(msg.from, msg.isSent, msg.audioData);
            } else {
                addMessageToUI(msg.from, msg.content, msg.isSent);
            }
        });
    } else {
        messagesArea.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">Start a conversation with ' + username + '</p>';
    }
}

async function sendMessage() {
    const input = document.getElementById('message-input');
    const message = input.value.trim();
    
    if (!message || !currentChat) return;
    
    const username = sessionStorage.getItem('username');
    
    try {
        let result;
        let chatKey;
        
        if (currentChat.type === 'user') {
            result = await sendMessageToUser(username, currentChat.name, message);
            chatKey = `user_${currentChat.name}`;
        } else if (currentChat.type === 'group') {
            result = await sendMessageToGroup(username, currentChat.name, message);
            chatKey = `group_${currentChat.name}`;
        }
        
        if (!result.success) {
            alert('Error al enviar mensaje: ' + result.message);
            return;
        }
        
        // Guardar en cache
        if (!messageCache[chatKey]) {
            messageCache[chatKey] = [];
        }
        messageCache[chatKey].push({ from: username, content: message, isSent: true, timestamp: new Date() });
        
        // Add message to UI
        addMessageToUI(username, message, true);
        
        input.value = '';
    } catch (error) {
        console.error('Error sending message:', error);
        alert('Failed to send message');
    }
}

function addMessageToUI(from, content, isSent) {
    const messagesArea = document.getElementById('chat-messages');
    
    // Remove placeholder if exists
    if (messagesArea.children.length === 1 && messagesArea.children[0].tagName === 'P') {
        messagesArea.innerHTML = '';
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message ' + (isSent ? 'sent' : 'received');
    
    const header = document.createElement('div');
    header.className = 'message-header';
    header.innerText = from;
    
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    bubble.innerText = content;
    
    const time = document.createElement('div');
    time.className = 'message-time';
    time.innerText = new Date().toLocaleTimeString();
    
    messageDiv.appendChild(header);
    messageDiv.appendChild(bubble);
    messageDiv.appendChild(time);
    
    messagesArea.appendChild(messageDiv);
    messagesArea.scrollTop = messagesArea.scrollHeight;
}

// ============================================
// FUNCIONES DE NOTAS DE VOZ
// ============================================

let isRecordingVoice = false;

/**
 * Alternar grabación de nota de voz
 */
async function toggleVoiceRecording() {
    const voiceButton = document.querySelector('.voice-btn');
    
    if (!voiceButton) return;
    
    if (!isRecordingVoice) {
        // Iniciar grabación
        const started = await startRecording();
        if (started) {
            isRecordingVoice = true;
            voiceButton.innerHTML = '⏹️';
            voiceButton.classList.add('recording');
            voiceButton.title = 'Detener grabación';
            console.log('[CHAT] 🎤 Grabación iniciada');
        }
    } else {
        // Detener y enviar
        try {
            voiceButton.disabled = true;
            const audioData = await stopRecording();
            
            console.log('[CHAT] 🎤 Audio capturado:', audioData.length, 'bytes');
            
            const username = sessionStorage.getItem('username');
            let result;
            
            // Importar función de envío
            const { sendVoiceNoteToUser, sendVoiceNoteToGroup } = await import('../services/iceDelegate.js');
            
            if (currentChat.type === 'user') {
                result = await sendVoiceNoteToUser(username, currentChat.name, audioData);
            } else {
                result = await sendVoiceNoteToGroup(username, currentChat.name, audioData);
            }
            
            if (result.success) {
                console.log('[CHAT] ✅ Nota de voz enviada');
                
                // Guardar en caché local para el remitente
                const chatKey = currentChat.type === 'group' ? `group_${currentChat.name}` : `user_${currentChat.name}`;
                if (!messageCache[chatKey]) {
                    messageCache[chatKey] = [];
                }
                
                messageCache[chatKey].push({
                    from: username,
                    content: '[Nota de voz]',
                    isSent: true,
                    timestamp: new Date(),
                    isVoiceNote: true,
                    audioData: audioData
                });
                
                // Mostrar en UI del remitente
                addVoiceNoteToUI(username, true, audioData);
            } else {
                alert('Error al enviar nota de voz: ' + result.message);
            }
            
        } catch (error) {
            console.error('[CHAT] ❌ Error enviando nota de voz:', error);
            alert('Error al enviar nota de voz: ' + error.message);
        } finally {
            isRecordingVoice = false;
            voiceButton.disabled = false;
            voiceButton.innerHTML = '🎤';
            voiceButton.classList.remove('recording');
            voiceButton.title = 'Grabar nota de voz';
        }
    }
}

/**
 * Manejar nota de voz recibida (sin reproducción automática)
 */
function playReceivedVoiceNote(from, to, audioData, isGroup) {
    console.log('[CHAT] 🎤 Nota de voz recibida de:', from, 'para:', to, 'isGroup:', isGroup, 'Size:', audioData.length);
    
    // Determinar clave de caché correcta según si es grupo o privado
    const chatKey = isGroup ? `group_${to}` : `user_${from}`;
    
    if (!messageCache[chatKey]) {
        messageCache[chatKey] = [];
    }
    
    messageCache[chatKey].push({
        from: from,
        content: '[Nota de voz]',
        isSent: false,
        timestamp: new Date(),
        isVoiceNote: true,
        audioData: audioData
    });
    
    // Mostrar en UI solo si estamos en el chat correcto
    if (currentChat) {
        const isCorrectChat = isGroup
            ? (currentChat.type === 'group' && currentChat.name === to)
            : (currentChat.type === 'user' && currentChat.name === from);
        
        if (isCorrectChat) {
            addVoiceNoteToUI(from, false, audioData);
        }
    }
}

/**
 * Agregar indicador visual de nota de voz en el chat
 */
function addVoiceNoteToUI(from, isSent, audioData = null) {
    const messagesArea = document.getElementById('chat-messages');
    
    // Remover placeholder si existe
    if (messagesArea.children.length === 1 && messagesArea.children[0].tagName === 'P') {
        messagesArea.innerHTML = '';
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message voice-note ' + (isSent ? 'sent' : 'received');
    
    const header = document.createElement('div');
    header.className = 'message-header';
    header.innerText = from;
    
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble voice-bubble';
    
    const voiceIcon = document.createElement('span');
    voiceIcon.className = 'voice-icon';
    voiceIcon.innerHTML = '🎤';
    
    const voiceContent = document.createElement('div');
    voiceContent.className = 'voice-content';
    
    const voiceText = document.createElement('span');
    voiceText.className = 'voice-text';
    voiceText.innerText = 'Nota de voz';
    
    const voiceDuration = document.createElement('span');
    voiceDuration.className = 'voice-duration';
    voiceDuration.innerText = audioData ? `${Math.ceil(audioData.length / 16000)}s` : '...';
    
    voiceContent.appendChild(voiceText);
    voiceContent.appendChild(voiceDuration);
    
    // Siempre agregar botón de reproducción si tenemos audioData
    if (audioData) {
        const playBtn = document.createElement('button');
        playBtn.innerHTML = '▶️';
        playBtn.className = 'play-audio-btn';
        playBtn.title = 'Reproducir nota de voz';
        playBtn.onclick = async () => {
            playBtn.disabled = true;
            playBtn.innerHTML = '⏸️';
            try {
                await playAudio(audioData);
                playBtn.innerHTML = '▶️';
            } catch (err) {
                console.error('Error reproduciendo:', err);
                alert('Error al reproducir audio');
                playBtn.innerHTML = '▶️';
            } finally {
                playBtn.disabled = false;
            }
        };
        bubble.appendChild(voiceIcon);
        bubble.appendChild(voiceContent);
        bubble.appendChild(playBtn);
    } else {
        bubble.appendChild(voiceIcon);
        bubble.appendChild(voiceContent);
    }
    
    const time = document.createElement('div');
    time.className = 'message-time';
    time.innerText = new Date().toLocaleTimeString();
    
    messageDiv.appendChild(header);
    messageDiv.appendChild(bubble);
    messageDiv.appendChild(time);
    
    messagesArea.appendChild(messageDiv);
    messagesArea.scrollTop = messagesArea.scrollHeight;
}

// ========== LLAMADAS WEBRTC ==========

let inCall = false;
let callWithUser = null;

/**
 * Manejar clic en botón de llamada
 */
async function handleCallButton() {
    const username = sessionStorage.getItem('username');
    
    if (inCall) {
        // Colgar llamada actual
        await hangUp(username, callWithUser);
        endCallUI();
    } else {
        // Iniciar nueva llamada
        if (!currentChat || currentChat.type !== 'user') {
            alert('Selecciona un usuario para llamar');
            return;
        }
        
        console.log('[CALL] Iniciando llamada a:', currentChat.name);
        
        // Notificar al servidor
        const result = await initiateCall(username, currentChat.name);
        if (!result.success) {
            alert('No se pudo iniciar la llamada: ' + result.message);
            return;
        }
        
        // Iniciar WebRTC
        const callResult = await startCall(username, currentChat.name, true); // audioOnly = true
        if (!callResult.success) {
            alert('Error al iniciar llamada: ' + callResult.error);
            return;
        }
        
        // Actualizar UI
        callWithUser = currentChat.name;
        inCall = true;
        showCallUI(currentChat.name, callResult.localStream);
    }
}

/**
 * Manejar llamada entrante
 */
async function handleIncomingCall(from) {
    const username = sessionStorage.getItem('username');
    
    if (inCall) {
        console.log('[CALL] Rechazando llamada, ya estamos en otra');
        return;
    }
    
    // Mostrar UI de llamada entrante personalizada
    showIncomingCallUI(from, async (accepted) => {
        if (accepted) {
            console.log('[CALL] Aceptando llamada de:', from);
            
            // Iniciar WebRTC para responder
            const callResult = await answerCall(from, username, true); // audioOnly = true
            if (!callResult.success) {
                alert('Error al aceptar llamada: ' + callResult.error);
                return;
            }
            
            // Actualizar UI
            callWithUser = from;
            inCall = true;
            showCallUI(from, callResult.localStream);
            
            // Cambiar al chat del usuario que llama
            selectUserDirectly(from);
        } else {
            console.log('[CALL] Llamada rechazada');
        }
    });
}

/**
 * Manejar señales WebRTC (offer/answer)
 */
async function handleWebRTCSignal(from, signalType, signalData) {
    console.log('[CALL] Manejando señal:', signalType, 'de:', from);
    const username = sessionStorage.getItem('username');
    
    if (signalType === 'offer') {
        await handleOffer(from, username, signalData);
    } else if (signalType === 'answer') {
        await handleAnswer(from, signalData);
    }
}

/**
 * Mostrar UI de llamada activa
 */
/**
 * Mostrar modal de llamada entrante
 */
function showIncomingCallUI(callerName, callback) {
    // Crear overlay modal
    const modal = document.createElement('div');
    modal.id = 'incomingCallModal';
    modal.className = 'incoming-call-modal';
    modal.innerHTML = `
        <div class="incoming-call-overlay"></div>
        <div class="incoming-call-card">
            <div class="incoming-call-avatar">
                <div class="avatar-ring"></div>
                <div class="avatar-circle">
                    <span class="avatar-initial">${callerName.charAt(0).toUpperCase()}</span>
                </div>
            </div>
            <h2 class="incoming-call-name">${callerName}</h2>
            <p class="incoming-call-text">📞 Llamada entrante...</p>
            <div class="incoming-call-buttons">
                <button class="call-accept-btn" id="acceptCallBtn">
                    <span class="btn-icon">✓</span>
                    <span>Aceptar</span>
                </button>
                <button class="call-reject-btn" id="rejectCallBtn">
                    <span class="btn-icon">✕</span>
                    <span>Rechazar</span>
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Animar entrada
    setTimeout(() => modal.classList.add('show'), 10);
    
    // Handlers
    const acceptBtn = document.getElementById('acceptCallBtn');
    const rejectBtn = document.getElementById('rejectCallBtn');
    
    const closeModal = () => {
        modal.classList.remove('show');
        setTimeout(() => modal.remove(), 300);
    };
    
    acceptBtn.onclick = () => {
        closeModal();
        callback(true);
    };
    
    rejectBtn.onclick = () => {
        closeModal();
        callback(false);
    };
}

function showCallUI(remoteUser, localStream) {
    const callContainer = document.getElementById('callContainer');
    const callButton = document.getElementById('call-button');
    
    callContainer.style.display = 'flex';
    callContainer.innerHTML = `
        <div class="call-info">
            <h3>📞 En llamada con ${remoteUser}</h3>
            <div class="call-status">Conectado...</div>
        </div>
        <div class="call-videos">
            <div class="video-container">
                <video id="localVideo" autoplay muted playsinline></video>
                <label>Tú</label>
            </div>
            <div class="video-container">
                <video id="remoteVideo" autoplay playsinline muted="false"></video>
                <label>${remoteUser}</label>
            </div>
        </div>
        <div class="call-controls">
            <button class="hangup-btn" onclick="window.hangUpCall()">🔴 Colgar</button>
        </div>
    `;
    
    // Mostrar stream local en video
    const localVideo = document.getElementById('localVideo');
    if (localVideo && localStream) {
        localVideo.srcObject = localStream;
    }
    
    // Actualizar botón de llamada
    callButton.innerHTML = '🔴';
    callButton.title = 'Colgar';
}

/**
 * Terminar llamada y limpiar UI
 */
async function endCallUI() {
    const username = sessionStorage.getItem('username');
    const callContainer = document.getElementById('callContainer');
    const callButton = document.getElementById('call-button');
    
    if (inCall && callWithUser) {
        await hangUp(username, callWithUser);
    }
    
    callContainer.style.display = 'none';
    callContainer.innerHTML = '';
    
    callButton.innerHTML = '📞';
    callButton.title = 'Iniciar llamada';
    
    inCall = false;
    callWithUser = null;
}

// Exponer función globalmente para el botón de colgar
window.hangUpCall = endCallUI;

/**
 * Seleccionar usuario directamente (usado al recibir llamada)
 */
function selectUserDirectly(username) {
    const userButtons = document.querySelectorAll('.user-item');
    userButtons.forEach(btn => {
        if (btn.dataset.username === username) {
            btn.click();
        }
    });
}

export default Chat;
