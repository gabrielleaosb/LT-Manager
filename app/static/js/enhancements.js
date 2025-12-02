// app/static/js/enhancements.js - Utilitários e melhorias de UX

// ==========================================
// CACHE INTELIGENTE DE IMAGENS
// ==========================================

class ImageCache {
    constructor(maxSize = 50) {
        this.cache = new Map();
        this.maxSize = maxSize;
        this.accessOrder = [];
    }
    
    set(key, image) {
        // Se atingiu o limite e a chave não existe, remove a mais antiga
        if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
            const oldest = this.accessOrder.shift();
            this.cache.delete(oldest);
            console.log(`🗑️ Cache: Removendo imagem antiga ${oldest}`);
        }
        
        this.cache.set(key, image);
        this.updateAccess(key);
        console.log(`💾 Cache: Armazenando ${key}. Total: ${this.cache.size}`);
    }
    
    get(key) {
        if (this.cache.has(key)) {
            this.updateAccess(key);
            return this.cache.get(key);
        }
        return null;
    }
    
    has(key) {
        return this.cache.has(key);
    }
    
    delete(key) {
        const index = this.accessOrder.indexOf(key);
        if (index > -1) {
            this.accessOrder.splice(index, 1);
        }
        return this.cache.delete(key);
    }
    
    updateAccess(key) {
        // Remove da posição atual
        const index = this.accessOrder.indexOf(key);
        if (index > -1) {
            this.accessOrder.splice(index, 1);
        }
        // Adiciona no final (mais recente)
        this.accessOrder.push(key);
    }
    
    clear() {
        this.cache.clear();
        this.accessOrder = [];
        console.log('🗑️ Cache limpo');
    }
    
    getSize() {
        return this.cache.size;
    }
    
    getStats() {
        return {
            size: this.cache.size,
            maxSize: this.maxSize,
            keys: Array.from(this.cache.keys())
        };
    }
}

// Instância global do cache
window.imageCache = new ImageCache(50);

// ==========================================
// COMPRESSÃO DE IMAGENS
// ==========================================

class ImageCompressor {
    static async compressImage(file, maxWidth = 1920, quality = 0.85) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                const img = new Image();
                
                img.onload = () => {
                    try {
                        const canvas = document.createElement('canvas');
                        let width = img.width;
                        let height = img.height;
                        
                        // Redimensionar se necessário
                        if (width > maxWidth) {
                            height = (height * maxWidth) / width;
                            width = maxWidth;
                        }
                        
                        canvas.width = width;
                        canvas.height = height;
                        
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, width, height);
                        
                        // Converter para base64
                        const compressed = canvas.toDataURL('image/jpeg', quality);
                        
                        console.log(`📦 Compressão: ${this.formatBytes(file.size)} → ${this.formatBytes(this.getBase64Size(compressed))}`);
                        
                        resolve(compressed);
                    } catch (error) {
                        reject(error);
                    }
                };
                
                img.onerror = () => {
                    reject(new Error('Erro ao carregar imagem'));
                };
                
                img.src = e.target.result;
            };
            
            reader.onerror = () => {
                reject(new Error('Erro ao ler arquivo'));
            };
            
            reader.readAsDataURL(file);
        });
    }
    
    static getBase64Size(base64String) {
        // Remove o header data:image/...;base64,
        const base64 = base64String.split(',')[1] || base64String;
        // Calcula o tamanho em bytes
        return Math.ceil((base64.length * 3) / 4);
    }
    
    static formatBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }
}

window.ImageCompressor = ImageCompressor;

// ==========================================
// FEEDBACK VISUAL DE AÇÕES
// ==========================================

class FeedbackManager {
    static show(x, y, type = 'success', icon = null) {
        const feedback = document.createElement('div');
        feedback.className = `action-feedback ${type}`;
        feedback.style.left = `${x}px`;
        feedback.style.top = `${y}px`;
        
        const icons = {
            success: '✓',
            error: '✗',
            info: 'ℹ',
            move: '↔',
            draw: '✏️',
            delete: '🗑️',
            add: '+',
            fog: '🌫️',
            note: '📌'
        };
        
        feedback.textContent = icon || icons[type] || icons.success;
        document.body.appendChild(feedback);
        
        setTimeout(() => feedback.remove(), 1000);
    }
    
    static showAtElement(element, type = 'success', icon = null) {
        const rect = element.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        this.show(x, y, type, icon);
    }
}

window.FeedbackManager = FeedbackManager;

// ==========================================
// TOOLTIPS
// ==========================================

class TooltipManager {
    static init() {
        // Adiciona tooltips a todos os elementos com data-tooltip
        document.addEventListener('DOMContentLoaded', () => {
            this.attachTooltips();
        });
    }
    
    static attachTooltips() {
        const elements = document.querySelectorAll('[data-tooltip]');
        
        elements.forEach(element => {
            if (!element.querySelector('.tooltip')) {
                this.addTooltip(element);
            }
        });
    }
    
