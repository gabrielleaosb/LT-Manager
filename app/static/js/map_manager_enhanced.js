// MAP MANAGER - PARTE 1: INICIALIZAÇÃO E CONFIGURAÇÃO

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

// Tamanho do canvas otimizado
const CANVAS_WIDTH = 2500;
const CANVAS_HEIGHT = 2500;

mapCanvas.width = gridCanvas.width = drawingCanvas.width = CANVAS_WIDTH;
mapCanvas.height = gridCanvas.height = drawingCanvas.height = CANVAS_HEIGHT;

// Estado do sistema - UNIFICADO: apenas images (mapas+entidades) e tokens
let images = [];  // Todas as imagens (não diferencia mais mapa de entidade)
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
let gridSize = 50;
let gridColor = 'rgba(155, 89, 182, 0.3)';
let gridLineWidth = 1;

// Seleção e arraste
let selectedItem = null;
let selectedType = null; // 'image' ou 'token'
let draggingItem = null;
let mouseDown = false;
let dragOffsetX = 0;
let dragOffsetY = 0;

// Pan e Zoom
let isPanning = false;
let panX = 0;
let panY = 0;
let startPanX = 0;
let startPanY = 0;
let currentScale = 1;

// Cache de imagens
let loadedImages = new Map();

// Chat state
let chatExpanded = false;

// ==================
// SISTEMA DE GRID (SOBREPÕE AS IMAGENS)
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
// WEBSOCKET EVENTS
// ==================
socket.on('connect', () => {
    console.log('Conectado ao servidor');
    socket.emit('join_session', { session_id: SESSION_ID });
});

socket.on('session_state', (data) => {
    console.log('Estado da sessão recebido:', data);
    
    // Combinar mapas e entidades em uma única lista
    const maps = data.maps || [];
    const entities = data.entities || [];
    images = [...maps, ...entities];
    
    tokens = data.tokens || [];
    drawings = data.drawings || [];
    
    preloadAllImages();
    drawGrid(); // Desenhar grid depois das imagens
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
    const maps = data.maps || [];
    images = images.filter(img => !maps.find(m => m.id === img.id));
    images = [...images, ...maps];
    preloadAllImages();
});

