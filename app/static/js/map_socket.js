// ==========================================
// MAP SOCKET MODULE - WebSocket e Sincronização
// ==========================================

const socket = io();
const SESSION_ID = document.getElementById('sessionId').value;

// Estado global do mapa
window.mapState = {
    images: [],
    tokens: [],
    drawings: [],
    players: [],
    selectedItem: null,
    selectedType: null
};

// ==================
// WEBSOCKET EVENTS - CONEXÃO
// ==================
socket.on('connect', () => {
    console.log('✅ Conectado ao servidor');
    socket.emit('join_session', { session_id: SESSION_ID });
});

socket.on('session_state', (data) => {
    console.log('📦 Estado da sessão recebido:', data);
    
    const maps = data.maps || [];
    const entities = data.entities || [];
    window.mapState.images = [...maps, ...entities];
    
    window.mapState.tokens = data.tokens || [];
    window.mapState.drawings = data.drawings || [];
    
    window.canvasModule.preloadAllImages();
    window.canvasModule.drawGrid();
});

socket.on('players_list', (data) => {
    window.mapState.players = data.players || [];
    if (window.playersModule) {
        window.playersModule.renderPlayersList();
    }
    if (window.chatModule) {
        window.chatModule.loadChatContacts();
    }
});

socket.on('player_joined', (data) => {
    window.toolsModule.showToast(`${data.player_name} entrou na sessão`);
    socket.emit('get_players', { session_id: SESSION_ID });
    if (window.chatModule) {
        window.chatModule.loadChatContacts();
    }
});

socket.on('player_left', (data) => {
    window.toolsModule.showToast(`${data.player_name} saiu da sessão`);
    socket.emit('get_players', { session_id: SESSION_ID });
    if (window.chatModule) {
        window.chatModule.loadChatContacts();
    }
});

// ==================
// SINCRONIZAÇÃO EM TEMPO REAL - CORRIGIDO
// ==================
socket.on('maps_sync', (data) => {
    console.log('🗺️ Maps sincronizados:', data.maps);
    const maps = data.maps || [];
    const entities = window.mapState.images.filter(img => !img.id.startsWith('map_'));
    window.mapState.images = [...maps, ...entities];
    window.canvasModule.preloadAllImages();
});

socket.on('entities_sync', (data) => {
    console.log('🎭 Entities sincronizados:', data.entities);
    const entities = data.entities || [];
    const maps = window.mapState.images.filter(img => img.id.startsWith('map_'));
    window.mapState.images = [...maps, ...entities];
    window.canvasModule.preloadAllImages();
});

socket.on('token_sync', (data) => {
    console.log('🎯 Tokens sincronizados:', data.tokens);
    window.mapState.tokens = data.tokens || [];
    window.canvasModule.preloadAllImages();
});

socket.on('drawing_sync', (data) => {
    console.log('✏️ Desenho sincronizado');
    window.mapState.drawings.push(data.drawing);
    window.canvasModule.redrawDrawings();
});

socket.on('drawings_cleared', () => {
    console.log('🧹 Desenhos limpos');
    window.mapState.drawings = [];
    window.canvasModule.redrawDrawings();
});

// ==================
// CHAT WHATSAPP - EVENTOS
// ==================
socket.on('receive_message', (data) => {
    if (window.chatModule) {
        window.chatModule.handleReceiveMessage(data);
    }
});

socket.on('contacts_loaded', (data) => {
    if (window.chatModule) {
        window.chatModule.handleContactsLoaded(data);
    }
});

socket.on('conversation_loaded', (data) => {
    if (window.chatModule) {
        window.chatModule.handleConversationLoaded(data);
    }
});

// ==================
// PERMISSÕES
// ==================
socket.on('permissions_updated', (data) => {
    console.log('🔐 Permissões atualizadas');
    // Atualizar no frontend se necessário
});

// ==================
// INICIALIZAÇÃO
// ==================
setTimeout(() => {
    socket.emit('get_players', { session_id: SESSION_ID });
}, 500);

// Exportar
window.socketModule = {
    socket,
    SESSION_ID
};

window.SESSION_ID = SESSION_ID;