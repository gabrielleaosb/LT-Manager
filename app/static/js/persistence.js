// ==========================================
// SISTEMA DE PERSISTÊNCIA - BACKEND
// ==========================================

const PersistenceManager = {
    API_BASE: '/api',
    
    // ==================
    // SALVAR NO BACKEND
    // ==================
    
    async saveSessionState(sessionId, state) {
        try {
            const response = await fetch(`${this.API_BASE}/session/save`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    session_id: sessionId,
                    data: state
                })
            });
            
            const result = await response.json();
            
            if (result.status === 'success') {
                console.log('💾 Estado salvo no banco de dados');
                return true;
            }
            
            console.error('❌ Erro ao salvar:', result.error);
            return false;
            
        } catch (e) {
            console.error('❌ Erro na requisição:', e);
            return false;
        }
    },
    
    async loadSessionState(sessionId) {
        try {
            const response = await fetch(`${this.API_BASE}/session/load/${sessionId}`);
            const result = await response.json();
            
            if (result.status === 'success' && result.data) {
                console.log('✅ Estado carregado do banco:', result.data);
                return result.data;
            }
            
            console.log('ℹ️ Nenhum estado salvo encontrado');
            return null;
            
        } catch (e) {
            console.error('❌ Erro ao carregar:', e);
            return null;
        }
    },
    
    // ==================
    // CENAS
    // ==================
    
    async saveScenes(sessionId, scenes) {
        try {
            const response = await fetch(`${this.API_BASE}/scenes/save`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    session_id: sessionId,
                    scenes: scenes
                })
            });
            
            const result = await response.json();
            
            if (result.status === 'success') {
                console.log('💾 Cenas salvas:', scenes.length);
                return true;
            }
            
            return false;
            
        } catch (e) {
            console.error('❌ Erro ao salvar cenas:', e);
            return false;
        }
    },
    
    async loadScenes(sessionId) {
        try {
            const response = await fetch(`${this.API_BASE}/scenes/load/${sessionId}`);
            const result = await response.json();
            
            if (result.status === 'success') {
                console.log('✅ Cenas carregadas:', result.scenes.length);
                return result.scenes || [];
            }
            
            return [];
            
        } catch (e) {
            console.error('❌ Erro ao carregar cenas:', e);
            return [];
        }
    },
    
    // ==================
    // GRID
    // ==================
    
    async saveGridSettings(sessionId, settings) {
        try {
            const response = await fetch(`${this.API_BASE}/grid/save`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    session_id: sessionId,
                    settings: settings
                })
            });
            
            return response.ok;
            
        } catch (e) {
            console.error('❌ Erro ao salvar grid:', e);
            return false;
        }
    },
    
    async loadGridSettings(sessionId) {
        try {
            const response = await fetch(`${this.API_BASE}/grid/load/${sessionId}`);
            const result = await response.json();
            
            if (result.status === 'success') {
                return result.settings;
            }
            
            return null;
            
        } catch (e) {
            console.error('❌ Erro ao carregar grid:', e);
            return null;
        }
    },
    
    // ==================
    // LISTAR SESSÕES
    // ==================
    
    async listSessions() {
        try {
            const response = await fetch(`${this.API_BASE}/sessions/list`);
            const result = await response.json();
            
            if (result.status === 'success') {
                return result.sessions;
            }
            
            return [];
            
        } catch (e) {
            console.error('❌ Erro ao listar sessões:', e);
            return [];
        }
    }
};

// Exportar para uso global
window.PersistenceManager = PersistenceManager;