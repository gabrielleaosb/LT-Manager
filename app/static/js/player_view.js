// PLAYER VIEW - COMPLETO E CORRIGIDO
const socket = io();
const SESSION_ID = document.getElementById('sessionId').value;

const CANVAS_WIDTH = 2000;
const CANVAS_HEIGHT = 2000;

let playerName = '';
let playerId = null;
let permissions = { moveTokens: [], draw: false };
let allPlayers = [];

// CHAT WHATSAPP
let chatContacts = [];
let currentChatContact = null;
let currentConversation = [];

// Canvas
const mapCanvas = document.getElementById('mapCanvas');
const mapCtx = mapCanvas.getContext('2d');
const gridCanvas = document.getElementById('gridCanvas');
const gridCtx = gridCanvas.getContext('2d');
const drawingCanvas = document.getElementById('drawingCanvas');
const drawCtx = drawingCanvas.getContext('2d');
const canvasWrapper = document.getElementById('canvasWrapper');
const canvasContainer = document.querySelector('.canvas-container');

mapCanvas.width = gridCanvas.width = drawingCanvas.width = CANVAS_WIDTH;
mapCanvas.height = gridCanvas.height = drawingCanvas.height = CANVAS_HEIGHT;

let maps = [];
let entities = [];
let tokens = [];
let drawings = [];
let currentScale = 1;
let panX = 0;
let panY = 0;

// Pan - SEMPRE ATIVO (exceto quando está desenhando)
let isPanning = false;
let startPanX = 0;
let startPanY = 0;

// Movimentação de tokens - APENAS SE TIVER PERMISSÃO
let draggingToken = null;
let dragOffsetX = 0;
let dragOffsetY = 0;

// Desenho - APENAS SE TIVER PERMISSÃO
let isDrawing = false;
let currentPath = [];
let drawTool = 'draw';
let drawColor = '#9b59b6';
let brushSize = 3;

const TOKEN_RADIUS = 35;
let loadedImages = {};

// Grid
let gridEnabled = true;
let gridSize = 50;
let gridColor = 'rgba(155, 89, 182, 0.3)';

// ========== CENTRALIZAÇÃO E TRANSFORM ==========
function centerCanvas() {
    const containerRect = canvasContainer.getBoundingClientRect();
    panX = (containerRect.width - CANVAS_WIDTH) / 2;
    panY = (containerRect.height - CANVAS_HEIGHT) / 2;
    applyTransform();
}

function applyTransform() {
    canvasWrapper.style.transform = `translate(${panX}px, ${panY}px) scale(${currentScale})`;
}

function zoom(delta) {
    const containerRect = canvasContainer.getBoundingClientRect();
    const centerX = containerRect.width / 2;
    const centerY = containerRect.height / 2;
    
    const mouseCanvasX = (centerX - panX) / currentScale;
    const mouseCanvasY = (centerY - panY) / currentScale;
    
    const oldScale = currentScale;
    currentScale = Math.max(0.3, Math.min(3, currentScale + delta));
    
    panX = centerX - mouseCanvasX * currentScale;
    panY = centerY - mouseCanvasY * currentScale;
    
    applyTransform();
}

canvasWrapper.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    zoom(delta);
});

// ========== GRID ==========
function drawGrid() {
    gridCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    if (!gridEnabled) return;
    
    gridCtx.strokeStyle = gridColor;
    gridCtx.lineWidth = 1;
    
    for (let x = 0; x <= CANVAS_WIDTH; x += gridSize) {
        gridCtx.beginPath();
        gridCtx.moveTo(x, 0);
        gridCtx.lineTo(x, CANVAS_HEIGHT);
        gridCtx.stroke();
    }
    
    for (let y = 0; y <= CANVAS_HEIGHT; y += gridSize) {
        gridCtx.beginPath();
        gridCtx.moveTo(0, y);
        gridCtx.lineTo(CANVAS_WIDTH, y);
        gridCtx.stroke();
    }
}

// ========== LOGIN ==========
document.getElementById('loginBtn').addEventListener('click', () => {
    const nameInput = document.getElementById('playerNameInput');
    const name = nameInput.value.trim();
    
    if (!name) {
        alert('Por favor, digite um nome!');
        return;
    }
    
    playerName = name;
    playerId = Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    
    document.getElementById('playerNameDisplay').textContent = playerName;
    document.getElementById('loginOverlay').classList.add('hidden');
    
    socket.emit('player_join', {
        session_id: SESSION_ID,
        player_id: playerId,
        player_name: playerName
    });
    
    showToast(`Bem-vindo, ${playerName}!`);
});

