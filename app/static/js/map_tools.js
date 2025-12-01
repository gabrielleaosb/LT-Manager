// ==========================================
// MAP TOOLS MODULE - Ferramentas e Desenho
// ==========================================

// Estado das ferramentas
let currentTool = 'select';
let drawingColor = '#9b59b6';
let brushSize = 3;
let isDrawing = false;
let currentPath = [];

// Sidebar
let sidebarCollapsed = false;

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
// FERRAMENTAS
// ==================
function setTool(tool) {
    currentTool = tool;
    document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    const canvasWrapper = document.querySelector('.canvas-wrapper');
    const drawingCanvas = document.getElementById('drawingCanvas');
    
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
// DESENHO LIVRE
// ==================
function getDrawingPos(e) {
    const drawingCanvas = document.getElementById('drawingCanvas');
    const rect = drawingCanvas.getBoundingClientRect();
    const scaleX = window.canvasModule.CANVAS_WIDTH / rect.width;
    const scaleY = window.canvasModule.CANVAS_HEIGHT / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    return { x, y };
}

const drawingCanvas = document.getElementById('drawingCanvas');
const drawCtx = drawingCanvas.getContext('2d');

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
        window.mapState.drawings.push(drawing);
        
        window.socketModule.socket.emit('drawing_update', {
            session_id: window.SESSION_ID,
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
    
    window.mapState.drawings = window.mapState.drawings.filter(drawing => {
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
        window.canvasModule.redrawDrawings();
        window.socketModule.socket.emit('clear_drawings', { session_id: window.SESSION_ID });
        window.mapState.drawings.forEach(d => {
            window.socketModule.socket.emit('drawing_update', {
                session_id: window.SESSION_ID,
                drawing: d
            });
        });
    }
}

function clearDrawings() {
    if (confirm('Limpar todos os desenhos?')) {
        window.mapState.drawings = [];
        window.canvasModule.redrawDrawings();
        window.socketModule.socket.emit('clear_drawings', { session_id: window.SESSION_ID });
        showToast('Desenhos limpos!');
    }
}

// ==================
// UTILITÁRIOS
// ==================
function clearAll() {
    if (!confirm('Limpar TUDO (imagens, tokens, desenhos)?')) return;
    
    window.canvasModule.loadImageSafe = new Map();
    
    window.mapState.images = [];
    window.mapState.tokens = [];
    window.mapState.drawings = [];
    
    window.canvasModule.redrawAll();
    window.canvasModule.redrawDrawings();
    window.itemsModule.renderImageList();
    window.itemsModule.renderTokenList();
    
    window.socketModule.socket.emit('clear_drawings', { session_id: window.SESSION_ID });
    showToast('Tudo limpo!');
}

function copyShareLink() {
    const link = `${window.location.origin}/player-view/${window.SESSION_ID}`;
    navigator.clipboard.writeText(link);
    showToast('Link copiado!');
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// Inicializar ferramenta padrão
setTool('select');

// Exportar funções
window.toolsModule = {
    setTool,
    setDrawingColor,
    setBrushSize,
    clearDrawings,
    clearAll,
    copyShareLink,
    toggleSidebar,
    showToast
};