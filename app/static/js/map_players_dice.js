// ==========================================
// PLAYERS & DICE MODULE - Jogadores e Dados
// ==========================================

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
// JOGADORES
// ==================
function renderPlayersList() {
    const list = document.getElementById('playersList');
    if (!list) return;
    
    list.innerHTML = '';
    
    if (window.mapState.players.length === 0) {
        list.innerHTML = '<div class="empty-state">Nenhum jogador conectado</div>';
        return;
    }
    
    window.mapState.players.forEach(player => {
        const item = document.createElement('div');
        item.className = 'player-item';
        
        const permissions = player.permissions || {};
        
        item.innerHTML = `
            <div class="player-info">
                <div class="player-name">👤 ${player.name}</div>
            </div>
            <div class="player-perms">
                <button class="perm-btn ${permissions.draw ? 'active' : ''}" 
                        onclick="window.playersModule.togglePermission('${player.id}', 'draw')">
                    ✏️ Desenhar
                </button>
                <button class="perm-btn" onclick="window.playersModule.openTokenPermissions('${player.id}')">
                    🎭 Mover Tokens
                </button>
            </div>
        `;
        
        list.appendChild(item);
    });
}

function togglePermission(playerId, permissionType) {
    const player = window.mapState.players.find(p => p.id === playerId);
    if (!player) return;
    
    const permissions = player.permissions || {};
    permissions[permissionType] = !permissions[permissionType];
    
    window.socketModule.socket.emit('update_permissions', {
        session_id: window.SESSION_ID,
        player_id: playerId,
        permissions: permissions
    });
    
    player.permissions = permissions;
    renderPlayersList();
    window.toolsModule.showToast(`Permissão "${permissionType}" atualizada`);
}

function openTokenPermissions(playerId) {
    const player = window.mapState.players.find(p => p.id === playerId);
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
    
    if (window.mapState.tokens.length === 0) {
        list.innerHTML = '<div class="empty-state">Nenhum token disponível</div>';
        return;
    }
    
    window.mapState.tokens.forEach(token => {
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
                       onchange="window.playersModule.toggleTokenPermission('${player.id}', '${token.id}')">
                <span>Permitir</span>
            </label>
        `;
        
        list.appendChild(item);
    });
}

function toggleTokenPermission(playerId, tokenId) {
    const player = window.mapState.players.find(p => p.id === playerId);
    if (!player) return;
    
    const permissions = player.permissions || {};
    let allowedTokens = permissions.moveTokens || [];
    
    if (allowedTokens.includes(tokenId)) {
        allowedTokens = allowedTokens.filter(id => id !== tokenId);
    } else {
        allowedTokens.push(tokenId);
    }
    
    permissions.moveTokens = allowedTokens;
    
    window.socketModule.socket.emit('update_permissions', {
        session_id: window.SESSION_ID,
        player_id: playerId,
        permissions: permissions
    });
    
    player.permissions = permissions;
}

function closeTokenPermissionsModal() {
    document.getElementById('tokenPermissionsModal').classList.remove('show');
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
                window.toolsModule.showToast('🎉 CRÍTICO!');
            } else if (result === 1) {
                resultDiv.classList.add('critical-fail');
                window.toolsModule.showToast('💀 FALHA CRÍTICA!');
            }
        }
    }, 10);
}

// ==================
// INICIALIZAÇÃO
// ==================
document.addEventListener('DOMContentLoaded', () => {
    // Fechar painéis ao clicar fora
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.floating-panel') && !e.target.closest('.floating-btn')) {
            document.querySelectorAll('.floating-panel').forEach(p => p.classList.remove('show'));
        }
    });
});

// Exportar funções
window.playersModule = {
    renderPlayersList,
    togglePermission,
    openTokenPermissions,
    renderTokenPermissionsList,
    toggleTokenPermission,
    closeTokenPermissionsModal,
    togglePlayersPanel,
    toggleDiceRoller,
    rollDice
};