    static addTooltip(element) {
        const tooltipText = element.getAttribute('data-tooltip');
        const position = element.getAttribute('data-tooltip-position') || 'top';
        
        if (!tooltipText) return;
        
        // Wrap element se não estiver já
        if (!element.classList.contains('tooltip-wrapper')) {
            const wrapper = document.createElement('div');
            wrapper.className = 'tooltip-wrapper';
            element.parentNode.insertBefore(wrapper, element);
            wrapper.appendChild(element);
            
            const tooltip = document.createElement('div');
            tooltip.className = `tooltip ${position}`;
            tooltip.textContent = tooltipText;
            wrapper.appendChild(tooltip);
        }
    }
    
    static update() {
        this.attachTooltips();
    }
}

window.TooltipManager = TooltipManager;
TooltipManager.init();

// ==========================================
// HISTÓRICO DE AÇÕES (DESFAZER/REFAZER)
// ==========================================

class ActionHistory {
    constructor(maxSize = 50) {
        this.maxSize = maxSize;
        this.history = [];
        this.currentIndex = -1;
    }
    
    addAction(actionType, beforeState, afterState, metadata = {}) {
        // Remove ações após o índice atual (se fez undo e depois nova ação)
        this.history = this.history.slice(0, this.currentIndex + 1);
        
        // Adiciona nova ação
        const action = {
            type: actionType,
            before: JSON.parse(JSON.stringify(beforeState)),
            after: JSON.parse(JSON.stringify(afterState)),
            metadata: metadata,
            timestamp: Date.now()
        };
        
        this.history.push(action);
        
        // Limita o tamanho do histórico
        if (this.history.length > this.maxSize) {
            this.history.shift();
        } else {
            this.currentIndex++;
        }
        
        this.updateUI();
        console.log(`📝 Ação adicionada: ${actionType}. Histórico: ${this.history.length}`);
    }
    
    canUndo() {
        return this.currentIndex >= 0;
    }
    
    canRedo() {
        return this.currentIndex < this.history.length - 1;
    }
    
    undo() {
        if (!this.canUndo()) {
            console.log('⚠️ Não há ações para desfazer');
            return null;
        }
        
        const action = this.history[this.currentIndex];
        this.currentIndex--;
        this.updateUI();
        
        console.log(`↶ Desfazendo: ${action.type}`);
        return action;
    }
    
    redo() {
        if (!this.canRedo()) {
            console.log('⚠️ Não há ações para refazer');
            return null;
        }
        
        this.currentIndex++;
        const action = this.history[this.currentIndex];
        this.updateUI();
        
        console.log(`↷ Refazendo: ${action.type}`);
        return action;
    }
    
    clear() {
        this.history = [];
        this.currentIndex = -1;
        this.updateUI();
        console.log('🗑️ Histórico limpo');
    }
    
    updateUI() {
        const undoBtn = document.getElementById('undoBtn');
        const redoBtn = document.getElementById('redoBtn');
        
        if (undoBtn) {
            undoBtn.disabled = !this.canUndo();
        }
        
        if (redoBtn) {
            redoBtn.disabled = !this.canRedo();
        }
    }
    
    getStats() {
        return {
            size: this.history.length,
            currentIndex: this.currentIndex,
            canUndo: this.canUndo(),
            canRedo: this.canRedo()
        };
    }
}

window.ActionHistory = ActionHistory;

// ==========================================
// INDICADOR DE DIGITAÇÃO
// ==========================================

class TypingIndicator {
    constructor(timeoutMs = 3000) {
        this.timeoutMs = timeoutMs;
        this.typingUsers = new Map(); // userId -> timeout
        this.container = null;
    }
    
    setContainer(containerId) {
        this.container = document.getElementById(containerId);
    }
    
    startTyping(userId, userName) {
        // Cancela timeout anterior se existir
        if (this.typingUsers.has(userId)) {
            clearTimeout(this.typingUsers.get(userId));
        }
        
        // Define novo timeout
        const timeout = setTimeout(() => {
            this.stopTyping(userId);
        }, this.timeoutMs);
        
        this.typingUsers.set(userId, timeout);
        this.render();
        
        console.log(`⌨️ ${userName} está digitando...`);
    }
    
    stopTyping(userId) {
        if (this.typingUsers.has(userId)) {
            clearTimeout(this.typingUsers.get(userId));
            this.typingUsers.delete(userId);
            this.render();
        }
    }
    
    render() {
        if (!this.container) return;
        
        // Remove indicador existente
        const existing = this.container.querySelector('.typing-indicator');
        if (existing) {
            existing.remove();
        }
        
        // Se ninguém está digitando, não mostra nada
        if (this.typingUsers.size === 0) return;
        
        // Cria novo indicador
        const indicator = document.createElement('div');
        indicator.className = 'typing-indicator';
        indicator.innerHTML = `
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
        `;
        
        this.container.appendChild(indicator);
    }
    
    clear() {
        this.typingUsers.forEach((timeout) => clearTimeout(timeout));
        this.typingUsers.clear();
        this.render();
    }
}

