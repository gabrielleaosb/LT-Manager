// ==========================================
// OTIMIZADOR DE CANVAS - Anti-Lag System
// ==========================================

const CanvasOptimizer = {
    // Controle de taxa de atualização
    lastDrawTime: 0,
    drawInterval: 16, // ~60 FPS
    pendingRedraw: false,
    
    // Throttle para eventos de mouse
    lastMouseTime: 0,
    mouseThrottle: 16, // ~60 FPS
    
    // Buffer de operações
    operationQueue: [],
    isProcessing: false,
    
    /**
     * Redesenhar com controle de taxa (RequestAnimationFrame)
     */
    scheduleRedraw(callback) {
        if (this.pendingRedraw) return;
        
        this.pendingRedraw = true;
        
        requestAnimationFrame(() => {
            const now = performance.now();
            
            if (now - this.lastDrawTime >= this.drawInterval) {
                callback();
                this.lastDrawTime = now;
            }
            
            this.pendingRedraw = false;
        });
    },
    
    /**
     * Throttle para eventos de mouse
     */
    throttleMouse(callback) {
        const now = performance.now();
        
        if (now - this.lastMouseTime >= this.mouseThrottle) {
            callback();
            this.lastMouseTime = now;
        }
    },
    
    /**
     * Debounce para operações de rede
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },
    
    /**
     * Batch de operações de socket
     */
    queueSocketEmit(eventName, data) {
        this.operationQueue.push({ eventName, data, timestamp: Date.now() });
        
        if (!this.isProcessing) {
            this.processQueue();
        }
    },
    
    processQueue() {
        if (this.operationQueue.length === 0) {
            this.isProcessing = false;
            return;
        }
        
        this.isProcessing = true;
        
        // Processar próxima operação após pequeno delay
        setTimeout(() => {
            if (this.operationQueue.length > 0) {
                const operation = this.operationQueue.shift();
                
                // Emit real
                if (window.socket) {
                    window.socket.emit(operation.eventName, operation.data);
                }
            }
            
            this.processQueue();
        }, 50); // 50ms entre emits
    },
    
    /**
     * Otimizar imagem antes de desenhar
     */
    optimizeImageDraw(ctx, img, x, y, width, height) {
        // Usar imageSmoothingEnabled apenas quando necessário
        const needsSmoothing = width !== img.naturalWidth || height !== img.naturalHeight;
        
        if (needsSmoothing) {
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'low'; // 'low' é mais rápido
        } else {
            ctx.imageSmoothingEnabled = false;
        }
        
        ctx.drawImage(img, x, y, width, height);
    },
    
    /**
     * Limpar área específica ao invés do canvas inteiro
     */
    clearArea(ctx, x, y, width, height, padding = 10) {
        ctx.clearRect(
            x - padding,
            y - padding,
            width + padding * 2,
            height + padding * 2
        );
    }
};

// Exportar globalmente
window.CanvasOptimizer = CanvasOptimizer;