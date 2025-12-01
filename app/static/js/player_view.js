// PLAYER VIEW - COMPLETO E CORRIGIDO
const socket = io();
const SESSION_ID = document.getElementById('sessionId').value;

const CANVAS_WIDTH = 2000;
const CANVAS_HEIGHT = 2000;

let playerName = '';
let playerId = null;
let permissions = { moveTokens: [], draw: false };
let allPlayers = [];
let chatMessages = [];

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

// Pan
let isPanning = false;
let startPanX = 0;
let startPanY = 0;

// Movimentação de tokens
let draggingToken = null;
let dragOffsetX = 0;
let dragOffsetY = 0;

// Desenho
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
    updateChatRecipients();
});

socket.on('player_joined', (data) => {
    if (data.player_id !== playerId) {
        showToast(`${data.player_name} entrou na sessão`);
    }
});

// CHAT - APENAS PRIVADAS
socket.on('chat_history', (data) => {
    chatMessages = data.messages || [];
    renderChatMessages();
});

socket.on('new_message', (data) => {
    if ((data.sender_id === playerId || data.recipient_id === playerId) && 
        !chatMessages.find(m => m.id === data.id)) {
        chatMessages.push(data);
        renderChatMessages();
        playNotificationSound();
    }
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
        
        if (img && img.complete) {
            mapCtx.save();
            mapCtx.beginPath();
            mapCtx.arc(token.x, token.y, TOKEN_RADIUS, 0, Math.PI * 2);
            mapCtx.closePath();
            mapCtx.clip();
            mapCtx.drawImage(img, token.x - TOKEN_RADIUS, token.y - TOKEN_RADIUS, TOKEN_RADIUS * 2, TOKEN_RADIUS * 2);
            mapCtx.restore();
        } else if (token.color) {
            mapCtx.fillStyle = token.color;
            mapCtx.beginPath();
            mapCtx.arc(token.x, token.y, TOKEN_RADIUS, 0, Math.PI * 2);
            mapCtx.fill();
        }
        
        mapCtx.strokeStyle = "#fff";
        mapCtx.lineWidth = 2;
        mapCtx.beginPath();
        mapCtx.arc(token.x, token.y, TOKEN_RADIUS, 0, Math.PI * 2);
        mapCtx.stroke();
        
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

// ========== MOUSE - PAN E MOVER TOKENS ==========
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
    
    // Tentar pegar token
    const token = findTokenAt(pos.x, pos.y);
    if (token) {
        draggingToken = token;
        dragOffsetX = pos.x - token.x;
        dragOffsetY = pos.y - token.y;
        canvasWrapper.style.cursor = 'grabbing';
        return;
    }
    
    // Pan
    isPanning = true;
    startPanX = e.clientX - panX;
    startPanY = e.clientY - panY;
    canvasWrapper.classList.add('grabbing');
});

canvasWrapper.addEventListener('mousemove', (e) => {
    const pos = getMousePos(e);
    
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

// ========== DESENHO (SE TIVER PERMISSÃO) ==========
function updateDrawingTools() {
    const tools = document.getElementById('drawingTools');
    if (permissions.draw) {
        tools.classList.add('show');
        drawingCanvas.classList.add('drawing-mode');
    } else {
        tools.classList.remove('show');
        drawingCanvas.classList.remove('drawing-mode');
    }
}

function setDrawTool(tool) {
    drawTool = tool;
    document.querySelectorAll('.drawing-tools .tool-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    if (tool === 'draw') {
        drawingCanvas.style.cursor = 'crosshair';
    } else {
        drawingCanvas.style.cursor = 'not-allowed';
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

// ========== CHAT ==========
function updateChatRecipients() {
    const select = document.getElementById('chatRecipient');
    select.innerHTML = '<option value="">Selecione um destinatário</option>';
    
    // Adicionar Mestre
    const masterOption = document.createElement('option');
    masterOption.value = 'master';
    masterOption.textContent = '👑 Mestre';
    select.appendChild(masterOption);
    
    // Adicionar outros jogadores
    allPlayers.filter(p => p.id !== playerId).forEach(player => {
        const option = document.createElement('option');
        option.value = player.id;
        option.textContent = `💬 ${player.name}`;
        select.appendChild(option);
    });
}

function renderChatMessages() {
    const chatBox = document.getElementById('chatMessages');
    chatBox.innerHTML = '';
    
    if (chatMessages.length === 0) {
        chatBox.innerHTML = '<div class="empty-state">Nenhuma mensagem ainda</div>';
        return;
    }
    
    chatMessages.forEach(msg => {
        const msgDiv = document.createElement('div');
        msgDiv.className = 'chat-message private-message';
        
        const senderName = msg.sender_id === playerId ? 'Você' : 
                          msg.sender_id === 'master' ? '👑 Mestre' : msg.sender_name;
        const recipientName = msg.recipient_id === playerId ? 'Você' : 
                            msg.recipient_id === 'master' ? '👑 Mestre' :
                            (allPlayers.find(p => p.id === msg.recipient_id)?.name || 'Desconhecido');
        
        msgDiv.innerHTML = `
            <div class="chat-message-header">
                <strong>${senderName}</strong> → ${recipientName}
                <span class="chat-timestamp">${new Date(msg.timestamp).toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit'})}</span>
            </div>
            <div class="chat-message-text">${msg.message}</div>
        `;
        
        chatBox.appendChild(msgDiv);
    });
    
    chatBox.scrollTop = chatBox.scrollHeight;
}

function sendChatMessage() {
    const input = document.getElementById('chatInput');
    const recipientSelect = document.getElementById('chatRecipient');
    
    const message = input.value.trim();
    const recipientId = recipientSelect.value;
    
    if (!message || !recipientId) {
        alert('Selecione um destinatário e digite uma mensagem!');
        return;
    }
    
    socket.emit('send_message', {
        session_id: SESSION_ID,
        sender_id: playerId,
        message: message,
        recipient_id: recipientId
    });
    
    input.value = '';
}

document.getElementById('chatInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendChatMessage();
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