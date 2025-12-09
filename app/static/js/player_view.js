// PLAYER VIEW - PARTE 1 - INICIALIZAÇÃO E WEBSOCKETS
const socket = io();
const SESSION_ID = document.getElementById('sessionId').value;

const CANVAS_WIDTH = 2000;
const CANVAS_HEIGHT = 2000;

let playerName = '';
let playerId = null;
let permissions = { moveTokens: [], draw: false };

// SCENES
let playerVisibleScenes = [];
let currentPlayerSceneContent = null;

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
let loadedImages = new Map();

let selectedItem = null;
let selectedType = null;

// Grid
let gridEnabled = true;
let gridSize = 50;
let gridColor = 'rgba(155, 89, 182, 0.3)';

let middleMousePressed = false;

// Undo/Redo
let playerHistory = [];
let playerHistoryIndex = -1;
const MAX_PLAYER_HISTORY = 30;


// Debounced socket emits
const debouncedPlayerTokenUpdate = CanvasOptimizer.debounce((tokens) => {
    socket.emit('token_update', {
        session_id: SESSION_ID,
        tokens: tokens
    });
}, 150);

let isPlayerDrawing = false;

// ==========================================
// PERSISTÊNCIA DO JOGADOR
// ==========================================

function savePlayerSession() {
    if (!SESSION_ID || !playerId) return;
    
    const playerData = {
        playerId: playerId,
        playerName: playerName,
        timestamp: Date.now()
    };
    
    localStorage.setItem('rpg_player_' + SESSION_ID, JSON.stringify(playerData));
    console.log('💾 Dados do jogador salvos');
}

function loadPlayerSession() {
    if (!SESSION_ID) return null;
    
    const data = localStorage.getItem('rpg_player_' + SESSION_ID);
    
    if (data) {
        const parsed = JSON.parse(data);
        console.log('✅ Dados do jogador carregados:', parsed.playerName);
        return parsed;
    }
    
    return null;
}

// ==========================================
// SISTEMA DE DADOS COMPARTILHADO - VERSÃO DISCRETA
// ==========================================
const SharedDiceSystem = {
    container: null,
    isShowing: false,
    hideTimeout: null,
    
    init() {
        // Criar container se não existir
        if (!this.container) {
            this.container = document.createElement('div');
            this.container.className = 'dice-notification';
            this.container.id = 'diceNotification';
            this.container.innerHTML = `
                <div class="dice-notif-icon">🎲</div>
                <div class="dice-notif-header">
                    <div class="dice-notif-roller">
                        <div class="dice-notif-avatar" id="diceNotifAvatar"></div>
                        <div class="dice-notif-name" id="diceNotifName"></div>
                    </div>
                    <button class="dice-notif-close" onclick="SharedDiceSystem.hide()">×</button>
                </div>
                <div class="dice-notif-result">
                    <div class="dice-notif-label">RESULTADO</div>
                    <div class="dice-notif-value" id="diceNotifValue">0</div>
                    <div class="dice-notif-formula" id="diceNotifFormula"></div>
                </div>
            `;
            document.body.appendChild(this.container);
        }
    },
    
    show(data) {
        this.init();
        
        // Se já está mostrando, esconder primeiro
        if (this.isShowing) {
            this.hide();
            setTimeout(() => this.show(data), 400);
            return;
        }
        
        console.log('🎲 Exibindo rolagem:', data);
        
        this.isShowing = true;
        
        // Limpar timeout anterior
        if (this.hideTimeout) {
            clearTimeout(this.hideTimeout);
        }
        
        // Resetar classes
        this.container.className = 'dice-notification';
        
        // Adicionar classe especial
        if (data.is_critical) {
            this.container.classList.add('critical-success');
        } else if (data.is_failure) {
            this.container.classList.add('critical-failure');
        }
        
        // Preencher dados
        const avatar = document.getElementById('diceNotifAvatar');
        const name = document.getElementById('diceNotifName');
        const value = document.getElementById('diceNotifValue');
        const formula = document.getElementById('diceNotifFormula');
        
        avatar.textContent = data.roller_name.charAt(0).toUpperCase();
        name.textContent = data.roller_name;
        value.textContent = data.result;
        formula.textContent = data.formula;
        
        // Mostrar
        setTimeout(() => {
            this.container.classList.add('show');
        }, 10);
        
        // Auto-hide após 5 segundos
        this.hideTimeout = setTimeout(() => {
            this.hide();
        }, 5000);
    },
    
    hide() {
        if (!this.isShowing) return;
        
        this.container.classList.add('hiding');
        this.container.classList.remove('show');
        
        setTimeout(() => {
            this.container.classList.remove('hiding');
            this.isShowing = false;
        }, 400);
    }
};

