// ==========================================
// SCENE MANAGER - REFORMULADO
// ==========================================

console.log('🎬 Scene Manager v2.0 carregado');

// ==================
// VARIÁVEIS GLOBAIS
// ==================
let currentSceneId = null;
let autoSaveInterval = null;

// ==================
// UI DO MODAL
// ==================

function openSceneManager() {
    console.log('🎬 Abrindo gerenciador de cenas');
    document.getElementById('sceneManagerModal').classList.add('show');
    renderScenesList();
}

function closeSceneManager() {
    document.getElementById('sceneManagerModal').classList.remove('show');
}

function createNewScene() {
    const name = prompt('📝 Nome da nova cena:');
    
    if (!name || !name.trim()) {
        return;
    }
    
    console.log('🎬 Criando nova cena:', name.trim());
    
    socket.emit('create_scene', {
        session_id: SESSION_ID,
        scene_name: name.trim()
    });
    
    showToast(`Cena "${name}" criada!`);
}

function deleteScene(sceneId) {
    const scene = scenes.find(s => s.id === sceneId);
    
    if (!scene) return;
    
    if (!confirm(`🗑️ Deletar cena "${scene.name}"?\n\nTodo o conteúdo será perdido!`)) {
        return;
    }
    
    console.log('🗑️ Deletando cena:', sceneId);
    
    socket.emit('delete_scene', {
        session_id: SESSION_ID,
        scene_id: sceneId
    });
    
    showToast('Cena deletada');
}

function switchToScene(sceneId) {
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene) {
        console.error('❌ Cena não encontrada:', sceneId);
        return;
    }
    
    console.log('🎬 Trocando para cena:', scene.name);
    
    // Salvar cena atual antes de trocar
    if (currentSceneId) {
        saveCurrentScene();
    }
    
    // Trocar cena
    socket.emit('switch_scene', {
        session_id: SESSION_ID,
        scene_id: sceneId
    });
    
    closeSceneManager();
}

// ==================
// RENDERIZAÇÃO
// ==================

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
        const isActive = scene.active || false;
        const content = scene.content || {};
        
        const totalImages = (content.maps?.length || 0) + (content.entities?.length || 0);
        const totalTokens = content.tokens?.length || 0;
        const totalFog = content.fog_areas?.length || 0;
        
        const item = document.createElement('div');
        item.className = 'scene-item' + (isActive ? ' active' : '');
        
        item.innerHTML = `
            <div class="scene-info">
                <div class="scene-name">
                    ${isActive ? '✅' : '🎬'} ${scene.name}
                    ${isActive ? '<span style="color: #2ed573; font-size: 0.8rem; margin-left: 8px;">(ATIVA)</span>' : ''}
                </div>
                <div class="scene-stats">
                    <span>📍 ${totalImages} imagens</span>
                    <span>🎭 ${totalTokens} tokens</span>
                    <span>🌫️ ${totalFog} névoa</span>
                </div>
            </div>
            <div class="scene-actions">
                ${!isActive ? 
                    `<button class="scene-action-btn" onclick="switchToScene('${scene.id}'); event.stopPropagation();">
                        🔄 Ativar
                    </button>` 
                    : ''
                }
                <button class="scene-action-btn" onclick="openSceneVisibility('${scene.id}'); event.stopPropagation();">
                    👁️ Jogadores
                </button>
                <button class="scene-action-btn delete" onclick="deleteScene('${scene.id}'); event.stopPropagation();">
                    🗑️
                </button>
            </div>
        `;
        
        list.appendChild(item);
    });
}

// ==================
// VISIBILIDADE - TEMPO REAL
// ==================

function openSceneVisibility(sceneId) {
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene) return;
    
    document.getElementById('currentSceneIdForVisibility').value = sceneId;
    document.getElementById('sceneVisibilityTitle').textContent = `👁️ Visibilidade: ${scene.name}`;
    
    renderSceneVisibilityList(scene);
    document.getElementById('sceneVisibilityModal').classList.add('show');
}

