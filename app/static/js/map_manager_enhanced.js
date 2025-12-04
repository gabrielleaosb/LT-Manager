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

// Configurar contextos para performance
mapCtx.imageSmoothingEnabled = false;
drawCtx.imageSmoothingEnabled = true;
drawCtx.imageSmoothingQuality = 'high';

// Otimizações de rendering
drawingCanvas.style.willChange = 'contents';
mapCanvas.style.willChange = 'transform';

mapCanvas.width = gridCanvas.width = drawingCanvas.width = CANVAS_WIDTH;
mapCanvas.height = gridCanvas.height = drawingCanvas.height = CANVAS_HEIGHT;

let maps = [];          
let entities = [];      
let images = [];
let tokens = [];
let drawings = [];
let players = [];
let scenes = [];         

// FOG OF WAR - 
let fogAreas = [];       
let fogOpacity = 1.0;    
let fogBrushSize = 100;
let fogBrushShape = 'circle';
let fogDrawingActive = false;
let fogPaintMode = false;
let fogEraseMode = false;
let lastFogPoint = null;

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

// Pan temporário com espaço
let middleMousePressed = false;
let tempPanning = false;
let spacePressed = false;  // ✅ ADICIONADO

// Undo/Redo
let sceneHistories = {}; 
let currentSceneHistory = { history: [], index: -1 };
const MAX_HISTORY = 50;

// Scene Manager
let currentSceneId = null;  // ✅ ADICIONADO

// Sistema de buffer para desenho suave
let drawingBuffer = null;
let drawingBufferCtx = null;
let isCurrentlyDrawingPath = false;
let drawingFrameRequest = null;

// ==========================================
// OTIMIZAÇÕES DE PERFORMANCE
// ==========================================

// Debounced socket emits
const debouncedTokenUpdate = CanvasOptimizer.debounce((tokens) => {
    socket.emit('token_update', {
        session_id: SESSION_ID,
        tokens: tokens
    });
}, 150);

const debouncedMapUpdate = CanvasOptimizer.debounce((mapId, mapData) => {
    socket.emit('update_map', {
        session_id: SESSION_ID,
        map_id: mapId,
        map: mapData
    });
}, 150);

const debouncedEntityUpdate = CanvasOptimizer.debounce((entityId, entityData) => {
    socket.emit('update_entity', {
        session_id: SESSION_ID,
        entity_id: entityId,
        entity: entityData
    });
}, 150);

// Flag para controlar redraw
let isCurrentlyDrawing = false;

// ==========================================
// GERENCIADOR DE FERRAMENTAS
// ==========================================
const ToolManager = {
    deactivateAll() {
        console.log('🔄 Desativando todas as ferramentas');
        
        // Fog
        window.fogPaintMode = false;
        window.fogEraseMode = false;
        
        // Drawing
        window.currentTool = 'select';
        
        // Remover classes ativas
        document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
        
        // Limpar cursores e classes
        const drawingCanvas = document.getElementById('drawingCanvas');
        const canvasWrapper = document.getElementById('canvasWrapper');
        const fogCanvas = document.getElementById('fogCanvas');
        
        if (drawingCanvas) {
            drawingCanvas.classList.remove('drawing-mode');
            drawingCanvas.style.cursor = 'default';
        }
        
        if (canvasWrapper) {
            canvasWrapper.classList.remove('drawing-mode');
            canvasWrapper.style.cursor = 'default';
        }
        
        if (fogCanvas) {
            fogCanvas.classList.remove('fog-drawing-mode');
            fogCanvas.style.cursor = 'default';
        }
    }
};

// ==========================================
// SISTEMA DE DADOS COMPARTILHADO - PREMIUM
// ==========================================
const SharedDiceSystem = {
    overlay: null,
    isShowing: false,
    hideTimeout: null,
    
    init() {
        this.overlay = document.getElementById('sharedDiceOverlay');
        
        if (this.overlay) {
            // Remover listener antigo se existir
            this.overlay.replaceWith(this.overlay.cloneNode(true));
            this.overlay = document.getElementById('sharedDiceOverlay');
            
            this.overlay.addEventListener('click', () => {
                this.hide();
            });
        }
    },
    
    show(data) {
        if (this.isShowing) {
            this.hide();
            setTimeout(() => this.show(data), 600);
            return;
        }
        
        console.log('🎲 Exibindo rolagem premium:', data);
        
        this.isShowing = true;
        const overlay = this.overlay;
        
        // Limpar timeout anterior
        if (this.hideTimeout) {
            clearTimeout(this.hideTimeout);
        }
        
        // Resetar classes
        overlay.className = 'dice-roll-overlay show';
        
        // Nome do jogador
        const rollerNameEl = document.getElementById('diceRollerName');
        rollerNameEl.textContent = `${data.roller_name} rolou os dados`;
        
        // Valor do dado
        const diceFaceValue = document.getElementById('diceFaceValue');
        diceFaceValue.textContent = data.result;
        
        // Adicionar classe especial
        if (data.is_critical) {
            overlay.classList.add('critical-success');
        } else if (data.is_failure) {
            overlay.classList.add('critical-failure');
        }
        
        // Criar partículas suaves
        this.createSmoothParticles();
        
        // Resultado (aparece depois da animação)
        setTimeout(() => {
            const resultEl = document.getElementById('sharedDiceResult');
            const formulaEl = document.getElementById('sharedDiceFormula');
            
            resultEl.textContent = data.result;
            formulaEl.textContent = data.formula;
            
            // Efeito sonoro visual (opcional)
            if (data.is_critical || data.is_failure) {
                this.createBurst();
            }
        }, 2200);
        
        // Auto-hide após 6 segundos
        this.hideTimeout = setTimeout(() => {
            this.hide();
        }, 6000);
    },
    
    hide() {
        if (!this.isShowing) return;
        
        const overlay = this.overlay;
        
        // Adicionar classe de saída
        overlay.classList.add('hiding');
        
        setTimeout(() => {
            overlay.classList.remove('show', 'hiding', 'critical-success', 'critical-failure');
            this.isShowing = false;
            
            // Limpar partículas
            const particlesContainer = document.getElementById('diceParticles');
            if (particlesContainer) {
                particlesContainer.innerHTML = '';
            }
        }, 500);
    },
    
    createSmoothParticles() {
        const container = document.getElementById('diceParticles');
        if (!container) return;
        
        container.innerHTML = '';
        
        // Criar 40 partículas com movimento suave
        for (let i = 0; i < 40; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle';
            
            // Posição inicial aleatória
            particle.style.left = Math.random() * 100 + '%';
            particle.style.bottom = '0';
            
            // Drift aleatório (movimento horizontal)
            const driftStart = (Math.random() - 0.5) * 100;
            const driftEnd = driftStart + (Math.random() - 0.5) * 200;
            
            particle.style.setProperty('--drift-start', driftStart + 'px');
            particle.style.setProperty('--drift-end', driftEnd + 'px');
            
            // Delay aleatório
            particle.style.animationDelay = Math.random() * 3 + 's';
            
            container.appendChild(particle);
        }
    },
    
    createBurst() {
        const container = document.getElementById('diceParticles');
        if (!container) return;
        
        // Criar burst de partículas no centro
        for (let i = 0; i < 20; i++) {
            const burst = document.createElement('div');
            burst.className = 'particle';
            burst.style.left = '50%';
            burst.style.top = '50%';
            burst.style.width = '8px';
            burst.style.height = '8px';
            
            const angle = (Math.PI * 2 * i) / 20;
            const distance = 100 + Math.random() * 100;
            const endX = Math.cos(angle) * distance;
            const endY = Math.sin(angle) * distance;
            
            burst.style.setProperty('--drift-start', '0px');
            burst.style.setProperty('--drift-end', endX + 'px');
            burst.style.animation = `burstParticle 1s ease-out forwards`;
            burst.style.transform = `translate(-50%, -50%)`;
            
            container.appendChild(burst);
            
            // Remover após animação
            setTimeout(() => burst.remove(), 1000);
        }
    }
};

// Adicionar animação de burst
const burstStyle = document.createElement('style');
burstStyle.textContent = `
    @keyframes burstParticle {
        0% {
            opacity: 1;
            transform: translate(-50%, -50%) translate(0, 0) scale(1);
        }
        100% {
            opacity: 0;
            transform: translate(-50%, -50%) translate(var(--drift-end), var(--drift-end)) scale(0);
        }
    }
`;
document.head.appendChild(burstStyle);

// ==========================================
// DEBUG: MOSTRAR INFO DA SESSÃO
// ==========================================

console.log('🔍 SESSION_ID atual:', SESSION_ID);
console.log('🔍 Verificando localStorage para:', SESSION_ID);

const savedState = localStorage.getItem('rpg_session_state_' + SESSION_ID);
if (savedState) {
    console.log('✅ DADOS ENCONTRADOS no localStorage');
    const parsed = JSON.parse(savedState);
    console.log('📊 Dados salvos:', {
        images: parsed.images?.length || 0,
        tokens: parsed.tokens?.length || 0,
        drawings: parsed.drawings?.length || 0,
        timestamp: new Date(parsed.timestamp).toLocaleString()
    });
} else {
    console.log('❌ NENHUM DADO no localStorage para esta sessão');
}