function openPlayerDiceRoller() {
    const dice = prompt('🎲 Qual dado rolar?\n\nd4, d6, d8, d10, d12, d20, d100');
    
    if (!dice) return;
    
    const sides = parseInt(dice.replace('d', ''));
    
    if (isNaN(sides) || sides < 2) {
        alert('Dado inválido!');
        return;
    }
    
    rollPlayerDice(sides);
}

function rollPlayerDice(sides) {
    const result = Math.floor(Math.random() * sides) + 1;
    const isCritical = sides === 20 && result === 20;
    const isFail = sides === 20 && result === 1;
    
    // Broadcast
    socket.emit('roll_shared_dice', {
        session_id: SESSION_ID,
        roller_name: playerName,
        dice_type: `d${sides}`,
        result: result,
        formula: `1d${sides}`,
        is_critical: isCritical,
        is_failure: isFail
    });
}

// Adicionar fadeOut ao estilo
const style = document.createElement('style');
style.textContent = `
    @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
    }
`;
document.head.appendChild(style);

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

// ==========================================
// SISTEMA DE DADOS DO JOGADOR
// ==========================================

let playerDiceHistory = [];

function togglePlayerDicePanel() {
    const panel = document.getElementById('playerDicePanel');
    if (panel.style.display === 'none' || !panel.style.display) {
        panel.style.display = 'flex';
    } else {
        panel.style.display = 'none';
    }
}

function rollPlayerDice(sides) {
    const result = Math.floor(Math.random() * sides) + 1;
    const isCritical = sides === 20 && result === 20;
    const isFail = sides === 20 && result === 1;
    
    // Mostrar resultado local
    const resultDiv = document.getElementById('playerDiceResult');
    resultDiv.textContent = result;
    resultDiv.style.opacity = '0';
    resultDiv.style.transform = 'scale(0.8)';
    
    setTimeout(() => {
        resultDiv.style.transition = 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';
        resultDiv.style.opacity = '1';
        resultDiv.style.transform = 'scale(1)';
        
        if (isCritical) {
            resultDiv.style.borderColor = '#fbbf24';
            resultDiv.style.color = '#fbbf24';
            resultDiv.style.background = 'linear-gradient(135deg, rgba(251, 191, 36, 0.15), rgba(245, 158, 11, 0.1))';
            showToast('🎉 CRÍTICO!');
        } else if (isFail) {
            resultDiv.style.borderColor = '#ef4444';
            resultDiv.style.color = '#ef4444';
            resultDiv.style.background = 'linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(220, 38, 38, 0.1))';
            showToast('💀 FALHA CRÍTICA!');
        } else {
            resultDiv.style.borderColor = '#10b981';
            resultDiv.style.color = '#10b981';
            resultDiv.style.background = 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(5, 150, 105, 0.05))';
        }
    }, 10);
    
    // Adicionar ao histórico
    addPlayerDiceToHistory(`1d${sides}`, result, isCritical, isFail);
    
    // Broadcast para todos
    socket.emit('roll_shared_dice', {
        session_id: SESSION_ID,
        roller_name: playerName,
        dice_type: `d${sides}`,
        result: result,
        formula: `1d${sides}`,
        is_critical: isCritical,
        is_failure: isFail
    });
    
    console.log('🎲 [PLAYER] Dado rolado:', { sides, result, playerName });
}

