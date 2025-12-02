// MAP MANAGER - MESTRE - PARTE 1 - INICIALIZAÇÃO E WEBSOCKETS
const socket = io({
    transports: ['websocket', 'polling'] 
});
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

const fogCanvas = document.getElementById('fogCanvas');
const fogCtx = fogCanvas.getContext('2d');

fogCanvas.width = CANVAS_WIDTH;
fogCanvas.height = CANVAS_HEIGHT;

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
let chatMinimized = true;
let chatCollapsed = false;

// Controles
let currentTool = 'select';
let drawingColor = '#9b59b6';
let brushSize = 3;
let isDrawing = false;
let currentPath = [];

let diceHistory = [];

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

// Estado do Fog of War
let fogAreas = [];
let fogDrawingMode = false;
let fogShape = 'rectangle';
let fogDrawStart = null;
let fogCurrentArea = null;
let fogOpacity = 0.5;

// SCENES
let scenes = [];
let currentSceneId = null;
let currentScene = null;

// Pan temporário com espaço
let spacePressed = false;
let tempPanning = false;

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
drawGrid();

function toggleGrid() {
    gridEnabled = !gridEnabled;
    drawGrid();
    showToast(gridEnabled ? 'Grid ativada' : 'Grid desativada');
    
    socket.emit('update_grid_settings', {
        session_id: SESSION_ID,
        grid_settings: {
            enabled: gridEnabled,
            size: gridSize,
            color: gridColor,
            lineWidth: gridLineWidth
        }
    });
    
    showToast(gridEnabled ? 'Grid ativada' : 'Grid desativada');
}