function closeSceneVisibilityModal() {
    document.getElementById('sceneVisibilityModal').classList.remove('show');
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
        item.style.transition = 'all 0.3s ease';
        
        // ID único para o checkbox
        const checkboxId = `visibility_${scene.id}_${player.id}`;
        
        item.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px; flex: 1;">
                <span style="font-size: 1.2rem;">👤</span>
                <span style="font-weight: 600;">${player.name}</span>
            </div>
            <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; user-select: none;">
                <input type="checkbox" 
                       id="${checkboxId}"
                       ${isVisible ? 'checked' : ''} 
                       onchange="toggleSceneVisibility('${scene.id}', '${player.id}')"
                       style="width: 20px; height: 20px; cursor: pointer;">
                <span style="font-weight: 600; color: ${isVisible ? '#2ed573' : '#e74c3c'};">
                    ${isVisible ? '✅ Visível' : '❌ Oculta'}
                </span>
            </label>
        `;
        
        list.appendChild(item);
    });
}

function toggleSceneVisibility(sceneId, playerId) {
    console.log('👁️ Toggle visibilidade:', sceneId, playerId);
    
    socket.emit('toggle_scene_visibility', {
        session_id: SESSION_ID,
        scene_id: sceneId,
        player_id: playerId
    });
    
    // Feedback visual imediato (será confirmado pelo servidor)
    showToast('Atualizando visibilidade...');
}

// ==================
// SALVAMENTO
// ==================

function saveCurrentScene() {
    if (!currentSceneId) {
        console.log('⚠️ Nenhuma cena ativa para salvar');
        return;
    }
    
    console.log('💾 Salvando cena atual:', currentSceneId);
    
    const content = {
        maps: [...maps],
        entities: [...entities],
        tokens: [...tokens],
        drawings: [...drawings],
        fog_areas: [...fogAreas]
    };
    
    console.log('💾 Conteúdo:', {
        maps: content.maps.length,
        entities: content.entities.length,
        tokens: content.tokens.length,
        drawings: content.drawings.length,
        fog_areas: content.fog_areas.length
    });
    
    socket.emit('save_scene_state', {
        session_id: SESSION_ID,
        scene_id: currentSceneId,
        content: content
    });
}

// Auto-save a cada 3 segundos se houver cena ativa
function startAutoSave() {
    if (autoSaveInterval) {
        clearInterval(autoSaveInterval);
    }
    
    autoSaveInterval = setInterval(() => {
        if (currentSceneId) {
            saveCurrentScene();
        }
    }, 3000);
}

// ==================
// SOCKET HANDLERS
// ==================

socket.on('scenes_updated', (data) => {
    console.log('🎬 [scenes_updated] Cenas atualizadas:', data.scenes.length);
    scenes = data.scenes || [];
    
    // ✅ ATUALIZAR LISTA EM TEMPO REAL (se o modal estiver aberto)
    const modal = document.getElementById('sceneManagerModal');
    if (modal && modal.classList.contains('show')) {
        renderScenesList();
    }
    
    // ✅ ATUALIZAR VISIBILIDADE EM TEMPO REAL (se modal de visibilidade estiver aberto)
    const visibilityModal = document.getElementById('sceneVisibilityModal');
    if (visibilityModal && visibilityModal.classList.contains('show')) {
        const sceneId = document.getElementById('currentSceneIdForVisibility').value;
        const scene = scenes.find(s => s.id === sceneId);
        if (scene) {
            renderSceneVisibilityList(scene);
        }
    }
});

socket.on('scene_activated', (data) => {
    console.log('🎬 [scene_activated] Cena ativada:', data.scene.name);
    
    currentSceneId = data.scene_id;
    const scene = data.scene;
    const content = scene.content || {};
    
    // Limpar estado atual
    maps = [];
    entities = [];
    images = [];
    tokens = [];
    drawings = [];
    fogAreas = [];
    
    // Carregar conteúdo da cena
    maps = [...(content.maps || [])];
    entities = [...(content.entities || [])];
    tokens = [...(content.tokens || [])];
    drawings = [...(content.drawings || [])];
    fogAreas = [...(content.fog_areas || [])];
    
    images = [...maps, ...entities];
    
    console.log('🎬 Conteúdo carregado:', {
        maps: maps.length,
        entities: entities.length,
        tokens: tokens.length,
        drawings: drawings.length,
        fog: fogAreas.length
    });
    
    // Redesenhar tudo
    preloadAllImages();
    renderImageList();
    renderTokenList();
    renderFogList();
    
    mapCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    drawCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    fogCtx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    redrawAll();
    redrawDrawings();
    redrawFog();
    
    showToast(`Cena ativada: ${scene.name}`);
});

socket.on('scene_saved', (data) => {
    if (data.success) {
        console.log('✅ Cena salva:', data.scene_id);
    }
});

// ==================
// INICIALIZAÇÃO
// ==================

startAutoSave();

console.log('✅ Scene Manager v2.0 inicializado');