function rollPlayerCustomDice() {
    const count = parseInt(document.getElementById('playerCustomDiceCount')?.value) || 1;
    const sides = parseInt(document.getElementById('playerCustomDiceSides')?.value) || 20;
    const modifier = parseInt(document.getElementById('playerCustomDiceModifier')?.value) || 0;
    
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
    
    const isCrit = sides === 20 && count === 1 && rolls[0] === 20;
    const isFail = sides === 20 && count === 1 && rolls[0] === 1;
    
    // Mostrar resultado local
    const resultDiv = document.getElementById('playerDiceResult');
    resultDiv.textContent = total;
    resultDiv.style.opacity = '0';
    resultDiv.style.transform = 'scale(0.8)';
    
    setTimeout(() => {
        resultDiv.style.transition = 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';
        resultDiv.style.opacity = '1';
        resultDiv.style.transform = 'scale(1)';
        
        if (isCrit) {
            resultDiv.style.borderColor = '#fbbf24';
            resultDiv.style.color = '#fbbf24';
            resultDiv.style.background = 'linear-gradient(135deg, rgba(251, 191, 36, 0.15), rgba(245, 158, 11, 0.1))';
            showToast('🎉 CRÍTICO!');
        } else if (isFail) {
            resultDiv.style.borderColor = '#ef4444';
            resultDiv.style.color = '#ef4444';
            resultDiv.style.background = 'linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(220, 38, 38, 0.1))';
            showToast('💀 FALHA CRÍTICA!');
        } else {
            resultDiv.style.borderColor = '#10b981';
            resultDiv.style.color = '#10b981';
            resultDiv.style.background = 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(5, 150, 105, 0.05))';
        }
    }, 10);
    
    // Adicionar ao histórico
    addPlayerDiceToHistory(formula, total, isCrit, isFail, breakdown);
    
    // Broadcast para todos
    socket.emit('roll_shared_dice', {
        session_id: SESSION_ID,
        roller_name: playerName,
        dice_type: `d${sides}`,
        result: total,
        formula: formula,
        is_critical: isCrit,
        is_failure: isFail
    });
    
    console.log('🎲 [PLAYER] Dado customizado rolado:', { formula, total, playerName });
}

function addPlayerDiceToHistory(formula, result, isCrit, isFail, breakdown = '') {
    const timestamp = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    
    playerDiceHistory.unshift({
        formula,
        result,
        isCrit,
        isFail,
        breakdown,
        timestamp
    });
    
    if (playerDiceHistory.length > 30) {
        playerDiceHistory = playerDiceHistory.slice(0, 30);
    }
    
    renderPlayerDiceHistory();
}

function renderPlayerDiceHistory() {
    const historyList = document.getElementById('playerDiceHistoryList');
    if (!historyList) return;
    
    if (playerDiceHistory.length === 0) {
        historyList.innerHTML = '<div class="empty-state" style="text-align: center; padding: 20px; color: #666; font-size: 0.8125rem;">Nenhuma rolagem ainda</div>';
        return;
    }
    
    historyList.innerHTML = playerDiceHistory.map(item => {
        let resultClass = '';
        let icon = '🎲';
        
        if (item.isCrit) {
            resultClass = 'style="color: #fbbf24; font-weight: bold;"';
            icon = '⭐';
        } else if (item.isFail) {
            resultClass = 'style="color: #e74c3c; font-weight: bold;"';
            icon = '💀';
        }
        
        return `
            <div style="padding: 10px; background: rgba(16,16,30,0.6); border-radius: 6px; border: 1px solid rgba(155,89,182,0.2); margin-bottom: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                    <strong style="color: #c49bdb; font-size: 0.875rem;">${icon} ${item.formula}</strong>
                    <span ${resultClass} style="font-size: 0.875rem;">${item.result}</span>
                </div>
                ${item.breakdown ? `<div style="font-size: 0.75rem; color: #888;">${item.breakdown}</div>` : ''}
                <div style="font-size: 0.7rem; color: #666; margin-top: 4px;">${item.timestamp}</div>
            </div>
        `;
    }).join('');
}

function clearPlayerDiceHistory() {
    if (confirm('Limpar histórico de dados?')) {
        playerDiceHistory = [];
        renderPlayerDiceHistory();
        showToast('Histórico limpo');
    }
}

// ==========================================
// REMOVER FUNÇÃO ANTIGA
// ==========================================
// Remover a função openPlayerDiceRoller() antiga se existir

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
    savePlayerSession();
    
    document.getElementById('playerNameDisplay').textContent = playerName;
    document.getElementById('loginOverlay').classList.add('hidden');
    
    console.log('✅ Jogador fazendo login:', playerName, playerId);
    
    socket.emit('player_join', {
        session_id: SESSION_ID,
        player_id: playerId,
        player_name: playerName
    });

    setTimeout(() => {
        console.log('🔄 [PLAYER] Solicitando cena atual...');
        socket.emit('request_current_scene', {
            session_id: SESSION_ID,
            player_id: playerId
        });
    }, 500);
    
    showToast(`Bem-vindo, ${playerName}!`);
});