function updateGridSize(size) {
    gridSize = parseInt(size);
    document.getElementById('gridSizeValue').textContent = gridSize + 'px';
    drawGrid();
    
    socket.emit('update_grid_settings', {
        session_id: SESSION_ID,
        grid_settings: {
            enabled: gridEnabled,
            size: gridSize,
            color: gridColor,
            lineWidth: gridLineWidth
        }
    });
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

    if (imagesToLoad === 0) {
        redrawAll();
    }
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

    scenes = data.scenes || [];
    renderScenesList();
    console.log('🎬 Cenas carregadas:', scenes.length);

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
    console.log('🎯 [MESTRE] TOKEN SYNC recebido:', {
        timestamp: new Date().toISOString(),
        tokensCount: data.tokens?.length,
        firstToken: data.tokens?.[0] ? {
            name: data.tokens[0].name,
            x: data.tokens[0].x,
            y: data.tokens[0].y
        } : null
    });
    
    tokens = data.tokens || [];
    
    window.requestAnimationFrame(() => {
        preloadAllImages();
        renderTokenList();
        redrawAll();
        console.log('✅ [MESTRE] Canvas redesenhado após token_sync');
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

socket.on('fog_areas_sync', (data) => {
    console.log('🌫️ FOG SYNC recebido:', data);
    fogAreas = data.fog_areas || [];
    redrawFog();
    renderFogList();
});

socket.on('scenes_sync', (data) => {
    console.log('🎬 Sincronização de cenas recebida:', data);
    scenes = data.scenes || [];
    renderScenesList();
    console.log('🎬 Total de cenas após sync:', scenes.length);
});

socket.on('scene_switched', (data) => {
    console.log('🎬 Cena trocada:', data);
    currentSceneId = data.scene_id;
    currentScene = data.scene;
    // Aqui você pode adicionar lógica para carregar o conteúdo da cena
});

// ==================
// FOG (NÉVOA)
// ==================

function toggleFogMode() {
    fogDrawingMode = !fogDrawingMode;
    
    const btn = document.querySelector('[onclick="toggleFogMode()"]');
    const indicator = document.getElementById('fogModeIndicator');
    
    if (fogDrawingMode) {
        currentTool = 'select'; 
        document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
        
        fogCanvas.classList.add('fog-drawing-mode');
        if (btn) btn.classList.add('active');
        if (indicator) {
            indicator.style.display = 'block';
            indicator.textContent = `🌫️ Desenhando Névoa - ${fogShape === 'rectangle' ? 'Retângulo' : 'Círculo'}`;
        }
        canvasWrapper.style.cursor = 'crosshair';
        
        canvasWrapper.style.pointerEvents = 'none';
        fogCanvas.style.pointerEvents = 'auto';
        
        showToast('Modo Névoa ATIVADO - Desenhe no mapa');
    } else {
        fogCanvas.classList.remove('fog-drawing-mode');
        if (btn) btn.classList.remove('active');
        if (indicator) indicator.style.display = 'none';
        canvasWrapper.style.cursor = 'default';
        
        canvasWrapper.style.pointerEvents = 'auto';
        fogCanvas.style.pointerEvents = 'none';
        
        showToast('Modo Névoa DESATIVADO');
    }
}

function setFogShape(shape) {
    fogShape = shape;
    document.querySelectorAll('.fog-shape-selector .tool-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    const indicator = document.getElementById('fogModeIndicator');
    if (indicator && fogDrawingMode) {
        indicator.textContent = `🌫️ Desenhando Névoa - ${shape === 'rectangle' ? 'Retângulo' : 'Círculo'}`;
    }
}

function setFogOpacity(value) {
    fogOpacity = parseFloat(value);
    document.getElementById('fogOpacityValue').textContent = Math.round(fogOpacity * 100) + '%';
    redrawFog();
}

function clearAllFog() {
    if (confirm('Remover toda a névoa e revelar o mapa?')) {
        fogAreas = [];
        socket.emit('clear_all_fog', {
            session_id: SESSION_ID
        });
        redrawFog();
        renderFogList();
        showToast('Mapa revelado!');
    }
}

function removeFogArea(areaId) {
    fogAreas = fogAreas.filter(area => area.id !== areaId);
    socket.emit('delete_fog_area', {
        session_id: SESSION_ID,
        fog_id: areaId
    });
    redrawFog();
    renderFogList();
    showToast('Área de névoa removida');
}

function redrawFog() {
    fogCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    if (fogAreas.length === 0) return;
    
    fogCtx.fillStyle = `rgba(0, 0, 0, ${fogOpacity})`;
    fogCtx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    fogCtx.globalCompositeOperation = 'destination-out';
    
    fogAreas.forEach(area => {
        if (area.shape === 'rectangle') {
            fogCtx.fillStyle = 'rgba(255, 255, 255, 1)';
            fogCtx.fillRect(area.x, area.y, area.width, area.height);
        } else if (area.shape === 'circle') {
            fogCtx.fillStyle = 'rgba(255, 255, 255, 1)';
            fogCtx.beginPath();
            fogCtx.arc(area.x, area.y, area.radius, 0, Math.PI * 2);
            fogCtx.fill();
        }
    });
    
    fogCtx.globalCompositeOperation = 'source-over';
    
    if (fogCurrentArea && fogDrawingMode) {
        fogCtx.strokeStyle = '#3498db';
        fogCtx.lineWidth = 3;
        fogCtx.setLineDash([10, 5]);
        
        if (fogShape === 'rectangle') {
            fogCtx.strokeRect(
                fogCurrentArea.x,
                fogCurrentArea.y,
                fogCurrentArea.width,
                fogCurrentArea.height
            );
        } else if (fogShape === 'circle') {
            fogCtx.beginPath();
            fogCtx.arc(fogCurrentArea.x, fogCurrentArea.y, fogCurrentArea.radius, 0, Math.PI * 2);
            fogCtx.stroke();
        }
        
        fogCtx.setLineDash([]);
    }
}

function renderFogList() {
    const list = document.getElementById('fogAreasList');
    if (!list) return;
    
    list.innerHTML = '';
    
    if (fogAreas.length === 0) {
        list.innerHTML = '<div class="empty-state">Nenhuma área revelada</div>';
        return;
    }
    
    fogAreas.forEach((area, index) => {
        const item = document.createElement('div');
        item.className = 'item-card';
        
        const shapeIcon = area.shape === 'rectangle' ? '⬜' : '🔵';
        const shapeName = area.shape === 'rectangle' ? 'Retângulo' : 'Círculo';
        
        item.innerHTML = `
            <div style="flex: 1;">
                <div class="item-name">${shapeIcon} Área ${index + 1} - ${shapeName}</div>
            </div>
            <div class="item-actions">
                <button class="item-action-btn" onclick="removeFogArea('${area.id}'); event.stopPropagation();">🗑️</button>
            </div>
        `;
        
        list.appendChild(item);
    });
}


// CHAT - Socket Handlers CORRIGIDOS (substitua no início do arquivo, parte 1)

socket.on('chat_contacts_loaded', (data) => {
    console.log('📋 Contatos carregados:', data);
    chatContacts = data.contacts || [];
    renderChatContacts();
});

socket.on('conversation_loaded', (data) => {
    console.log('💬 Conversa carregada:', data);
    currentConversation = data.messages || [];
    
    if (data.other_user_id) {
        conversationsCache[data.other_user_id] = [...currentConversation];
        console.log(`💾 Cache atualizado para ${data.other_user_id}:`, currentConversation.length, 'mensagens');
    }
    
    renderConversation();
});

socket.on('new_private_message', (data) => {
    console.log('💬 Nova mensagem recebida:', data);
    
    const messageExists = (messages, msgData) => {
        return messages.some(m => m.id === msgData.id);
    };
    
    if (currentChatContact) {
        let shouldAdd = false;
        
        if (data.sender_id === currentChatContact || data.recipient_id === currentChatContact) {
            shouldAdd = true;
        }
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
    
    if (data.sender_id === 'master' && data.recipient_id) {
        if (!conversationsCache[data.recipient_id]) {
            conversationsCache[data.recipient_id] = [];
        }
        if (!messageExists(conversationsCache[data.recipient_id], data)) {
            conversationsCache[data.recipient_id].push(data);
        }
    }
    else if (data.recipient_id === 'master' && data.sender_id) {
        if (!conversationsCache[data.sender_id]) {
            conversationsCache[data.sender_id] = [];
        }
        if (!messageExists(conversationsCache[data.sender_id], data)) {
            conversationsCache[data.sender_id].push(data);
        }
    }
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
});

socket.on('grid_settings_sync', (data) => {
    console.log('📐 Grid settings recebidos:', data);
    const settings = data.grid_settings || {};
    
    gridEnabled = settings.enabled !== false;
    gridSize = settings.size || 50;
    gridColor = settings.color || 'rgba(155, 89, 182, 0.3)';
    gridLineWidth = settings.lineWidth || 1;
    
    drawGrid();
});


// MAP MANAGER - PARTE 2 - FERRAMENTAS E RENDER

// ==================
// FERRAMENTAS
// ==================

function setTool(tool) {
    currentTool = tool;
    document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
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
    
    images.forEach(img => {
        const loadedImg = loadedImages.get(img.id);
        
        if (loadedImg && loadedImg.complete && loadedImg.naturalWidth > 0) {
            try {
                mapCtx.drawImage(loadedImg, img.x, img.y, img.width, img.height);
                
                if (selectedItem === img && selectedType === 'image') {
                    mapCtx.strokeStyle = '#ffc107';
                    mapCtx.lineWidth = 4;
                    mapCtx.strokeRect(img.x, img.y, img.width, img.height);
                    
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
        
        mapCtx.fillStyle = "#fff";
        mapCtx.font = "bold 11px Lato";
        mapCtx.textAlign = "center";
        mapCtx.strokeStyle = "#000";
        mapCtx.lineWidth = 2.5;
        
        const nameY = token.style === 'square' ? token.y + TOKEN_RADIUS * 1.8 / 2 + 15 : token.y + TOKEN_RADIUS + 15;
        mapCtx.strokeText(token.name, token.x, nameY);
        mapCtx.fillText(token.name, token.x, nameY);

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
    
    if (spacePressed) {
        tempPanning = true;
        isPanning = true;
        startPanX = e.clientX - panX;
        startPanY = e.clientY - panY;
        canvasWrapper.style.cursor = 'grabbing';
        return;
    }
    
    if (fogDrawingMode) {
        return;
    }
    
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
    
    if (tempPanning && isPanning) {
        panX = e.clientX - startPanX;
        panY = e.clientY - startPanY;
        applyTransform();
        return;
    }
    
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
            if (spacePressed) {
                canvasWrapper.style.cursor = 'grab';
            } else {
                canvasWrapper.style.cursor = found ? 'grab' : 'default';
            }
        }
    }
});

canvasWrapper.addEventListener('mouseup', () => {
    // Pan temporário
    if (tempPanning) {
        tempPanning = false;
        isPanning = false;
        
        if (spacePressed) {
            canvasWrapper.style.cursor = 'grab';
        } else if (fogDrawingMode) {
            canvasWrapper.style.cursor = 'crosshair';
        } else if (currentTool === 'pan') {
            canvasWrapper.style.cursor = 'grab';
        } else {
            canvasWrapper.style.cursor = 'default';
        }
        return;
    }
    
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
    } else if (spacePressed) {
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
    if (spacePressed) {
        return;
    }
    
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
    if (spacePressed) {
        return;
    }
    
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
    if (isDrawing && currentPath.length > 0 && !spacePressed) {
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

// ==================
// FOG CANVAS EVENTS
// ==================

fogCanvas.addEventListener('mousedown', (e) => {
    if (!fogDrawingMode || spacePressed) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const rect = fogCanvas.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    fogDrawStart = { x, y };
    
    if (fogShape === 'rectangle') {
        fogCurrentArea = {
            shape: 'rectangle',
            x: x,
            y: y,
            width: 0,
            height: 0
        };
    } else if (fogShape === 'circle') {
        fogCurrentArea = {
            shape: 'circle',
            x: x,
            y: y,
            radius: 0
        };
    }
    
    console.log('🌫️ Fog drawing started:', fogCurrentArea);
});

fogCanvas.addEventListener('mousemove', (e) => {
    if (!fogDrawingMode || !fogDrawStart || !fogCurrentArea || spacePressed) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const rect = fogCanvas.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    if (fogShape === 'rectangle') {
        fogCurrentArea.width = x - fogDrawStart.x;
        fogCurrentArea.height = y - fogDrawStart.y;
    } else if (fogShape === 'circle') {
        const dx = x - fogDrawStart.x;
        const dy = y - fogDrawStart.y;
        fogCurrentArea.radius = Math.sqrt(dx * dx + dy * dy);
    }
    
    redrawFog();
});

fogCanvas.addEventListener('mouseup', (e) => {
    if (!fogDrawingMode || !fogCurrentArea || spacePressed) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    if (fogShape === 'rectangle') {
        if (fogCurrentArea.width < 0) {
            fogCurrentArea.x += fogCurrentArea.width;
            fogCurrentArea.width = Math.abs(fogCurrentArea.width);
        }
        if (fogCurrentArea.height < 0) {
            fogCurrentArea.y += fogCurrentArea.height;
            fogCurrentArea.height = Math.abs(fogCurrentArea.height);
        }
        
        if (fogCurrentArea.width < 20 || fogCurrentArea.height < 20) {
            fogCurrentArea = null;
            fogDrawStart = null;
            redrawFog();
            showToast('Área muito pequena - desenhe uma área maior');
            return;
        }
    } else if (fogShape === 'circle') {
        if (fogCurrentArea.radius < 10) {
            fogCurrentArea = null;
            fogDrawStart = null;
            redrawFog();
            showToast('Área muito pequena - desenhe uma área maior');
            return;
        }
    }
    
    fogCurrentArea.id = Date.now() + '_' + Math.random().toString(36).substr(2, 9); 
    fogAreas.push(fogCurrentArea);
    
    console.log('🌫️ Fog area adicionada:', fogCurrentArea);
    console.log('🌫️ Total fog areas:', fogAreas.length);
    
    socket.emit('add_fog_area', {
        session_id: SESSION_ID,
        fog_area: fogCurrentArea
    });
    
    fogCurrentArea = null;
    fogDrawStart = null;
    
    redrawFog();
    renderFogList();
    showToast('Área de névoa adicionada!');
});

fogCanvas.addEventListener('mouseleave', () => {
    if (fogDrawingMode && fogCurrentArea) {
        fogCurrentArea = null;
        fogDrawStart = null;
        redrawFog();
    }
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
    if (e.code === 'Space' && !spacePressed) {
        e.preventDefault();
        spacePressed = true;
        
        const indicator = document.getElementById('panIndicator');
        if (indicator) {
            indicator.style.display = 'flex';
        }
        
        if (!tempPanning) {
            canvasWrapper.style.cursor = 'grab';
        }
    }
});

document.addEventListener('keyup', (e) => {
    if (e.code === 'Space') {
        e.preventDefault();
        spacePressed = false;
        tempPanning = false;
        
        const indicator = document.getElementById('panIndicator');
        if (indicator) {
            indicator.style.display = 'none';
        }
        
        if (fogDrawingMode) {
            canvasWrapper.style.cursor = 'crosshair';
        } else if (currentTool === 'draw') {
            canvasWrapper.style.cursor = 'crosshair';
        } else if (currentTool === 'erase') {
            canvasWrapper.style.cursor = 'not-allowed';
        } else if (currentTool === 'pan') {
            canvasWrapper.style.cursor = 'grab';
        } else {
            canvasWrapper.style.cursor = 'default';
        }
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
    
    if (currentChatContact && currentConversation.length > 0) {
        conversationsCache[currentChatContact] = [...currentConversation];
        console.log(`💾 Cache salvo para ${currentChatContact}:`, conversationsCache[currentChatContact].length, 'mensagens');
    }
    
    currentChatContact = contactId;
    
    socket.emit('mark_conversation_read', {
        session_id: SESSION_ID,
        user_id: 'master',
        other_user_id: contactId
    });
    
    document.querySelectorAll('.contact-item').forEach(item => item.classList.remove('active'));
    event.currentTarget?.classList.add('active');
    
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
            user_id: 'master',
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
    
    loadChatContacts();
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
    
    addDiceToHistory(`1d${sides}`, result, sides === 20 && result === 20, sides === 20 && result === 1);
    
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

function rollCustomDice() {
    const count = parseInt(document.getElementById('customDiceCount')?.value) || 1;
    const sides = parseInt(document.getElementById('customDiceSides')?.value) || 20;
    const modifier = parseInt(document.getElementById('customDiceModifier')?.value) || 0;
    
    let rolls = [];
    let sum = 0;
    
    for (let i = 0; i < count; i++) {
        const roll = Math.floor(Math.random() * sides) + 1;
        rolls.push(roll);
        sum += roll;
    }
    
    const total = sum + modifier;
    const formula = `${count}d${sides}${modifier !== 0 ? (modifier > 0 ? '+' : '') + modifier : ''}`;
    const breakdown = rolls.join(' + ') + (modifier !== 0 ? ` ${modifier > 0 ? '+' : ''}${modifier}` : '');
    
    const resultDiv = document.getElementById('diceResult');
    resultDiv.textContent = total;
    resultDiv.className = 'dice-result show';
    
    const isCrit = sides === 20 && count === 1 && rolls[0] === 20;
    const isFail = sides === 20 && count === 1 && rolls[0] === 1;
    
    if (isCrit) {
        resultDiv.classList.add('critical-success');
        showToast('🎉 CRÍTICO!');
    } else if (isFail) {
        resultDiv.classList.add('critical-fail');
        showToast('💀 FALHA CRÍTICA!');
    }
    
    addDiceToHistory(formula, total, isCrit, isFail, breakdown);
}

function addDiceToHistory(formula, result, isCrit, isFail, breakdown = '') {
    const timestamp = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    
    diceHistory.unshift({
        formula,
        result,
        isCrit,
        isFail,
        breakdown,
        timestamp
    });
    
    if (diceHistory.length > 50) {
        diceHistory = diceHistory.slice(0, 50);
    }
    
    renderDiceHistory();
}

function renderDiceHistory() {
    const historyList = document.getElementById('diceHistoryList');
    if (!historyList) return;
    
    if (diceHistory.length === 0) {
        historyList.innerHTML = '<div class="empty-state" style="padding: 20px; color: #666; text-align: center;">Nenhuma rolagem ainda</div>';
        return;
    }
    
    historyList.innerHTML = diceHistory.map(item => {
        let resultClass = '';
        let icon = '🎲';
        
        if (item.isCrit) {
            resultClass = 'style="color: #ffd700; font-weight: bold;"';
            icon = '⭐';
        } else if (item.isFail) {
            resultClass = 'style="color: #e74c3c; font-weight: bold;"';
            icon = '💀';
        }
        
        return `
            <div class="history-item" style="padding: 10px; background: rgba(16,16,30,0.6); border-radius: 6px; border: 1px solid rgba(155,89,182,0.2); margin-bottom: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                    <strong style="color: #c49bdb;">${icon} ${item.formula}</strong>
                    <span ${resultClass}>${item.result}</span>
                </div>
                ${item.breakdown ? `<div style="font-size: 0.85rem; color: #888;">${item.breakdown}</div>` : ''}
                <div style="font-size: 0.75rem; color: #666; margin-top: 4px;">${item.timestamp}</div>
            </div>
        `;
    }).join('');
}

function clearDiceHistory() {
    if (confirm('Limpar histórico de dados?')) {
        diceHistory = [];
        renderDiceHistory();
        showToast('Histórico limpo');
    }
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

document.addEventListener('DOMContentLoaded', () => {
    const chatContainer = document.getElementById('chatContainer');
    if (chatContainer) {
        chatContainer.classList.add('minimized');
        const icon = document.getElementById('chatMinimizeIcon');
        if (icon) icon.textContent = '▲';
    }
});

window.addEventListener('resize', () => {
    centerCanvas();
});

// ==================
// PAN TEMPORÁRIO COM ESPAÇO
// ==================
document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !spacePressed) {
        e.preventDefault();
        spacePressed = true;
        
        if (!tempPanning) {
            canvasWrapper.style.cursor = 'grab';
        }
    }
});

document.addEventListener('keyup', (e) => {
    if (e.code === 'Space') {
        e.preventDefault();
        spacePressed = false;
        tempPanning = false;
        
        // Restaurar cursor baseado na ferramenta ativa
        if (fogDrawingMode) {
            canvasWrapper.style.cursor = 'crosshair';
        } else if (currentTool === 'draw') {
            canvasWrapper.style.cursor = 'crosshair';
        } else if (currentTool === 'erase') {
            canvasWrapper.style.cursor = 'not-allowed';
        } else if (currentTool === 'pan') {
            canvasWrapper.style.cursor = 'grab';
        } else {
            canvasWrapper.style.cursor = 'default';
        }
    }
});

setTool('select');
setTimeout(() => {
    drawGrid();
    console.log('✅ Grid desenhado');
}, 500);

renderImageList();
renderTokenList();