socket.on('entities_sync', (data) => {
    const entities = data.entities || [];
    images = images.filter(img => !entities.find(e => e.id === img.id));
    images = [...images, ...entities];
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

// ==================
// FERRAMENTAS
// ==================
function setTool(tool) {
    currentTool = tool;
    document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    if (tool === 'draw') {
        drawingCanvas.classList.add('drawing-mode');
        canvasWrapper.style.cursor = 'crosshair';
    } else if (tool === 'erase') {
        drawingCanvas.classList.add('drawing-mode');
        canvasWrapper.style.cursor = 'not-allowed';
    } else if (tool === 'pan') {
        drawingCanvas.classList.remove('drawing-mode');
        canvasWrapper.style.cursor = 'grab';
    } else {
        drawingCanvas.classList.remove('drawing-mode');
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
// PAN E ZOOM COM SCROLL
// ==================
function applyTransform() {
    const transform = `scale(${currentScale})`;
    canvasWrapper.style.transform = transform;
}

function zoom(delta) {
    currentScale = Math.max(0.3, Math.min(3, currentScale + delta));
    applyTransform();
    showToast(`Zoom: ${Math.round(currentScale * 100)}%`);
}

// Zoom com scroll do mouse
canvasWrapper.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    zoom(delta);
});

// ==================
// RENDER
// ==================
function redrawAll() {
    mapCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // 1. Desenhar todas as imagens (mapas e entidades juntos)
    images.forEach(img => {
        const loadedImg = loadedImages.get(img.id);
        
        if (loadedImg && loadedImg.complete && loadedImg.naturalWidth > 0) {
            try {
                mapCtx.drawImage(loadedImg, img.x, img.y, img.width, img.height);
                
                if (selectedItem === img && selectedType === 'image') {
                    mapCtx.strokeStyle = '#ffc107';
                    mapCtx.lineWidth = 4;
                    mapCtx.strokeRect(img.x, img.y, img.width, img.height);
                }
            } catch (e) {
                console.error('Erro ao desenhar imagem:', e);
            }
        } else if (img.image) {
            loadImageSafe(img.id, img.image);
            
            mapCtx.fillStyle = 'rgba(155, 89, 182, 0.1)';
            mapCtx.fillRect(img.x, img.y, img.width, img.height);
            mapCtx.strokeStyle = '#9b59b6';
            mapCtx.lineWidth = 2;
            mapCtx.strokeRect(img.x, img.y, img.width, img.height);
        }
    });
    
    // 2. Desenhar tokens
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
            }
        } else if (token.image) {
            loadImageSafe(token.id, token.image);
            
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

// MAP MANAGER - PARTE 2: EVENTOS DE MOUSE E DESENHO

// ==================
// EVENTOS DE MOUSE - CORRIGIDO PARA ZOOM
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
    // Verificar tokens primeiro (camada superior)
    for (let i = tokens.length - 1; i >= 0; i--) {
        const token = tokens[i];
        const dist = Math.hypot(token.x - x, token.y - y);
        if (dist <= TOKEN_RADIUS) {
            return { item: token, type: 'token' };
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

canvasWrapper.addEventListener('mousedown', (e) => {
    const pos = getMousePos(e);
    
    if (currentTool === 'pan') {
        isPanning = true;
        startPanX = e.clientX - panX;
        startPanY = e.clientY - panY;
        canvasWrapper.style.cursor = 'grabbing';
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
    
    if (isPanning && currentTool === 'pan') {
        panX = e.clientX - startPanX;
        panY = e.clientY - startPanY;
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
        canvasWrapper.style.cursor = found ? 'grab' : 'default';
    }
});

canvasWrapper.addEventListener('mouseup', () => {
    if (draggingItem && mouseDown) {
        // Emitir atualização baseado no tipo
        if (selectedType === 'image') {
            // Determinar se é mapa ou entidade pelo ID
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
    if (draggingItem && mouseDown) {
        draggingItem = null;
        mouseDown = false;
    }
});

// ==================
// DESENHO LIVRE - CORRIGIDO PARA ZOOM
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

// Apagar apenas desenhos que passam por cima
function eraseDrawingsAt(x, y) {
    const eraseRadius = brushSize * 3;
    const before = drawings.length;
    
    drawings = drawings.filter(drawing => {
        const shouldKeep = !drawing.path.some(point => {
            const dist = Math.hypot(point.x - x, point.y - y);
            return dist < eraseRadius;
        });
        return shouldKeep;
    });
    
    if (drawings.length < before) {
        redrawDrawings();
        // Sincronizar estado completo dos desenhos
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
// ADICIONAR IMAGEM (MAPA OU ENTIDADE)
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
                const newImage = {
                    id: 'img_' + Date.now(),
                    name: name,
                    x: 100,
                    y: 100,
                    width: img.width,
                    height: img.height,
                    image: ev.target.result
                };
                
                loadedImages.set(newImage.id, img);
                images.push(newImage);
                
                // Emitir como entidade (pode ser tratado como mapa também)
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
        // Detectar se é mapa ou entidade pelo ID
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

// MAP MANAGER - PARTE 3: CHAT, PERMISSÕES E UI

// ==================
// CHAT INFERIOR EXPANSÍVEL
// ==================
function toggleChat() {
    const chatBottom = document.getElementById('chatBottom');
    chatExpanded = !chatExpanded;
    
    if (chatExpanded) {
        chatBottom.classList.remove('minimized');
        chatBottom.classList.add('expanded');
    } else {
        chatBottom.classList.remove('expanded');
        chatBottom.classList.add('minimized');
    }
}

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
        const recipientName = isPrivate ? (players.find(p => p.id === msg.recipient_id)?.name || 'Desconhecido') : '';
        
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
    
    select.innerHTML = '<option value="all">📢 Apenas para mim</option>';
    
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
// PERMISSÕES DE JOGADORES
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
        
        item.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px; flex: 1;">
                ${token.image ? 
                    `<img src="${token.image}" class="item-preview" style="border-radius: 50%;">` :
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
// RENDERIZAR LISTAS
// ==================
function renderImageList() {
    const list = document.getElementById('imageList');
    if (!list) return;
    
    list.innerHTML = '';
    
    if (images.length === 0) {
        list.innerHTML = '<div class="empty-state">Nenhuma imagem adicionada</div>';
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
        list.innerHTML = '<div class="empty-state">Nenhum token adicionado</div>';
        return;
    }
    
    tokens.forEach(token => {
        const item = document.createElement('div');
        item.className = 'item-card';
        item.onclick = () => selectItem(token, 'token');
        
        if (token.image) {
            item.innerHTML = `
                <img src="${token.image}" class="item-preview" style="border-radius: 50%;" alt="${token.name}">
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
// PAINÉIS FLUTUANTES
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
    // Inicializar chat minimizado
    const chatBottom = document.getElementById('chatBottom');
    if (chatBottom) {
        chatBottom.classList.add('minimized');
    }
    
    // Event listener para Enter no chat
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

console.log('Map Manager Parte 3 carregado!');

// Inicializar
setTool('select');
applyTransform();
drawGrid();
renderImageList();
renderTokenList();

socket.emit('get_players', { session_id: SESSION_ID });