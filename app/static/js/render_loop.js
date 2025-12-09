// ==========================================
// LOOP DE RENDERIZAÇÃO DEDICADO - Anti-Flick
// ==========================================

const RenderLoop = {
    isRunning: false,
    lastFrameTime: 0,
    targetFPS: 60,
    frameInterval: 1000 / 60,
    
    // Flags para controle
    needsRedraw: false,
    needsFogRedraw: false,
    needsDrawingRedraw: false,
    
    /**
     * Iniciar loop principal
     */
    start() {
        if (this.isRunning) return;
        
        console.log('🎬 Loop de renderização iniciado (60 FPS)');
        this.isRunning = true;
        this.loop();
    },
    
    /**
     * Loop principal com RequestAnimationFrame
     */
    loop() {
        if (!this.isRunning) return;
        
        const now = performance.now();
        const elapsed = now - this.lastFrameTime;
        
        // Controle de FPS
        if (elapsed >= this.frameInterval) {
            // ✅ Renderizar apenas o que mudou
            if (this.needsRedraw) {
                this.renderCanvas();
                this.needsRedraw = false;
            }
            
            if (this.needsDrawingRedraw) {
                this.renderDrawings();
                this.needsDrawingRedraw = false;
            }
            
            // ✅ FOG NÃO É REDESENHADO AQUI
            // Ele só muda quando o mestre pinta/apaga
            
            this.lastFrameTime = now - (elapsed % this.frameInterval);
        }
        
        requestAnimationFrame(() => this.loop());
    },
    
    /**
     * Renderizar canvas principal (mapas + tokens)
     */
    renderCanvas() {
        if (!window.mapCtx || typeof window.images === 'undefined') return;
        
        const ctx = window.mapCtx;
        const canvas = ctx.canvas;
        
        // ✅ Limpar apenas uma vez
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // ✅ Desenhar imagens
        if (window.images && Array.isArray(window.images)) {
            window.images.forEach(img => {
                const loadedImg = window.loadedImages?.get(img.id);
                
                if (loadedImg && loadedImg.complete && loadedImg.naturalWidth > 0) {
                    try {
                        ctx.drawImage(loadedImg, img.x, img.y, img.width, img.height);
                        
                        // Seleção
                        if (window.selectedItem === img && window.selectedType === 'image') {
                            ctx.strokeStyle = '#ffc107';
                            ctx.lineWidth = 4;
                            ctx.strokeRect(img.x, img.y, img.width, img.height);
                        }
                    } catch (e) {
                        console.error('Erro ao desenhar imagem:', e);
                    }
                }
            });
        }
        
        // ✅ Desenhar tokens
        if (window.tokens && Array.isArray(window.tokens)) {
            window.tokens.forEach(token => {
                this.drawToken(ctx, token);
            });
        }
    },
    
    /**
     * Desenhar token individual
     */
    drawToken(ctx, token) {
        const TOKEN_RADIUS = 35;
        const img = window.loadedImages?.get(token.id);
        
        if (token.style === 'square' && img && img.complete && img.naturalWidth > 0) {
            const tokenSize = TOKEN_RADIUS * 1.8;
            ctx.drawImage(
                img,
                token.x - tokenSize/2,
                token.y - tokenSize/2,
                tokenSize,
                tokenSize
            );
        } else if (img && img.complete && img.naturalWidth > 0) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(token.x, token.y, TOKEN_RADIUS, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();
            
            ctx.drawImage(
                img,
                token.x - TOKEN_RADIUS,
                token.y - TOKEN_RADIUS,
                TOKEN_RADIUS * 2,
                TOKEN_RADIUS * 2
            );
            
            ctx.restore();
            
            ctx.strokeStyle = "#fff";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(token.x, token.y, TOKEN_RADIUS, 0, Math.PI * 2);
            ctx.stroke();
        } else if (token.color) {
            ctx.fillStyle = token.color;
            ctx.beginPath();
            ctx.arc(token.x, token.y, TOKEN_RADIUS, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.strokeStyle = "#fff";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(token.x, token.y, TOKEN_RADIUS, 0, Math.PI * 2);
            ctx.stroke();
        }
        
        // Nome do token
        ctx.fillStyle = "#fff";
        ctx.font = "bold 11px Lato";
        ctx.textAlign = "center";
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 2.5;
        
        const nameY = token.style === 'square' ? token.y + TOKEN_RADIUS * 1.8 / 2 + 15 : token.y + TOKEN_RADIUS + 15;
        ctx.strokeText(token.name, token.x, nameY);
        ctx.fillText(token.name, token.x, nameY);
    },
    
    /**
     * Renderizar desenhos
     */
    renderDrawings() {
        if (!window.drawCtx || typeof window.drawings === 'undefined') return;
        
        const ctx = window.drawCtx;
        const canvas = ctx.canvas;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        if (window.drawings && Array.isArray(window.drawings)) {
            window.drawings.forEach(drawing => {
                ctx.strokeStyle = drawing.color;
                ctx.lineWidth = drawing.size;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
                
                if (drawing.path && drawing.path.length > 1) {
                    ctx.beginPath();
                    ctx.moveTo(drawing.path[0].x, drawing.path[0].y);
                    
                    for (let i = 1; i < drawing.path.length; i++) {
                        ctx.lineTo(drawing.path[i].x, drawing.path[i].y);
                    }
                    
                    ctx.stroke();
                }
            });
        }
    },
    
    /**
     * Marcar que precisa redesenhar
     */
    requestRedraw() {
        this.needsRedraw = true;
    },
    
    requestDrawingRedraw() {
        this.needsDrawingRedraw = true;
    },
    
    /**
     * Parar loop
     */
    stop() {
        this.isRunning = false;
        console.log('⏹️ Loop de renderização parado');
    }
};

// Exportar
window.RenderLoop = RenderLoop;