document.getElementById('playerNameInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') document.getElementById('loginBtn').click();
});

// ========== WEBSOCKET ==========
socket.on('connect', () => {
    console.log('✅ Conectado');
    updateStatus(true);
    SharedDiceSystem.init();
    
    if (playerId && playerName) {
        console.log('🔄 Solicitando cena atual...');
        socket.emit('request_current_scene', {
            session_id: SESSION_ID,
            player_id: playerId
        });
    }
});

socket.on('disconnect', () => {
    console.log('❌ Desconectado');
    updateStatus(false);
});

socket.on('session_state', (data) => {
    console.log('📦 Estado da sessão recebido:', data);
    
    loadedImages = {};
    
    maps = data.maps || [];
    entities = data.entities || [];
    tokens = data.tokens || [];
    drawings = data.drawings || [];
    
    preloadAllImages();
    drawGrid();
    
    setTimeout(() => {
        redrawAll();
        redrawDrawings();
    }, 100);
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
        tokens: data.tokens
    });
    
    if (!data.tokens || data.tokens.length === 0) {
        console.warn('⚠️ [JOGADOR] Nenhum token recebido');
        tokens = [];
        redrawAll();
        return;
    }
    
    tokens = data.tokens;
    console.log('✅ [JOGADOR] Tokens atualizados:', tokens.length);
    
    // ✅ Preload e redesenhar
    window.requestAnimationFrame(() => {
        preloadAllImages();
        setTimeout(() => {
            redrawAll();
            console.log('✅ [JOGADOR] Canvas redesenhado');
        }, 100);
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

socket.on('fog_state_sync', (data) => {
    console.log('🌫️ [JOGADOR] Fog state recebido');
    
    if (data.fog_image) {
        loadFogStatePlayer(data.fog_image);
    } else {
        fogCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }
});

socket.on('drawing_sync', (data) => {
    console.log('✏️ [PLAYER] Novo desenho recebido');
    drawings.push(data.drawing);
    redrawDrawings();
});

socket.on('drawings_cleared', () => {
    console.log('🧹 [PLAYER] Desenhos limpos');
    drawings = [];
    drawCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    redrawDrawings();
});

function loadFogStatePlayer(imageData) {
    console.log('🌫️ [PLAYER] Carregando névoa');
    
    const fogCanvas = document.getElementById('fogCanvas');
    const fogCtx = fogCanvas.getContext('2d');
    
    if (!imageData) {
        console.log('✨ [PLAYER] Sem névoa - limpando');
        fogCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        return;
    }
    
    const img = new Image();
    img.onload = () => {
        console.log('✅ [PLAYER] Névoa carregada - aplicando');
        fogCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        fogCtx.drawImage(img, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        
        // ✅ Forçar opacidade total no canvas
        fogCanvas.style.opacity = '1';
        
        console.log('✅ [PLAYER] Névoa aplicada (100% opaca)');
    };
    img.onerror = () => {
        console.error('❌ [PLAYER] Erro ao carregar névoa');
        fogCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    };
    img.src = imageData;
}

socket.on('scene_activated', (data) => {
    console.log('🎬 [PLAYER] Cena ativada:', data.scene?.name);
    
    if (!data.scene) {
        console.error('❌ [PLAYER] Dados da cena inválidos');
        return;
    }
    
    const scene = data.scene;
    
    // ✅ VERIFICAR se playerId está definido
    if (!playerId) {
        console.error('❌ [PLAYER] playerId não definido ainda');
        return;
    }
    
    // ✅ VERIFICAR permissão
    const visiblePlayers = scene.visible_to_players || [];
    const hasPermission = visiblePlayers.includes(playerId);
    
    console.log('🎬 [PLAYER] Verificação de permissão:', {
        playerId: playerId,
        visiblePlayers: visiblePlayers,
        hasPermission: hasPermission
    });
    
    // ✅ SE NÃO TEM PERMISSÃO - Bloquear
    if (!hasPermission) {
        console.log('🚫 [PLAYER] SEM permissão - bloqueando acesso');
        
        // Limpar tudo
        maps = [];
        entities = [];
        tokens = [];
        drawings = [];
        loadedImages = {};
        
        mapCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        drawCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        fogCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        
        showBlockedScreen(scene.name);
        showToast('🚫 Acesso negado a esta cena');
        return;
    }
    
    // ✅ TEM PERMISSÃO - Carregar conteúdo
    console.log('✅ [PLAYER] COM permissão - carregando cena');
    hideBlockedScreen();
    
    // Limpar estado anterior
    maps = [];
    entities = [];
    tokens = [];
    drawings = [];
    loadedImages = {};
    
    mapCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    drawCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    fogCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // ✅ Carregar dados da cena (DEEP COPY para evitar referências)
    maps = JSON.parse(JSON.stringify(scene.maps || []));
    entities = JSON.parse(JSON.stringify(scene.entities || []));
    tokens = JSON.parse(JSON.stringify(scene.tokens || []));
    drawings = JSON.parse(JSON.stringify(scene.drawings || []));
    
    console.log('📦 Conteúdo carregado:', {
        maps: maps.length,
        entities: entities.length,
        tokens: tokens.length,
        drawings: drawings.length,
        hasFog: !!scene.fog_image
    });
    loadedImages.clear();
    console.log('🧹 Cache de imagens limpo');
    
    // ✅ Carregar névoa
    if (scene.fog_image) {
        console.log('🌫️ [PLAYER] Carregando névoa da cena');
        loadFogStatePlayer(scene.fog_image);
    } else {
        console.log('✨ [PLAYER] Cena sem névoa');
        fogCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }
    
    // ✅ Renderizar
    preloadAllImages();
    
    setTimeout(() => {
        redrawAll();
        redrawDrawings();
        showToast(`📍 ${scene.name}`);
        console.log('✅ [PLAYER] Cena renderizada');
    }, 200);
});

// ✅ NOVO HANDLER - Cena bloqueada
socket.on('scene_blocked', (data) => {
    console.log('🚫 [PLAYER] Acesso bloqueado à cena:', data.scene_name);
    
    // ✅ Limpar tudo
    maps = [];
    entities = [];
    tokens = [];
    drawings = [];
    loadedImages = {};
    
    mapCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    drawCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    fogCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // ✅ Mostrar tela de bloqueio
    showBlockedScreen(data.scene_name);
    showToast('🚫 Você não tem acesso a esta cena');
});

// ✅ NOVO HANDLER - Sem cena ativa
socket.on('no_active_scene', () => {
    console.log('ℹ️ [PLAYER] Nenhuma cena ativa');
    
    maps = [];
    entities = [];
    tokens = [];
    drawings = [];
    loadedImages = {};
    
    mapCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    drawCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    fogCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    showBlockedScreen('Aguardando...');
});

// ========== FOG OF WAR ==========


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

socket.on('dice_rolled_shared', (data) => {
    console.log('🎲 [PLAYER] Dado rolado:', data);
    SharedDiceSystem.show(data);
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

    // ✅ Preload mapas
    if (maps && Array.isArray(maps)) {
        maps.forEach(img => {
            if (img.image && !loadedImages.has(img.id)) {
                imagesToLoad++;
                const i = new Image();
                i.onload = () => {
                    loadedImages.set(img.id, i);
                    checkAllLoaded();
                };
                i.onerror = () => {
                    console.error('Erro ao carregar mapa:', img.id);
                    checkAllLoaded();
                };
                i.src = img.image;
            }
        });
    }

    // ✅ Preload entities
    if (entities && Array.isArray(entities)) {
        entities.forEach(img => {
            if (img.image && !loadedImages.has(img.id)) {
                imagesToLoad++;
                const i = new Image();
                i.onload = () => {
                    loadedImages.set(img.id, i);
                    checkAllLoaded();
                };
                i.onerror = () => {
                    console.error('Erro ao carregar entidade:', img.id);
                    checkAllLoaded();
                };
                i.src = img.image;
            }
        });
    }
    
    // ✅ Preload tokens
    if (tokens && Array.isArray(tokens)) {
        tokens.forEach(token => {
            if (token.image && !loadedImages.has(token.id)) {
                imagesToLoad++;
                const i = new Image();
                i.onload = () => {
                    loadedImages.set(token.id, i);
                    checkAllLoaded();
                };
                i.onerror = () => {
                    console.error('Erro ao carregar token:', token.id);
                    checkAllLoaded();
                };
                i.src = token.image;
            }
        });
    }

    // ✅ Se não há imagens, redesenhar mesmo assim
    if (imagesToLoad === 0) {
        console.log('ℹ️ Nenhuma imagem para carregar');
        redrawAll();
    } else {
        console.log(`📦 Carregando ${imagesToLoad} imagens...`);
    }
}

// PLAYER VIEW - PARTE 2 - RENDER, MOUSE E CHAT (FINAL)

// ==================
// RENDER OTIMIZADO
// ==================

function redrawAll() {
    CanvasOptimizer.scheduleRedraw(() => {
        isPlayerDrawing = true;
        
        mapCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        
        // ✅ Desenhar mapas
        if (maps && Array.isArray(maps)) {
            maps.forEach(img => {
                const loadedImg = loadedImages.get(img.id);
                
                if (loadedImg && loadedImg.complete && loadedImg.naturalWidth > 0) {
                    try {
                        CanvasOptimizer.optimizeImageDraw(
                            mapCtx, 
                            loadedImg, 
                            img.x, 
                            img.y, 
                            img.width, 
                            img.height
                        );
                    } catch (e) {
                        console.error('Erro ao desenhar mapa:', e);
                    }
                }
            });
        }
        
        // ✅ Desenhar entidades
        if (entities && Array.isArray(entities)) {
            entities.forEach(img => {
                const loadedImg = loadedImages.get(img.id);
                
                if (loadedImg && loadedImg.complete && loadedImg.naturalWidth > 0) {
                    try {
                        CanvasOptimizer.optimizeImageDraw(
                            mapCtx, 
                            loadedImg, 
                            img.x, 
                            img.y, 
                            img.width, 
                            img.height
                        );
                    } catch (e) {
                        console.error('Erro ao desenhar entidade:', e);
                    }
                }
            });
        }
        
        // ✅ Desenhar tokens
        if (tokens && Array.isArray(tokens)) {
            tokens.forEach(token => {
                const img = loadedImages.get(token.id);
                
                if (token.style === 'square' && img && img.complete && img.naturalWidth > 0) {
                    try {
                        const tokenSize = TOKEN_RADIUS * 1.8;
                        CanvasOptimizer.optimizeImageDraw(
                            mapCtx,
                            img,
                            token.x - tokenSize/2,
                            token.y - tokenSize/2,
                            tokenSize,
                            tokenSize
                        );
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
                        
                        CanvasOptimizer.optimizeImageDraw(
                            mapCtx,
                            img,
                            token.x - TOKEN_RADIUS,
                            token.y - TOKEN_RADIUS,
                            TOKEN_RADIUS * 2,
                            TOKEN_RADIUS * 2
                        );
                        
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
                    // Token sem imagem (apenas cor)
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
                
                // Nome do token
                mapCtx.fillStyle = "#fff";
                mapCtx.font = "bold 11px Lato";
                mapCtx.textAlign = "center";
                mapCtx.strokeStyle = "#000";
                mapCtx.lineWidth = 2.5;
                
                const nameY = token.style === 'square' ? token.y + TOKEN_RADIUS * 1.8 / 2 + 15 : token.y + TOKEN_RADIUS + 15;
                mapCtx.strokeText(token.name, token.x, nameY);
                mapCtx.fillText(token.name, token.x, nameY);
            });
        }
        
        isPlayerDrawing = false;
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
    
    // Se está em modo desenho, não fazer nada aqui
    if (permissions.draw && (drawTool === 'draw' || drawTool === 'erase')) {
        return;
    }
    
    // Tentar pegar token primeiro
    const token = findTokenAt(pos.x, pos.y);
    if (token) {
        draggingToken = token;
        dragOffsetX = pos.x - token.x;
        dragOffsetY = pos.y - token.y;
        canvasWrapper.style.cursor = 'grabbing';
        return;
    }
    
    // Se não pegou token, fazer pan
    isPanning = true;
    startPanX = e.clientX - panX;
    startPanY = e.clientY - panY;
    canvasWrapper.style.cursor = 'grabbing';
});

canvasWrapper.addEventListener('mousemove', (e) => {
    const pos = getMousePos(e);
    
    // Se está em modo desenho, não fazer nada aqui
    if (permissions.draw && (drawTool === 'draw' || drawTool === 'erase')) {
        return;
    }
    
    // Se está arrastando token
    if (draggingToken) {
        draggingToken.x = pos.x - dragOffsetX;
        draggingToken.y = pos.y - dragOffsetY;
        redrawAll();
        return;
    }
    
    // Se está fazendo pan
    if (isPanning) {
        panX = e.clientX - startPanX;
        panY = e.clientY - startPanY;
        applyTransform();
        return;
    }
    
    // Hover: mostrar cursor apropriado
    const token = findTokenAt(pos.x, pos.y);
    if (token) {
        canvasWrapper.style.cursor = 'grab';
    } else {
        canvasWrapper.style.cursor = 'default';
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
    
    // Restaurar cursor padrão
    if (permissions.draw && drawTool === 'draw') {
        canvasWrapper.style.cursor = 'crosshair';
    } else if (permissions.draw && drawTool === 'erase') {
        canvasWrapper.style.cursor = 'not-allowed';
    } else {
        canvasWrapper.style.cursor = 'default';
    }
});

canvasWrapper.addEventListener('mouseleave', () => {
    isPanning = false;
    draggingToken = null;
});

// ========== DESENHO ==========
function updateDrawingTools() {
    const tools = document.getElementById('drawingTools');
    
    // ✅ VERIFICAR SE EXISTE
    if (!tools) {
        console.warn('⚠️ drawingTools não encontrado');
        return;
    }
    
    if (permissions.draw) {
        tools.classList.add('show');
        setDrawTool('draw');
    } else {
        tools.classList.remove('show');
        
        // ✅ VERIFICAR SE EXISTEM
        const drawingCanvas = document.getElementById('drawingCanvas');
        const canvasWrapper = document.getElementById('canvasWrapper');
        
        if (drawingCanvas) drawingCanvas.classList.remove('drawing-mode');
        if (canvasWrapper) canvasWrapper.classList.remove('drawing-mode');
    }
}

function setDrawTool(tool) {
    drawTool = tool;
    
    document.querySelectorAll('.drawing-tools .tool-btn').forEach(btn => btn.classList.remove('active'));
    
    // ✅ CORRIGIDO - Verificar se event existe
    if (window.event && window.event.target) {
        window.event.target.classList.add('active');
    } else {
        // Caso seja chamado programaticamente, ativar o primeiro botão
        const firstBtn = document.querySelector('.drawing-tools .tool-btn');
        if (firstBtn) firstBtn.classList.add('active');
    }
    
    const drawingCanvas = document.getElementById('drawingCanvas');
    const canvasWrapper = document.getElementById('canvasWrapper');
    
    if (!drawingCanvas || !canvasWrapper) return;
    
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

// ==================
// SISTEMA DE UNDO/REDO - PLAYER
// ==================

function savePlayerState(action) {
    if (!permissions.draw) return;
    
    if (playerHistoryIndex < playerHistory.length - 1) {
        playerHistory = playerHistory.slice(0, playerHistoryIndex + 1);
    }
    
    const state = {
        action: action,
        drawings: JSON.parse(JSON.stringify(drawings))
    };
    
    playerHistory.push(state);
    playerHistoryIndex++;
    
    if (playerHistory.length > MAX_PLAYER_HISTORY) {
        playerHistory.shift();
        playerHistoryIndex--;
    }
}

function playerUndo() {
    if (!permissions.draw || playerHistoryIndex <= 0) {
        showToast('⚠️ Nada para desfazer');
        return;
    }
    
    playerHistoryIndex--;
    const state = playerHistory[playerHistoryIndex];
    
    drawings = JSON.parse(JSON.stringify(state.drawings));
    redrawDrawings();
    
    // Sincronizar
    socket.emit('clear_drawings', { session_id: SESSION_ID });
    drawings.forEach(d => {
        socket.emit('drawing_update', {
            session_id: SESSION_ID,
            drawing: d
        });
    });
    
    showToast('↩️ Desfeito');
}

function playerRedo() {
    if (!permissions.draw || playerHistoryIndex >= playerHistory.length - 1) {
        showToast('⚠️ Nada para refazer');
        return;
    }
    
    playerHistoryIndex++;
    const state = playerHistory[playerHistoryIndex];
    
    drawings = JSON.parse(JSON.stringify(state.drawings));
    redrawDrawings();
    
    // Sincronizar
    socket.emit('clear_drawings', { session_id: SESSION_ID });
    drawings.forEach(d => {
        socket.emit('drawing_update', {
            session_id: SESSION_ID,
            drawing: d
        });
    });
    
    showToast('↪️ Refeito');
}

// Atalhos
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        playerUndo();
    }
    
    if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'z')) {
        e.preventDefault();
        playerRedo();
    }
});

// Modificar o mouseup de desenho:
drawingCanvas.addEventListener('mouseup', () => {
    if (isDrawing && currentPath.length > 0) {
        // ... código existente ...
        
        // ADICIONAR:
        savePlayerState('Desenhar');
    }
    isDrawing = false;
});

// ========== CHAT ==========
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

// ✅ NOVAS FUNÇÕES - Tela de bloqueio
function showBlockedScreen(sceneName) {
    // Criar overlay se não existir
    let overlay = document.getElementById('blockedOverlay');
    
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'blockedOverlay';
        overlay.style.cssText = `
            position: fixed;
            inset: 0;
            background: linear-gradient(135deg, rgba(10, 10, 15, 0.98), rgba(5, 5, 10, 0.98));
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            backdrop-filter: blur(10px);
        `;
        
        overlay.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <div style="font-size: 5rem; margin-bottom: 20px; animation: pulse 2s infinite;">🚫</div>
                <h2 style="color: #e74c3c; font-family: 'Merriweather', serif; font-size: 2rem; margin-bottom: 15px;">
                    Acesso Restrito
                </h2>
                <p style="color: #bbb; font-size: 1.2rem; margin-bottom: 10px;" id="blockedSceneName">
                    Cena: ${sceneName}
                </p>
                <p style="color: #888; font-size: 0.95rem; max-width: 400px;">
                    Você não tem permissão para visualizar esta cena.<br>
                    Aguarde o Mestre liberar o acesso.
                </p>
            </div>
            <style>
                @keyframes pulse {
                    0%, 100% { opacity: 1; transform: scale(1); }
                    50% { opacity: 0.7; transform: scale(1.1); }
                }
            </style>
        `;
        
        document.body.appendChild(overlay);
    } else {
        overlay.style.display = 'flex';
        document.getElementById('blockedSceneName').textContent = `Cena: ${sceneName}`;
    }
    
    console.log('🚫 Tela de bloqueio ativada');
}

function hideBlockedScreen() {
    const overlay = document.getElementById('blockedOverlay');
    if (overlay) {
        overlay.style.display = 'none';
        console.log('✅ Tela de bloqueio removida');
    }
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
    const savedPlayer = loadPlayerSession();
    
    if (savedPlayer && savedPlayer.playerName) {
        // Auto-preencher nome
        const input = document.getElementById('playerNameInput');
        if (input) {
            input.value = savedPlayer.playerName;
            input.focus();
        }
        
        showToast('✅ Bem-vindo de volta, ' + savedPlayer.playerName + '!');
    }
});

document.addEventListener('DOMContentLoaded', () => {
    const chatContainer = document.getElementById('chatContainer');
    if (chatContainer) {
        chatContainer.classList.add('minimized');
        const icon = document.getElementById('chatMinimizeIcon');
        if (icon) icon.textContent = '▲';
    }
    const savedPlayer = loadPlayerSession();
    
    if (savedPlayer && savedPlayer.playerName) {
        // Auto-preencher nome
        const input = document.getElementById('playerNameInput');
        if (input) {
            input.value = savedPlayer.playerName;
            input.focus();
        }
        
        showToast('✅ Bem-vindo de volta, ' + savedPlayer.playerName + '!');
    }
});

function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// ========== INIT ==========
function initializePlayerView() {
    console.log('🎬 [PLAYER] Inicializando visualização...');
    
    // Configurar canvas
    currentScale = 0.5;
    centerCanvas();
    drawGrid();
    
    // Limpar tudo
    mapCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    drawCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    fogCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    console.log('✅ [PLAYER] View inicializada');
}

// ✅ Aguardar DOM e scripts carregarem
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(initializePlayerView, 200);
    });
} else {
    setTimeout(initializePlayerView, 200);
}

window.addEventListener('resize', () => {
    centerCanvas();
});