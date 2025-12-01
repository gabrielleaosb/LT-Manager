// ==========================================
// MAP MOUSE MODULE - Eventos de Mouse
// ==========================================

// Estado de seleção e arrastar
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

// ==================
// UTILITÁRIOS
// ==================
function getMousePos(e) {
    const canvasWrapper = document.querySelector('.canvas-wrapper');
    const rect = canvasWrapper.getBoundingClientRect();
    const scaleX = window.canvasModule.CANVAS_WIDTH / rect.width;
    const scaleY = window.canvasModule.CANVAS_HEIGHT / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    return { x, y };
}

function findItemAt(x, y) {
    // Verificar tokens primeiro
    for (let i = window.mapState.tokens.length - 1; i >= 0; i--) {
        const token = window.mapState.tokens[i];
        
        if (token.style === 'square') {
            const tokenSize = window.canvasModule.TOKEN_RADIUS * 1.8;
            if (x >= token.x - tokenSize/2 && x <= token.x + tokenSize/2 &&
                y >= token.y - tokenSize/2 && y <= token.y + tokenSize/2) {
                return { item: token, type: 'token' };
            }
        } else {
            const dist = Math.hypot(token.x - x, token.y - y);
            if (dist <= window.canvasModule.TOKEN_RADIUS) {
                return { item: token, type: 'token' };
            }
        }
    }
    
    // Verificar imagens
    for (let i = window.mapState.images.length - 1; i >= 0; i--) {
        const img = window.mapState.images[i];
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
// EVENTOS DE MOUSE
// ==================
const canvasWrapper = document.querySelector('.canvas-wrapper');

canvasWrapper.addEventListener('mousedown', (e) => {
    const pos = getMousePos(e);
    const currentTool = window.toolsModule ? 
        (document.querySelector('.tool-btn.active')?.textContent.includes('Desenhar') ? 'draw' : 
         document.querySelector('.tool-btn.active')?.textContent.includes('Apagar') ? 'erase' :
         document.querySelector('.tool-btn.active')?.textContent.includes('Mover') ? 'pan' : 'select')
        : 'select';
    
    // Se está no modo de desenho ou apagar, não fazer nada aqui
    if (currentTool === 'draw' || currentTool === 'erase') {
        return;
    }
    
    if (currentTool === 'pan') {
        window.canvasModule.isPanning = true;
        window.canvasModule.startPanX = e.clientX - window.canvasModule.panX;
        window.canvasModule.startPanY = e.clientY - window.canvasModule.panY;
        canvasWrapper.style.cursor = 'grabbing';
        return;
    }
    
    if (currentTool === 'select') {
        const found = findItemAt(pos.x, pos.y);
        
        if (found && found.type === 'image' && isOnResizeHandle(found.item, pos.x, pos.y)) {
            // Iniciar resize
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
            
            dragOffsetX = pos.x - found.item.x;
            dragOffsetY = pos.y - found.item.y;
            
            canvasWrapper.style.cursor = 'grabbing';
        } else {
            selectedItem = null;
            selectedType = null;
        }
        
        window.canvasModule.redrawAll();
    }
});

canvasWrapper.addEventListener('mousemove', (e) => {
    const pos = getMousePos(e);
    const currentTool = document.querySelector('.tool-btn.active')?.textContent.includes('Desenhar') ? 'draw' : 
                       document.querySelector('.tool-btn.active')?.textContent.includes('Apagar') ? 'erase' :
                       document.querySelector('.tool-btn.active')?.textContent.includes('Mover') ? 'pan' : 'select';
    
    // Se está desenhando ou apagando, não fazer nada aqui
    if (currentTool === 'draw' || currentTool === 'erase') {
        return;
    }
    
    if (window.canvasModule.isPanning && currentTool === 'pan') {
        window.canvasModule.panX = e.clientX - window.canvasModule.startPanX;
        window.canvasModule.panY = e.clientY - window.canvasModule.startPanY;
        window.canvasModule.applyTransform();
        return;
    }
    
    if (resizingImage) {
        const deltaX = pos.x - resizeStartX;
        const deltaY = pos.y - resizeStartY;
        
        resizingImage.width = Math.max(50, resizeStartWidth + deltaX);
        resizingImage.height = Math.max(50, resizeStartHeight + deltaY);
        
        window.canvasModule.redrawAll();
        return;
    }
    
    if (mouseDown && draggingItem && currentTool === 'select') {
        const newX = pos.x - dragOffsetX;
        const newY = pos.y - dragOffsetY;
        
        draggingItem.x = newX;
        draggingItem.y = newY;
        
        window.canvasModule.redrawAll();
    } else if (currentTool === 'select' && !mouseDown) {
        const found = findItemAt(pos.x, pos.y);
        if (found && found.type === 'image' && isOnResizeHandle(found.item, pos.x, pos.y)) {
            canvasWrapper.style.cursor = 'nwse-resize';
        } else {
            canvasWrapper.style.cursor = found ? 'grab' : 'default';
        }
    }
});

canvasWrapper.addEventListener('mouseup', () => {
    if (resizingImage) {
        // Emitir atualização
        if (resizingImage.id.startsWith('map_')) {
            window.socketModule.socket.emit('update_map', {
                session_id: window.SESSION_ID,
                map_id: resizingImage.id,
                map: resizingImage
            });
        } else {
            window.socketModule.socket.emit('update_entity', {
                session_id: window.SESSION_ID,
                entity_id: resizingImage.id,
                entity: resizingImage
            });
        }
        resizingImage = null;
        canvasWrapper.style.cursor = 'default';
        return;
    }
    
    if (draggingItem && mouseDown) {
        // Emitir atualização
        if (selectedType === 'image') {
            if (draggingItem.id.startsWith('map_')) {
                window.socketModule.socket.emit('update_map', {
                    session_id: window.SESSION_ID,
                    map_id: draggingItem.id,
                    map: draggingItem
                });
            } else {
                window.socketModule.socket.emit('update_entity', {
                    session_id: window.SESSION_ID,
                    entity_id: draggingItem.id,
                    entity: draggingItem
                });
            }
        } else if (selectedType === 'token') {
            window.socketModule.socket.emit('token_update', {
                session_id: window.SESSION_ID,
                tokens: window.mapState.tokens
            });
        }
    }
    
    window.canvasModule.isPanning = false;
    draggingItem = null;
    mouseDown = false;
    
    const currentTool = document.querySelector('.tool-btn.active')?.textContent.includes('Mover') ? 'pan' : 'select';
    if (currentTool === 'pan') {
        canvasWrapper.style.cursor = 'grab';
    } else {
        canvasWrapper.style.cursor = 'default';
    }
});

canvasWrapper.addEventListener('mouseleave', () => {
    window.canvasModule.isPanning = false;
    resizingImage = null;
    if (draggingItem && mouseDown) {
        draggingItem = null;
        mouseDown = false;
    }
});

// Deletar com tecla Delete
document.addEventListener('keydown', (e) => {
    if (e.key === 'Delete' && selectedItem) {
        window.itemsModule.deleteSelected();
    }
});

// Exportar estado
window.mapState = window.mapState || {};
window.mapState.selectedItem = null;
window.mapState.selectedType = null;

// Atualizar referências quando mudar
Object.defineProperty(window.mapState, 'selectedItem', {
    get: () => selectedItem,
    set: (val) => selectedItem = val
});

Object.defineProperty(window.mapState, 'selectedType', {
    get: () => selectedType,
    set: (val) => selectedType = val
});

// Exportar funções
window.mouseModule = {
    getMousePos,
    findItemAt,
    isOnResizeHandle
};