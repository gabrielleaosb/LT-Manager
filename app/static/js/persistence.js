// ==========================================
// SISTEMA DE PERSISTÊNCIA UNIFICADO
// ==========================================

const PersistenceManager = {
    API_BASE: '/api',
    SAVE_DEBOUNCE: 2000,
    saveTimeout: null,
    
    /**
     * Salvar estado COMPLETO no backend
     */
    async saveSession(sessionId, state) {
        try {
            console.log('💾 Salvando sessão no banco...');
            
            const response = await fetch(`${this.API_BASE}/session/save`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: sessionId,
                    data: state
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.status === 'success') {
                console.log(`✅ Sessão salva (${result.size_mb || '?'} MB)`);
                return true;
            }
            
            console.error('❌ Erro ao salvar:', result.error);
            return false;
            
        } catch (e) {
            console.error('❌ Erro na requisição de salvamento:', e);
            return false;
        }
    },
    
    /**
     * Salvar com debounce
     */
    saveDebouncedSession(sessionId, state) {
        clearTimeout(this.saveTimeout);
        
        this.saveTimeout = setTimeout(() => {
            this.saveSession(sessionId, state);
        }, this.SAVE_DEBOUNCE);
    },
    
    /**
     * Carregar estado do backend
     */
    async loadSession(sessionId) {
        try {
            console.log('📂 Carregando sessão do banco...');
            
            const response = await fetch(`${this.API_BASE}/session/load/${sessionId}`);
            
            if (!response.ok) {
                if (response.status === 404) {
                    console.log('ℹ️ Nenhum estado salvo encontrado');
                    return null;
                }
                throw new Error(`HTTP ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.status === 'success' && result.data) {
                console.log(`✅ Sessão carregada (versão ${result.version || '?'})`);
                return result.data;
            }
            
            console.log('ℹ️ Nenhum estado salvo encontrado');
            return null;
            
        } catch (e) {
            console.error('❌ Erro ao carregar sessão:', e);
            return null;
        }
    },
    
    /**
     * Deletar sessão
     */
    async deleteSession(sessionId) {
        try {
            const response = await fetch(`${this.API_BASE}/session/delete/${sessionId}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const result = await response.json();
            return result.status === 'success';
            
        } catch (e) {
            console.error('❌ Erro ao deletar:', e);
            return false;
        }
    },
    
    /**
     * Listar sessões
     */
    async listSessions(limit = 50) {
        try {
            const response = await fetch(`${this.API_BASE}/sessions/list?limit=${limit}`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.status === 'success') {
                return result.sessions || [];
            }
            
            return [];
            
        } catch (e) {
            console.error('❌ Erro ao listar:', e);
            return [];
        }
    },
    
    async getSessionSize(sessionId) {
        try {
            const response = await fetch(`${this.API_BASE}/session/load/${sessionId}`);
            
            if (!response.ok) {
                return 0;
            }
            
            const result = await response.json();
            
            if (result.status === 'success' && result.data) {
                // Calcular tamanho aproximado em MB
                const jsonStr = JSON.stringify(result.data);
                const bytes = new Blob([jsonStr]).size;
                return bytes / (1024 * 1024);
            }
            
            return 0;
            
        } catch (e) {
            console.error('❌ Erro ao calcular tamanho:', e);
            return 0;
        }
    }
};

// Exportar para uso global
window.PersistenceManager = PersistenceManager;