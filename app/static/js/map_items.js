// ==========================================
// MAP ITEMS MODULE - Imagens e Tokens
// ==========================================

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
        
        window.toolsModule.showToast('Carregando imagem...');
        
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
                    x: window.canvasModule.CANVAS_WIDTH / 2 - width / 2,
                    y: window.canvasModule.CANVAS_HEIGHT / 2 - height / 2,
                    width: width,
                    height: height,
                    image: ev.target.result
                };
                
                window.canvasModule.loadImageSafe(newImage.id, ev.target.result, (loadedImg) => {
                    window.mapState.images.push(newImage);
                    
                    window.socketModule.socket.emit('add_entity', {
                        session_id: window.SESSION_ID,
                        entity: newImage
                    });
                    
                    window.canvasModule.redrawAll();
                    renderImageList();
                    window.toolsModule.showToast(`Imagem "${name}" adicionada!`);
                });
            };
            img.onerror = () => {
                window.toolsModule.showToast('Erro ao carregar imagem');
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
        window.toolsModule.showToast('Carregando token...');
        
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.onload = () => {
                const newToken = {
                    id: 'token_' + Date.now(),
                    name: name,
                    x: window.canvasModule.CANVAS_WIDTH / 2,
                    y: window.canvasModule.CANVAS_HEIGHT / 2,
                    image: e.target.result,
                    style: style
                };
                
                window.canvasModule.loadImageSafe(newToken.id, e.target.result, () => {
                    window.mapState.tokens.push(newToken);
                    renderTokenList();
                    window.canvasModule.redrawAll();
                    
                    window.socketModule.socket.emit('token_update', {
                        session_id: window.SESSION_ID,
                        tokens: window.mapState.tokens
                    });
                    
                    closeTokenModal();
                    window.toolsModule.showToast(`Token "${name}" adicionado!`);
                });
            };
            img.onerror = () => {
                window.toolsModule.showToast('Erro ao carregar imagem do token');
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(imageInput.files[0]);
    } else {
        const newToken = {
            id: 'token_' + Date.now(),
            name: name,
            x: window.canvasModule.CANVAS_WIDTH / 2,
            y: window.canvasModule.CANVAS_HEIGHT / 2,
            color: '#' + Math.floor(Math.random() * 16777215).toString(16),
            style: 'round'
        };
        
        window.mapState.tokens.push(newToken);
        renderTokenList();
        window.canvasModule.redrawAll();
        
        window.socketModule.socket.emit('token_update', {
            session_id: window.SESSION_ID,
            tokens: window.mapState.tokens
        });
        
        closeTokenModal();
        window.toolsModule.showToast(`Token "${name}" adicionado!`);
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
    if (!window.mapState.selectedItem) {
        alert('Selecione um item primeiro');
        return;
    }
    
    const confirmMsg = `Remover ${window.mapState.selectedType === 'image' ? 'imagem' : 'token'}?`;
    if (!confirm(confirmMsg)) return;
    
    if (window.mapState.selectedType === 'image') {
        if (window.mapState.selectedItem.id.startsWith('map_')) {
            window.socketModule.socket.emit('delete_map', {
                session_id: window.SESSION_ID,
                map_id: window.mapState.selectedItem.id
            });
        } else {
            window.socketModule.socket.emit('delete_entity', {
                session_id: window.SESSION_ID,
                entity_id: window.mapState.selectedItem.id
            });
        }
        window.mapState.images = window.mapState.images.filter(i => i !== window.mapState.selectedItem);
        renderImageList();
    } else if (window.mapState.selectedType === 'token') {
        window.mapState.tokens = window.mapState.tokens.filter(t => t !== window.mapState.selectedItem);
        window.socketModule.socket.emit('token_update', {
            session_id: window.SESSION_ID,
            tokens: window.mapState.tokens
        });
        renderTokenList();
    }
    
    window.mapState.selectedItem = null;
    window.mapState.selectedType = null;
    window.canvasModule.redrawAll();
    window.toolsModule.showToast('Item removido!');
}

function deleteItemById(itemId, type) {
    if (confirm('Remover este item?')) {
        if (type === 'image') {
            const img = window.mapState.images.find(i => i.id === itemId);
            if (img) {
                window.mapState.images = window.mapState.images.filter(i => i.id !== itemId);
                
                if (img.id.startsWith('map_')) {
                    window.socketModule.socket.emit('delete_map', {
                        session_id: window.SESSION_ID,
                        map_id: itemId
                    });
                } else {
                    window.socketModule.socket.emit('delete_entity', {
                        session_id: window.SESSION_ID,
                        entity_id: itemId
                    });
                }
                
                renderImageList();
            }
        } else if (type === 'token') {
            const token = window.mapState.tokens.find(t => t.id === itemId);
            if (token) {
                window.mapState.tokens = window.mapState.tokens.filter(t => t.id !== itemId);
                
                window.socketModule.socket.emit('token_update', {
                    session_id: window.SESSION_ID,
                    tokens: window.mapState.tokens
                });
                
                renderTokenList();
            }
        }
        
        if (window.mapState.selectedItem && window.mapState.selectedItem.id === itemId) {
            window.mapState.selectedItem = null;
            window.mapState.selectedType = null;
        }
        
        window.canvasModule.redrawAll();
        window.toolsModule.showToast('Item removido!');
    }
}

// ==================
// RENDERIZAR LISTAS
// ==================
function renderImageList() {
    const list = document.getElementById('imageList');
    if (!list) return;
    
    list.innerHTML = '';
    
    if (window.mapState.images.length === 0) {
        list.innerHTML = '<div class="empty-state">Nenhuma imagem</div>';
        return;
    }
    
    window.mapState.images.forEach(img => {
        const item = document.createElement('div');
        item.className = 'item-card';
        item.onclick = () => selectItem(img, 'image');
        
        item.innerHTML = `
            <img src="${img.image}" class="item-preview" alt="${img.name}">
            <div class="item-info">
                <div class="item-name">${img.name}</div>
            </div>
            <div class="item-actions">
                <button class="item-action-btn" onclick="window.itemsModule.deleteItemById('${img.id}', 'image'); event.stopPropagation();">🗑️</button>
            </div>
        `;
        
        list.appendChild(item);
    });
}

function renderTokenList() {
    const list = document.getElementById('tokenList');
    if (!list) return;
    
    list.innerHTML = '';
    
    if (window.mapState.tokens.length === 0) {
        list.innerHTML = '<div class="empty-state">Nenhum token</div>';
        return;
    }
    
    window.mapState.tokens.forEach(token => {
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
                    <button class="item-action-btn" onclick="window.itemsModule.deleteItemById('${token.id}', 'token'); event.stopPropagation();">🗑️</button>
                </div>
            `;
        } else {
            item.innerHTML = `
                <div class="item-color" style="background-color: ${token.color}"></div>
                <div class="item-info">
                    <div class="item-name">${token.name}</div>
                </div>
                <div class="item-actions">
                    <button class="item-action-btn" onclick="window.itemsModule.deleteItemById('${token.id}', 'token'); event.stopPropagation();">🗑️</button>
                </div>
            `;
        }
        
        list.appendChild(item);
    });
}

function selectItem(item, type) {
    window.mapState.selectedItem = item;
    window.mapState.selectedType = type;
    
    document.querySelectorAll('.item-card').forEach(i => i.classList.remove('active'));
    event.currentTarget.classList.add('active');
    
    window.canvasModule.redrawAll();
}

// Exportar funções
window.itemsModule = {
    addImage,
    addToken,
    createToken,
    closeTokenModal,
    deleteSelected,
    deleteItemById,
    renderImageList,
    renderTokenList,
    selectItem
};