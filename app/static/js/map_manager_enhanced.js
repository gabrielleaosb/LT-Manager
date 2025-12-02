// MAP MANAGER - MESTRE - PARTE 1 - INICIALIZAÇÃO E WEBSOCKETS
const socket = io();
const SESSION_ID = document.getElementById('sessionId').value;

// Canvas elements
const mapCanvas = document.getElementById('mapCanvas');
const mapCtx = mapCanvas.getContext('2d');
const gridCanvas = document.getElementById('gridCanvas');
const gridCtx = gridCanvas.getContext('2d');
const drawingCanvas = document.getElementById('drawingCanvas');
const drawCtx = drawingCanvas.getContext('2d');
const canvasWrapper = document.querySelector('.canvas-wrapper');
const canvasContainer = document.querySelector('.canvas-container');

// Tamanho do canvas
const CANVAS_WIDTH = 2000;
const CANVAS_HEIGHT = 2000;

mapCanvas.width = gridCanvas.width = drawingCanvas.width = CANVAS_WIDTH;
mapCanvas.height = gridCanvas.height = drawingCanvas.height = CANVAS_HEIGHT;

// Estado
let images = [];
let tokens = [];
let drawings = [];
let players = [];

// CHAT
let chatContacts = [];
let currentChatContact = null;
let currentConversation = [];
let chatMinimized = false;
let chatCollapsed = false;

// Controles
let currentTool = 'select';
let drawingColor = '#9b59b6';
let brushSize = 3;
let isDrawing = false;
let currentPath = [];

const TOKEN_RADIUS = 35;

// Grid
let gridEnabled = true;
let gridSize = 50;
let gridColor = 'rgba(155, 89, 182, 0.3)';
let gridLineWidth = 1;

// Seleção
let selectedItem = null;
let selectedType = null;
let draggingItem = null;
let mouseDown = false;
let dragOffsetX = 0;
let dragOffsetY = 0;

// Resize de imagens
let resizingImage = null;
let resizeStartX = 0;
let resizeStartY = 0;
let resizeStartWidth = 0;
let resizeStartHeight = 0;

// Pan e Zoom
let isPanning = false;
let startPanX = 0;
let startPanY = 0;
let currentScale = 1;
let panX = 0;
let panY = 0;

// Cache de imagens
let loadedImages = new Map();

// Sidebar
let sidebarCollapsed = false;

// ==================
// CENTRALIZAÇÃO E TRANSFORM
// ==================
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

// Zoom com scroll
canvasWrapper.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    zoom(delta);
});

// ==================
// SIDEBAR TOGGLE
// ==================
function toggleSidebar() {
    sidebarCollapsed = !sidebarCollapsed;
    const sidebar = document.querySelector('.tools-sidebar');
    const toggle = document.querySelector('.sidebar-toggle');
    
    if (sidebarCollapsed) {
        sidebar.classList.add('collapsed');
        toggle.textContent = '▶';
    } else {
        sidebar.classList.remove('collapsed');
        toggle.textContent = '◀';
    }
}

