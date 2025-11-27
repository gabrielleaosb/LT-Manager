// ====================
// MAP MANAGER JS COM WEBSOCKET - VERSÃO CORRIGIDA
// ====================

// Conectar ao SocketIO
const socket = io();
const SESSION_ID = document.getElementById('sessionId').value;

// Canvas setup
const mapCanvas = document.getElementById('mapCanvas');
const mapCtx = mapCanvas.getContext('2d');
const drawingCanvas = document.getElementById('drawingCanvas');
const drawCtx = drawingCanvas.getContext('2d');

let w = mapCanvas.width = drawingCanvas.width = window.innerWidth - 320;
let h = mapCanvas.height = drawingCanvas.height = window.innerHeight - 70;

// Estado do mapa
let mapImage = null;
let gridSize = parseInt(document.getElementById('gridSize').value);
let gridColor = document.getElementById('gridColor').value;
let gridOpacity = document.getElementById('gridOpacity').value / 100;
let gridVisible = true;

// Ferramentas
let currentTool = 'select'; // select, draw, erase
let drawingColor = '#9b59b6';
let brushSize = 3;
let isDrawing = false;
let drawings = [];

// Tokens
const TOKEN_RADIUS = 35; // Tokens maiores
const TOKEN_BORDER = 2; // Borda mais fina
let tokens = [];
let selectedToken = null;
let draggedToken = null;
let scale = 1;
let isDraggingToken = false;

// --------------------
// WEBSOCKET
// --------------------
socket.on('connect', () => {
    console.log('Conectado ao servidor');
    socket.emit('join_session', { session_id: SESSION_ID });
});

socket.on('token_sync', (data) => {
    tokens = data.tokens;
    redrawMap();
});

socket.on('drawing_sync', (data) => {
    drawings.push(data.drawing);
    redrawDrawings();
});

socket.on('drawings_cleared', () => {
    drawings = [];
    redrawDrawings();
});

socket.on('map_sync', (data) => {
    if (data.mapData) {
        const img = new Image();
        img.onload = function() {
            mapImage = img;
            redrawMap();
        };
        img.src = data.mapData;
    }
});

function emitTokenUpdate() {
    socket.emit('token_update', {
        session_id: SESSION_ID,
        tokens: tokens
    });
}

function emitDrawingUpdate(drawing) {
    socket.emit('drawing_update', {
        session_id: SESSION_ID,
        drawing: drawing
    });
}

// --------------------
// FERRAMENTAS
// --------------------
function setTool(tool) {
    currentTool = tool;
    document.querySelectorAll('.tool-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Atualizar cursor
    if (tool === 'draw') {
        drawingCanvas.style.cursor = 'crosshair';
        mapCanvas.style.cursor = 'crosshair';
    } else if (tool === 'erase') {
        drawingCanvas.style.cursor = 'not-allowed';
        mapCanvas.style.cursor = 'not-allowed';
    } else {
        drawingCanvas.style.cursor = 'default';
        mapCanvas.style.cursor = 'grab';
    }
}

function setDrawingColor(color) {
    drawingColor = color;
    document.querySelectorAll('.color-option').forEach(opt => {
        opt.classList.remove('active');
    });
    event.target.classList.add('active');
}

function setBrushSize(size) {
    brushSize = parseInt(size);
}

// --------------------
// DESENHO LIVRE - CORRIGIDO PARA ZOOM
// --------------------
let currentPath = [];

function getCanvasCoordinates(canvas, e) {
    const rect = canvas.getBoundingClientRect();
    // Ajustar para o zoom
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
    };
}

drawingCanvas.addEventListener('mousedown', (e) => {
    if (currentTool === 'draw') {
        isDrawing = true;
        const coords = getCanvasCoordinates(drawingCanvas, e);
        currentPath = [coords];
    } else if (currentTool === 'erase') {
        // Apagar apenas desenhos próximos ao cursor
        const coords = getCanvasCoordinates(drawingCanvas, e);
        eraseDrawingsAt(coords.x, coords.y);
    }
});

drawingCanvas.addEventListener('mousemove', (e) => {
    if (isDrawing && currentTool === 'draw') {
        const coords = getCanvasCoordinates(drawingCanvas, e);
        currentPath.push(coords);
        
        // Desenhar em tempo real
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
        // Continuar apagando enquanto arrasta
        const coords = getCanvasCoordinates(drawingCanvas, e);
        eraseDrawingsAt(coords.x, coords.y);
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
        emitDrawingUpdate(drawing);
        currentPath = [];
    }
    isDrawing = false;
});

