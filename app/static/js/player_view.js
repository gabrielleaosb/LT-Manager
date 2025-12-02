// PLAYER VIEW - PARTE 1 - INICIALIZAÇÃO E WEBSOCKETS
const socket = io();
const SESSION_ID = document.getElementById('sessionId').value;

const CANVAS_WIDTH = 2000;
const CANVAS_HEIGHT = 2000;

let playerName = '';
let playerId = null;
let permissions = { moveTokens: [], draw: false };

// SCENES
let visibleScenes = [];
let currentPlayerSceneId = null;

// CHAT
let chatContacts = [];
let currentChatContact = null;
let currentConversation = [];
let chatMinimized = true;
let chatCollapsed = false;
let conversationsCache = {};

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

const fogCanvas = document.getElementById('fogCanvas');
const fogCtx = fogCanvas.getContext('2d');

fogCanvas.width = CANVAS_WIDTH;
fogCanvas.height = CANVAS_HEIGHT;

let fogAreas = [];
let fogOpacity = 1.0;

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
    
    if (CANVAS_WIDTH * currentScale < containerRect.width) {
        panX = (containerRect.width - CANVAS_WIDTH * currentScale) / 2;
    } else {
        panX = 0;
    }
    
    if (CANVAS_HEIGHT * currentScale < containerRect.height) {
        panY = (containerRect.height - CANVAS_HEIGHT * currentScale) / 2;
    } else {
        panY = 0;
    }
    
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
drawGrid();

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
    
    console.log('✅ Jogador fazendo login:', playerName, playerId);
    
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
    console.log('✅ Conectado');
    updateStatus(true);
});

socket.on('disconnect', () => {
    console.log('❌ Desconectado');
    updateStatus(false);
});

socket.on('session_state', (data) => {
    console.log('📦 Estado da sessão recebido:', data);
    maps = data.maps || [];
    entities = data.entities || [];
    tokens = data.tokens || [];
    drawings = data.drawings || [];
    preloadAllImages();
    drawGrid();
});

socket.on('permissions_updated', (data) => {
    if (data.player_id === playerId) {
        console.log('🔑 Permissões atualizadas:', data.permissions);
        permissions = data.permissions;
        updateDrawingTools();
        showToast('Suas permissões foram atualizadas!');
    }
});

// SINCRONIZAÇÃO EM TEMPO REAL - CORRIGIDO
socket.on('maps_sync', (data) => {
    console.log('📍 MAPS SYNC recebido:', data);
    maps = data.maps || [];
    preloadAllImages();
    redrawAll();
});

socket.on('entities_sync', (data) => {
    console.log('🎭 ENTITIES SYNC recebido:', data);
    entities = data.entities || [];
    preloadAllImages();
    redrawAll();
});

socket.on('token_sync', (data) => {
    console.log('🎯 [JOGADOR] TOKEN SYNC recebido:', {
        timestamp: new Date().toISOString(),
        tokensCount: data.tokens?.length,
        firstToken: data.tokens?.[0] ? {
            name: data.tokens[0].name,
            x: data.tokens[0].x,
            y: data.tokens[0].y
        } : null
    });
    
    tokens = data.tokens || [];
    
    // FORÇAR redesenho imediato
    window.requestAnimationFrame(() => {
        preloadAllImages();
        redrawAll();
        console.log('✅ [JOGADOR] Canvas redesenhado após token_sync');
    });
});

socket.on('drawing_sync', (data) => {
    drawings.push(data.drawing);
    redrawDrawings();
    redrawAll();
});

socket.on('drawings_cleared', () => {
    drawings = [];
    redrawDrawings();
    redrawAll();
});

socket.on('players_list', (data) => {
    console.log('👥 Lista de jogadores recebida:', data);
    loadChatContacts();
});

socket.on('player_joined', (data) => {
    if (data.player_id !== playerId) {
        console.log('✅ Outro jogador entrou:', data);
        showToast(`${data.player_name} entrou na sessão`);
    }
    loadChatContacts();
});

