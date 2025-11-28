// ====================
// ENHANCED MAP MANAGER - COM MÚLTIPLOS MAPAS E PERMISSÕES
// ====================

const socket = io();
const SESSION_ID = document.getElementById('sessionId').value;

const mapCanvas = document.getElementById('mapCanvas');
const mapCtx = mapCanvas.getContext('2d');
const drawingCanvas = document.getElementById('drawingCanvas');
const drawCtx = drawingCanvas.getContext('2d');

// Canvas maior para comportar múltiplos mapas
let w = mapCanvas.width = drawingCanvas.width = 5000;
let h = mapCanvas.height = drawingCanvas.height = 5000;

// Estado do sistema
let maps = [];  // Múltiplos mapas
let entities = [];  // Entidades (PNGs sem borda)
let tokens = [];  // Tokens circulares
let drawings = [];  // Desenhos
let players = [];  // Jogadores conectados

// Controles
let currentTool = 'select';
let drawingColor = '#9b59b6';
let brushSize = 3;
let isDrawing = false;
let currentPath = [];

const TOKEN_RADIUS = 35;

// Seleção e arraste
let selectedItem = null;
let selectedType = null;  // 'map', 'entity', 'token'
let draggingItem = null;
let mouseDown = false;
let dragOffsetX = 0;
let dragOffsetY = 0;

// Pan e Zoom do canvas
let isPanning = false;
let panX = -1500;  // Centralizar no canvas maior
let panY = -1500;
let startPanX = 0;
let startPanY = 0;
let currentScale = 1;

// ==================
// WEBSOCKET
// ==================
socket.on('connect', () => {
    console.log('Conectado ao servidor');
    socket.emit('join_session', { session_id: SESSION_ID });
});

socket.on('session_state', (data) => {
    maps = data.maps || [];
    entities = data.entities || [];
    tokens = data.tokens || [];
    drawings = data.drawings || [];
    redrawAll();
    console.log('Estado da sessão carregado');
});

socket.on('players_list', (data) => {
    players = data.players || [];
    renderPlayersList();
    console.log('Jogadores:', players);
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
    redrawAll();
});

socket.on('entities_sync', (data) => {
    entities = data.entities;
    redrawAll();
});