// Função de auto-save (executa a cada 10 segundos)]

let autoSaveInterval = null;
let isSaving = false;

function startAutoSave() {
    if (autoSaveInterval) {
        clearInterval(autoSaveInterval);
    }
    
    // Auto-save a cada 30 segundos
    autoSaveInterval = setInterval(() => {
        saveCurrentState();
    }, 30000);
    
    console.log('✅ Auto-save ativado (30s)');
}

async function saveCurrentState() {
    if (!SESSION_ID || isSaving) {
        return;
    }
    
    isSaving = true;
    console.log('💾 Salvando estado atual...');
    
    try {
        // Montar estado COMPLETO
        const state = {
            images: images,
            tokens: tokens,
            drawings: drawings,
            fogImage: fogCanvas.toDataURL('image/jpeg', 0.7),
            scenes: scenes,
            grid_settings: {
                enabled: gridEnabled,
                size: gridSize,
                color: gridColor,
                lineWidth: gridLineWidth
            },
            timestamp: Date.now()
        };
        
        // Salvar no banco
        const success = await PersistenceManager.saveSession(SESSION_ID, state);
        
        if (success) {
            updateStorageIndicator();
        } else {
            showToast('⚠️ Erro ao salvar');
        }
        
    } catch (error) {
        console.error('❌ Erro ao salvar:', error);
    } finally {
        isSaving = false;
    }
}