window.TypingIndicator = TypingIndicator;

// ==========================================
// LOADING SPINNER
// ==========================================

class LoadingSpinner {
    static show(text = 'Carregando...') {
        let spinner = document.getElementById('loadingSpinner');
        
        if (!spinner) {
            spinner = document.createElement('div');
            spinner.id = 'loadingSpinner';
            spinner.className = 'loading-spinner';
            spinner.innerHTML = `
                <div class="spinner"></div>
                <div class="loading-text">${text}</div>
            `;
            document.body.appendChild(spinner);
        } else {
            spinner.querySelector('.loading-text').textContent = text;
        }
        
        spinner.classList.add('show');
    }
    
    static hide() {
        const spinner = document.getElementById('loadingSpinner');
        if (spinner) {
            spinner.classList.remove('show');
        }
    }
    
    static updateText(text) {
        const spinner = document.getElementById('loadingSpinner');
        if (spinner) {
            const textEl = spinner.querySelector('.loading-text');
            if (textEl) {
                textEl.textContent = text;
            }
        }
    }
}

window.LoadingSpinner = LoadingSpinner;

// ==========================================
// ATALHOS DE TECLADO
// ==========================================

class KeyboardShortcuts {
    constructor() {
        this.shortcuts = new Map();
        this.enabled = true;
        this.init();
    }
    
    init() {
        document.addEventListener('keydown', (e) => {
            if (!this.enabled) return;
            
            // Ignora se está em input/textarea
            const target = e.target;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
                return;
            }
            
            const key = this.getKeyString(e);
            const handler = this.shortcuts.get(key);
            
            if (handler) {
                e.preventDefault();
                handler(e);
            }
        });
    }
    
    getKeyString(event) {
        const parts = [];
        
        if (event.ctrlKey || event.metaKey) parts.push('Ctrl');
        if (event.altKey) parts.push('Alt');
        if (event.shiftKey) parts.push('Shift');
        
        parts.push(event.key.toUpperCase());
        
        return parts.join('+');
    }
    
    register(key, handler, description = '') {
        this.shortcuts.set(key, handler);
        console.log(`⌨️ Atalho registrado: ${key}${description ? ` - ${description}` : ''}`);
    }
    
    unregister(key) {
        this.shortcuts.delete(key);
    }
    
    enable() {
        this.enabled = true;
    }
    
    disable() {
        this.enabled = false;
    }
    
    getAll() {
        return Array.from(this.shortcuts.keys());
    }
    
    showHelp() {
        const shortcuts = [
            { key: 'G', description: 'Alternar grid' },
            { key: 'M', description: 'Medidor de distância' },
            { key: 'F', description: 'Fog of War' },
            { key: 'N', description: 'Nova anotação' },
            { key: 'Delete', description: 'Remover selecionado' },
            { key: 'Ctrl+Z', description: 'Desfazer' },
            { key: 'Ctrl+Y', description: 'Refazer' },
            { key: 'Ctrl+S', description: 'Salvar sessão' },
            { key: 'Espaço', description: 'Pan (segurar)' },
            { key: '?', description: 'Mostrar atalhos' }
        ];
        
        const modal = document.createElement('div');
        modal.className = 'modal show';
        modal.innerHTML = `
            <div class="modal-content shortcuts-modal">
                <h3>⌨️ Atalhos de Teclado</h3>
                <ul class="shortcuts-list">
                    ${shortcuts.map(s => `
                        <li>
                            <kbd>${s.key}</kbd>
                            <span class="shortcuts-description">${s.description}</span>
                        </li>
                    `).join('')}
                </ul>
                <div class="modal-actions" style="margin-top: 20px;">
                    <button class="btn btn-primary" onclick="this.closest('.modal').remove()">Fechar</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Fecha ao clicar fora
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }
}

window.KeyboardShortcuts = KeyboardShortcuts;

// ==========================================
// UTILITÁRIOS GERAIS
// ==========================================

const Utils = {
    // Debounce function
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
    
    // Throttle function
    throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },
    
    // Deep clone
    deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    },
    
    // Generate unique ID
    generateId(prefix = 'id') {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    },
    
    // Format timestamp
    formatTimestamp(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit'
        });
    },
    
    // Distance between two points
    distance(x1, y1, x2, y2) {
        return Math.hypot(x2 - x1, y2 - y1);
    },
    
    // Check if point is inside circle
    isPointInCircle(px, py, cx, cy, radius) {
        return this.distance(px, py, cx, cy) <= radius;
    },
    
    // Check if point is inside rectangle
    isPointInRect(px, py, rx, ry, width, height) {
        return px >= rx && px <= rx + width && py >= ry && py <= ry + height;
    }
};

window.Utils = Utils;

// ==========================================
// INICIALIZAÇÃO
// ==========================================

console.log('✨ Enhancements.js carregado com sucesso!');
console.log('📦 Cache de imagens:', window.imageCache.getStats());