socket.on('fog_areas_sync', (data) => {
    console.log('🌫️ [JOGADOR] FOG SYNC recebido:', data);
    console.log('🌫️ Fog areas:', data.fog_areas);
    fogAreas = data.fog_areas || [];
    console.log('🌫️ fogAreas atualizado:', fogAreas.length, 'áreas');
    redrawFog();
    
    if (fogAreas.length > 0) {
        showToast(`Mapa atualizado - ${fogAreas.length} área(s) visível(is)`);
    }
});

socket.on('scene_activated', (data) => {
    console.log('🎬 [PLAYER] Cena ativada:', data.scene.name);
    
    const scene = data.scene;
    const isVisible = scene.visible_to_players && scene.visible_to_players.includes(playerId);
    
    console.log('🎬 [PLAYER] Visível?', isVisible);
    
    if (!isVisible) {
        console.log('❌ [PLAYER] Cena não visível - limpando canvas');
        
        maps = [];
        entities = [];
        tokens = [];
        drawings = [];
        fogAreas = [];
        
        mapCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        drawCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        fogCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        
        redrawAll();
        redrawDrawings();
        redrawFog();
        
        showToast('Você não tem acesso a esta cena');
        return;
    }
    
    console.log('✅ [PLAYER] Cena visível - carregando conteúdo');
    
    const content = scene.content || {};
    
    maps = [...(content.maps || [])];
    entities = [...(content.entities || [])];
    tokens = [...(content.tokens || [])];
    drawings = [...(content.drawings || [])];
    fogAreas = [...(content.fog_areas || [])];
    
    console.log('🎬 [PLAYER] Conteúdo:', {
        maps: maps.length,
        entities: entities.length,
        tokens: tokens.length,
        fog: fogAreas.length
    });
    
    preloadAllImages();
    
    mapCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    drawCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    fogCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    redrawAll();
    redrawDrawings();
    redrawFog();
    
    showToast(`Cena: ${scene.name}`);
});

// ========== FOG OF WAR ==========
function redrawFog() {
    fogCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    console.log('🌫️ [JOGADOR] Redesenhando fog. Areas:', fogAreas.length);
    
    if (fogAreas.length === 0) {
        // SEM FOG AREAS = MAPA TOTALMENTE COBERTO
        fogCtx.fillStyle = 'rgba(0, 0, 0, 1)';
        fogCtx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        console.log('🌫️ Mapa totalmente coberto (sem áreas visíveis)');
        return;
    }
    
    // Névoa TOTALMENTE ESCURA para jogadores (opacidade 100%)
    fogCtx.fillStyle = 'rgba(0, 0, 0, 1)';
    fogCtx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    console.log('🌫️ Base escura aplicada');
    
    // "Cortar" áreas visíveis
    fogCtx.globalCompositeOperation = 'destination-out';
    
    fogAreas.forEach((area, index) => {
        console.log(`🌫️ Processando área ${index + 1}:`, area);
        
        if (area.shape === 'rectangle') {
            fogCtx.fillStyle = 'rgba(255, 255, 255, 1)';
            fogCtx.fillRect(area.x, area.y, area.width, area.height);
            console.log(`   ✅ Retângulo desenhado em (${area.x}, ${area.y}) ${area.width}x${area.height}`);
        } else if (area.shape === 'circle') {
            fogCtx.fillStyle = 'rgba(255, 255, 255, 1)';
            fogCtx.beginPath();
            fogCtx.arc(area.x, area.y, area.radius, 0, Math.PI * 2);
            fogCtx.fill();
            console.log(`   ✅ Círculo desenhado em (${area.x}, ${area.y}) raio ${area.radius}`);
        }
    });
    
    fogCtx.globalCompositeOperation = 'source-over';
    
    console.log('🌫️ Fog redesenhado com sucesso');
}

