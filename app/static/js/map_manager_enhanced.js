// ====================
// ENHANCED MAP MANAGER - PARTE 1: INICIALIZAÇÃO E GRID
// ====================

const socket = io();
const SESSION_ID = document.getElementById('sessionId').value;

const mapCanvas = document.getElementById('mapCanvas');
const mapCtx = mapCanvas.getContext('2d');
const gridCanvas = document.getElementById('gridCanvas');
const gridCtx = gridCanvas.getContext('2d');
const drawingCanvas = document.getElementById('drawingCanvas');
const drawCtx = drawingCanvas.getContext('2d');

// Canvas maior para comportar múltiplos mapas
let w = mapCanvas.width = gridCanvas.width = drawingCanvas.width = 5000;
let h = mapCanvas.height = gridCanvas.height = drawingCanvas.height = 5000;

// Estado do sistema
let maps = [];
let entities = [];
let tokens = [];
let drawings = [];
let players = [];
let chatMessages = [];

// Controles
let currentTool = 'select';
let drawingColor = '#9b59b6';
let brushSize = 3;
let isDrawing = false;
let currentPath = [];

const TOKEN_RADIUS = 35;

// Grid settings
let gridEnabled = true;
let gridSize = 50;  // Tamanho de cada quadrado
let gridColor = 'rgba(155, 89, 182, 0.3)';
let gridLineWidth = 1;

// Seleção e arraste
let selectedItem = null;
let selectedType = null;
let draggingItem = null;
let mouseDown = false;
let dragOffsetX = 0;
let dragOffsetY = 0;

// Pan e Zoom do canvas
let isPanning = false;
let panX = -1500;
let panY = -1500;
let startPanX = 0;
let startPanY = 0;
let currentScale = 1;

// Imagens pré-carregadas (CORREÇÃO DO BUG) - MELHORADO
let loadedImages = new Map();
let imageLoadQueue = [];
let isLoadingImages = false;

