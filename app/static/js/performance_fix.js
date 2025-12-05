// ==========================================
// SISTEMA DE PERFORMANCE - Anti-Lag Total
// ==========================================

const PerformanceFix = {
    // Controles de taxa
    lastFogSync: 0,
    fogSyncInterval: 1000, // Enviar fog apenas 1x por segundo
    
    lastTokenSync: 0,
    tokenSyncInterval: 100, // 10 FPS para tokens
    
    lastRedraw: 0,
    redrawInterval: 16, // 60 FPS máximo
    
    pendingFogSync: false,
    pendingTokenSync: false,
    
    // Buffer de operações
    fogOperations: [],
    tokenMoves: [],
    
    /**
     * Throttle para fog - Envia apenas 1x por segundo
     */
    syncFogThrottled(sessionId, fogImage) {
        const now = performance.now();
        
        if (now - this.lastFogSync < this.fogSyncInterval) {
            // Guardar para enviar depois
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
            // Guardar para enviar depois
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
            return; // Ignorar se chamou muito rápido
        }
        
        requestAnimationFrame(() => {
            callback();
            this.lastRedraw = performance.now();
        });
    },
    
    /**
     * Comprimir fog antes de salvar (reduz de 5MB para ~500KB)
     */
    compressFog(fogCanvas) {
        // Criar canvas menor
        const compressed = document.createElement('canvas');
        compressed.width = fogCanvas.width / 2; // Metade do tamanho
        compressed.height = fogCanvas.height / 2;
        
        const ctx = compressed.getContext('2d');
        ctx.drawImage(fogCanvas, 0, 0, compressed.width, compressed.height);
        
        // Retornar com qualidade reduzida
        return compressed.toDataURL('image/jpeg', 0.7); // 70% qualidade
    },
    
    /**
     * Debounce para auto-save (espera 5s sem mudanças)
     */
    debouncedAutoSave: null,
    
    scheduleAutoSave(callback, delay = 5000) {
        clearTimeout(this.debouncedAutoSave);
        
        this.debouncedAutoSave = setTimeout(() => {
            console.log('💾 Auto-save executando...');
            callback();
        }, delay);
    }
};

// Exportar
window.PerformanceFix = PerformanceFix;