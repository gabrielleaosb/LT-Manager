// ==========================================
// SISTEMA DE PERFORMANCE - Anti-Lag Total
// ==========================================

const PerformanceFix = {
    // Controles de taxa
    lastFogSync: 0,
    fogSyncInterval: 1000,
    
    lastTokenSync: 0,
    tokenSyncInterval: 100,
    
    lastRedraw: 0,
    redrawInterval: 16,
    
    pendingFogSync: false,
    pendingTokenSync: false,
    
    // Buffer de operações
    fogOperations: [],
    tokenMoves: [],
    
    /**
     * ✅ CORRIGIDO - NÃO COMPRIMIR MAIS O FOG
     * Compressão estava causando artefatos visuais
     */
    compressFog(fogCanvas) {
        // ✅ RETORNAR IMAGEM ORIGINAL SEM COMPRESSÃO
        // Qualidade máxima para evitar artefatos
        return fogCanvas.toDataURL('image/png');
    },
    
    /**
     * Throttle para fog - Envia apenas 1x por segundo
     */
    syncFogThrottled(sessionId, fogImage) {
        const now = performance.now();
        
        if (now - this.lastFogSync < this.fogSyncInterval) {
            if (!this.pendingFogSync) {
                this.pendingFogSync = true;
                setTimeout(() => {
                    this.syncFogNow(sessionId, fogImage);
                }, this.fogSyncInterval - (now - this.lastFogSync));
            }
            return;
        }
        
        this.syncFogNow(sessionId, fogImage);
    },
    
    syncFogNow(sessionId, fogImage) {
        console.log('🌫️ Sincronizando fog...');
        
        if (window.socket) {
            window.socket.emit('update_fog_state', {
                session_id: sessionId,
                fog_image: fogImage
            });
        }
        
        this.lastFogSync = performance.now();
        this.pendingFogSync = false;
    },
    
    /**
     * Throttle para tokens - 10 FPS
     */
    syncTokensThrottled(sessionId, tokens) {
        const now = performance.now();
        
        if (now - this.lastTokenSync < this.tokenSyncInterval) {
            this.tokenMoves = tokens;
            
            if (!this.pendingTokenSync) {
                this.pendingTokenSync = true;
                setTimeout(() => {
                    this.syncTokensNow(sessionId, this.tokenMoves);
                }, this.tokenSyncInterval - (now - this.lastTokenSync));
            }
            return;
        }
        
        this.syncTokensNow(sessionId, tokens);
    },
    
    syncTokensNow(sessionId, tokens) {
        if (window.socket) {
            window.socket.emit('token_update', {
                session_id: sessionId,
                tokens: tokens
            });
        }
        
        this.lastTokenSync = performance.now();
        this.pendingTokenSync = false;
    },
    
    /**
     * Redraw com limite de FPS
     */
    scheduleRedraw(callback) {
        const now = performance.now();
        
        if (now - this.lastRedraw < this.redrawInterval) {
            return;
        }
        
        requestAnimationFrame(() => {
            callback();
            this.lastRedraw = performance.now();
        });
    },
    
    /**
     * Debounce para auto-save (espera 5s sem mudanças)
     */
    debouncedAutoSave: null,
    
    scheduleAutoSave(callback, delay = 5000) {
        clearTimeout(this.debouncedAutoSave);
        
        this.debouncedAutoSave = setTimeout(() => {
            console.log('💾 Auto-save executando...');
            try {
                callback();
            } catch (error) {
                console.error('❌ Erro no auto-save:', error);
            }
        }, delay);
    }
};

// Exportar
window.PerformanceFix = PerformanceFix;