// ==========================================
// MAP CANVAS MODULE - Renderização e Canvas
// ==========================================

// Canvas elements
const mapCanvas = document.getElementById('mapCanvas');
const mapCtx = mapCanvas.getContext('2d');
const gridCanvas = document.getElementById('gridCanvas');
const gridCtx = gridCanvas.getContext('2d');
const drawingCanvas = document.getElementById('drawingCanvas');
const drawCtx = drawingCanvas.getContext('2d');
const canvasWrapper = document.querySelector('.canvas-wrapper');
const canvasContainer = document.querySelector('.canvas-container');

// Constantes
const CANVAS_WIDTH = 2000;
const CANVAS_HEIGHT = 2000;
const TOKEN_RADIUS = 35;

// Configurar tamanho dos canvas
mapCanvas.width = gridCanvas.width = drawingCanvas.width = CANVAS_WIDTH;
mapCanvas.height = gridCanvas.height = drawingCanvas.height = CANVAS_HEIGHT;

// Estado do canvas
let currentScale = 1;
let panX = 0;
let panY = 0;
let isPanning = false;
let startPanX = 0;
let startPanY = 0;

// Cache de imagens
let loadedImages = new Map();

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
// GRID
// ==================
let gridEnabled = true;
let gridSize = 50;
let gridColor = 'rgba(155, 89, 182, 0.3)';
let gridLineWidth = 1;

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
    window.mapState.images.forEach(img => {
        if (img.image && !loadedImages.has(img.id)) {
            loadImageSafe(img.id, img.image);
        }
    });
    
    window.mapState.tokens.forEach(token => {
        if (token.image && !loadedImages.has(token.id)) {
            loadImageSafe(token.id, token.image);
        }
    });
}

// ==================
// RENDER
// ==================
function redrawAll() {
    mapCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // Desenhar todas as imagens
    window.mapState.images.forEach(img => {
        const loadedImg = loadedImages.get(img.id);
        
        if (loadedImg && loadedImg.complete && loadedImg.naturalWidth > 0) {
            try {
                mapCtx.drawImage(loadedImg, img.x, img.y, img.width, img.height);
                
                if (window.mapState.selectedItem === img && window.mapState.selectedType === 'image') {
                    mapCtx.strokeStyle = '#ffc107';
                    mapCtx.lineWidth = 4;
                    mapCtx.strokeRect(img.x, img.y, img.width, img.height);
                    
                    // Handle de resize
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
    window.mapState.tokens.forEach(token => {
        const img = loadedImages.get(token.id);
        
        if (token.style === 'square' && img && img.complete && img.naturalWidth > 0) {
            // Token quadrado
            try {
                const tokenSize = TOKEN_RADIUS * 1.8;
                mapCtx.drawImage(img, token.x - tokenSize/2, token.y - tokenSize/2, tokenSize, tokenSize);
            } catch (e) {
                console.error('Erro ao desenhar token quadrado:', e);
            }
        } else if (img && img.complete && img.naturalWidth > 0) {
            // Token redondo
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
            // Token colorido
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
        if (window.mapState.selectedItem === token && window.mapState.selectedType === 'token') {
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
    
    window.mapState.drawings.forEach(drawing => {
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
// INICIALIZAÇÃO
// ==================
window.addEventListener('resize', () => {
    centerCanvas();
});

setTimeout(() => {
    centerCanvas();
}, 100);

drawGrid();

// Exportar funções
window.canvasModule = {
    redrawAll,
    redrawDrawings,
    preloadAllImages,
    centerCanvas,
    drawGrid,
    toggleGrid,
    updateGridSize,
    loadImageSafe,
    CANVAS_WIDTH,
    CANVAS_HEIGHT,
    TOKEN_RADIUS
};