// CHAT
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
    console.log('💬 Nova mensagem:', data);
    
    // Verificar se a mensagem já existe para evitar duplicação
    const messageExists = (messages, msgData) => {
        return messages.some(m => m.id === msgData.id);
    };
    
    // Se a mensagem é da conversa atual, adiciona (sem duplicar)
    if (currentChatContact && 
        (data.sender_id === currentChatContact || data.recipient_id === currentChatContact)) {
        if (!messageExists(currentConversation, data)) {
            currentConversation.push(data);
            conversationsCache[currentChatContact] = [...currentConversation];
            renderConversation();
        }
    }
    
    // Atualizar cache de outras conversas (sem duplicar)
    if (data.sender_id !== playerId && data.sender_id) {
        if (!conversationsCache[data.sender_id]) {
            conversationsCache[data.sender_id] = [];
        }
        if (!messageExists(conversationsCache[data.sender_id], data)) {
            conversationsCache[data.sender_id].push(data);
        }
    }
    
    if (data.recipient_id !== playerId && data.recipient_id) {
        if (!conversationsCache[data.recipient_id]) {
            conversationsCache[data.recipient_id] = [];
        }
        if (!messageExists(conversationsCache[data.recipient_id], data)) {
            conversationsCache[data.recipient_id].push(data);
        }
    }
    
    loadChatContacts();
});

socket.on('grid_settings_sync', (data) => {
    console.log('📐 [PLAYER] Grid settings recebidos:', data);
    const settings = data.grid_settings || {};
    
    gridEnabled = settings.enabled !== false;
    gridSize = settings.size || 50;
    gridColor = settings.color || 'rgba(155, 89, 182, 0.3)';
    
    drawGrid();
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
    let imagesToLoad = 0;
    let imagesLoaded = 0;

    const checkAllLoaded = () => {
        imagesLoaded++;
        if (imagesLoaded === imagesToLoad) {
            redrawAll();
        }
    };

    [...maps, ...entities].forEach(img => {
        if (img.image && !loadedImages[img.id]) {
            imagesToLoad++;
            const i = new Image();
            i.onload = () => {
                loadedImages[img.id] = i;
                checkAllLoaded();
            };
            i.onerror = () => {
                console.error('Erro ao carregar imagem:', img.id);
                checkAllLoaded();
            };
            i.src = img.image;
        }
    });
    
    tokens.forEach(token => {
        if (token.image && !loadedImages[token.id]) {
            imagesToLoad++;
            const i = new Image();
            i.onload = () => {
                loadedImages[token.id] = i;
                checkAllLoaded();
            };
            i.onerror = () => {
                console.error('Erro ao carregar token:', token.id);
                checkAllLoaded();
            };
            i.src = token.image;
        }
    });

    // Se não há imagens para carregar, redesenha imediatamente
    if (imagesToLoad === 0) {
        redrawAll();
    }
}

// PLAYER VIEW - PARTE 2 - RENDER, MOUSE E CHAT (FINAL)

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
            mapCtx.drawImage(img, token.x - TOKEN_RADIUS, token.y - TOKEN_RADIUS, TOKEN_RADIUS * 2, TOKEN_RADIUS * 2);
            
            mapCtx.strokeStyle = "#fff";
            mapCtx.lineWidth = 2;
            mapCtx.strokeRect(token.x - TOKEN_RADIUS, token.y - TOKEN_RADIUS, TOKEN_RADIUS * 2, TOKEN_RADIUS * 2);
        } else if (img && img.complete) {
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
    redrawFog();
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
    
    if (permissions.draw && (drawTool === 'draw' || drawTool === 'erase')) {
        return;
    }
    
    const token = findTokenAt(pos.x, pos.y);
    if (token) {
        draggingToken = token;
        dragOffsetX = pos.x - token.x;
        dragOffsetY = pos.y - token.y;
        canvasWrapper.style.cursor = 'grabbing';
        return;
    }
    
    isPanning = true;
    startPanX = e.clientX - panX;
    startPanY = e.clientY - panY;
    canvasWrapper.classList.add('grabbing');
});