document.getElementById('playerNameInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') document.getElementById('loginBtn').click();
});

// ========== WEBSOCKET ==========
socket.on('connect', () => {
    console.log('Conectado');
    updateStatus(true);
});

socket.on('disconnect', () => {
    console.log('Desconectado');
    updateStatus(false);
});

socket.on('session_state', (data) => {
    maps = data.maps || [];
    entities = data.entities || [];
    tokens = data.tokens || [];
    drawings = data.drawings || [];
    preloadAllImages();
    drawGrid();
});

socket.on('permissions_updated', (data) => {
    if (data.player_id === playerId) {
        permissions = data.permissions;
        updateDrawingTools();
        showToast('Suas permissões foram atualizadas!');
    }
});

// TEMPO REAL - Sincronização instantânea
socket.on('maps_sync', (data) => {
    maps = data.maps || [];
    preloadAllImages();
});

socket.on('entities_sync', (data) => {
    entities = data.entities || [];
    preloadAllImages();
});

socket.on('token_sync', (data) => {
    tokens = data.tokens || [];
    preloadAllImages();
});

socket.on('drawing_sync', (data) => {
    drawings.push(data.drawing);
    redrawDrawings();
});

socket.on('drawings_cleared', () => {
    drawings = [];
    redrawDrawings();
});

socket.on('players_list', (data) => {
    allPlayers = data.players || [];
    loadChatContacts();
});

socket.on('player_joined', (data) => {
    if (data.player_id !== playerId) {
        showToast(`${data.player_name} entrou na sessão`);
    }
    loadChatContacts();
});

// CHAT WHATSAPP
socket.on('chat_contacts_loaded', (data) => {
    chatContacts = data.contacts || [];
    renderChatContacts();
});

socket.on('conversation_loaded', (data) => {
    currentConversation = data.messages || [];
    renderConversation();
});

socket.on('new_private_message', (data) => {
    // Se a mensagem é da conversa atual, adiciona
    if (currentChatContact && 
        (data.sender_id === currentChatContact || data.recipient_id === currentChatContact)) {
        currentConversation.push(data);
        renderConversation();
    }
    
    // Recarregar contatos para atualizar badges
    loadChatContacts();
    playNotificationSound();
});

socket.on('chat_notification', (data) => {
    showToast(`Nova mensagem de ${data.from_name}`);
});

function updateStatus(connected) {
    const indicator = document.getElementById('statusIndicator');
    const text = document.getElementById('statusText');
    
    if (connected) {
        indicator.className = 'status-indicator connected';
        text.textContent = 'Conectado';
    } else {
        indicator.className = 'status-indicator disconnected';
        text.textContent = 'Desconectado';
    }
}

// ========== IMAGENS ==========
function preloadAllImages() {
    [...maps, ...entities].forEach(img => {
        if (img.image && !loadedImages[img.id]) {
            const i = new Image();
            i.onload = () => { loadedImages[img.id] = i; redrawAll(); };
            i.src = img.image;
        }
    });
    
    tokens.forEach(token => {
        if (token.image && !loadedImages[token.id]) {
            const i = new Image();
            i.onload = () => { loadedImages[token.id] = i; redrawAll(); };
            i.src = token.image;
        }
    });
}
// PLAYER VIEW - PARTE 2 - RENDER E EVENTOS DE MOUSE