drawingCanvas.addEventListener('mouseleave', () => {
    isDrawing = false;
});

// Função para apagar desenhos - APENAS DESENHOS, NÃO O MAPA
function eraseDrawingsAt(x, y) {
    const eraseRadius = brushSize * 3; // Raio de apagamento
    let somethingErased = false;
    
    drawings = drawings.filter(drawing => {
        // Verificar se algum ponto do desenho está próximo ao cursor
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
        // Re-enviar todos os desenhos restantes
        drawings.forEach(d => emitDrawingUpdate(d));
    }
}

function redrawDrawings() {
    drawCtx.clearRect(0, 0, drawingCanvas.width, drawingCanvas.height);
    
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

function clearDrawings() {
    if (confirm('Limpar todos os desenhos?')) {
        drawings = [];
        redrawDrawings();
        socket.emit('clear_drawings', { session_id: SESSION_ID });
        showToast('Desenhos limpos!');
    }
}

// --------------------
// MAP & TOKENS
// --------------------
function redrawMap() {
    mapCtx.clearRect(0, 0, mapCanvas.width, mapCanvas.height);
    
    // Desenhar imagem do mapa
    if (mapImage) {
        mapCtx.drawImage(mapImage, 0, 0, mapCanvas.width, mapCanvas.height);
    }

    // Desenhar grid
    if (gridVisible) drawMapGrid();

    // Desenhar tokens (maiores e com borda fina)
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
            mapCtx.fillStyle = token.color;
            mapCtx.beginPath();
            mapCtx.arc(token.x, token.y, TOKEN_RADIUS, 0, Math.PI * 2);
            mapCtx.fill();
        }
        
        // Borda fina
        mapCtx.strokeStyle = "#fff";
        mapCtx.lineWidth = TOKEN_BORDER;
        mapCtx.beginPath();
        mapCtx.arc(token.x, token.y, TOKEN_RADIUS, 0, Math.PI * 2);
        mapCtx.stroke();
        
        // Nome
        mapCtx.fillStyle = "#fff";
        mapCtx.font = "bold 13px Lato";
        mapCtx.textAlign = "center";
        mapCtx.strokeStyle = "#000";
        mapCtx.lineWidth = 3;
        mapCtx.strokeText(token.name, token.x, token.y + TOKEN_RADIUS + 18);
        mapCtx.fillText(token.name, token.x, token.y + TOKEN_RADIUS + 18);

        // Destaque se selecionado
        if (token === selectedToken) {
            mapCtx.strokeStyle = "#ffc107";
            mapCtx.lineWidth = 3;
            mapCtx.beginPath();
            mapCtx.arc(token.x, token.y, TOKEN_RADIUS + 5, 0, Math.PI * 2);
            mapCtx.stroke();
        }
    });
}

function drawMapGrid() {
    mapCtx.strokeStyle = gridColor;
    mapCtx.globalAlpha = gridOpacity;
    mapCtx.lineWidth = 1;
    
    for (let x = 0; x <= mapCanvas.width; x += gridSize) {
        mapCtx.beginPath();
        mapCtx.moveTo(x, 0);
        mapCtx.lineTo(x, mapCanvas.height);
        mapCtx.stroke();
    }
    
    for (let y = 0; y <= mapCanvas.height; y += gridSize) {
        mapCtx.beginPath();
        mapCtx.moveTo(0, y);
        mapCtx.lineTo(mapCanvas.width, y);
        mapCtx.stroke();
    }
    
    mapCtx.globalAlpha = 1;
}