async function loadSavedState() {
    if (!SESSION_ID) return false;
    
    console.log('📂 Carregando estado salvo...');
    
    try {
        // ✅ CORRIGIDO: Usar loadSession ao invés de loadSessionState
        const savedData = await PersistenceManager.loadSession(SESSION_ID);
        
        if (!savedData) {
            console.log('ℹ️ Sem dados salvos');
            return false;
        }
        
        // Restaurar estado
        images = savedData.images || [];
        tokens = savedData.tokens || [];
        drawings = savedData.drawings || [];
        scenes = savedData.scenes || [];
        
        if (savedData.grid_settings) {
            gridEnabled = savedData.grid_settings.enabled;
            gridSize = savedData.grid_settings.size;
            gridColor = savedData.grid_settings.color;
            gridLineWidth = savedData.grid_settings.lineWidth;
        }
        
        if (savedData.fogImage) {
            loadFogState(savedData.fogImage);
        }
        
        // Renderizar
        preloadAllImages();
        renderImageList();
        renderTokenList();
        renderScenesList();
        drawGrid();
        
        setTimeout(() => {
            redrawAll();
            redrawDrawings();
        }, 200);
        
        showToast('✅ Sessão restaurada!');
        
        // ✅ Verificar se tem cenas
        if (scenes && scenes.length > 0) {
            hasCreatedScene = true;
            localStorage.setItem('rpg_has_scene_' + SESSION_ID, 'true');
        }
        
        return true;
        
    } catch (error) {
        console.error('❌ Erro ao carregar:', error);
        return false;
    }
}

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

    // ✅ CORRIGIDO - Usar images ao invés de maps/entities
    images.forEach(img => {
        if (img.image && !loadedImages.has(img.id)) {
            imagesToLoad++;
            const i = new Image();
            i.onload = () => {
                loadedImages.set(img.id, i);
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

    if (imagesToLoad === 0) {
        redrawAll();
    }
}

// ==================
// WEBSOCKET EVENTS - CORRIGIDO COM REDRAW SEMPRE
// ==================

socket.on('connect', () => {
    console.log('✅ Conectado ao servidor');
   
     SharedDiceSystem.init();
    loadSavedState().then(wasRestored => {
        if (wasRestored) {
            console.log('♻️ Estado restaurado');
        }
        
        socket.emit('join_session', { session_id: SESSION_ID });
        startAutoSave();

        setTimeout(() => {
            initializeSceneSystem();
        }, 1500);
    });
});

socket.on('session_state', (data) => {
    console.log('📦 Estado da sessão recebido do servidor:', data);
    
    // ✅ CORRIGIDO: Usar await com async
    (async () => {
        const localState = await PersistenceManager.loadSession(SESSION_ID);
        
        if (localState && localState.images && localState.images.length > 0) {
            console.log('⚠️ Já temos dados locais, ignorando estado vazio do servidor');
            return;
        }
        
        // Se não tem dados locais, usar dados do servidor
        maps = data.maps || [];
        entities = data.entities || [];
        images = [...maps, ...entities];
        
        tokens = data.tokens || [];
        drawings = data.drawings || [];
        
        scenes = data.scenes || [];
        renderScenesList();
        console.log('🎬 Cenas carregadas:', scenes.length);
        
        preloadAllImages();
        drawGrid();
        renderImageList();
        renderTokenList();
        
        setTimeout(() => {
            redrawAll();
            redrawDrawings();
        }, 100);
        
        // ✅ Verificar cenas para o sistema obrigatório
        if (scenes && scenes.length > 0) {
            console.log('✅ Cenas encontradas no servidor:', scenes.length);
            hasCreatedScene = true;
            localStorage.setItem('rpg_has_scene_' + SESSION_ID, 'true');
            
            if (sceneCreationOverlay) {
                sceneCreationOverlay.remove();
                sceneCreationOverlay = null;
            }
        }
    })();
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
    // ✅ NÃO limpar fog aqui
    console.log('✅ Maps sync completo - fog preservado');
});

socket.on('entities_sync', (data) => {
    console.log('🎭 ENTITIES SYNC recebido:', data);
    const entities = data.entities || [];
    const maps = images.filter(img => img.id.startsWith('map_'));
    images = [...maps, ...entities];
    preloadAllImages();
    renderImageList();
    redrawAll();
    // ✅ NÃO limpar fog aqui
    console.log('✅ Entities sync completo - fog preservado');
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
        // ✅ NÃO limpar fog aqui
        console.log('✅ [MESTRE] Canvas redesenhado após token_sync - fog preservado');
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

socket.on('fog_state_sync', (data) => {
    console.log('🌫️ Fog state recebido');
    if (data.fog_image) {
        loadFogState(data.fog_image);
    } else {
        fogCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }
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
});

// Inicializar buffer
function initDrawingBuffer() {
    if (!drawingBuffer) {
        drawingBuffer = document.createElement('canvas');
        drawingBuffer.width = CANVAS_WIDTH;
        drawingBuffer.height = CANVAS_HEIGHT;
        drawingBufferCtx = drawingBuffer.getContext('2d', {
            alpha: true,
            desynchronized: true  // Performance hint
        });
        console.log('✅ Buffer de desenho criado');
    }
}

initDrawingBuffer();

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
    console.log('🔧 Ativando ferramenta:', tool);
    
    // ✅ DESATIVAR TUDO PRIMEIRO
    ToolManager.deactivateAll();
    
    // Ativar ferramenta selecionada
    currentTool = tool;
    
    // Remover active de todos
    document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
    
    // Ativar botão clicado
    if (typeof event !== 'undefined' && event.target) {
        event.target.classList.add('active');
    }
    
    const canvasWrapper = document.querySelector('.canvas-wrapper');
    const drawingCanvas = document.getElementById('drawingCanvas');
    
    // Aplicar modo específico
    if (tool === 'draw') {
        drawingCanvas.classList.add('drawing-mode');
        canvasWrapper.classList.add('drawing-mode');
        canvasWrapper.style.cursor = 'crosshair';
    } else if (tool === 'erase') {
        drawingCanvas.classList.add('drawing-mode');
        canvasWrapper.classList.add('drawing-mode');
        canvasWrapper.style.cursor = 'not-allowed';
    } else {
        canvasWrapper.style.cursor = 'default';
    }
    
    console.log('✅ Ferramenta ativada:', tool);
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
// RENDER OTIMIZADO
// ==================

function redrawAll() {
    if (isCurrentlyDrawingPath) {
        return;
    }
    CanvasOptimizer.scheduleRedraw(() => {
        isCurrentlyDrawing = true;
        mapCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        
        // Desenhar imagens com otimização
        images.forEach(img => {
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
                    
                    // Seleção
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
        
        // Desenhar tokens
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
        
        isCurrentlyDrawing = false;
    });
}

function redrawDrawings() {
    // ✅ Usar requestAnimationFrame
    requestAnimationFrame(() => {
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

// ==================
// EVENTOS DE MOUSE - CORRIGIDO
// ==================

// ==================
// EVENTOS DE MOUSE - CORRIGIDO COM PRIORIDADES
// ==================

let isDraggingItem = false;
let mouseDownOnCanvas = false;

canvasWrapper.addEventListener('mousedown', (e) => {
    const pos = getMousePos(e);

    if (fogPaintMode || fogEraseMode) {
        console.log('🚫 Bloqueado: modo fog ativo');
        return;
    }
    
    if (e.button === 1) {
        e.preventDefault();
        middleMousePressed = true;
        tempPanning = true;
        isPanning = true;
        startPanX = e.clientX - panX;
        startPanY = e.clientY - panY;
        canvasWrapper.style.cursor = 'grabbing';
        return;
    }
    
    // Prioridade 2: Modo fog (não interferir)
    if (fogPaintMode || fogEraseMode) {
        return;
    }
    
    // Prioridade 3: Modo desenho (não interferir)
    if (currentTool === 'draw' || currentTool === 'erase') {
        return;
    }
    
    // Prioridade 4: Modo select
    if (currentTool === 'select') {
        const found = findItemAt(pos.x, pos.y);
        
        // 4a. Verificar resize de imagem
        if (found && found.type === 'image' && isOnResizeHandle(found.item, pos.x, pos.y)) {
            resizingImage = found.item;
            resizeStartX = pos.x;
            resizeStartY = pos.y;
            resizeStartWidth = found.item.width;
            resizeStartHeight = found.item.height;
            canvasWrapper.style.cursor = 'nwse-resize';
            mouseDownOnCanvas = true;
            e.preventDefault();
            e.stopPropagation();
            return;
        }
        
        // 4b. Verificar drag de item
        if (found) {
            selectedItem = found.item;
            selectedType = found.type;
            draggingItem = found.item;
            isDraggingItem = true;
            mouseDownOnCanvas = true;
            
            dragOffsetX = pos.x - found.item.x;
            dragOffsetY = pos.y - found.item.y;
            
            canvasWrapper.style.cursor = 'grabbing';
            e.preventDefault();
            e.stopPropagation();
            redrawAll();
            return;
        } else {
            // 4c. Clique no vazio = desselecionar
            selectedItem = null;
            selectedType = null;
            redrawAll();
        }
    }
});

canvasWrapper.addEventListener('mousemove', (e) => {
    // Throttle do movimento do mouse
    CanvasOptimizer.throttleMouse(() => {
        const pos = getMousePos(e);
        
        // Pan temporário
        if (tempPanning && isPanning) {
            panX = e.clientX - startPanX;
            panY = e.clientY - startPanY;
            applyTransform();
            return;
        }
        
        // Modo fog ou desenho - não interferir
        if (fogPaintMode || fogEraseMode || currentTool === 'draw' || currentTool === 'erase') {
            return;
        }
        
        // Resize de imagem
        if (resizingImage && mouseDownOnCanvas) {
            const deltaX = pos.x - resizeStartX;
            const deltaY = pos.y - resizeStartY;
            
            resizingImage.width = Math.max(50, resizeStartWidth + deltaX);
            resizingImage.height = Math.max(50, resizeStartHeight + deltaY);
            
            // Redesenhar com otimização
            if (!isCurrentlyDrawing) {
                redrawAll();
            }
            
            e.preventDefault();
            e.stopPropagation();
            return;
        }
        
        // Arrastar item
        if (isDraggingItem && draggingItem && mouseDownOnCanvas) {
            const newX = pos.x - dragOffsetX;
            const newY = pos.y - dragOffsetY;
            
            draggingItem.x = newX;
            draggingItem.y = newY;
            
            // Redesenhar com otimização
            if (!isCurrentlyDrawing) {
                redrawAll();
            }
            
            e.preventDefault();
            e.stopPropagation();
            return;
        }
        
        // Atualizar cursor no modo select
        if (currentTool === 'select' && !mouseDownOnCanvas && !isDraggingItem) {
            const found = findItemAt(pos.x, pos.y);
            if (found && found.type === 'image' && isOnResizeHandle(found.item, pos.x, pos.y)) {
                canvasWrapper.style.cursor = 'nwse-resize';
            } else if (found) {
                canvasWrapper.style.cursor = 'grab';
            } else {
                canvasWrapper.style.cursor = 'default';
            }
        }
    });
});

canvasWrapper.addEventListener('mouseup', (e) => {
    // Pan temporário
    if (e.button === 1) {
        middleMousePressed = false;
        tempPanning = false;
        isPanning = false;
        
        const indicator = document.getElementById('panIndicator');
        if (indicator) {
            indicator.style.display = 'none';
        }
        
        canvasWrapper.style.cursor = 'default';
        mouseDownOnCanvas = false;
        return;
    }
    
    // Resize
    if (resizingImage) {
        if (resizingImage.id.startsWith('map_')) {
            debouncedMapUpdate(resizingImage.id, resizingImage);
        } else {
            debouncedEntityUpdate(resizingImage.id, resizingImage);
        }
        resizingImage = null;
        canvasWrapper.style.cursor = 'default';
        mouseDownOnCanvas = false;
        return;
    }
    
    // Arrastar item
    if (isDraggingItem && draggingItem && mouseDownOnCanvas) {
        if (selectedType === 'image') {
            if (draggingItem.id.startsWith('map_')) {
                debouncedMapUpdate(draggingItem.id, draggingItem);
            } else {
                debouncedEntityUpdate(draggingItem.id, draggingItem);
            }
        } else if (selectedType === 'token') {
            debouncedTokenUpdate(tokens);
        }
        saveState(selectedType === 'image' ? 'Mover Imagem' : 'Mover Token');
        
        isDraggingItem = false;
        draggingItem = null;
        mouseDownOnCanvas = false;
        canvasWrapper.style.cursor = 'default';
        return;
    }
    
    mouseDownOnCanvas = false;
    canvasWrapper.style.cursor = 'default';
});

canvasWrapper.addEventListener('mouseleave', () => {
    if (isDraggingItem && draggingItem && mouseDownOnCanvas) {
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
    resizingImage = null;
    isDraggingItem = false;
    draggingItem = null;
    mouseDownOnCanvas = false;
});

// MAP MANAGER - PARTE 3 - DESENHO, ADICIONAR ITENS E CHAT

// ==================
// DESENHO LIVRE - TOTALMENTE REESCRITO
// ==================

function getDrawingPos(e) {
    const rect = drawingCanvas.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    return { x, y };
}

// ✅ NOVO: Renderizar preview em tempo real
function renderDrawingPreview() {
    if (!isCurrentlyDrawingPath || currentPath.length < 2) return;
    
    // Limpar buffer
    drawingBufferCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // Configurar estilo
    drawingBufferCtx.strokeStyle = drawingColor;
    drawingBufferCtx.lineWidth = brushSize;
    drawingBufferCtx.lineCap = 'round';
    drawingBufferCtx.lineJoin = 'round';
    
    // Desenhar path suavizado
    drawingBufferCtx.beginPath();
    drawingBufferCtx.moveTo(currentPath[0].x, currentPath[0].y);
    
    // Usar curvas quadráticas para suavização
    for (let i = 1; i < currentPath.length - 1; i++) {
        const xc = (currentPath[i].x + currentPath[i + 1].x) / 2;
        const yc = (currentPath[i].y + currentPath[i + 1].y) / 2;
        drawingBufferCtx.quadraticCurveTo(currentPath[i].x, currentPath[i].y, xc, yc);
    }
    
    // Último ponto
    if (currentPath.length > 1) {
        const last = currentPath[currentPath.length - 1];
        drawingBufferCtx.lineTo(last.x, last.y);
    }
    
    drawingBufferCtx.stroke();
    
    // Copiar buffer para canvas principal
    drawCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // Redesenhar desenhos existentes
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
    
    // Sobrepor preview
    drawCtx.drawImage(drawingBuffer, 0, 0);
}

// ✅ NOVO: Throttle para adicionar pontos
let lastPointTime = 0;
const POINT_INTERVAL = 8; // ms entre pontos (125 FPS max)

function addDrawingPoint(x, y) {
    const now = performance.now();
    
    if (now - lastPointTime < POINT_INTERVAL) {
        return false;
    }
    
    // Calcular distância do último ponto
    if (currentPath.length > 0) {
        const lastPoint = currentPath[currentPath.length - 1];
        const dist = Math.hypot(x - lastPoint.x, y - lastPoint.y);
        
        // Ignorar pontos muito próximos
        if (dist < 2) {
            return false;
        }
    }
    
    currentPath.push({ x, y });
    lastPointTime = now;
    return true;
}

// ✅ NOVO: Loop de animação dedicado para desenho
function scheduleDrawingRender() {
    if (drawingFrameRequest) {
        cancelAnimationFrame(drawingFrameRequest);
    }
    
    drawingFrameRequest = requestAnimationFrame(() => {
        renderDrawingPreview();
        drawingFrameRequest = null;
    });
}

drawingCanvas.addEventListener('mousedown', (e) => {
    if (e.button === 1) {
        return;
    }
    
    if (currentTool === 'draw') {
        e.preventDefault();
        e.stopPropagation();
        
        isDrawing = true;
        isCurrentlyDrawingPath = true;
        
        const pos = getDrawingPos(e);
        currentPath = [pos];
        lastPointTime = performance.now();
        
        // Primeira renderização
        scheduleDrawingRender();
        
    } else if (currentTool === 'erase') {
        e.preventDefault();
        e.stopPropagation();
        
        isDrawing = true;
        const pos = getDrawingPos(e);
        eraseDrawingsAt(pos.x, pos.y);
    }
});

drawingCanvas.addEventListener('mousemove', (e) => {
    if (!isDrawing) return;
    
    if (currentTool === 'draw') {
        e.preventDefault();
        e.stopPropagation();
        
        const pos = getDrawingPos(e);
        
        // Adicionar ponto com throttle
        if (addDrawingPoint(pos.x, pos.y)) {
            // Agendar renderização
            scheduleDrawingRender();
        }
        
    } else if (currentTool === 'erase') {
        e.preventDefault();
        e.stopPropagation();
        
        const pos = getDrawingPos(e);
        eraseDrawingsAt(pos.x, pos.y);
    }
});

drawingCanvas.addEventListener('mouseup', () => {
    if (isDrawing && currentPath.length > 0 && currentTool === 'draw') {
        // Cancelar animação pendente
        if (drawingFrameRequest) {
            cancelAnimationFrame(drawingFrameRequest);
            drawingFrameRequest = null;
        }
        
        isCurrentlyDrawingPath = false;
        
        // Simplificar path (remover pontos redundantes)
        const simplifiedPath = simplifyPath(currentPath, 2);
        
        const drawing = {
            id: Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            path: simplifiedPath,
            color: drawingColor,
            size: brushSize
        };
        
        drawings.push(drawing);
        
        // ✅ Renderizar final
        redrawDrawings();
        
        // ✅ ENVIAR PARA O SERVIDOR (apenas no final)
        socket.emit('drawing_update', {
            session_id: SESSION_ID,
            drawing: drawing
        });
        
        currentPath = [];
        saveState('Desenhar');
        
        console.log('✏️ Desenho finalizado:', simplifiedPath.length, 'pontos');
    }
    
    isDrawing = false;
    isCurrentlyDrawingPath = false;
});

drawingCanvas.addEventListener('mouseleave', () => {
    if (isDrawing && currentPath.length > 0 && currentTool === 'draw') {
        // Cancelar animação
        if (drawingFrameRequest) {
            cancelAnimationFrame(drawingFrameRequest);
            drawingFrameRequest = null;
        }
        
        isCurrentlyDrawingPath = false;
        
        const simplifiedPath = simplifyPath(currentPath, 2);
        
        const drawing = {
            id: Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            path: simplifiedPath,
            color: drawingColor,
            size: brushSize
        };
        
        drawings.push(drawing);
        redrawDrawings();
        
        socket.emit('drawing_update', {
            session_id: SESSION_ID,
            drawing: drawing
        });
        
        currentPath = [];
        saveState('Desenhar');
    }
    
    isDrawing = false;
    isCurrentlyDrawingPath = false;
});

// ✅ NOVO: Simplificar path (algoritmo Ramer-Douglas-Peucker simplificado)
function simplifyPath(points, tolerance = 2) {
    if (points.length <= 2) return points;
    
    const simplified = [points[0]];
    
    for (let i = 1; i < points.length - 1; i++) {
        const prev = simplified[simplified.length - 1];
        const curr = points[i];
        const next = points[i + 1];
        
        // Calcular distância perpendicular
        const dist = perpendicularDistance(curr, prev, next);
        
        if (dist > tolerance) {
            simplified.push(curr);
        }
    }
    
    simplified.push(points[points.length - 1]);
    
    console.log(`📉 Path simplificado: ${points.length} → ${simplified.length} pontos`);
    return simplified;
}

function perpendicularDistance(point, lineStart, lineEnd) {
    const dx = lineEnd.x - lineStart.x;
    const dy = lineEnd.y - lineStart.y;
    
    if (dx === 0 && dy === 0) {
        return Math.hypot(point.x - lineStart.x, point.y - lineStart.y);
    }
    
    const t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / (dx * dx + dy * dy);
    
    let closestX, closestY;
    
    if (t < 0) {
        closestX = lineStart.x;
        closestY = lineStart.y;
    } else if (t > 1) {
        closestX = lineEnd.x;
        closestY = lineEnd.y;
    } else {
        closestX = lineStart.x + t * dx;
        closestY = lineStart.y + t * dy;
    }
    
    return Math.hypot(point.x - closestX, point.y - closestY);
}

function eraseDrawingsAt(x, y) {
    const eraseRadius = brushSize * 5;
    let changed = false;
    
    const newDrawings = [];
    
    drawings.forEach(drawing => {
        const hasPointInRadius = drawing.path.some(point => {
            const dist = Math.hypot(point.x - x, point.y - y);
            return dist < eraseRadius;
        });
        
        if (!hasPointInRadius) {
            newDrawings.push(drawing);
        } else {
            changed = true;
        }
    });
    
    if (changed) {
        drawings = newDrawings;
        redrawDrawings();
    }
}

function clearDrawings() {
    if (confirm('Limpar todos os desenhos?')) {
        drawings = [];
        redrawDrawings();
        socket.emit('clear_drawings', { session_id: SESSION_ID });
        showToast('Desenhos limpos!');
        saveState('Limpar Desenhos');
    }
}

// ==================
// FOG CANVAS EVENTS
// ==================

// Inicializar fog canvas vazio
function toggleFogPaintMode() {
    console.log('🌫️ Toggle Fog Paint');
    
    if (fogPaintMode) {
        // Desativar
        ToolManager.deactivateAll();
        showToast('🌫️ Modo névoa desativado');
        return;
    }
    
    // ✅ DESATIVAR TUDO PRIMEIRO
    ToolManager.deactivateAll();
    
    // Ativar fog paint
    fogPaintMode = true;
    fogEraseMode = false;
    
    document.getElementById('fogPaintBtn')?.classList.add('active');
    
    const fogCanvas = document.getElementById('fogCanvas');
    const canvasWrapper = document.querySelector('.canvas-wrapper');
    
    fogCanvas.classList.add('fog-drawing-mode');
    fogCanvas.style.cursor = 'crosshair';
    canvasWrapper.style.cursor = 'crosshair';
    
    showToast('🌫️ Modo: Pintar Névoa');
}

// Ativar modo de apagar névoa
function toggleFogEraseMode() {
    console.log('✨ Toggle Fog Erase');
    
    if (fogEraseMode) {
        // Desativar
        ToolManager.deactivateAll();
        showToast('✨ Modo névoa desativado');
        return;
    }
    
    // ✅ DESATIVAR TUDO PRIMEIRO
    ToolManager.deactivateAll();
    
    // Ativar fog erase
    fogEraseMode = true;
    fogPaintMode = false;
    
    document.getElementById('fogEraseBtn')?.classList.add('active');
    
    const fogCanvas = document.getElementById('fogCanvas');
    const canvasWrapper = document.querySelector('.canvas-wrapper');
    
    fogCanvas.classList.add('fog-drawing-mode');
    fogCanvas.style.cursor = 'not-allowed';
    canvasWrapper.style.cursor = 'not-allowed';
    
    showToast('✨ Modo: Apagar Névoa');
}

// Definir forma do pincel
function setFogBrushShape(shape) {
    fogBrushShape = shape;
    document.querySelectorAll('.fog-shape-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
}

// Atualizar tamanho do pincel
function setFogBrushSize(size) {
    fogBrushSize = parseInt(size);
    document.getElementById('fogBrushSizeValue').textContent = fogBrushSize + 'px';
}

// Desenhar névoa com pincel
function paintFog(x, y, erase = false) {
    fogCtx.globalCompositeOperation = erase ? 'destination-out' : 'source-over';
    
    if (fogBrushShape === 'circle') {
        fogCtx.fillStyle = erase ? 'rgba(255, 255, 255, 1)' : 'rgba(0, 0, 0, 0.9)';
        fogCtx.beginPath();
        fogCtx.arc(x, y, fogBrushSize / 2, 0, Math.PI * 2);
        fogCtx.fill();
    } else if (fogBrushShape === 'square') {
        fogCtx.fillStyle = erase ? 'rgba(255, 255, 255, 1)' : 'rgba(0, 0, 0, 0.9)';
        fogCtx.fillRect(
            x - fogBrushSize / 2,
            y - fogBrushSize / 2,
            fogBrushSize,
            fogBrushSize
        );
    }
    
    fogCtx.globalCompositeOperation = 'source-over';
}

// Interpolar entre dois pontos para pincel suave
function interpolateFogPaint(x1, y1, x2, y2, erase) {
    const dist = Math.hypot(x2 - x1, y2 - y1);
    const steps = Math.max(1, Math.floor(dist / 5));
    
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = x1 + (x2 - x1) * t;
        const y = y1 + (y2 - y1) * t;
        paintFog(x, y, erase);
    }
}

// Salvar estado do fog
function saveFogState() {
    const imageData = fogCanvas.toDataURL();
    
    console.log('🌫️ [MESTRE] Salvando fog state');
    
    socket.emit('update_fog_state', {
        session_id: SESSION_ID,
        fog_image: imageData
    });
}

function loadFogState(imageData) {
    if (!imageData) {
        fogCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        return;
    }
    
    const img = new Image();
    img.onload = () => {
        fogCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        fogCtx.drawImage(img, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        console.log('✅ Fog carregado no mestre');
    };
    img.onerror = () => {
        console.error('❌ Erro ao carregar fog');
    };
    img.src = imageData;
}

// Limpar toda a névoa
function clearAllFog() {
    if (confirm('Remover toda a névoa do mapa?')) {
        fogCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        
        socket.emit('clear_fog_state', {
            session_id: SESSION_ID
        });
        
        showToast('Névoa removida!');
    }
}

// Cobrir todo o mapa com névoa
function coverAllWithFog() {
    if (confirm('Cobrir todo o mapa com névoa?')) {
        fogCtx.fillStyle = 'rgba(0, 0, 0, 0.9)';
        fogCtx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        
        saveFogState();
        showToast('Mapa coberto com névoa!');
    }
}

// Eventos do fog canvas - CORRIGIDO
fogCanvas.addEventListener('mousedown', (e) => {
    // Verificar se está em modo fog
    if (!fogPaintMode && !fogEraseMode) {
        return;
    }
    
    if (spacePressed) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const rect = fogCanvas.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    fogDrawingActive = true;
    lastFogPoint = { x, y };
    
    paintFog(x, y, fogEraseMode);
});

fogCanvas.addEventListener('mousemove', (e) => {
    if (!fogDrawingActive) return;
    if (spacePressed) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    const rect = fogCanvas.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    if (lastFogPoint) {
        interpolateFogPaint(lastFogPoint.x, lastFogPoint.y, x, y, fogEraseMode);
    }
    
    lastFogPoint = { x, y };
});

fogCanvas.addEventListener('mouseup', () => {
    if (fogDrawingActive) {
        fogDrawingActive = false;
        lastFogPoint = null;
        saveFogState();
    }
});

fogCanvas.addEventListener('mouseleave', () => {
    fogDrawingActive = false;
    lastFogPoint = null;
});

function clearDrawings() {
    if (confirm('Limpar todos os desenhos?')) {
        drawings = [];
        redrawDrawings();
        socket.emit('clear_drawings', { session_id: SESSION_ID });
        showToast('Desenhos limpos!');
        saveState('Limpar Desenhos');
    }
}

// ==================
// ADICIONAR IMAGEM
// ==================

function addImage() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {  // ✅ ASYNC
        const file = e.target.files[0];
        if (!file) return;
        
        const name = prompt('Nome da imagem:', file.name.replace(/\.(jpg|jpeg|png|gif|webp)$/i, ''));
        if (!name) return;
        
        showToast('🔄 Carregando e comprimindo imagem...');
        
        const reader = new FileReader();
        reader.onload = async (ev) => {  // ✅ ASYNC
            const img = new Image();
            img.onload = async () => {  // ✅ ASYNC
                try {
                    // ✅ COMPRIMIR IMAGEM ANTES DE SALVAR
                    const originalBase64 = ev.target.result;
                    console.log('📦 Comprimindo imagem...');
                    
                    const compressedBase64 = await ImageCompressor.compress(
                        originalBase64,
                        1920,  // Max width
                        1920,  // Max height
                        0.85   // Qualidade 85%
                    );
                    
                    // Calcular dimensões proporcionais para o canvas
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
                        image: compressedBase64  // ✅ USAR IMAGEM COMPRIMIDA
                    };
                    
                    // Criar nova imagem para carregar a comprimida
                    const compressedImg = new Image();
                    compressedImg.onload = () => {
                        loadedImages.set(newImage.id, compressedImg);
                        images.push(newImage);
                        
                        socket.emit('add_entity', {
                            session_id: SESSION_ID,
                            entity: newImage
                        });
                        
                        redrawAll();
                        renderImageList();
                        showToast(`✅ Imagem "${name}" adicionada e comprimida!`);
                        saveState('Adicionar Imagem');
                        
                        // ✅ SALVAR AUTOMATICAMENTE
                        saveToDatabaseAsync();
                    };
                    compressedImg.onerror = () => {
                        showToast('❌ Erro ao carregar imagem comprimida');
                    };
                    compressedImg.src = compressedBase64;
                    
                } catch (error) {
                    console.error('❌ Erro ao comprimir:', error);
                    showToast('❌ Erro ao processar imagem');
                }
            };
            
            img.onerror = () => {
                showToast('❌ Erro ao carregar imagem');
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
        showToast('🔄 Carregando e comprimindo token...');
        
        const reader = new FileReader();
        reader.onload = async function(e) {  // ✅ ASYNC
            const img = new Image();
            img.onload = async () => {  // ✅ ASYNC
                try {
                    // ✅ COMPRIMIR TOKEN (menor que imagens de mapa)
                    const originalBase64 = e.target.result;
                    console.log('📦 Comprimindo token...');
                    
                    const compressedBase64 = await ImageCompressor.compress(
                        originalBase64,
                        400,   // Tokens menores
                        400,
                        0.8    // Qualidade 80%
                    );
                    
                    const newToken = {
                        id: 'token_' + Date.now(),
                        name: name,
                        x: CANVAS_WIDTH / 2,
                        y: CANVAS_HEIGHT / 2,
                        image: compressedBase64,  // ✅ USAR COMPRIMIDO
                        style: style
                    };
                    
                    // Carregar imagem comprimida
                    const compressedImg = new Image();
                    compressedImg.onload = () => {
                        loadedImages.set(newToken.id, compressedImg);
                        
                        tokens.push(newToken);
                        renderTokenList();
                        redrawAll();
                        
                        socket.emit('token_update', {
                            session_id: SESSION_ID,
                            tokens: tokens
                        });
                        
                        closeTokenModal();
                        showToast(`✅ Token "${name}" adicionado e comprimido!`);
                        saveState('Adicionar Token');
                        
                        // ✅ SALVAR AUTOMATICAMENTE
                       saveToDatabaseAsync();
                    };
                    compressedImg.onerror = () => {
                        showToast('❌ Erro ao carregar token comprimido');
                    };
                    compressedImg.src = compressedBase64;
                    
                } catch (error) {
                    console.error('❌ Erro ao comprimir token:', error);
                    showToast('❌ Erro ao processar imagem do token');
                }
            };
            img.onerror = () => {
                showToast('❌ Erro ao carregar imagem do token');
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(imageInput.files[0]);
    } else {
        // Token sem imagem (apenas cor)
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
        showToast(`✅ Token "${name}" adicionado!`);
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
        saveState(type === 'image' ? 'Remover Imagem' : 'Remover Token');
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
    
    // Resultado local
    resultDiv.textContent = result;
    resultDiv.className = 'dice-result';
    
    const isCritical = sides === 20 && result === 20;
    const isFail = sides === 20 && result === 1;
    
    addDiceToHistory(`1d${sides}`, result, isCritical, isFail);
    
    setTimeout(() => {
        resultDiv.classList.add('show');
        
        if (isCritical) {
            resultDiv.classList.add('critical-success');
            showToast('🎉 CRÍTICO!');
        } else if (isFail) {
            resultDiv.classList.add('critical-fail');
            showToast('💀 FALHA CRÍTICA!');
        }
    }, 10);
    
    // ✅ BROADCAST para todos
    socket.emit('roll_shared_dice', {
        session_id: SESSION_ID,
        roller_name: 'Mestre',
        dice_type: `d${sides}`,
        result: result,
        formula: `1d${sides}`,
        is_critical: isCritical,
        is_failure: isFail
    });
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
    
    // ✅ BROADCAST para todos
    socket.emit('roll_shared_dice', {
        session_id: SESSION_ID,
        roller_name: 'Mestre',
        dice_type: `d${sides}`,
        result: total,
        formula: formula,
        is_critical: isCrit,
        is_failure: isFail
    });
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

// ==========================================
// SISTEMA DE CENAS REESTRUTURADO
// ==========================================

function createEmptyScene(name) {
    return {
        id: `scene_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: name,
        created_at: Date.now(),
        maps: [],
        entities: [],
        tokens: [],
        drawings: [],
        fog_image: null,
        visible_to_players: []
    };
}

function createNewScene() {
    const name = prompt('📝 Nome da nova cena:');
    
    if (!name || !name.trim()) {
        return;
    }
    
    console.log('🎬 Criando cena:', name.trim());
    
    const newScene = createEmptyScene(name.trim());
    scenes.push(newScene);
    
    socket.emit('scene_create', {
        session_id: SESSION_ID,
        scene: newScene
    });
    
    renderScenesList();
    
    // ✅ Marcar como tendo cena criada
    if (!hasCreatedScene) {
        hasCreatedScene = true;
        localStorage.setItem('rpg_has_scene_' + SESSION_ID, 'true');
        console.log('✅ Primeira cena criada pelo usuário');
    }
    
    showToast(`Cena "${name}" criada!`);
}

function saveCurrentScene() {
    if (!currentSceneId) {
        console.log('⚠️ Nenhuma cena ativa para salvar');
        return;
    }
    
    const scene = scenes.find(s => s.id === currentSceneId);
    if (!scene) {
        console.log('❌ Cena não encontrada:', currentSceneId);
        return;
    }
    
    const mapsOnly = images.filter(img => img.id.startsWith('map_'));
    const entitiesOnly = images.filter(img => !img.id.startsWith('map_'));
    
    scene.maps = JSON.parse(JSON.stringify(mapsOnly));
    scene.entities = JSON.parse(JSON.stringify(entitiesOnly));
    scene.tokens = JSON.parse(JSON.stringify(tokens));
    scene.drawings = JSON.parse(JSON.stringify(drawings));
    scene.fog_image = fogCanvas.toDataURL();
    
    console.log('💾 Cena salva:', {
        scene_id: scene.id,
        maps: scene.maps.length,
        entities: scene.entities.length,
        tokens: scene.tokens.length,
        has_fog: !!scene.fog_image
    });
    
    socket.emit('scene_update', {
        session_id: SESSION_ID,
        scene: scene
    });
    
    showToast(`💾 Cena "${scene.name}" salva`);
}

function switchToScene(sceneId) {
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene) {
        console.error('❌ Cena não encontrada:', sceneId);
        return;
    }
    
    console.log('🎬 Trocando para cena:', scene.name);
    
    // ✅ SALVAR cena atual ANTES de trocar
    if (currentSceneId) {
        saveCurrentScene();
        
        // ✅ NOVO: Salvar histórico da cena atual
        if (sceneHistories[currentSceneId]) {
            console.log(`📚 Histórico da cena ${currentSceneId.slice(0,8)}: ${sceneHistories[currentSceneId].history.length} estados`);
        }
    }
    
    // ✅ LIMPAR TUDO
    images = [];
    tokens = [];
    drawings = [];
    
    mapCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    drawCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    fogCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    currentSceneId = sceneId;
    
    // ✅ NOVO: Inicializar histórico da nova cena se não existir
    if (!sceneHistories[sceneId]) {
        sceneHistories[sceneId] = {
            history: [],
            index: -1
        };
        console.log(`📚 Novo histórico criado para cena ${sceneId.slice(0,8)}`);
    } else {
        console.log(`📚 Histórico carregado: ${sceneHistories[sceneId].history.length} estados`);
    }
    
    // ✅ CARREGAR dados da cena (DEEP COPY)
    images = JSON.parse(JSON.stringify([
        ...(scene.maps || []),
        ...(scene.entities || [])
    ]));
    tokens = JSON.parse(JSON.stringify(scene.tokens || []));
    drawings = JSON.parse(JSON.stringify(scene.drawings || []));
    
    // ✅ CARREGAR FOG da cena
    if (scene.fog_image) {
        console.log('🌫️ Carregando fog da cena');
        loadFogState(scene.fog_image);
    } else {
        console.log('✨ Cena sem fog');
        fogCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }
    
    preloadAllImages();
    renderImageList();
    renderTokenList();
    
    // ✅ ATUALIZAR botões undo/redo
    updateUndoRedoButtons();
    
    setTimeout(() => {
        redrawAll();
        redrawDrawings();
    }, 150);
    
    // ✅ SINCRONIZAR com servidor
    socket.emit('scene_switch', {
        session_id: SESSION_ID,
        scene_id: sceneId,
        scene: scene
    });
    
    renderScenesList();
    showToast(`Cena ativada: ${scene.name}`);
    closeSceneManager();
}

function deleteScene(sceneId) {
    const scene = scenes.find(s => s.id === sceneId);
    
    if (!scene) return;
    
    if (currentSceneId === sceneId) {
        alert('⚠️ Não é possível deletar a cena ativa. Troque para outra cena primeiro.');
        return;
    }
    
    if (!confirm(`🗑️ Tem certeza que deseja excluir a cena "${scene.name}"?`)) {
        return;
    }
    
    scenes = scenes.filter(s => s.id !== sceneId);
    
    // ✅ NOVO: Limpar histórico da cena deletada
    if (sceneHistories[sceneId]) {
        delete sceneHistories[sceneId];
        console.log(`🗑️ Histórico da cena ${sceneId.slice(0,8)} removido`);
    }
    
    socket.emit('scene_delete', {
        session_id: SESSION_ID,
        scene_id: sceneId
    });
    
    renderScenesList();
    showToast('Cena deletada');
}

function openSceneVisibility(sceneId) {
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene) return;
    
    document.getElementById('currentSceneIdForVisibility').value = sceneId;
    document.getElementById('sceneVisibilityTitle').textContent = `Visibilidade: ${scene.name}`;
    
    renderSceneVisibilityList(scene);
    document.getElementById('sceneVisibilityModal').classList.add('show');
}

function renderSceneVisibilityList(scene) {
    const list = document.getElementById('sceneVisibilityList');
    list.innerHTML = '';
    
    if (players.length === 0) {
        list.innerHTML = '<div class="empty-state">Nenhum jogador conectado</div>';
        return;
    }
    
    players.forEach(player => {
        const isVisible = scene.visible_to_players && scene.visible_to_players.includes(player.id);
        
        const item = document.createElement('div');
        item.className = 'item-card';
        
        item.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px; flex: 1;">
                <span>👤 ${player.name}</span>
            </div>
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                <input type="checkbox" ${isVisible ? 'checked' : ''} 
                       onchange="toggleSceneVisibilityForPlayer('${scene.id}', '${player.id}')">
                <span>${isVisible ? '👁️ Visível' : '🚫 Oculta'}</span>
            </label>
        `;
        
        list.appendChild(item);
    });
}

function toggleSceneVisibilityForPlayer(sceneId, playerId) {
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene) return;
    
    if (!scene.visible_to_players) {
        scene.visible_to_players = [];
    }
    
    const index = scene.visible_to_players.indexOf(playerId);
    
    if (index > -1) {
        scene.visible_to_players.splice(index, 1);
        console.log(`❌ ${playerId} perdeu acesso à cena ${scene.name}`);
    } else {
        scene.visible_to_players.push(playerId);
        console.log(`✅ ${playerId} ganhou acesso à cena ${scene.name}`);
    }
    
    // ✅ ATUALIZAR NO SERVIDOR (vai notificar os jogadores)
    socket.emit('scene_update', {
        session_id: SESSION_ID,
        scene: scene
    });
    
    showToast('Visibilidade atualizada!');
}

function renderScenesList() {
const list = document.getElementById('scenesList');
if (!list) {
    console.error('❌ Container scenesList não encontrado!');
    return;
}

list.innerHTML = '';

if (!scenes || scenes.length === 0) {
    list.innerHTML = '<div class="empty-state">Nenhuma cena criada</div>';
    return;
}

scenes.forEach(scene => {
    const isActive = scene.id === currentSceneId;
    
    const item = document.createElement('div');
    item.className = 'scene-item' + (isActive ? ' active' : '');
    
    const visibleCount = scene.visible_to_players ? scene.visible_to_players.length : 0;
    
    item.innerHTML = `
        <div class="scene-info">
            <div class="scene-name">
                ${isActive ? '▶️' : '🎬'} ${scene.name}
            </div>
            <div class="scene-stats">
                <span>🖼️ ${(scene.maps?.length || 0) + (scene.entities?.length || 0)} imagens</span>
                <span>🎭 ${scene.tokens?.length || 0} tokens</span>
                <span>👁️ ${visibleCount} jogador(es)</span>
            </div>
        </div>
        <div class="scene-actions">
            ${!isActive ? 
                `<button class="scene-action-btn" onclick="switchToScene('${scene.id}')">🔄 Ativar</button>` : 
                '<span style="color: #2ed573; font-weight: bold;">✅ Ativa</span>'
            }
            ${isActive ? 
                `<button class="scene-action-btn" onclick="saveCurrentScene()">💾 Salvar</button>` : 
                ''
            }
            <button class="scene-action-btn" onclick="openSceneVisibility('${scene.id}')">👁️ Visibilidade</button>
            ${!isActive ? 
                `<button class="scene-action-btn delete" onclick="deleteScene('${scene.id}'); event.stopPropagation();">🗑️</button>` : 
                ''
            }
        </div>
    `;
    
    list.appendChild(item);
});
}
function openSceneManager() {
    // ✅ Garantir que scenes existe antes de usar
    if (!scenes) {
        scenes = [];
        console.warn('⚠️ scenes não estava inicializado, criando array vazio');
    }
    
    console.log('🎬 Abrindo gerenciador. Cenas:', scenes.length);
    document.getElementById('sceneManagerModal').classList.add('show');
    renderScenesList();
}

function closeSceneManager() {
    document.getElementById('sceneManagerModal').classList.remove('show');
}

function closeSceneVisibilityModal() {
    document.getElementById('sceneVisibilityModal').classList.remove('show');
}


setInterval(() => {
    if (currentSceneId) {
    saveCurrentScene();
    console.log('🔄 Auto-save da cena');
    }
}, 10000);

socket.on('scenes_sync', (data) => {
console.log('🎬 Sincronização de cenas recebida:', data);
if (data.scenes && Array.isArray(data.scenes)) {
    scenes = data.scenes;
    renderScenesList();
}
});
socket.on('scene_switched', (data) => {
console.log('🎬 Outro cliente trocou de cena:', data);
const scene = scenes.find(s => s.id === data.scene_id);
if (scene && data.scene) {
    Object.assign(scene, data.scene);
}
});

// ==================
// SISTEMA DE UNDO/REDO
// ==================

function saveState(action) {
    // ✅ CORRIGIDO: Salvar no histórico da cena atual
    if (!currentSceneId) {
        console.warn('⚠️ Nenhuma cena ativa - histórico não salvo');
        return;
    }
    
    // Garantir que a cena tem histórico
    if (!sceneHistories[currentSceneId]) {
        sceneHistories[currentSceneId] = {
            history: [],
            index: -1
        };
    }
    
    const sceneHist = sceneHistories[currentSceneId];
    
    // Remover estados futuros se estivermos no meio da história
    if (sceneHist.index < sceneHist.history.length - 1) {
        sceneHist.history = sceneHist.history.slice(0, sceneHist.index + 1);
    }
    
    // Salvar estado atual
    const state = {
        action: action,
        timestamp: Date.now(),
        scene_id: currentSceneId,  // ✅ NOVO: Vincular ao ID da cena
        images: JSON.parse(JSON.stringify(images)),
        tokens: JSON.parse(JSON.stringify(tokens)),
        drawings: JSON.parse(JSON.stringify(drawings)),
        fogImage: fogCanvas.toDataURL()
    };
    
    sceneHist.history.push(state);
    sceneHist.index++;
    
    // Limitar histórico
    if (sceneHist.history.length > MAX_HISTORY) {
        sceneHist.history.shift();
        sceneHist.index--;
    }
    
    console.log(`💾 [${currentSceneId.slice(0,8)}] Estado salvo: ${action} (${sceneHist.index + 1}/${sceneHist.history.length})`);
    updateUndoRedoButtons();
}

function undo() {
    if (!currentSceneId) {
        showToast('⚠️ Nenhuma cena ativa');
        return;
    }
    
    const sceneHist = sceneHistories[currentSceneId];
    
    if (!sceneHist || sceneHist.index <= 0) {
        showToast('⚠️ Nada para desfazer');
        return;
    }
    
    sceneHist.index--;
    const state = sceneHist.history[sceneHist.index];
    
    // ✅ VERIFICAR se o estado pertence à cena atual
    if (state.scene_id !== currentSceneId) {
        console.error('❌ Estado pertence a outra cena!');
        sceneHist.index++; // Reverter
        showToast('❌ Erro: histórico corrompido');
        return;
    }
    
    // Restaurar estado
    images = JSON.parse(JSON.stringify(state.images));
    tokens = JSON.parse(JSON.stringify(state.tokens));
    drawings = JSON.parse(JSON.stringify(state.drawings));
    
    // Restaurar fog
    if (state.fogImage) {
        loadFogState(state.fogImage);
    } else {
        fogCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }
    
    // Atualizar displays
    renderImageList();
    renderTokenList();
    preloadAllImages();
    redrawAll();
    redrawDrawings();
    
    // Sincronizar com servidor
    syncStateToServer();
    
    showToast(`↩️ Desfeito: ${state.action}`);
    updateUndoRedoButtons();
    console.log(`↩️ Undo: ${sceneHist.index + 1}/${sceneHist.history.length}`);
}

function redo() {
    if (!currentSceneId) {
        showToast('⚠️ Nenhuma cena ativa');
        return;
    }
    
    const sceneHist = sceneHistories[currentSceneId];
    
    if (!sceneHist || sceneHist.index >= sceneHist.history.length - 1) {
        showToast('⚠️ Nada para refazer');
        return;
    }
    
    sceneHist.index++;
    const state = sceneHist.history[sceneHist.index];
    
    // ✅ VERIFICAR se o estado pertence à cena atual
    if (state.scene_id !== currentSceneId) {
        console.error('❌ Estado pertence a outra cena!');
        sceneHist.index--; // Reverter
        showToast('❌ Erro: histórico corrompido');
        return;
    }
    
    // Restaurar estado
    images = JSON.parse(JSON.stringify(state.images));
    tokens = JSON.parse(JSON.stringify(state.tokens));
    drawings = JSON.parse(JSON.stringify(state.drawings));
    
    // Restaurar fog
    if (state.fogImage) {
        loadFogState(state.fogImage);
    } else {
        fogCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }
    
    // Atualizar displays
    renderImageList();
    renderTokenList();
    preloadAllImages();
    redrawAll();
    redrawDrawings();
    
    // Sincronizar com servidor
    syncStateToServer();
    
    showToast(`↪️ Refeito: ${state.action}`);
    updateUndoRedoButtons();
    console.log(`↪️ Redo: ${sceneHist.index + 1}/${sceneHist.history.length}`);
}

function syncStateToServer() {
    // Sincronizar imagens
    images.forEach(img => {
        if (img.id.startsWith('map_')) {
            socket.emit('update_map', {
                session_id: SESSION_ID,
                map_id: img.id,
                map: img
            });
        } else {
            socket.emit('update_entity', {
                session_id: SESSION_ID,
                entity_id: img.id,
                entity: img
            });
        }
    });
    
    // Sincronizar tokens
    socket.emit('token_update', {
        session_id: SESSION_ID,
        tokens: tokens
    });
    
    // Sincronizar desenhos
    socket.emit('clear_drawings', { session_id: SESSION_ID });
    drawings.forEach(d => {
        socket.emit('drawing_update', {
            session_id: SESSION_ID,
            drawing: d
        });
    });
    
    // Sincronizar fog
    socket.emit('update_fog_state', {
        session_id: SESSION_ID,
        fog_image: fogCanvas.toDataURL()
    });
}

function updateUndoRedoButtons() {
    const undoBtn = document.getElementById('undoBtn');
    const redoBtn = document.getElementById('redoBtn');
    
    if (!currentSceneId) {
        // Sem cena ativa - desabilitar tudo
        if (undoBtn) {
            undoBtn.disabled = true;
            undoBtn.style.opacity = '0.5';
        }
        if (redoBtn) {
            redoBtn.disabled = true;
            redoBtn.style.opacity = '0.5';
        }
        return;
    }
    
    const sceneHist = sceneHistories[currentSceneId];
    
    if (!sceneHist) {
        // Cena sem histórico ainda
        if (undoBtn) {
            undoBtn.disabled = true;
            undoBtn.style.opacity = '0.5';
        }
        if (redoBtn) {
            redoBtn.disabled = true;
            redoBtn.style.opacity = '0.5';
        }
        return;
    }
    
    // Atualizar botões baseado no histórico da cena atual
    if (undoBtn) {
        undoBtn.disabled = sceneHist.index <= 0;
        undoBtn.style.opacity = sceneHist.index <= 0 ? '0.5' : '1';
    }
    
    if (redoBtn) {
        redoBtn.disabled = sceneHist.index >= sceneHist.history.length - 1;
        redoBtn.style.opacity = sceneHist.index >= sceneHist.history.length - 1 ? '0.5' : '1';
    }
}

// Limpar Cache
function clearLocalCache() {
    if (confirm('⚠️ Limpar TODOS os dados salvos localmente?\n\nIsso removerá:\n- Estado da sessão\n- Cenas salvas\n- Histórico de ações\n\nOs dados no servidor serão mantidos.')) {
        PersistenceManager.clearSession(SESSION_ID);
        showToast('🗑️ Cache local limpo!');
        
        // Recarregar página
        setTimeout(() => {
            location.reload();
        }, 1500);
    }
}

// Atalhos de teclado
document.addEventListener('keydown', (e) => {
    // Ctrl+Z = Undo
    if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
    }
    
    // Ctrl+Y ou Ctrl+Shift+Z = Redo
    if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'z')) {
        e.preventDefault();
        redo();
    }
});

// ==========================================
// INICIALIZAÇÃO
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    // Definir ferramenta padrão
    currentTool = 'select';
    
    // Ativar botão visualmente
    const selectBtn = document.querySelector('.tool-btn');
    if (selectBtn) {
        selectBtn.classList.add('active');
    }
    
    console.log('✅ Ferramenta padrão: select');
});

setTimeout(() => {
    drawGrid();
    console.log('✅ Grid desenhado');
}, 500);

renderImageList();
renderTokenList();

// ✅ SALVAR ANTES DE SAIR
window.addEventListener('beforeunload', (e) => {
    if (!isSaving) {
        saveCurrentState();
    }
});

// ==========================================
// SISTEMA OBRIGATÓRIO DE CRIAÇÃO DE CENA
// ==========================================

let hasCreatedScene = false;
let sceneCreationOverlay = null;
let overlayInitialized = false; // ✅ NOVO - Prevenir múltiplas inicializações

function showSceneCreationOverlay() {
    // ✅ Verificar se já foi inicializado
    if (overlayInitialized) {
        console.log('⚠️ Overlay já inicializado - ignorando');
        return;
    }
    
    console.log('🚨 Mostrando overlay obrigatório de criação de cena');
    overlayInitialized = true;
    
    // Remover overlay antigo se existir
    if (sceneCreationOverlay) {
        sceneCreationOverlay.remove();
    }
    
    // Criar overlay minimalista
    sceneCreationOverlay = document.createElement('div');
    sceneCreationOverlay.id = 'sceneCreationOverlay';
    sceneCreationOverlay.style.cssText = `
        position: fixed;
        inset: 0;
        background: rgba(10, 15, 26, 0.98);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 99999;
        backdrop-filter: blur(24px);
        animation: fadeIn 0.3s ease;
    `;
    
    sceneCreationOverlay.innerHTML = `
        <div style="
            max-width: 480px;
            width: 90%;
            background: linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.95));
            border: 1px solid rgba(99, 102, 241, 0.3);
            border-radius: 16px;
            padding: 48px 40px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
            animation: slideUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
        ">
            <!-- Ícone -->
            <div style="
                width: 80px;
                height: 80px;
                margin: 0 auto 24px;
                background: linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(139, 92, 246, 0.2));
                border: 2px solid rgba(99, 102, 241, 0.4);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 2.5rem;
                box-shadow: 0 8px 24px rgba(99, 102, 241, 0.3);
            ">
                🎬
            </div>
            
            <!-- Título -->
            <h1 style="
                color: #f1f5f9;
                font-size: 1.75rem;
                font-weight: 600;
                text-align: center;
                margin: 0 0 12px 0;
                letter-spacing: -0.02em;
            ">
                Criar Primeira Cena
            </h1>
            
            <!-- Descrição -->
            <p style="
                color: #94a3b8;
                font-size: 0.9375rem;
                text-align: center;
                line-height: 1.6;
                margin: 0 0 32px 0;
            ">
                As cenas organizam mapas, tokens e elementos do seu jogo.<br>
                Crie uma cena para começar a usar o Map Manager.
            </p>
            
            <!-- Botão -->
            <button id="createFirstSceneBtn" style="
                width: 100%;
                padding: 16px;
                background: linear-gradient(135deg, #6366f1, #4f46e5);
                border: none;
                border-radius: 12px;
                color: white;
                font-size: 1rem;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
                box-shadow: 0 4px 16px rgba(99, 102, 241, 0.4);
                position: relative;
                overflow: hidden;
            ">
                <span style="position: relative; z-index: 1;">Criar Cena</span>
            </button>
            
            <!-- Dica -->
            <p style="
                color: #64748b;
                font-size: 0.8125rem;
                text-align: center;
                margin: 16px 0 0 0;
                font-style: italic;
            ">
                💡 Exemplo: "Mapa buxa de Vitor Cabral"
            </p>
        </div>
        
        <style>
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            
            @keyframes slideUp {
                from {
                    opacity: 0;
                    transform: translateY(20px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            
            #createFirstSceneBtn:hover {
                transform: translateY(-2px);
                box-shadow: 0 8px 24px rgba(99, 102, 241, 0.6);
                background: linear-gradient(135deg, #818cf8, #6366f1);
            }
            
            #createFirstSceneBtn:active {
                transform: translateY(0);
            }
            
            #createFirstSceneBtn::before {
                content: '';
                position: absolute;
                inset: 0;
                background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
                transform: translateX(-100%);
                transition: transform 0.6s;
            }
            
            #createFirstSceneBtn:hover::before {
                transform: translateX(100%);
            }
        </style>
    `;
    
    document.body.appendChild(sceneCreationOverlay);
    console.log('✅ Overlay de criação de cena adicionado');
    
    // Event listener no botão
    const createBtn = document.getElementById('createFirstSceneBtn');
    if (createBtn) {
        createBtn.addEventListener('click', () => {
            console.log('🎬 Usuário clicou para criar primeira cena');
            promptCreateFirstScene();
        });
    }
}

function promptCreateFirstScene() {
    const sceneName = prompt('🎬 Digite o nome da sua primeira cena:');
    
    if (!sceneName || !sceneName.trim()) {
        alert('❌ Você precisa dar um nome para a cena!');
        return;
    }
    
    console.log('✅ Criando primeira cena:', sceneName.trim());
    
    // Criar cena
    const newScene = createEmptyScene(sceneName.trim());
    scenes.push(newScene);
    
    // ✅ ATIVAR IMEDIATAMENTE
    currentSceneId = newScene.id;
    
    // Inicializar histórico
    sceneHistories[newScene.id] = {
        history: [],
        index: -1
    };
    updateUndoRedoButtons();
    
    // ✅ SINCRONIZAR COM SERVIDOR
    socket.emit('scene_create', {
        session_id: SESSION_ID,
        scene: newScene
    });
    
    // ✅ ATIVAR NO SERVIDOR
    socket.emit('scene_switch', {
        session_id: SESSION_ID,
        scene_id: newScene.id,
        scene: newScene
    });
    
    renderScenesList();
    
    hasCreatedScene = true;
    localStorage.setItem('rpg_has_scene_' + SESSION_ID, 'true');
    
    // Remover overlay
    if (sceneCreationOverlay) {
        sceneCreationOverlay.style.animation = 'fadeOut 0.3s ease';
        setTimeout(() => {
            if (sceneCreationOverlay) {
                sceneCreationOverlay.remove();
                sceneCreationOverlay = null;
                overlayInitialized = false;
            }
        }, 300);
    }
    
    showToast(`✅ Cena "${sceneName.trim()}" criada e ativada!`);
    console.log('🎉 Primeira cena ativa:', newScene.id);
}

// Adicionar animação de fadeOut
style.textContent = `
    @keyframes fadeOut {
        from {
            opacity: 1;
            transform: scale(1);
        }
        to {
            opacity: 0;
            transform: scale(0.95);
        }
    }
`;
document.head.appendChild(style);

// ==========================================
// VERIFICAÇÃO INICIAL - SIMPLIFICADA
// ==========================================

function checkIfSceneExists() {
    console.log('🔍 Verificando se já existe cena criada...');
    
    // ✅ CORRIGIDO: Aguardar scenes carregar
    return new Promise((resolve) => {
        const checkScenes = () => {
            const hasSceneFlag = localStorage.getItem('rpg_has_scene_' + SESSION_ID);
            const hasScenesInMemory = scenes && scenes.length > 0;
            
            if (hasSceneFlag === 'true' || hasScenesInMemory) {
                console.log('✅ Cena já existe - permitindo acesso');
                hasCreatedScene = true;
                overlayInitialized = true;
                resolve(true);
            } else {
                console.log('❌ Nenhuma cena encontrada - bloqueando acesso');
                hasCreatedScene = false;
                resolve(false);
            }
        };
        
        // Se scenes já está populado, verificar imediatamente
        if (scenes && scenes.length > 0) {
            checkScenes();
        } else {
            // Aguardar um pouco para scenes carregar
            setTimeout(checkScenes, 800);
        }
    });
}

async function initializeSceneSystem() {
    console.log('🎬 Inicializando sistema de cenas...');
    
    if (overlayInitialized) {
        console.log('⚠️ Sistema já inicializado - ignorando');
        return;
    }
    
    const exists = await checkIfSceneExists();
    
    if (!exists) {
        console.log('🚨 Mostrando overlay obrigatório');
        showSceneCreationOverlay();
    } else {
        console.log('✅ Sistema de cenas OK');
        overlayInitialized = true;
    }
}

// ==========================================
// BLOQUEAR AÇÕES ATÉ CRIAR CENA
// ==========================================

function blockActionUntilSceneCreated(actionName) {
    if (!hasCreatedScene) {
        showToast('⚠️ Crie uma cena primeiro!');
        console.warn(`❌ Ação "${actionName}" bloqueada - cena não criada`);
        return false;
    }
    return true;
}

// Adicionar verificação nas funções principais
const originalAddImage = window.addImage;
window.addImage = function() {
    if (!blockActionUntilSceneCreated('Adicionar Imagem')) return;
    originalAddImage();
};

const originalAddToken = window.addToken;
window.addToken = function() {
    if (!blockActionUntilSceneCreated('Adicionar Token')) return;
    originalAddToken();
};

// ==========================================
// EXECUTAR NA INICIALIZAÇÃO - ÚNICA VEZ
// ==========================================

let systemInitialized = false; // ✅ NOVO - Prevenir múltiplas inicializações

// ✅ Método único de inicialização
function initializeOnce() {
    if (systemInitialized) {
        console.log('⚠️ Sistema já foi inicializado - ignorando');
        return;
    }
    
    systemInitialized = true;
    console.log('🎬 Inicializando sistema pela primeira vez...');
    
    // Aguardar um momento para garantir que tudo carregou
    setTimeout(() => {
        initializeSceneSystem();
    }, 800);
}

// DOMContentLoaded - Inicializar apenas uma vez
document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 DOM pronto');
    initializeOnce();
});

// Socket conectado - Backup (só executa se ainda não inicializou)
socket.on('connect', () => {
    console.log('🔌 Socket conectado');
    
    // Só tenta inicializar se ainda não foi feito
    if (!systemInitialized && !overlayInitialized) {
        console.log('🔄 Tentando inicializar via socket...');
        setTimeout(() => {
            initializeOnce();
        }, 1200);
    }
});

// ==========================================
// RECEBER ROLAGENS COMPARTILHADAS
// ==========================================
socket.on('dice_rolled_shared', (data) => {
    console.log('🎲 Dado rolado:', data);
    SharedDiceSystem.show(data);
});

// Session state - Atualizar flag se necessário
socket.on('session_state', (data) => {
    console.log('📦 Estado da sessão recebido');
    
    // Se recebeu cenas do servidor
    if (data.scenes && data.scenes.length > 0) {
        console.log('✅ Cenas encontradas no servidor:', data.scenes.length);
        scenes = data.scenes;
        hasCreatedScene = true;
        overlayInitialized = true;
        
        // Salvar flag no localStorage
        localStorage.setItem('rpg_has_scene_' + SESSION_ID, 'true');
        
        // Remover overlay se estiver aberto
        if (sceneCreationOverlay) {
            sceneCreationOverlay.style.animation = 'fadeOut 0.3s ease';
            setTimeout(() => {
                if (sceneCreationOverlay) {
                    sceneCreationOverlay.remove();
                    sceneCreationOverlay = null;
                }
            }, 300);
        }
    }
});