// ========== RENDER ==========
function redrawAll() {
    mapCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    [...maps, ...entities].forEach(img => {
        const loadedImg = loadedImages[img.id];
        if (loadedImg && loadedImg.complete) {
            mapCtx.drawImage(loadedImg, img.x, img.y, img.width, img.height);
        }
    });
    
    tokens.forEach(token => {
        const img = loadedImages[token.id];
        
        if (token.style === 'square' && img && img.complete) {
            // Token quadrado
            mapCtx.drawImage(img, token.x - TOKEN_RADIUS, token.y - TOKEN_RADIUS, TOKEN_RADIUS * 2, TOKEN_RADIUS * 2);
            
            mapCtx.strokeStyle = "#fff";
            mapCtx.lineWidth = 2;
            mapCtx.strokeRect(token.x - TOKEN_RADIUS, token.y - TOKEN_RADIUS, TOKEN_RADIUS * 2, TOKEN_RADIUS * 2);
        } else if (img && img.complete) {
            // Token redondo
            mapCtx.save();
            mapCtx.beginPath();
            mapCtx.arc(token.x, token.y, TOKEN_RADIUS, 0, Math.PI * 2);
            mapCtx.closePath();
            mapCtx.clip();
            mapCtx.drawImage(img, token.x - TOKEN_RADIUS, token.y - TOKEN_RADIUS, TOKEN_RADIUS * 2, TOKEN_RADIUS * 2);
            mapCtx.restore();
            
            mapCtx.strokeStyle = "#fff";
            mapCtx.lineWidth = 2;
            mapCtx.beginPath();
            mapCtx.arc(token.x, token.y, TOKEN_RADIUS, 0, Math.PI * 2);
            mapCtx.stroke();
        } else if (token.color) {
            mapCtx.fillStyle = token.color;
            mapCtx.beginPath();
            mapCtx.arc(token.x, token.y, TOKEN_RADIUS, 0, Math.PI * 2);
            mapCtx.fill();
            
            mapCtx.strokeStyle = "#fff";
            mapCtx.lineWidth = 2;
            mapCtx.beginPath();
            mapCtx.arc(token.x, token.y, TOKEN_RADIUS, 0, Math.PI * 2);
            mapCtx.stroke();
        }
        
        mapCtx.fillStyle = "#fff";
        mapCtx.font = "bold 13px Lato";
        mapCtx.textAlign = "center";
        mapCtx.strokeStyle = "#000";
        mapCtx.lineWidth = 3;
        mapCtx.strokeText(token.name, token.x, token.y + TOKEN_RADIUS + 18);
        mapCtx.fillText(token.name, token.x, token.y + TOKEN_RADIUS + 18);
    });
}

function redrawDrawings() {
    drawCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    drawings.forEach(drawing => {
        drawCtx.strokeStyle = drawing.color;
        drawCtx.lineWidth = drawing.size;
        drawCtx.lineCap = 'round';
        drawCtx.lineJoin = 'round';
        
        if (drawing.path.length > 1) {
            drawCtx.beginPath();
            drawCtx.moveTo(drawing.path[0].x, drawing.path[0].y);
            for (let i = 1; i < drawing.path.length; i++) {
                drawCtx.lineTo(drawing.path[i].x, drawing.path[i].y);
            }
            drawCtx.stroke();
        }
    });
}

// ========== MOUSE - PAN E MOVER TOKENS (CORRIGIDO) ==========
function getMousePos(e) {
    const rect = canvasWrapper.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    return { x, y };
}

function findTokenAt(x, y) {
    for (let i = tokens.length - 1; i >= 0; i--) {
        const token = tokens[i];
        const dist = Math.hypot(token.x - x, token.y - y);
        if (dist <= TOKEN_RADIUS && permissions.moveTokens && permissions.moveTokens.includes(token.id)) {
            return token;
        }
    }
    return null;
}

canvasWrapper.addEventListener('mousedown', (e) => {
    const pos = getMousePos(e);
    
    // Se está no modo de desenho, não fazer nada aqui
    if (permissions.draw && (drawTool === 'draw' || drawTool === 'erase')) {
        return;
    }
    
    // Tentar pegar token (se tiver permissão)
    const token = findTokenAt(pos.x, pos.y);
    if (token) {
        draggingToken = token;
        dragOffsetX = pos.x - token.x;
        dragOffsetY = pos.y - token.y;
        canvasWrapper.style.cursor = 'grabbing';
        return;
    }
    
    // Pan (sempre disponível quando não está desenhando ou movendo token)
    isPanning = true;
    startPanX = e.clientX - panX;
    startPanY = e.clientY - panY;
    canvasWrapper.classList.add('grabbing');
});

canvasWrapper.addEventListener('mousemove', (e) => {
    const pos = getMousePos(e);
    
    // Se está desenhando, não fazer nada aqui
    if (permissions.draw && (drawTool === 'draw' || drawTool === 'erase')) {
        return;
    }
    
    if (draggingToken) {
        draggingToken.x = pos.x - dragOffsetX;
        draggingToken.y = pos.y - dragOffsetY;
        redrawAll();
        return;
    }
    
    if (isPanning) {
        panX = e.clientX - startPanX;
        panY = e.clientY - startPanY;
        applyTransform();
    }
});

