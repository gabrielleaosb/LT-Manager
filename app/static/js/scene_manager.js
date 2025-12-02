// ==========================================
// SCENE MANAGER - Gerenciador de Cenas
// ==========================================

console.log('🎬 Scene Manager carregado');

function openSceneManager() {
    console.log('🎬 Abrindo gerenciador. Cenas atuais:', scenes.length);
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
    
    console.log('🎬 Criando cena:', name.trim());
    
    socket.emit('create_scene', {
        session_id: SESSION_ID,
        scene_name: name.trim()
    });
    
    showToast(`Cena "${name}" criada!`);
}

function deleteScene(sceneId) {
    const scene = scenes.find(s => s.id === sceneId);
    
    if (!scene) return;
    
    if (!confirm(`🗑️ Tem certeza que deseja excluir a cena "${scene.name}"?`)) {
        return;
    }
    
    console.log('🗑️ Excluindo cena:', sceneId);
    
    socket.emit('delete_scene', {
        session_id: SESSION_ID,
        scene_id: sceneId
    });
    
    showToast('Cena deletada');
}

function switchToScene(sceneId) {
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene) return;
    
    console.log('🎬 Trocando para cena:', sceneId);
    
    // Salvar conteúdo da cena atual antes de trocar
    if (currentSceneId && currentScene) {
        saveCurrentSceneContent();
    }
    
    currentSceneId = sceneId;
    currentScene = scene;
    
    // Carregar conteúdo da nova cena
    loadSceneContent(scene);
    
    socket.emit('switch_scene', {
        session_id: SESSION_ID,
        scene_id: sceneId
    });
    
    showToast(`Cena alterada: ${scene.name}`);
    closeSceneManager();
}

function saveCurrentSceneContent() {
    if (!currentSceneId) return;
    
    socket.emit('update_scene_content', {
        session_id: SESSION_ID,
        scene_id: currentSceneId,
        content_type: 'maps',
        content: maps
    });
    
    socket.emit('update_scene_content', {
        session_id: SESSION_ID,
        scene_id: currentSceneId,
        content_type: 'entities',
        content: entities
    });
    
    socket.emit('update_scene_content', {
        session_id: SESSION_ID,
        scene_id: currentSceneId,
        content_type: 'tokens',
        content: tokens
    });
    
    socket.emit('update_scene_content', {
        session_id: SESSION_ID,
        scene_id: currentSceneId,
        content_type: 'drawings',
        content: drawings
    });
    
    socket.emit('update_scene_content', {
        session_id: SESSION_ID,
        scene_id: currentSceneId,
        content_type: 'fog_areas',
        content: fogAreas
    });
}

function loadSceneContent(scene) {
    maps = scene.maps || [];
    entities = scene.entities || [];
    images = [...maps, ...entities];
    tokens = scene.tokens || [];
    drawings = scene.drawings || [];
    fogAreas = scene.fog_areas || [];
    
    preloadAllImages();
    renderImageList();
    renderTokenList();
    renderFogList();
    redrawAll();
    redrawDrawings();
    redrawFog();
}

function toggleSceneVisibility(sceneId, playerId) {
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene) return;
    
    const isVisible = scene.visible_to_players && scene.visible_to_players.includes(playerId);
    
    socket.emit('update_scene_visibility', {
        session_id: SESSION_ID,
        scene_id: sceneId,
        player_id: playerId,
        visible: !isVisible
    });
}

function renderScenesList() {
    console.log('🎬 Renderizando lista. Cenas disponíveis:', scenes);
    
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
        
        item.innerHTML = `
            <div class="scene-info">
                <div class="scene-name">🎬 ${scene.name}</div>
                <div class="scene-stats">
                    <span>📍 ${(scene.maps?.length || 0) + (scene.entities?.length || 0)} imagens</span>
                    <span>🎭 ${scene.tokens?.length || 0} tokens</span>
                </div>
            </div>
            <div class="scene-actions">
                ${!isActive ? `<button class="scene-action-btn" onclick="switchToScene('${scene.id}')">🔄 Ativar</button>` : '<span style="color: #2ed573; font-weight: bold;">✓ Ativa</span>'}
                <button class="scene-action-btn" onclick="openSceneVisibility('${scene.id}')">👁️ Visibilidade</button>
                <button class="scene-action-btn delete" onclick="deleteScene('${scene.id}'); event.stopPropagation();">🗑️</button>
            </div>
        `;
        
        list.appendChild(item);
    });
    
    console.log('✅ Lista renderizada com', scenes.length, 'cena(s)');
}

function openSceneVisibility(sceneId) {
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene) return;
    
    document.getElementById('currentSceneIdForVisibility').value = sceneId;
    document.getElementById('sceneVisibilityTitle').textContent = `Visibilidade: ${scene.name}`;
    
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
        
        item.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px; flex: 1;">
                <span>👤 ${player.name}</span>
            </div>
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                <input type="checkbox" ${isVisible ? 'checked' : ''} 
                       onchange="toggleSceneVisibility('${scene.id}', '${player.id}')">
                <span>${isVisible ? 'Visível' : 'Oculta'}</span>
            </label>
        `;
        
        list.appendChild(item);
    });
}

// Socket handlers
socket.on('scenes_sync', (data) => {
    console.log('🎬 Sincronização de cenas recebida:', data);
    scenes = data.scenes || [];
    renderScenesList();
    console.log('🎬 Total de cenas após sync:', scenes.length);
});

socket.on('scene_switched', (data) => {
    console.log('🎬 Cena trocada:', data);
    
    if (currentSceneId !== data.scene_id) {
        currentSceneId = data.scene_id;
        currentScene = data.scene;
        loadSceneContent(data.scene);
    }
});

// Salvar automaticamente ao modificar conteúdo
setInterval(() => {
    if (currentSceneId && currentScene) {
        saveCurrentSceneContent();
    }
}, 5000);