// --------------------
// MAP CONTROLS
// --------------------
function loadMapImage(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(ev) {
        const img = new Image();
        img.onload = function() {
            mapImage = img;
            redrawMap();
            showToast("Mapa carregado!");
            
            // Compartilhar com jogadores
            socket.emit('map_update', {
                session_id: SESSION_ID,
                mapData: ev.target.result
            });
        };
        img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
}

function updateGrid() {
    gridSize = parseInt(document.getElementById('gridSize').value);
    gridColor = document.getElementById('gridColor').value;
    gridOpacity = document.getElementById('gridOpacity').value / 100;
    redrawMap();
}

function toggleGrid() {
    gridVisible = !gridVisible;
    redrawMap();
}

// --------------------
// TOKENS
// --------------------
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
                x: mapCanvas.width / 2,
                y: mapCanvas.height / 2,
                image: e.target.result
            };
            tokens.push(newToken);
            renderTokenList();
            redrawMap();
            emitTokenUpdate();
            closeTokenModal();
            showToast(`Token "${name}" adicionado!`);
        };
        reader.readAsDataURL(imageInput.files[0]);
    } else {
        const newToken = {
            id: Date.now(),
            name: name,
            x: mapCanvas.width / 2,
            y: mapCanvas.height / 2,
            color: '#' + Math.floor(Math.random() * 16777215).toString(16)
        };
        tokens.push(newToken);
        renderTokenList();
        redrawMap();
        emitTokenUpdate();
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
        item.onclick = () => selectTokenFromList(token);
        
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

function selectTokenFromList(token) {
    selectedToken = token;
    document.querySelectorAll('.token-item').forEach(i => i.classList.remove('active'));
    event.currentTarget.classList.add('active');
    redrawMap();
}

function deleteToken(tokenId) {
    if (confirm('Remover este token?')) {
        tokens = tokens.filter(t => t.id !== tokenId);
        selectedToken = null;
        renderTokenList();
        redrawMap();
        emitTokenUpdate();
        showToast('Token removido!');
    }
}

// --------------------
// INTERAÇÃO COM TOKENS - CORRIGIDO
// --------------------
mapCanvas.addEventListener('click', (e) => {
    if (currentTool !== 'select') return;
    
    const coords = getCanvasCoordinates(mapCanvas, e);
    let clicked = false;
    
    tokens.forEach(t => {
        if (Math.hypot(t.x - coords.x, t.y - coords.y) <= TOKEN_RADIUS) {
            selectedToken = t;
            clicked = true;
        }
    });
    
    if (!clicked) selectedToken = null;
    redrawMap();
});

mapCanvas.addEventListener('mousedown', (e) => {
    if (currentTool !== 'select') return;
    
    const coords = getCanvasCoordinates(mapCanvas, e);
    
    tokens.forEach(t => {
        if (Math.hypot(t.x - coords.x, t.y - coords.y) <= TOKEN_RADIUS) {
            draggedToken = t;
            isDraggingToken = true;
            mapCanvas.style.cursor = 'grabbing';
        }
    });
});

mapCanvas.addEventListener('mousemove', (e) => {
    if (draggedToken && currentTool === 'select' && isDraggingToken) {
        const coords = getCanvasCoordinates(mapCanvas, e);
        draggedToken.x = coords.x;
        draggedToken.y = coords.y;
        redrawMap();
    } else if (currentTool === 'select' && !isDraggingToken) {
        // Mudar cursor quando passar sobre token
        const coords = getCanvasCoordinates(mapCanvas, e);
        let overToken = false;
        
        tokens.forEach(t => {
            if (Math.hypot(t.x - coords.x, t.y - coords.y) <= TOKEN_RADIUS) {
                overToken = true;
            }
        });
        
        mapCanvas.style.cursor = overToken ? 'grab' : 'default';
    }
});

mapCanvas.addEventListener('mouseup', () => {
    if (draggedToken) {
        emitTokenUpdate();
        draggedToken = null;
        isDraggingToken = false;
        mapCanvas.style.cursor = 'grab';
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Delete' && selectedToken) {
        deleteToken(selectedToken.id);
    }
});

// --------------------
// OUTROS CONTROLES
// --------------------
function zoom(delta) {
    scale = Math.max(0.5, Math.min(2, scale + delta));
    mapCanvas.style.transform = `scale(${scale})`;
    drawingCanvas.style.transform = `scale(${scale})`;
    showToast(`Zoom: ${Math.round(scale * 100)}%`);
}

function clearMap() {
    if (confirm("Tem certeza que deseja limpar o mapa?")) {
        mapImage = null;
        tokens = [];
        selectedToken = null;
        drawings = [];
        redrawMap();
        redrawDrawings();
        emitTokenUpdate();
        socket.emit('clear_drawings', { session_id: SESSION_ID });
        showToast("Mapa limpo!");
    }
}

function copyShareLink() {
    const link = `${window.location.origin}/player-view/${SESSION_ID}`;
    navigator.clipboard.writeText(link);
    showToast("Link copiado!");
}

// --------------------
// TOAST
// --------------------
function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// --------------------
// REDIMENSIONAMENTO
// --------------------
window.addEventListener('resize', () => {
    w = mapCanvas.width = drawingCanvas.width = window.innerWidth - 320;
    h = mapCanvas.height = drawingCanvas.height = window.innerHeight - 70;
    redrawMap();
    redrawDrawings();
});

// Inicialização
redrawMap();
renderTokenList();