canvasWrapper.addEventListener('mouseup', () => {
    if (draggingToken) {
        socket.emit('token_update', {
            session_id: SESSION_ID,
            tokens: tokens
        });
        draggingToken = null;
    }
    
    isPanning = false;
    canvasWrapper.classList.remove('grabbing');
    canvasWrapper.style.cursor = 'grab';
});

canvasWrapper.addEventListener('mouseleave', () => {
    draggingToken = null;
    isPanning = false;
    canvasWrapper.classList.remove('grabbing');
});

// ========== DESENHO (SE TIVER PERMISSÃO) - CORRIGIDO ==========
function updateDrawingTools() {
    const tools = document.getElementById('drawingTools');
    if (permissions.draw) {
        tools.classList.add('show');
        // Quando ganha permissão de desenhar, ativa o modo desenho automaticamente
        setDrawTool('draw');
    } else {
        tools.classList.remove('show');
        drawingCanvas.classList.remove('drawing-mode');
        canvasWrapper.classList.remove('drawing-mode');
    }
}

function setDrawTool(tool) {
    drawTool = tool;
    document.querySelectorAll('.drawing-tools .tool-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    if (tool === 'draw') {
        drawingCanvas.classList.add('drawing-mode');
        canvasWrapper.classList.add('drawing-mode');
        drawingCanvas.style.cursor = 'crosshair';
        canvasWrapper.style.cursor = 'crosshair';
    } else if (tool === 'erase') {
        drawingCanvas.classList.add('drawing-mode');
        canvasWrapper.classList.add('drawing-mode');
        drawingCanvas.style.cursor = 'not-allowed';
        canvasWrapper.style.cursor = 'not-allowed';
    } else if (tool === 'pan') {
        drawingCanvas.classList.remove('drawing-mode');
        canvasWrapper.classList.remove('drawing-mode');
        drawingCanvas.style.cursor = 'default';
        canvasWrapper.style.cursor = 'grab';
    }
}

function setPlayerColor(color) {
    drawColor = color;
    document.querySelectorAll('.color-option').forEach(opt => opt.classList.remove('active'));
    event.target.classList.add('active');
}

function getDrawingPos(e) {
    const rect = drawingCanvas.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    return { x, y };
}

drawingCanvas.addEventListener('mousedown', (e) => {
    if (!permissions.draw) return;
    
    if (drawTool === 'draw') {
        isDrawing = true;
        const pos = getDrawingPos(e);
        currentPath = [pos];
    } else if (drawTool === 'erase') {
        const pos = getDrawingPos(e);
        eraseDrawingsAt(pos.x, pos.y);
    }
});

drawingCanvas.addEventListener('mousemove', (e) => {
    if (!permissions.draw) return;
    
    if (isDrawing && drawTool === 'draw') {
        const pos = getDrawingPos(e);
        currentPath.push(pos);
        
        drawCtx.strokeStyle = drawColor;
        drawCtx.lineWidth = brushSize;
        drawCtx.lineCap = 'round';
        drawCtx.lineJoin = 'round';
        
        if (currentPath.length > 1) {
            const prev = currentPath[currentPath.length - 2];
            const curr = currentPath[currentPath.length - 1];
            
            drawCtx.beginPath();
            drawCtx.moveTo(prev.x, prev.y);
            drawCtx.lineTo(curr.x, curr.y);
            drawCtx.stroke();
        }
    } else if (drawTool === 'erase' && e.buttons === 1) {
        const pos = getDrawingPos(e);
        eraseDrawingsAt(pos.x, pos.y);
    }
});

drawingCanvas.addEventListener('mouseup', () => {
    if (isDrawing && currentPath.length > 0) {
        const drawing = {
            id: Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            path: currentPath,
            color: drawColor,
            size: brushSize
        };
        drawings.push(drawing);
        
        socket.emit('drawing_update', {
            session_id: SESSION_ID,
            drawing: drawing
        });
        
        currentPath = [];
    }
    isDrawing = false;
});

function eraseDrawingsAt(x, y) {
    const eraseRadius = brushSize * 3;
    let changed = false;
    
    drawings = drawings.filter(drawing => {
        const hasPointInRadius = drawing.path.some(point => {
            const dist = Math.hypot(point.x - x, point.y - y);
            return dist < eraseRadius;
        });
        
        if (hasPointInRadius) {
            changed = true;
            return false;
        }
        return true;
    });
    
    if (changed) {
        redrawDrawings();
        socket.emit('clear_drawings', { session_id: SESSION_ID });
        drawings.forEach(d => {
            socket.emit('drawing_update', {
                session_id: SESSION_ID,
                drawing: d
            });
        });
    }
}
// PLAYER VIEW - PARTE 3 - CHAT WHATSAPP