// ==================
// SISTEMA DE GRID
// ==================
function drawGrid() {
    if (!gridEnabled) {
        gridCtx.clearRect(0, 0, w, h);
        return;
    }
    
    gridCtx.clearRect(0, 0, w, h);
    gridCtx.strokeStyle = gridColor;
    gridCtx.lineWidth = gridLineWidth;
    
    // Linhas verticais
    for (let x = 0; x <= w; x += gridSize) {
        gridCtx.beginPath();
        gridCtx.moveTo(x, 0);
        gridCtx.lineTo(x, h);
        gridCtx.stroke();
    }
    
    // Linhas horizontais
    for (let y = 0; y <= h; y += gridSize) {
        gridCtx.beginPath();
        gridCtx.moveTo(0, y);
        gridCtx.lineTo(w, y);
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

function updateGridColor(color) {
    gridColor = color;
    drawGrid();
}

function updateGridOpacity(opacity) {
    const alpha = parseFloat(opacity);
    const rgb = hexToRgb(gridColor.split(',')[0].replace('rgba(', ''));
    gridColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
    drawGrid();
}

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : {r: 155, g: 89, b: 182};
}

// ==================
// SISTEMA DE CARREGAMENTO DE IMAGENS (MELHORADO)
// ==================
function loadImageSafe(id, src, onComplete) {
    // Se já está carregada, retornar imediatamente
    if (loadedImages.has(id)) {
        if (onComplete) onComplete(loadedImages.get(id));
        return loadedImages.get(id);
    }
    
    // Adicionar à fila de carregamento
    imageLoadQueue.push({ id, src, onComplete });
    
    // Processar fila se não estiver processando
    if (!isLoadingImages) {
        processImageQueue();
    }
    
    return null;
}

function processImageQueue() {
    if (imageLoadQueue.length === 0) {
        isLoadingImages = false;
        return;
    }
    
    isLoadingImages = true;
    const { id, src, onComplete } = imageLoadQueue.shift();
    
    const img = new Image();
    
    img.onload = () => {
        loadedImages.set(id, img);
        if (onComplete) onComplete(img);
        redrawAll();
        
        // Processar próxima imagem na fila
        setTimeout(() => processImageQueue(), 10);
    };
    
    img.onerror = () => {
        console.error('Erro ao carregar imagem:', id);
        // Continuar processando mesmo com erro
        setTimeout(() => processImageQueue(), 10);
    };
    
    img.src = src;
}

function preloadAllImages() {
    console.log('Pré-carregando todas as imagens...');
    
    // Carregar mapas
    maps.forEach(map => {
        if (map.image && !loadedImages.has(map.id)) {
            loadImageSafe(map.id, map.image);
        }
    });
    
    // Carregar entidades
    entities.forEach(entity => {
        if (entity.image && !loadedImages.has(entity.id)) {
            loadImageSafe(entity.id, entity.image);
        }
    });
    
    // Carregar tokens
    tokens.forEach(token => {
        if (token.image && !loadedImages.has(token.id)) {
            loadImageSafe(token.id, token.image);
        }
    });
}

// ==================
// WEBSOCKET EVENTS
// ==================
socket.on('connect', () => {
    console.log('Conectado ao servidor');
    socket.emit('join_session', { session_id: SESSION_ID });
});

socket.on('session_state', (data) => {
    console.log('Estado da sessão recebido:', data);
    maps = data.maps || [];
    entities = data.entities || [];
    tokens = data.tokens || [];
    drawings = data.drawings || [];
    
    // Pré-carregar todas as imagens
    preloadAllImages();
});

socket.on('players_list', (data) => {
    players = data.players || [];
    renderPlayersList();
    updateChatRecipients();
});

socket.on('player_joined', (data) => {
    showToast(`${data.player_name} entrou na sessão`);
    socket.emit('get_players', { session_id: SESSION_ID });
});

socket.on('player_left', (data) => {
    showToast(`${data.player_name} saiu da sessão`);
    socket.emit('get_players', { session_id: SESSION_ID });
});

socket.on('maps_sync', (data) => {
    maps = data.maps;
    preloadAllImages();
});

socket.on('entities_sync', (data) => {
    entities = data.entities;
    preloadAllImages();
});

socket.on('token_sync', (data) => {
    tokens = data.tokens;
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

// Chat events
socket.on('chat_history', (data) => {
    chatMessages = data.messages || [];
    renderChatMessages();
});

socket.on('new_message', (data) => {
    if (!chatMessages.find(m => m.id === data.id)) {
        chatMessages.push(data);
        renderChatMessages();
        playNotificationSound();
    }
});

socket.on('master_message_notification', (data) => {
    if (!chatMessages.find(m => m.id === data.id)) {
        chatMessages.push(data);
        renderChatMessages();
        playNotificationSound();
    }
});

// ====================
// PARTE 2: FERRAMENTAS E RENDERIZAÇÃO CORRIGIDA
// ====================

// ==================
// FERRAMENTAS
// ==================
function setTool(tool) {
    currentTool = tool;
    document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    if (tool === 'draw') {
        drawingCanvas.style.pointerEvents = 'auto';
        mapCanvas.style.pointerEvents = 'none';
        drawingCanvas.style.cursor = 'crosshair';
    } else if (tool === 'erase') {
        drawingCanvas.style.pointerEvents = 'auto';
        mapCanvas.style.pointerEvents = 'none';
        drawingCanvas.style.cursor = 'not-allowed';
    } else if (tool === 'pan') {
        drawingCanvas.style.pointerEvents = 'none';
        mapCanvas.style.pointerEvents = 'auto';
        mapCanvas.style.cursor = 'grab';
    } else {
        drawingCanvas.style.pointerEvents = 'none';
        mapCanvas.style.pointerEvents = 'auto';
        mapCanvas.style.cursor = 'default';
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
// RENDER - USANDO IMAGENS CARREGADAS (CORREÇÃO DEFINITIVA)
// ==================
function redrawAll() {
    // Limpar canvas
    mapCtx.clearRect(0, 0, w, h);
    
    let needsRedraw = false;
    
    // 1. Desenhar mapas (camada de fundo)
    maps.forEach(map => {
        const img = loadedImages.get(map.id);
        
        if (img && img.complete && img.naturalWidth > 0) {
            // Imagem carregada e válida
            try {
                mapCtx.drawImage(img, map.x, map.y, map.width, map.height);
                
                // Borda se selecionado
                if (selectedItem === map && selectedType === 'map') {
                    mapCtx.strokeStyle = '#ffc107';
                    mapCtx.lineWidth = 4;
                    mapCtx.strokeRect(map.x, map.y, map.width, map.height);
                }
            } catch (e) {
                console.error('Erro ao desenhar mapa:', e);
                needsRedraw = true;
            }
        } else if (map.image) {
            // Imagem ainda não carregada
            loadImageSafe(map.id, map.image, () => redrawAll());
            needsRedraw = true;
            
            // Desenhar placeholder
            mapCtx.fillStyle = 'rgba(155, 89, 182, 0.1)';
            mapCtx.fillRect(map.x, map.y, map.width, map.height);
            mapCtx.strokeStyle = '#9b59b6';
            mapCtx.lineWidth = 2;
            mapCtx.strokeRect(map.x, map.y, map.width, map.height);
            
            // Texto "Carregando..."
            mapCtx.fillStyle = '#9b59b6';
            mapCtx.font = '16px Lato';
            mapCtx.textAlign = 'center';
            mapCtx.fillText('Carregando...', map.x + map.width/2, map.y + map.height/2);
        }
    });
    
    // 2. Desenhar entidades (camada intermediária)
    entities.forEach(entity => {
        const img = loadedImages.get(entity.id);
        
        if (img && img.complete && img.naturalWidth > 0) {
            try {
                mapCtx.drawImage(img, entity.x, entity.y, entity.width, entity.height);
                
                // Borda se selecionado
                if (selectedItem === entity && selectedType === 'entity') {
                    mapCtx.strokeStyle = '#ffc107';
                    mapCtx.lineWidth = 3;
                    mapCtx.strokeRect(entity.x, entity.y, entity.width, entity.height);
                }
            } catch (e) {
                console.error('Erro ao desenhar entidade:', e);
                needsRedraw = true;
            }
        } else if (entity.image) {
            loadImageSafe(entity.id, entity.image, () => redrawAll());
            needsRedraw = true;
        }
    });
    
    // 3. Desenhar tokens (camada superior)
    tokens.forEach(token => {
        const img = loadedImages.get(token.id);
        
        if (img && img.complete && img.naturalWidth > 0) {
            try {
                mapCtx.save();
                mapCtx.beginPath();
                mapCtx.arc(token.x, token.y, TOKEN_RADIUS, 0, Math.PI * 2);
                mapCtx.closePath();
                mapCtx.clip();
                mapCtx.drawImage(img, token.x - TOKEN_RADIUS, token.y - TOKEN_RADIUS, TOKEN_RADIUS * 2, TOKEN_RADIUS * 2);
                mapCtx.restore();
            } catch (e) {
                console.error('Erro ao desenhar token:', e);
                needsRedraw = true;
            }
        } else if (token.image) {
            loadImageSafe(token.id, token.image, () => redrawAll());
            needsRedraw = true;
            
            // Placeholder
            mapCtx.fillStyle = token.color || '#9b59b6';
            mapCtx.beginPath();
            mapCtx.arc(token.x, token.y, TOKEN_RADIUS, 0, Math.PI * 2);
            mapCtx.fill();
        } else if (token.color) {
            mapCtx.fillStyle = token.color;
            mapCtx.beginPath();
            mapCtx.arc(token.x, token.y, TOKEN_RADIUS, 0, Math.PI * 2);
            mapCtx.fill();
        }
        
        // Borda do token
        mapCtx.strokeStyle = "#fff";
        mapCtx.lineWidth = 2;
        mapCtx.beginPath();
        mapCtx.arc(token.x, token.y, TOKEN_RADIUS, 0, Math.PI * 2);
        mapCtx.stroke();
        
        // Nome do token
        mapCtx.fillStyle = "#fff";
        mapCtx.font = "bold 13px Lato";
        mapCtx.textAlign = "center";
        mapCtx.strokeStyle = "#000";
        mapCtx.lineWidth = 3;
        mapCtx.strokeText(token.name, token.x, token.y + TOKEN_RADIUS + 18);
        mapCtx.fillText(token.name, token.x, token.y + TOKEN_RADIUS + 18);

        // Highlight se selecionado
        if (selectedItem === token && selectedType === 'token') {
            mapCtx.strokeStyle = "#ffc107";
            mapCtx.lineWidth = 4;
            mapCtx.beginPath();
            mapCtx.arc(token.x, token.y, TOKEN_RADIUS + 5, 0, Math.PI * 2);
            mapCtx.stroke();
        }
    });
    
    // Se alguma imagem ainda está carregando, tentar novamente em breve
    if (needsRedraw) {
        setTimeout(() => redrawAll(), 100);
    }
}

function redrawDrawings() {
    drawCtx.clearRect(0, 0, w, h);
    
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
// PAN E ZOOM DO CANVAS
// ==================
function applyTransform() {
    const transform = `translate(${panX}px, ${panY}px) scale(${currentScale})`;
    mapCanvas.style.transform = transform;
    gridCanvas.style.transform = transform;
    drawingCanvas.style.transform = transform;
    mapCanvas.style.transformOrigin = '0 0';
    gridCanvas.style.transformOrigin = '0 0';
    drawingCanvas.style.transformOrigin = '0 0';
}

function zoom(delta) {
    currentScale = Math.max(0.3, Math.min(3, currentScale + delta));
    applyTransform();
    showToast(`Zoom: ${Math.round(currentScale * 100)}%`);
}

// ====================
// PARTE 3: EVENTOS DE MOUSE E GERENCIAMENTO
// ====================

// ==================
// MOUSE EVENTS
// ==================
function getMousePos(e) {
    const rect = mapCanvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - panX * currentScale) / currentScale;
    const y = (e.clientY - rect.top - panY * currentScale) / currentScale;
    return { x, y };
}

function findItemAt(x, y) {
    // Verificar tokens primeiro (camada superior)
    for (let i = tokens.length - 1; i >= 0; i--) {
        const token = tokens[i];
        const dist = Math.hypot(token.x - x, token.y - y);
        if (dist <= TOKEN_RADIUS) {
            return { item: token, type: 'token' };
        }
    }
    
    // Verificar entidades
    for (let i = entities.length - 1; i >= 0; i--) {
        const entity = entities[i];
        if (x >= entity.x && x <= entity.x + entity.width &&
            y >= entity.y && y <= entity.y + entity.height) {
            return { item: entity, type: 'entity' };
        }
    }
    
    // Verificar mapas
    for (let i = maps.length - 1; i >= 0; i--) {
        const map = maps[i];
        if (x >= map.x && x <= map.x + map.width &&
            y >= map.y && y <= map.y + map.height) {
            return { item: map, type: 'map' };
        }
    }
    
    return null;
}

mapCanvas.addEventListener('mousedown', (e) => {
    const pos = getMousePos(e);
    
    if (currentTool === 'pan') {
        isPanning = true;
        startPanX = e.clientX - panX;
        startPanY = e.clientY - panY;
        mapCanvas.style.cursor = 'grabbing';
        return;
    }
    
    if (currentTool === 'select') {
        const found = findItemAt(pos.x, pos.y);
        
        if (found) {
            selectedItem = found.item;
            selectedType = found.type;
            draggingItem = found.item;
            mouseDown = true;
            
            dragOffsetX = pos.x - found.item.x;
            dragOffsetY = pos.y - found.item.y;
            
            mapCanvas.style.cursor = 'grabbing';
        } else {
            selectedItem = null;
            selectedType = null;
        }
        
        redrawAll();
    }
});

mapCanvas.addEventListener('mousemove', (e) => {
    const pos = getMousePos(e);
    
    if (isPanning && currentTool === 'pan') {
        panX = e.clientX - startPanX;
        panY = e.clientY - startPanY;
        applyTransform();
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
        mapCanvas.style.cursor = found ? 'grab' : 'default';
    }
});

mapCanvas.addEventListener('mouseup', () => {
    if (draggingItem && mouseDown) {
        // Emitir atualização baseado no tipo
        if (selectedType === 'map') {
            socket.emit('update_map', {
                session_id: SESSION_ID,
                map_id: draggingItem.id,
                map: draggingItem
            });
        } else if (selectedType === 'entity') {
            socket.emit('update_entity', {
                session_id: SESSION_ID,
                entity_id: draggingItem.id,
                entity: draggingItem
            });
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
        mapCanvas.style.cursor = 'grab';
    } else {
        mapCanvas.style.cursor = 'default';
    }
});

mapCanvas.addEventListener('mouseleave', () => {
    isPanning = false;
    if (draggingItem && mouseDown) {
        draggingItem = null;
        mouseDown = false;
    }
});

// ==================
// ADICIONAR MAPA
// ==================
function addMap() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        showToast('Carregando mapa...');
        
        const reader = new FileReader();
        reader.onload = (ev) => {
            const img = new Image();
            img.onload = () => {
                const newMap = {
                    id: 'map_' + Date.now(),
                    x: 100,
                    y: 100,
                    width: img.width,
                    height: img.height,
                    image: ev.target.result
                };
                
                // Carregar imagem no cache
                loadedImages.set(newMap.id, img);
                
                maps.push(newMap);
                
                socket.emit('add_map', {
                    session_id: SESSION_ID,
                    map: newMap
                });
                
                redrawAll();
                showToast('Mapa adicionado!');
            };
            img.onerror = () => {
                showToast('Erro ao carregar mapa');
            };
            img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
    };
    input.click();
}

// ==================
// ADICIONAR ENTIDADE
// ==================
function addEntity() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        showToast('Carregando entidade...');
        
        const reader = new FileReader();
        reader.onload = (ev) => {
            const img = new Image();
            img.onload = () => {
                const name = prompt('Nome da entidade:', file.name.replace('.png', ''));
                if (!name) return;
                
                const newEntity = {
                    id: 'entity_' + Date.now(),
                    name: name,
                    x: 200,
                    y: 200,
                    width: img.width,
                    height: img.height,
                    image: ev.target.result
                };
                
                // Carregar imagem no cache
                loadedImages.set(newEntity.id, img);
                
                entities.push(newEntity);
                
                socket.emit('add_entity', {
                    session_id: SESSION_ID,
                    entity: newEntity
                });
                
                redrawAll();
                showToast(`Entidade "${name}" adicionada!`);
            };
            img.onerror = () => {
                showToast('Erro ao carregar entidade');
            };
            img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
    };
    input.click();
}

// ==================
// DELETAR ITEM
// ==================
function deleteSelected() {
    if (!selectedItem) {
        alert('Selecione um item primeiro');
        return;
    }
    
    const confirmMsg = `Remover ${selectedType === 'map' ? 'mapa' : selectedType === 'entity' ? 'entidade' : 'token'}?`;
    if (!confirm(confirmMsg)) return;
    
    if (selectedType === 'map') {
        socket.emit('delete_map', {
            session_id: SESSION_ID,
            map_id: selectedItem.id
        });
        loadedImages.delete(selectedItem.id);
        maps = maps.filter(m => m !== selectedItem);
    } else if (selectedType === 'entity') {
        socket.emit('delete_entity', {
            session_id: SESSION_ID,
            entity_id: selectedItem.id
        });
        loadedImages.delete(selectedItem.id);
        entities = entities.filter(e => e !== selectedItem);
    } else if (selectedType === 'token') {
        deleteToken(selectedItem.id);
        return;
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

// ====================
// PARTE 4: TOKENS E DESENHO
// ====================

// ==================
// ADICIONAR TOKEN
// ==================
function addToken() {
    document.getElementById('tokenModal').classList.add('show');
}

function createToken() {
    const name = document.getElementById('tokenName').value.trim();
    const imageInput = document.getElementById('tokenImage');
    
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
                    x: 300,
                    y: 300,
                    image: e.target.result
                };
                
                // Carregar imagem no cache
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
        // Token colorido sem imagem
        const newToken = {
            id: 'token_' + Date.now(),
            name: name,
            x: 300,
            y: 300,
            color: '#' + Math.floor(Math.random() * 16777215).toString(16)
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

function renderTokenList() {
    const list = document.getElementById('tokenList');
    if (!list) return;
    
    list.innerHTML = '';
    
    if (tokens.length === 0) {
        list.innerHTML = '<div class="empty-state">Nenhum token adicionado</div>';
        return;
    }
    
    tokens.forEach(token => {
        const item = document.createElement('div');
        item.className = 'token-item';
        item.onclick = () => selectToken(token);
        
        if (token.image) {
            item.innerHTML = `
                <img src="${token.image}" class="token-preview" alt="${token.name}">
                <div class="token-info">
                    <div class="token-name">${token.name}</div>
                </div>
                <div class="token-actions">
                    <button class="token-action-btn delete" onclick="deleteToken(${token.id}); event.stopPropagation();">🗑️</button>
                </div>
            `;
        } else {
            item.innerHTML = `
                <div class="token-color" style="background-color: ${token.color}"></div>
                <div class="token-info">
                    <div class="token-name">${token.name}</div>
                </div>
                <div class="token-actions">
                    <button class="token-action-btn delete" onclick="deleteToken('${token.id}'); event.stopPropagation();">🗑️</button>
                </div>
            `;
        }
        
        list.appendChild(item);
    });
}

function selectToken(token) {
    selectedItem = token;
    selectedType = 'token';
    document.querySelectorAll('.token-item').forEach(i => i.classList.remove('active'));
    event.currentTarget.classList.add('active');
    redrawAll();
}

function deleteToken(tokenId) {
    if (confirm('Remover este token?')) {
        const token = tokens.find(t => t.id === tokenId);
        if (token) {
            loadedImages.delete(token.id);
        }
        tokens = tokens.filter(t => t.id !== tokenId);
        selectedItem = null;
        renderTokenList();
        redrawAll();
        
        socket.emit('token_update', {
            session_id: SESSION_ID,
            tokens: tokens
        });
        
        showToast('Token removido!');
    }
}

// ==================
// DESENHO LIVRE
// ==================
function getDrawingPos(e) {
    const rect = drawingCanvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - panX * currentScale) / currentScale;
    const y = (e.clientY - rect.top - panY * currentScale) / currentScale;
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
    let somethingErased = false;
    
    drawings = drawings.filter(drawing => {
        const shouldKeep = !drawing.path.some(point => {
            const dist = Math.hypot(point.x - x, point.y - y);
            return dist < eraseRadius;
        });
        
        if (!shouldKeep) somethingErased = true;
        return shouldKeep;
    });
    
    if (somethingErased) {
        redrawDrawings();
        socket.emit('clear_drawings', { session_id: SESSION_ID });
        drawings.forEach(d => socket.emit('drawing_update', {
            session_id: SESSION_ID,
            drawing: d
        }));
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
// PERMISSÕES
// ==================
function renderPlayersList() {
    const list = document.getElementById('playersList');
    if (!list) return;
    
    list.innerHTML = '';
    
    if (players.length === 0) {
        list.innerHTML = '<div class="empty-players">Nenhum jogador conectado</div>';
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
                <button class="perm-btn ${permissions.ping ? 'active' : ''}" 
                        onclick="togglePermission('${player.id}', 'ping')">
                    📍 Pingar
                </button>
                <button class="perm-btn" onclick="openTokenPermissions('${player.id}')">
                    🎭 Tokens
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
        item.className = 'token-perm-item';
        
        const isAllowed = allowedTokens.includes(token.id);
        
        item.innerHTML = `
            <div class="token-perm-info">
                ${token.image ? 
                    `<img src="${token.image}" class="token-perm-preview">` :
                    `<div class="token-perm-color" style="background: ${token.color}"></div>`
                }
                <span>${token.name}</span>
            </div>
            <label class="checkbox-label">
                <input type="checkbox" ${isAllowed ? 'checked' : ''} 
                       onchange="toggleTokenPermission('${player.id}', '${token.id}')">
                <span>Permitir mover</span>
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

// ====================
// PARTE 5 FINAL: CHAT, DICE ROLLER FLUTUANTE E UTILS
// ====================

// ==================
// SISTEMA DE CHAT
// ==================
function renderChatMessages() {
    const chatBox = document.getElementById('chatMessages');
    if (!chatBox) return;
    
    chatBox.innerHTML = '';
    
    if (chatMessages.length === 0) {
        chatBox.innerHTML = '<div class="empty-state">Nenhuma mensagem ainda</div>';
        return;
    }
    
    chatMessages.forEach(msg => {
        const msgDiv = document.createElement('div');
        msgDiv.className = 'chat-message';
        
        const isPrivate = msg.recipient_id !== null;
        const recipientName = isPrivate ? (players.find(p => p.id === msg.recipient_id)?.name || 'Desconhecido') : 'Todos';
        
        msgDiv.innerHTML = `
            <div class="chat-message-header">
                <strong>${msg.sender_name}</strong> 
                ${isPrivate ? `→ <em>${recipientName}</em>` : ''}
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
    if (!message) return;
    
    const recipientId = recipientSelect.value === 'all' ? null : recipientSelect.value;
    
    socket.emit('send_message', {
        session_id: SESSION_ID,
        sender_id: 'master',
        message: message,
        recipient_id: recipientId
    });
    
    input.value = '';
}

function updateChatRecipients() {
    const select = document.getElementById('chatRecipient');
    if (!select) return;
    
    select.innerHTML = '<option value="all">📢 Visível apenas para mim</option>';
    
    players.forEach(player => {
        const option = document.createElement('option');
        option.value = player.id;
        option.textContent = `💬 ${player.name} (privado)`;
        select.appendChild(option);
    });
}

function playNotificationSound() {
    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIGGa88OScTgwOWK3n77BdGAg+ltf');
    audio.volume = 0.3;
    audio.play().catch(() => {});
}

// ==================
// DICE ROLLER FLUTUANTE
// ==================
function toggleDiceRoller() {
    const panel = document.getElementById('dicePanel');
    panel.classList.toggle('show');
}

function rollDice(sides) {
    const result = Math.floor(Math.random() * sides) + 1;
    const resultDiv = document.getElementById('diceResult');
    
    resultDiv.textContent = result;
    resultDiv.className = 'dice-result';
    
    // Animação
    setTimeout(() => {
        resultDiv.classList.add('show');
        
        // Verificar críticos
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
    const count = parseInt(document.getElementById('diceCount').value) || 1;
    const type = parseInt(document.getElementById('diceType').value) || 20;
    const modifier = parseInt(document.getElementById('diceModifier').value) || 0;
    
    let sum = 0;
    const rolls = [];
    
    for (let i = 0; i < count; i++) {
        const roll = Math.floor(Math.random() * type) + 1;
        rolls.push(roll);
        sum += roll;
    }
    
    const total = sum + modifier;
    const resultDiv = document.getElementById('diceResult');
    
    resultDiv.innerHTML = `
        <div style="font-size: 2rem; font-weight: bold;">${total}</div>
        <div style="font-size: 0.8rem; color: #bbb;">${rolls.join(' + ')}${modifier !== 0 ? ` ${modifier > 0 ? '+' : ''}${modifier}` : ''}</div>
    `;
    
    resultDiv.className = 'dice-result show';
}

// ==================
// PAINÉIS FLUTUANTES
// ==================
function togglePanel(panelId) {
    const panel = document.getElementById(panelId);
    const isVisible = panel.classList.contains('show');
    
    // Fechar todos os painéis
    document.querySelectorAll('.floating-panel').forEach(p => p.classList.remove('show'));
    
    // Abrir o painel clicado se não estava visível
    if (!isVisible) {
        panel.classList.add('show');
    }
}

function togglePlayersPanel() {
    togglePanel('playersPanel');
}

function toggleChatPanel() {
    togglePanel('chatPanel');
}

function toggleToolsPanel() {
    togglePanel('toolsPanel');
}

// ==================
// OUTROS CONTROLES
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
    if (!confirm('Limpar TUDO (mapas, tokens, entidades, desenhos)?')) return;
    
    loadedImages.clear();
    
    maps = [];
    entities = [];
    tokens = [];
    drawings = [];
    
    redrawAll();
    redrawDrawings();
    
    socket.emit('clear_drawings', { session_id: SESSION_ID });
    showToast('Tudo limpo!');
}

// ==================
// INICIALIZAÇÃO
// ==================
console.log('Map Manager carregado! Session ID:', SESSION_ID);

// Inicializar
setTool('select');
applyTransform();
drawGrid();
renderTokenList();

// Solicitar lista de jogadores
socket.emit('get_players', { session_id: SESSION_ID });

// Event listener para Enter no chat
document.addEventListener('DOMContentLoaded', () => {
    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendChatMessage();
            }
        });
    }
    
    // Fechar painéis ao clicar fora
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.floating-panel') && !e.target.closest('.floating-btn')) {
            document.querySelectorAll('.floating-panel').forEach(p => p.classList.remove('show'));
        }
    });
});

console.log('✅ Sistema pronto!');