// ==================
// GRID
// ==================
function drawGrid() {
    gridCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    if (!gridEnabled) return;
    
    gridCtx.strokeStyle = gridColor;
    gridCtx.lineWidth = gridLineWidth;
    
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

function toggleGrid() {
    gridEnabled = !gridEnabled;
    drawGrid();
    showToast(gridEnabled ? 'Grid ativada' : 'Grid desativada');
}

function updateGridSize(size) {
    gridSize = parseInt(size);
    document.getElementById('gridSizeValue').textContent = gridSize + 'px';
    drawGrid();
}

// ==================
// CARREGAMENTO DE IMAGENS
// ==================
function loadImageSafe(id, src, onComplete) {
    if (loadedImages.has(id)) {
        if (onComplete) onComplete(loadedImages.get(id));
        return loadedImages.get(id);
    }
    
    const img = new Image();
    img.onload = () => {
        loadedImages.set(id, img);
        if (onComplete) onComplete(img);
        redrawAll();
    };
    img.onerror = () => {
        console.error('Erro ao carregar imagem:', id);
    };
    img.src = src;
    return null;
}

function preloadAllImages() {
    images.forEach(img => {
        if (img.image && !loadedImages.has(img.id)) {
            loadImageSafe(img.id, img.image);
        }
    });
    
    tokens.forEach(token => {
        if (token.image && !loadedImages.has(token.id)) {
            loadImageSafe(token.id, token.image);
        }
    });
}

// ==================
// WEBSOCKET EVENTS - CORRIGIDO COM REDRAW SEMPRE
// ==================
socket.on('connect', () => {
    console.log('✅ Conectado ao servidor');
    socket.emit('join_session', { session_id: SESSION_ID });
});

socket.on('session_state', (data) => {
    console.log('📦 Estado da sessão recebido:', data);
    
    const maps = data.maps || [];
    const entities = data.entities || [];
    images = [...maps, ...entities];
    
    tokens = data.tokens || [];
    drawings = data.drawings || [];
    
    preloadAllImages();
    drawGrid();
    renderImageList();
    renderTokenList();
    redrawAll();
    redrawDrawings();
});

socket.on('players_list', (data) => {
    console.log('👥 Lista de jogadores recebida:', data);
    players = data.players || [];
    renderPlayersList();
    loadChatContacts();
});

socket.on('player_joined', (data) => {
    console.log('✅ Jogador entrou:', data);
    showToast(`${data.player_name} entrou na sessão`);
    socket.emit('get_players', { session_id: SESSION_ID });
});

socket.on('player_left', (data) => {
    console.log('❌ Jogador saiu:', data);
    showToast(`${data.player_name} saiu da sessão`);
    socket.emit('get_players', { session_id: SESSION_ID });
});

// SINCRONIZAÇÃO EM TEMPO REAL - SEMPRE REDESENHA
socket.on('maps_sync', (data) => {
    console.log('📍 MAPS SYNC recebido:', data);
    const maps = data.maps || [];
    const entities = images.filter(img => !img.id.startsWith('map_'));
    images = [...maps, ...entities];
    preloadAllImages();
    renderImageList();
    redrawAll();
});

socket.on('entities_sync', (data) => {
    console.log('🎭 ENTITIES SYNC recebido:', data);
    const entities = data.entities || [];
    const maps = images.filter(img => img.id.startsWith('map_'));
    images = [...maps, ...entities];
    preloadAllImages();
    renderImageList();
    redrawAll();
});

socket.on('token_sync', (data) => {
    console.log('🎯 TOKEN SYNC recebido:', data);
    tokens = data.tokens || [];
    preloadAllImages();
    renderTokenList();
    redrawAll();
});

socket.on('drawing_sync', (data) => {
    drawings.push(data.drawing);
    redrawDrawings();
});

socket.on('drawings_cleared', () => {
    drawings = [];
    redrawDrawings();
});

// CHAT - Socket Handlers CORRIGIDOS (substitua no início do arquivo, parte 1)

socket.on('chat_contacts_loaded', (data) => {
    console.log('📋 Contatos carregados:', data);
    chatContacts = data.contacts || [];
    renderChatContacts();
});

socket.on('conversation_loaded', (data) => {
    console.log('💬 Conversa carregada:', data);
    currentConversation = data.messages || [];
    
    // Salvar no cache
    if (data.other_user_id) {
        conversationsCache[data.other_user_id] = [...currentConversation];
        console.log(`💾 Cache atualizado para ${data.other_user_id}:`, currentConversation.length, 'mensagens');
    }
    
    renderConversation();
});

socket.on('new_private_message', (data) => {
    console.log('💬 Nova mensagem recebida:', data);
    
    // Verificar se a mensagem já existe para evitar duplicação
    const messageExists = (messages, msgData) => {
        return messages.some(m => m.id === msgData.id);
    };
    
    // Adicionar à conversa atual se estiver aberta e não existir
    if (currentChatContact) {
        let shouldAdd = false;
        
        // Conversa direta
        if (data.sender_id === currentChatContact || data.recipient_id === currentChatContact) {
            shouldAdd = true;
        }
        // Conversa entre jogadores (mestre observando)
        else if (currentChatContact.includes('_')) {
            const [player1, player2] = currentChatContact.split('_');
            if ((data.sender_id === player1 && data.recipient_id === player2) ||
                (data.sender_id === player2 && data.recipient_id === player1)) {
                shouldAdd = true;
            }
        }
        
        if (shouldAdd && !messageExists(currentConversation, data)) {
            currentConversation.push(data);
            conversationsCache[currentChatContact] = [...currentConversation];
            renderConversation();
        }
    }
    
    // Atualizar cache de outras conversas afetadas (sem duplicar)
    // Conversa mestre -> jogador
    if (data.sender_id === 'master' && data.recipient_id) {
        if (!conversationsCache[data.recipient_id]) {
            conversationsCache[data.recipient_id] = [];
        }
        if (!messageExists(conversationsCache[data.recipient_id], data)) {
            conversationsCache[data.recipient_id].push(data);
        }
    }
    // Conversa jogador -> mestre
    else if (data.recipient_id === 'master' && data.sender_id) {
        if (!conversationsCache[data.sender_id]) {
            conversationsCache[data.sender_id] = [];
        }
        if (!messageExists(conversationsCache[data.sender_id], data)) {
            conversationsCache[data.sender_id].push(data);
        }
    }
    // Conversas entre jogadores
    else if (data.sender_id !== 'master' && data.recipient_id !== 'master') {
        const conversationKey = [data.sender_id, data.recipient_id].sort().join('_');
        if (!conversationsCache[conversationKey]) {
            conversationsCache[conversationKey] = [];
        }
        if (!messageExists(conversationsCache[conversationKey], data)) {
            conversationsCache[conversationKey].push(data);
        }
    }
    
    loadChatContacts();
    playNotificationSound();
});

// MAP MANAGER - PARTE 2 - FERRAMENTAS E RENDER

// ==================
// FERRAMENTAS
// ==================
function setTool(tool) {
    currentTool = tool;
    document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    // Remover classes de modo
    canvasWrapper.classList.remove('drawing-mode');
    drawingCanvas.classList.remove('drawing-mode');
    
    if (tool === 'draw') {
        canvasWrapper.classList.add('drawing-mode');
        drawingCanvas.classList.add('drawing-mode');
        canvasWrapper.style.cursor = 'crosshair';
    } else if (tool === 'erase') {
        canvasWrapper.classList.add('drawing-mode');
        drawingCanvas.classList.add('drawing-mode');
        canvasWrapper.style.cursor = 'not-allowed';
    } else if (tool === 'pan') {
        canvasWrapper.style.cursor = 'grab';
    } else {
        canvasWrapper.style.cursor = 'default';
    }
}

function setDrawingColor(color) {
    drawingColor = color;
    document.querySelectorAll('.color-option').forEach(opt => opt.classList.remove('active'));
    event.target.classList.add('active');
}

function setBrushSize(size) {
    brushSize = parseInt(size);
}

// ==================
// RENDER
// ==================
function redrawAll() {
    mapCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // Desenhar todas as imagens
    images.forEach(img => {
        const loadedImg = loadedImages.get(img.id);
        
        if (loadedImg && loadedImg.complete && loadedImg.naturalWidth > 0) {
            try {
                mapCtx.drawImage(loadedImg, img.x, img.y, img.width, img.height);
                
                if (selectedItem === img && selectedType === 'image') {
                    mapCtx.strokeStyle = '#ffc107';
                    mapCtx.lineWidth = 4;
                    mapCtx.strokeRect(img.x, img.y, img.width, img.height);
                    
                    // Handles de resize
                    const handleSize = 10;
                    mapCtx.fillStyle = '#9b59b6';
                    
                    mapCtx.fillRect(
                        img.x + img.width - handleSize/2, 
                        img.y + img.height - handleSize/2, 
                        handleSize, 
                        handleSize
                    );
                }
            } catch (e) {
                console.error('Erro ao desenhar imagem:', e);
            }
        }
    });
    
    // Desenhar tokens
    tokens.forEach(token => {
        const img = loadedImages.get(token.id);
        
        if (token.style === 'square' && img && img.complete && img.naturalWidth > 0) {
            try {
                const tokenSize = TOKEN_RADIUS * 1.8;
                mapCtx.drawImage(img, token.x - tokenSize/2, token.y - tokenSize/2, tokenSize, tokenSize);
            } catch (e) {
                console.error('Erro ao desenhar token quadrado:', e);
            }
        } else if (img && img.complete && img.naturalWidth > 0) {
            try {
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
            } catch (e) {
                console.error('Erro ao desenhar token:', e);
            }
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
        
        // Nome
        mapCtx.fillStyle = "#fff";
        mapCtx.font = "bold 11px Lato";
        mapCtx.textAlign = "center";
        mapCtx.strokeStyle = "#000";
        mapCtx.lineWidth = 2.5;
        
        const nameY = token.style === 'square' ? token.y + TOKEN_RADIUS * 1.8 / 2 + 15 : token.y + TOKEN_RADIUS + 15;
        mapCtx.strokeText(token.name, token.x, nameY);
        mapCtx.fillText(token.name, token.x, nameY);

        // Highlight
        if (selectedItem === token && selectedType === 'token') {
            mapCtx.strokeStyle = "#ffc107";
            mapCtx.lineWidth = 4;
            mapCtx.beginPath();
            if (token.style === 'square') {
                const tokenSize = TOKEN_RADIUS * 1.8;
                mapCtx.strokeRect(token.x - tokenSize/2 - 5, token.y - tokenSize/2 - 5, tokenSize + 10, tokenSize + 10);
            } else {
                mapCtx.arc(token.x, token.y, TOKEN_RADIUS + 5, 0, Math.PI * 2);
                mapCtx.stroke();
            }
        }
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

// ==================
// EVENTOS DE MOUSE
// ==================
function getMousePos(e) {
    const rect = canvasWrapper.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    return { x, y };
}

function findItemAt(x, y) {
    // Verificar tokens primeiro
    for (let i = tokens.length - 1; i >= 0; i--) {
        const token = tokens[i];
        
        if (token.style === 'square') {
            const tokenSize = TOKEN_RADIUS * 1.8;
            if (x >= token.x - tokenSize/2 && x <= token.x + tokenSize/2 &&
                y >= token.y - tokenSize/2 && y <= token.y + tokenSize/2) {
                return { item: token, type: 'token' };
            }
        } else {
            const dist = Math.hypot(token.x - x, token.y - y);
            if (dist <= TOKEN_RADIUS) {
                return { item: token, type: 'token' };
            }
        }
    }
    
    // Verificar imagens
    for (let i = images.length - 1; i >= 0; i--) {
        const img = images[i];
        if (x >= img.x && x <= img.x + img.width &&
            y >= img.y && y <= img.y + img.height) {
            return { item: img, type: 'image' };
        }
    }
    
    return null;
}

function isOnResizeHandle(img, x, y) {
    const handleSize = 20;
    const handleX = img.x + img.width;
    const handleY = img.y + img.height;
    
    return x >= handleX - handleSize && x <= handleX + handleSize &&
           y >= handleY - handleSize && y <= handleY + handleSize;
}

canvasWrapper.addEventListener('mousedown', (e) => {
    const pos = getMousePos(e);
    
    if (currentTool === 'draw' || currentTool === 'erase') {
        return;
    }
    
    if (currentTool === 'pan') {
        isPanning = true;
        startPanX = e.clientX - panX;
        startPanY = e.clientY - panY;
        canvasWrapper.style.cursor = 'grabbing';
        return;
    }
    
    if (currentTool === 'select') {
        const found = findItemAt(pos.x, pos.y);
        
        if (found && found.type === 'image' && isOnResizeHandle(found.item, pos.x, pos.y)) {
            resizingImage = found.item;
            resizeStartX = pos.x;
            resizeStartY = pos.y;
            resizeStartWidth = found.item.width;
            resizeStartHeight = found.item.height;
            canvasWrapper.style.cursor = 'nwse-resize';
            return;
        }
        
        if (found) {
            selectedItem = found.item;
            selectedType = found.type;
            draggingItem = found.item;
            mouseDown = true;
            
            if (found.type === 'token' && found.item.style === 'square') {
                const tokenSize = TOKEN_RADIUS * 1.8;
                dragOffsetX = pos.x - found.item.x;
                dragOffsetY = pos.y - found.item.y;
            } else {
                dragOffsetX = pos.x - found.item.x;
                dragOffsetY = pos.y - found.item.y;
            }
            
            canvasWrapper.style.cursor = 'grabbing';
        } else {
            selectedItem = null;
            selectedType = null;
        }
        
        redrawAll();
    }
});

canvasWrapper.addEventListener('mousemove', (e) => {
    const pos = getMousePos(e);
    
    if (currentTool === 'draw' || currentTool === 'erase') {
        return;
    }
    
    if (isPanning && currentTool === 'pan') {
        panX = e.clientX - startPanX;
        panY = e.clientY - startPanY;
        applyTransform();
        return;
    }
    
    if (resizingImage) {
        const deltaX = pos.x - resizeStartX;
        const deltaY = pos.y - resizeStartY;
        
        resizingImage.width = Math.max(50, resizeStartWidth + deltaX);
        resizingImage.height = Math.max(50, resizeStartHeight + deltaY);
        
        redrawAll();
        return;
    }
    
    if (mouseDown && draggingItem && currentTool === 'select') {
        const newX = pos.x - dragOffsetX;
        const newY = pos.y - dragOffsetY;
        
        draggingItem.x = newX;
        draggingItem.y = newY;
        
        redrawAll();
    } else if (currentTool === 'select' && !mouseDown) {
        const found = findItemAt(pos.x, pos.y);
        if (found && found.type === 'image' && isOnResizeHandle(found.item, pos.x, pos.y)) {
            canvasWrapper.style.cursor = 'nwse-resize';
        } else {
            canvasWrapper.style.cursor = found ? 'grab' : 'default';
        }
    }
});

canvasWrapper.addEventListener('mouseup', () => {
    if (resizingImage) {
        if (resizingImage.id.startsWith('map_')) {
            socket.emit('update_map', {
                session_id: SESSION_ID,
                map_id: resizingImage.id,
                map: resizingImage
            });
        } else {
            socket.emit('update_entity', {
                session_id: SESSION_ID,
                entity_id: resizingImage.id,
                entity: resizingImage
            });
        }
        resizingImage = null;
        canvasWrapper.style.cursor = 'default';
        return;
    }
    
    if (draggingItem && mouseDown) {
        if (selectedType === 'image') {
            if (draggingItem.id.startsWith('map_')) {
                socket.emit('update_map', {
                    session_id: SESSION_ID,
                    map_id: draggingItem.id,
                    map: draggingItem
                });
            } else {
                socket.emit('update_entity', {
                    session_id: SESSION_ID,
                    entity_id: draggingItem.id,
                    entity: draggingItem
                });
            }
        } else if (selectedType === 'token') {
            socket.emit('token_update', {
                session_id: SESSION_ID,
                tokens: tokens
            });
        }
    }
    
    isPanning = false;
    draggingItem = null;
    mouseDown = false;
    
    if (currentTool === 'pan') {
        canvasWrapper.style.cursor = 'grab';
    } else {
        canvasWrapper.style.cursor = 'default';
    }
});

canvasWrapper.addEventListener('mouseleave', () => {
    isPanning = false;
    resizingImage = null;
    if (draggingItem && mouseDown) {
        draggingItem = null;
        mouseDown = false;
    }
});

// MAP MANAGER - PARTE 3 - DESENHO, ADICIONAR ITENS E CHAT

// ==================
// DESENHO LIVRE
// ==================
function getDrawingPos(e) {
    const rect = drawingCanvas.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    return { x, y };
}

drawingCanvas.addEventListener('mousedown', (e) => {
    if (currentTool === 'draw') {
        isDrawing = true;
        const pos = getDrawingPos(e);
        currentPath = [pos];
    } else if (currentTool === 'erase') {
        const pos = getDrawingPos(e);
        eraseDrawingsAt(pos.x, pos.y);
    }
});

drawingCanvas.addEventListener('mousemove', (e) => {
    if (isDrawing && currentTool === 'draw') {
        const pos = getDrawingPos(e);
        currentPath.push(pos);
        
        drawCtx.strokeStyle = drawingColor;
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
    } else if (currentTool === 'erase' && e.buttons === 1) {
        const pos = getDrawingPos(e);
        eraseDrawingsAt(pos.x, pos.y);
    }
});

drawingCanvas.addEventListener('mouseup', () => {
    if (isDrawing && currentPath.length > 0) {
        const drawing = {
            id: Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            path: currentPath,
            color: drawingColor,
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

drawingCanvas.addEventListener('mouseleave', () => {
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

function clearDrawings() {
    if (confirm('Limpar todos os desenhos?')) {
        drawings = [];
        redrawDrawings();
        socket.emit('clear_drawings', { session_id: SESSION_ID });
        showToast('Desenhos limpos!');
    }
}

// ==================
// ADICIONAR IMAGEM
// ==================
function addImage() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const name = prompt('Nome da imagem:', file.name.replace(/\.(jpg|jpeg|png|gif|webp)$/i, ''));
        if (!name) return;
        
        showToast('Carregando imagem...');
        
        const reader = new FileReader();
        reader.onload = (ev) => {
            const img = new Image();
            img.onload = () => {
                let width = 400;
                let height = 400;
                
                if (img.width > img.height) {
                    height = (img.height / img.width) * width;
                } else {
                    width = (img.width / img.height) * height;
                }
                
                const newImage = {
                    id: 'img_' + Date.now(),
                    name: name,
                    x: CANVAS_WIDTH / 2 - width / 2,
                    y: CANVAS_HEIGHT / 2 - height / 2,
                    width: width,
                    height: height,
                    image: ev.target.result
                };
                
                loadedImages.set(newImage.id, img);
                images.push(newImage);
                
                socket.emit('add_entity', {
                    session_id: SESSION_ID,
                    entity: newImage
                });
                
                redrawAll();
                renderImageList();
                showToast(`Imagem "${name}" adicionada!`);
            };
            img.onerror = () => {
                showToast('Erro ao carregar imagem');
            };
            img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
    };
    input.click();
}

// ==================
// ADICIONAR TOKEN
// ==================
function addToken() {
    document.getElementById('tokenModal').classList.add('show');
}

function createToken() {
    const name = document.getElementById('tokenName').value.trim();
    const imageInput = document.getElementById('tokenImage');
    const styleInput = document.querySelector('input[name="tokenStyle"]:checked');
    const style = styleInput ? styleInput.value : 'round';
    
    if (!name) {
        alert('Digite um nome para o token');
        return;
    }
    
    if (imageInput.files.length > 0) {
        showToast('Carregando token...');
        
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = () => {
                const newToken = {
                    id: 'token_' + Date.now(),
                    name: name,
                    x: CANVAS_WIDTH / 2,
                    y: CANVAS_HEIGHT / 2,
                    image: e.target.result,
                    style: style
                };
                
                loadedImages.set(newToken.id, img);
                
                tokens.push(newToken);
                renderTokenList();
                redrawAll();
                
                socket.emit('token_update', {
                    session_id: SESSION_ID,
                    tokens: tokens
                });
                
                closeTokenModal();
                showToast(`Token "${name}" adicionado!`);
            };
            img.onerror = () => {
                showToast('Erro ao carregar imagem do token');
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(imageInput.files[0]);
    } else {
        const newToken = {
            id: 'token_' + Date.now(),
            name: name,
            x: CANVAS_WIDTH / 2,
            y: CANVAS_HEIGHT / 2,
            color: '#' + Math.floor(Math.random() * 16777215).toString(16),
            style: 'round'
        };
        
        tokens.push(newToken);
        renderTokenList();
        redrawAll();
        
        socket.emit('token_update', {
            session_id: SESSION_ID,
            tokens: tokens
        });
        
        closeTokenModal();
        showToast(`Token "${name}" adicionado!`);
    }
}

function closeTokenModal() {
    document.getElementById('tokenModal').classList.remove('show');
    document.getElementById('tokenName').value = '';
    document.getElementById('tokenImage').value = '';
}

// ==================
// DELETAR ITEM
// ==================
function deleteSelected() {
    if (!selectedItem) {
        alert('Selecione um item primeiro');
        return;
    }
    
    const confirmMsg = `Remover ${selectedType === 'image' ? 'imagem' : 'token'}?`;
    if (!confirm(confirmMsg)) return;
    
    if (selectedType === 'image') {
        if (selectedItem.id.startsWith('map_')) {
            socket.emit('delete_map', {
                session_id: SESSION_ID,
                map_id: selectedItem.id
            });
        } else {
            socket.emit('delete_entity', {
                session_id: SESSION_ID,
                entity_id: selectedItem.id
            });
        }
        loadedImages.delete(selectedItem.id);
        images = images.filter(i => i !== selectedItem);
        renderImageList();
    } else if (selectedType === 'token') {
        loadedImages.delete(selectedItem.id);
        tokens = tokens.filter(t => t !== selectedItem);
        socket.emit('token_update', {
            session_id: SESSION_ID,
            tokens: tokens
        });
        renderTokenList();
    }
    
    selectedItem = null;
    selectedType = null;
    redrawAll();
    showToast('Item removido!');
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Delete' && selectedItem) {
        deleteSelected();
    }
});

// ==================
// RENDERIZAR LISTAS
// ==================
function renderImageList() {
    const list = document.getElementById('imageList');
    if (!list) return;
    
    list.innerHTML = '';
    
    if (images.length === 0) {
        list.innerHTML = '<div class="empty-state">Nenhuma imagem</div>';
        return;
    }
    
    images.forEach(img => {
        const item = document.createElement('div');
        item.className = 'item-card';
        item.onclick = () => selectItem(img, 'image');
        
        item.innerHTML = `
            <img src="${img.image}" class="item-preview" alt="${img.name}">
            <div class="item-info">
                <div class="item-name">${img.name}</div>
            </div>
            <div class="item-actions">
                <button class="item-action-btn" onclick="deleteItemById('${img.id}', 'image'); event.stopPropagation();">🗑️</button>
            </div>
        `;
        
        list.appendChild(item);
    });
}

function renderTokenList() {
    const list = document.getElementById('tokenList');
    if (!list) return;
    
    list.innerHTML = '';
    
    if (tokens.length === 0) {
        list.innerHTML = '<div class="empty-state">Nenhum token</div>';
        return;
    }
    
    tokens.forEach(token => {
        const item = document.createElement('div');
        item.className = 'item-card';
        item.onclick = () => selectItem(token, 'token');
        
        if (token.image) {
            const imgStyle = token.style === 'square' ? 'border-radius: 6px;' : 'border-radius: 50%;';
            item.innerHTML = `
                <img src="${token.image}" class="item-preview" style="${imgStyle}" alt="${token.name}">
                <div class="item-info">
                    <div class="item-name">${token.name}</div>
                </div>
                <div class="item-actions">
                    <button class="item-action-btn" onclick="deleteItemById('${token.id}', 'token'); event.stopPropagation();">🗑️</button>
                </div>
            `;
        } else {
            item.innerHTML = `
                <div class="item-color" style="background-color: ${token.color}"></div>
                <div class="item-info">
                    <div class="item-name">${token.name}</div>
                </div>
                <div class="item-actions">
                    <button class="item-action-btn" onclick="deleteItemById('${token.id}', 'token'); event.stopPropagation();">🗑️</button>
                </div>
            `;
        }
        
        list.appendChild(item);
    });
}

function selectItem(item, type) {
    selectedItem = item;
    selectedType = type;
    
    document.querySelectorAll('.item-card').forEach(i => i.classList.remove('active'));
    event.currentTarget.classList.add('active');
    
    redrawAll();
}

function deleteItemById(itemId, type) {
    if (confirm('Remover este item?')) {
        if (type === 'image') {
            const img = images.find(i => i.id === itemId);
            if (img) {
                loadedImages.delete(img.id);
                images = images.filter(i => i.id !== itemId);
                
                if (img.id.startsWith('map_')) {
                    socket.emit('delete_map', {
                        session_id: SESSION_ID,
                        map_id: itemId
                    });
                } else {
                    socket.emit('delete_entity', {
                        session_id: SESSION_ID,
                        entity_id: itemId
                    });
                }
                
                renderImageList();
            }
        } else if (type === 'token') {
            const token = tokens.find(t => t.id === itemId);
            if (token) {
                loadedImages.delete(token.id);
                tokens = tokens.filter(t => t.id !== itemId);
                
                socket.emit('token_update', {
                    session_id: SESSION_ID,
                    tokens: tokens
                });
                
                renderTokenList();
            }
        }
        
        if (selectedItem && selectedItem.id === itemId) {
            selectedItem = null;
            selectedType = null;
        }
        
        redrawAll();
        showToast('Item removido!');
    }
}

// ==================
// CHAT - COM CACHE SEM DUPLICAÇÃO
// ==================

// Cache de conversas - armazena todas as conversas carregadas
let conversationsCache = {};

function toggleChatMinimize() {
    chatMinimized = !chatMinimized;
    const chatContainer = document.getElementById('chatContainer');
    const icon = document.getElementById('chatMinimizeIcon');
    
    if (chatMinimized) {
        chatContainer.classList.add('minimized');
        chatContainer.classList.remove('collapsed');
        if (icon) icon.textContent = '▲';
    } else {
        chatContainer.classList.remove('minimized');
        chatContainer.classList.remove('collapsed');
        if (icon) icon.textContent = '▼';
        loadChatContacts();
    }
}

function toggleChatCollapse() {
    chatCollapsed = !chatCollapsed;
    const chatContainer = document.getElementById('chatContainer');
    
    if (chatCollapsed) {
        chatContainer.classList.add('collapsed');
        chatContainer.classList.remove('minimized');
    } else {
        chatContainer.classList.remove('collapsed');
        if (chatMinimized) {
            chatContainer.classList.add('minimized');
        }
    }
}

function loadChatContacts() {
    console.log('📋 Carregando contatos do chat...');
    socket.emit('get_chat_contacts', {
        session_id: SESSION_ID,
        user_id: 'master'
    });
}

function renderChatContacts() {
    const contactsList = document.getElementById('contactsList');
    if (!contactsList) return;
    
    contactsList.innerHTML = '';
    
    console.log('📋 Renderizando contatos:', chatContacts);
    
    if (chatContacts.length === 0) {
        contactsList.innerHTML = '<div class="empty-state">Nenhum jogador conectado</div>';
        return;
    }
    
    chatContacts.forEach(contact => {
        const item = document.createElement('div');
        item.className = 'contact-item';
        if (currentChatContact === contact.id) {
            item.classList.add('active');
        }
        
        item.onclick = () => openConversation(contact.id);
        
        item.innerHTML = `
            <div class="contact-avatar">${contact.name.charAt(0).toUpperCase()}</div>
            <div class="contact-name">${contact.name}</div>
            ${contact.unread > 0 ? `<span class="contact-badge">${contact.unread}</span>` : ''}
        `;
        
        contactsList.appendChild(item);
    });
}

function openConversation(contactId) {
    console.log('💬 Abrindo conversa com:', contactId);
    
    // Salvar conversa atual no cache antes de trocar
    if (currentChatContact && currentConversation.length > 0) {
        conversationsCache[currentChatContact] = [...currentConversation];
        console.log(`💾 Cache salvo para ${currentChatContact}:`, conversationsCache[currentChatContact].length, 'mensagens');
    }
    
    currentChatContact = contactId;
    
    document.querySelectorAll('.contact-item').forEach(item => item.classList.remove('active'));
    event.currentTarget?.classList.add('active');
    
    // Verificar se já temos o cache desta conversa
    if (conversationsCache[contactId]) {
        console.log(`📦 Carregando do cache: ${contactId}`, conversationsCache[contactId].length, 'mensagens');
        currentConversation = [...conversationsCache[contactId]];
        renderConversation();
        
        // Mostrar área de conversa
        document.getElementById('conversationPlaceholder').style.display = 'none';
        document.getElementById('conversationArea').style.display = 'flex';
        
        // Atualizar header
        const contact = chatContacts.find(c => c.id === contactId);
        if (contact) {
            document.getElementById('conversationContactName').textContent = contact.name;
            document.getElementById('conversationContactAvatar').textContent = contact.name.charAt(0).toUpperCase();
        }
    } else {
        // Carregar do servidor se não estiver no cache
        console.log(`🌐 Carregando do servidor: ${contactId}`);
        socket.emit('get_conversation', {
            session_id: SESSION_ID,
            user_id: 'master',
            other_user_id: contactId
        });
        
        // Mostrar área de conversa
        document.getElementById('conversationPlaceholder').style.display = 'none';
        document.getElementById('conversationArea').style.display = 'flex';
        
        // Atualizar header
        const contact = chatContacts.find(c => c.id === contactId);
        if (contact) {
            document.getElementById('conversationContactName').textContent = contact.name;
            document.getElementById('conversationContactAvatar').textContent = contact.name.charAt(0).toUpperCase();
        }
    }
}

function renderConversation() {
    const messagesContainer = document.getElementById('conversationMessages');
    if (!messagesContainer) return;
    
    messagesContainer.innerHTML = '';
    
    if (currentConversation.length === 0) {
        messagesContainer.innerHTML = '<div class="empty-state">Nenhuma mensagem ainda</div>';
        return;
    }
    
    currentConversation.forEach(msg => {
        const bubble = document.createElement('div');
        bubble.className = msg.sender_id === 'master' ? 'message-bubble sent' : 'message-bubble received';
        
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
    
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function sendChatMessage() {
    const input = document.getElementById('conversationInput');
    const message = input.value.trim();
    
    if (!message || !currentChatContact) {
        return;
    }
    
    console.log('📤 Enviando mensagem para:', currentChatContact);
    
    socket.emit('send_private_message', {
        session_id: SESSION_ID,
        sender_id: 'master',
        recipient_id: currentChatContact,
        message: message
    });
    
    input.value = '';
}

// Listener para Enter no input
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

// ==================
// PERMISSÕES E JOGADORES
// ==================
function renderPlayersList() {
    const list = document.getElementById('playersList');
    if (!list) return;
    
    list.innerHTML = '';
    
    if (players.length === 0) {
        list.innerHTML = '<div class="empty-state">Nenhum jogador conectado</div>';
        return;
    }
    
    players.forEach(player => {
        const item = document.createElement('div');
        item.className = 'player-item';
        
        const permissions = player.permissions || {};
        
        item.innerHTML = `
            <div class="player-info">
                <div class="player-name">👤 ${player.name}</div>
            </div>
            <div class="player-perms">
                <button class="perm-btn ${permissions.draw ? 'active' : ''}" 
                        onclick="togglePermission('${player.id}', 'draw')">
                    ✏️ Desenhar
                </button>
                <button class="perm-btn" onclick="openTokenPermissions('${player.id}')">
                    🎭 Mover Tokens
                </button>
            </div>
        `;
        
        list.appendChild(item);
    });
}

function togglePermission(playerId, permissionType) {
    const player = players.find(p => p.id === playerId);
    if (!player) return;
    
    const permissions = player.permissions || {};
    permissions[permissionType] = !permissions[permissionType];
    
    socket.emit('update_permissions', {
        session_id: SESSION_ID,
        player_id: playerId,
        permissions: permissions
    });
    
    player.permissions = permissions;
    renderPlayersList();
    showToast(`Permissão "${permissionType}" atualizada`);
}

function openTokenPermissions(playerId) {
    const player = players.find(p => p.id === playerId);
    if (!player) return;
    
    document.getElementById('currentPlayerId').value = playerId;
    document.getElementById('tokenPermModalTitle').textContent = `Tokens para ${player.name}`;
    
    renderTokenPermissionsList(player);
    document.getElementById('tokenPermissionsModal').classList.add('show');
}

function renderTokenPermissionsList(player) {
    const list = document.getElementById('tokenPermList');
    list.innerHTML = '';
    
    const permissions = player.permissions || {};
    const allowedTokens = permissions.moveTokens || [];
    
    if (tokens.length === 0) {
        list.innerHTML = '<div class="empty-state">Nenhum token disponível</div>';
        return;
    }
    
    tokens.forEach(token => {
        const item = document.createElement('div');
        item.className = 'item-card';
        
        const isAllowed = allowedTokens.includes(token.id);
        
        const imgStyle = token.style === 'square' ? 'border-radius: 6px;' : 'border-radius: 50%;';
        
        item.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px; flex: 1;">
                ${token.image ? 
                    `<img src="${token.image}" class="item-preview" style="${imgStyle}">` :
                    `<div class="item-color" style="background: ${token.color}"></div>`
                }
                <span>${token.name}</span>
            </div>
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                <input type="checkbox" ${isAllowed ? 'checked' : ''} 
                       onchange="toggleTokenPermission('${player.id}', '${token.id}')">
                <span>Permitir</span>
            </label>
        `;
        
        list.appendChild(item);
    });
}

function toggleTokenPermission(playerId, tokenId) {
    const player = players.find(p => p.id === playerId);
    if (!player) return;
    
    const permissions = player.permissions || {};
    let allowedTokens = permissions.moveTokens || [];
    
    if (allowedTokens.includes(tokenId)) {
        allowedTokens = allowedTokens.filter(id => id !== tokenId);
    } else {
        allowedTokens.push(tokenId);
    }
    
    permissions.moveTokens = allowedTokens;
    
    socket.emit('update_permissions', {
        session_id: SESSION_ID,
        player_id: playerId,
        permissions: permissions
    });
    
    player.permissions = permissions;
}

function closeTokenPermissionsModal() {
    document.getElementById('tokenPermissionsModal').classList.remove('show');
}

// ==================
// PAINÉIS
// ==================
function togglePanel(panelId) {
    const panel = document.getElementById(panelId);
    const isVisible = panel.classList.contains('show');
    
    document.querySelectorAll('.floating-panel').forEach(p => p.classList.remove('show'));
    
    if (!isVisible) {
        panel.classList.add('show');
    }
}

function togglePlayersPanel() {
    togglePanel('playersPanel');
}

function toggleDiceRoller() {
    togglePanel('dicePanel');
}

// ==================
// DICE ROLLER
// ==================
function rollDice(sides) {
    const result = Math.floor(Math.random() * sides) + 1;
    const resultDiv = document.getElementById('diceResult');
    
    resultDiv.textContent = result;
    resultDiv.className = 'dice-result';
    
    setTimeout(() => {
        resultDiv.classList.add('show');
        
        if (sides === 20) {
            if (result === 20) {
                resultDiv.classList.add('critical-success');
                showToast('🎉 CRÍTICO!');
            } else if (result === 1) {
                resultDiv.classList.add('critical-fail');
                showToast('💀 FALHA CRÍTICA!');
            }
        }
    }, 10);
}

// ==================
// UTILS
// ==================
function copyShareLink() {
    const link = `${window.location.origin}/player-view/${SESSION_ID}`;
    navigator.clipboard.writeText(link);
    showToast('Link copiado!');
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

function clearAll() {
    if (!confirm('Limpar TUDO (imagens, tokens, desenhos)?')) return;
    
    loadedImages.clear();
    
    images = [];
    tokens = [];
    drawings = [];
    
    redrawAll();
    redrawDrawings();
    renderImageList();
    renderTokenList();
    
    socket.emit('clear_drawings', { session_id: SESSION_ID });
    showToast('Tudo limpo!');
}

// ==================
// INICIALIZAÇÃO
// ==================
document.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.floating-panel') && !e.target.closest('.floating-btn')) {
            document.querySelectorAll('.floating-panel').forEach(p => p.classList.remove('show'));
        }
    });
    
    setTimeout(() => {
        centerCanvas();
    }, 100);
    
    socket.emit('get_players', { session_id: SESSION_ID });
});

window.addEventListener('resize', () => {
    centerCanvas();
});

setTool('select');
drawGrid();
renderImageList();
renderTokenList();