socket.on('token_sync', (data) => {
    tokens = data.tokens;
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
// RENDER - TUDO EM CAMADAS
// ==================
function redrawAll() {
    mapCtx.clearRect(0, 0, w, h);
    
    // 1. Desenhar mapas (camada de fundo)
    maps.forEach(map => {
        if (map.image) {
            const img = new Image();
            img.src = map.image;
            img.onload = () => {
                mapCtx.drawImage(img, map.x, map.y, map.width, map.height);
                
                // Borda se selecionado
                if (selectedItem === map && selectedType === 'map') {
                    mapCtx.strokeStyle = '#ffc107';
                    mapCtx.lineWidth = 4;
                    mapCtx.strokeRect(map.x, map.y, map.width, map.height);
                }
            };
        }
    });
    
    // 2. Desenhar entidades (camada intermediária)
    entities.forEach(entity => {
        const img = new Image();
        img.src = entity.image;
        img.onload = () => {
            mapCtx.drawImage(img, entity.x, entity.y, entity.width, entity.height);
            
            // Borda se selecionado
            if (selectedItem === entity && selectedType === 'entity') {
                mapCtx.strokeStyle = '#ffc107';
                mapCtx.lineWidth = 3;
                mapCtx.strokeRect(entity.x, entity.y, entity.width, entity.height);
            }
        };
    });
    
    // 3. Desenhar tokens (camada superior)
    tokens.forEach(token => {
        if (token.image) {
            const img = new Image();
            img.src = token.image;
            mapCtx.save();
            mapCtx.beginPath();
            mapCtx.arc(token.x, token.y, TOKEN_RADIUS, 0, Math.PI * 2);
            mapCtx.closePath();
            mapCtx.clip();
            mapCtx.drawImage(img, token.x - TOKEN_RADIUS, token.y - TOKEN_RADIUS, TOKEN_RADIUS * 2, TOKEN_RADIUS * 2);
            mapCtx.restore();
        } else {
            mapCtx.fillStyle = token.color || '#9b59b6';
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

        if (selectedItem === token && selectedType === 'token') {
            mapCtx.strokeStyle = "#ffc107";
            mapCtx.lineWidth = 4;
            mapCtx.beginPath();
            mapCtx.arc(token.x, token.y, TOKEN_RADIUS + 5, 0, Math.PI * 2);
            mapCtx.stroke();
        }
    });
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
    drawingCanvas.style.transform = transform;
    mapCanvas.style.transformOrigin = '0 0';
    drawingCanvas.style.transformOrigin = '0 0';
}

function zoom(delta) {
    currentScale = Math.max(0.3, Math.min(3, currentScale + delta));
    applyTransform();
    showToast(`Zoom: ${Math.round(currentScale * 100)}%`);
}

// ==================
// MOUSE EVENTS - SISTEMA UNIFICADO
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
            
            // Calcular offset do clique
            dragOffsetX = pos.x - found.item.x;
            dragOffsetY = pos.y - found.item.y;
            
            mapCanvas.style.cursor = 'grabbing';
            console.log(`Selecionado: ${found.type}`, found.item);
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
        
        const reader = new FileReader();
        reader.onload = (ev) => {
            const img = new Image();
            img.onload = () => {
                const newMap = {
                    id: Date.now(),
                    x: 100,
                    y: 100,
                    width: img.width,
                    height: img.height,
                    image: ev.target.result
                };
                
                maps.push(newMap);
                redrawAll();
                
                socket.emit('add_map', {
                    session_id: SESSION_ID,
                    map: newMap
                });
                
                showToast('Mapa adicionado!');
            };
            img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
    };
    input.click();
}

// ==================
// ADICIONAR ENTIDADE (PNG sem borda)
// ==================
function addEntity() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (ev) => {
            const img = new Image();
            img.onload = () => {
                const name = prompt('Nome da entidade:', file.name.replace('.png', ''));
                if (!name) return;
                
                const newEntity = {
                    id: Date.now(),
                    name: name,
                    x: 200,
                    y: 200,
                    width: img.width,
                    height: img.height,
                    image: ev.target.result
                };
                
                entities.push(newEntity);
                redrawAll();
                
                socket.emit('add_entity', {
                    session_id: SESSION_ID,
                    entity: newEntity
                });
                
                showToast(`Entidade "${name}" adicionada!`);
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
    const name = document.getElementById('tokenName').value;
    const imageInput = document.getElementById('tokenImage');
    
    if (!name) {
        alert('Digite um nome para o token');
        return;
    }
    
    if (imageInput.files.length > 0) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const newToken = {
                id: Date.now(),
                name: name,
                x: 300,
                y: 300,
                image: e.target.result
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
        };
        reader.readAsDataURL(imageInput.files[0]);
    } else {
        const newToken = {
            id: Date.now(),
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
    list.innerHTML = '';
    
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
                    <button class="token-action-btn delete" onclick="deleteToken(${token.id}); event.stopPropagation();">🗑️</button>
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
// DELETAR ITEM SELECIONADO
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
        maps = maps.filter(m => m !== selectedItem);
    } else if (selectedType === 'entity') {
        socket.emit('delete_entity', {
            session_id: SESSION_ID,
            entity_id: selectedItem.id
        });
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

// Tecla DELETE
document.addEventListener('keydown', (e) => {
    if (e.key === 'Delete' && selectedItem) {
        deleteSelected();
    }
});

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
// SISTEMA DE JOGADORES E PERMISSÕES
// ==================
function renderPlayersList() {
    const list = document.getElementById('playersList');
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
                <div class="player-id">${player.id.substr(0, 8)}</div>
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
                       onchange="toggleTokenPermission('${player.id}', ${token.id})">
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
console.log('Enhanced Map Manager carregado! Session ID:', SESSION_ID);
setTool('select');
applyTransform();
redrawAll();
renderTokenList();

// Solicitar lista de jogadores
socket.emit('get_players', { session_id: SESSION_ID });