canvasWrapper.addEventListener('mousemove', (e) => {
    const pos = getMousePos(e);
    
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
        const tokensCopy = JSON.parse(JSON.stringify(tokens));
        
        console.log('📤 [JOGADOR] Enviando token_update:', {
            sessionId: SESSION_ID,
            tokensCount: tokensCopy.length,
            movedToken: {
                name: draggingToken.name,
                newX: draggingToken.x,
                newY: draggingToken.y
            }
        });
        
        socket.emit('token_update', {
            session_id: SESSION_ID,
            tokens: tokensCopy
        });
        
        draggingToken = null;
    }
    
    isPanning = false;
    canvasWrapper.classList.remove('grabbing');
    canvasWrapper.style.cursor = 'grab';
});

// ========== DESENHO ==========
function updateDrawingTools() {
    const tools = document.getElementById('drawingTools');
    if (permissions.draw) {
        tools.classList.add('show');
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

// ========== CHAT - CORRIGIDO ==========
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
        user_id: playerId
    });
}

function renderChatContacts() {
    const contactsList = document.getElementById('contactsList');
    if (!contactsList) return;
    
    contactsList.innerHTML = '';
    
    console.log('📋 Renderizando contatos:', chatContacts);
    
    if (chatContacts.length === 0) {
        contactsList.innerHTML = '<div class="empty-state">Nenhum contato disponível</div>';
        return;
    }
    
    // Atualizar badge total no header
    const totalUnread = chatContacts.reduce((sum, contact) => sum + (contact.unread || 0), 0);
    const chatBadge = document.getElementById('chatBadge');
    if (chatBadge) {
        if (totalUnread > 0) {
            chatBadge.textContent = totalUnread;
            chatBadge.style.display = 'inline-block';
        } else {
            chatBadge.style.display = 'none';
        }
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
    
    // Marcar como lida no servidor - CORRIGIDO: usar playerId
    socket.emit('mark_conversation_read', {
        session_id: SESSION_ID,
        user_id: playerId,  // ✅ USAR playerId em vez de 'master'
        other_user_id: contactId
    });
    
    document.querySelectorAll('.contact-item').forEach(item => item.classList.remove('active'));
    event.currentTarget?.classList.add('active');
    
    // Verificar se já temos o cache desta conversa
    if (conversationsCache[contactId]) {
        console.log(`📦 Carregando do cache: ${contactId}`, conversationsCache[contactId].length, 'mensagens');
        currentConversation = [...conversationsCache[contactId]];
        renderConversation();
        
        document.getElementById('conversationPlaceholder').style.display = 'none';
        document.getElementById('conversationArea').style.display = 'flex';
        
        const contact = chatContacts.find(c => c.id === contactId);
        if (contact) {
            document.getElementById('conversationContactName').textContent = contact.name;
            document.getElementById('conversationContactAvatar').textContent = contact.name.charAt(0).toUpperCase();
        }
    } else {
        console.log(`🌐 Carregando do servidor: ${contactId}`);
        socket.emit('get_conversation', {
            session_id: SESSION_ID,
            user_id: playerId,  // ✅ USAR playerId em vez de 'master'
            other_user_id: contactId
        });
        
        document.getElementById('conversationPlaceholder').style.display = 'none';
        document.getElementById('conversationArea').style.display = 'flex';
        
        const contact = chatContacts.find(c => c.id === contactId);
        if (contact) {
            document.getElementById('conversationContactName').textContent = contact.name;
            document.getElementById('conversationContactAvatar').textContent = contact.name.charAt(0).toUpperCase();
        }
    }
    
    // Recarregar contatos para atualizar contador
    loadChatContacts();
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
        sender_id: playerId,
        recipient_id: currentChatContact,
        message: message
    });
    
    input.value = '';
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

document.addEventListener('DOMContentLoaded', () => {
    const chatContainer = document.getElementById('chatContainer');
    if (chatContainer) {
        chatContainer.classList.add('minimized');
        const icon = document.getElementById('chatMinimizeIcon');
        if (icon) icon.textContent = '▲';
    }
});

function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// ========== INIT ==========
setTimeout(() => {
    currentScale = 0.5; 
    centerCanvas();
    console.log('[PLAYER] Canvas centralizado. Pan:', panX, panY, 'Scale:', currentScale);
}, 100);

window.addEventListener('resize', () => {
    centerCanvas();
});

drawGrid();