// ========== CHAT WHATSAPP ==========
function loadChatContacts() {
    socket.emit('get_chat_contacts', {
        session_id: SESSION_ID,
        user_id: playerId
    });
}

function renderChatContacts() {
    const contactsList = document.getElementById('contactsList');
    if (!contactsList) return;
    
    contactsList.innerHTML = '';
    
    if (chatContacts.length === 0) {
        contactsList.innerHTML = '<div class="empty-state">Nenhum contato disponível</div>';
        return;
    }
    
    chatContacts.forEach(contact => {
        const item = document.createElement('div');
        item.className = 'contact-item';
        if (currentChatContact === contact.id) {
            item.classList.add('active');
        }
        
        item.onclick = () => openConversation(contact.id);
        
        const lastMsg = contact.last_message ? 
            (contact.last_message.message.substring(0, 30) + (contact.last_message.message.length > 30 ? '...' : '')) :
            'Nenhuma mensagem ainda';
        
        item.innerHTML = `
            <div class="contact-avatar">${contact.name.charAt(0).toUpperCase()}</div>
            <div class="contact-info">
                <div class="contact-name">${contact.name}</div>
                <div class="contact-last-message">${lastMsg}</div>
            </div>
            ${contact.unread > 0 ? `<span class="contact-badge">${contact.unread}</span>` : ''}
        `;
        
        contactsList.appendChild(item);
    });
}

function openConversation(contactId) {
    currentChatContact = contactId;
    
    // Atualizar UI
    document.querySelectorAll('.contact-item').forEach(item => item.classList.remove('active'));
    event.currentTarget?.classList.add('active');
    
    // Carregar conversa
    socket.emit('get_conversation', {
        session_id: SESSION_ID,
        user_id: playerId,
        other_user_id: contactId
    });
    
    // Mostrar área de conversa
    document.getElementById('conversationPlaceholder').style.display = 'none';
    document.getElementById('conversationArea').style.display = 'flex';
    
    // Atualizar header da conversa
    const contact = chatContacts.find(c => c.id === contactId);
    if (contact) {
        document.getElementById('conversationContactName').textContent = contact.name;
        document.getElementById('conversationContactAvatar').textContent = contact.name.charAt(0).toUpperCase();
    }
}

function renderConversation() {
    const messagesContainer = document.getElementById('conversationMessages');
    if (!messagesContainer) return;
    
    messagesContainer.innerHTML = '';
    
    if (currentConversation.length === 0) {
        messagesContainer.innerHTML = '<div class="empty-state">Nenhuma mensagem ainda. Inicie a conversa!</div>';
        return;
    }
    
    currentConversation.forEach(msg => {
        const bubble = document.createElement('div');
        bubble.className = msg.sender_id === playerId ? 'message-bubble sent' : 'message-bubble received';
        
        const time = new Date(msg.timestamp).toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit'
        });
        
        bubble.innerHTML = `
            <div class="message-text">${msg.message}</div>
            <div class="message-time">${time}</div>
        `;
        
        messagesContainer.appendChild(bubble);
    });
    
    // Scroll para o final
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function sendChatMessage() {
    const input = document.getElementById('conversationInput');
    const message = input.value.trim();
    
    if (!message || !currentChatContact) {
        return;
    }
    
    socket.emit('send_private_message', {
        session_id: SESSION_ID,
        sender_id: playerId,
        recipient_id: currentChatContact,
        message: message
    });
    
    input.value = '';
    
    // Adicionar temporariamente à conversa
    currentConversation.push({
        id: 'temp_' + Date.now(),
        sender_id: playerId,
        sender_name: playerName,
        recipient_id: currentChatContact,
        message: message,
        timestamp: new Date().toISOString()
    });
    
    renderConversation();
}

// Enter para enviar
document.addEventListener('DOMContentLoaded', () => {
    const conversationInput = document.getElementById('conversationInput');
    if (conversationInput) {
        conversationInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendChatMessage();
            }
        });
    }
});

function playNotificationSound() {
    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIGGa88OScTgwOWK3n77BdGAg+ltf');
    audio.volume = 0.3;
    audio.play().catch(() => {});
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// ========== INIT ==========
window.addEventListener('resize', () => {
    centerCanvas();
});

setTimeout(() => {
    centerCanvas();
}, 100);

drawGrid();