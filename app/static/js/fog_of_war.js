// app/static/js/fog_of_war.js - Sistema de Fog of War

class FogOfWar {
    constructor(canvasWidth, canvasHeight) {
        this.canvasWidth = canvasWidth;
        this.canvasHeight = canvasHeight;
        this.fogAreas = []; // Áreas reveladas
        this.fogMode = false; // Modo de adicionar/remover fog
        this.fogAction = 'reveal'; // 'reveal' ou 'hide'
        this.fogRadius = 100; // Raio da área revelada
        this.enabled = true;
        
        // Canvas para fog
        this.fogCanvas = document.createElement('canvas');
        this.fogCanvas.width = canvasWidth;
        this.fogCanvas.height = canvasHeight;
        this.fogCtx = this.fogCanvas.getContext('2d');
    }
    
    toggleMode() {
        this.fogMode = !this.fogMode;
        this.updateModeIndicator();
        return this.fogMode;
    }
    
    setAction(action) {
        this.fogAction = action; // 'reveal' ou 'hide'
    }
    
    setRadius(radius) {
        this.fogRadius = Math.max(50, Math.min(300, radius));
    }
    
    toggle() {
        this.enabled = !this.enabled;
        return this.enabled;
    }
    
    addArea(x, y, radius = null) {
        const r = radius || this.fogRadius;
        
        if (this.fogAction === 'reveal') {
            this.fogAreas.push({
                id: Utils.generateId('fog'),
                x: x,
                y: y,
                radius: r,
                type: 'reveal'
            });
        } else {
            // Remove áreas reveladas nesta posição
            this.fogAreas = this.fogAreas.filter(area => {
                const dist = Utils.distance(area.x, area.y, x, y);
                return dist > (area.radius + r);
            });
        }
        
        console.log(`🌫️ Fog: ${this.fogAction} em (${Math.round(x)}, ${Math.round(y)})`);
    }
    
    removeArea(areaId) {
        this.fogAreas = this.fogAreas.filter(area => area.id !== areaId);
    }
    
    clearAll() {
        this.fogAreas = [];
        console.log('🌫️ Fog: Todas as áreas limpas');
    }
    
    draw(targetCtx) {
        if (!this.enabled) return;
        
        // Limpa o canvas de fog
        this.fogCtx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);
        
        // Preenche tudo com névoa escura
        this.fogCtx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        this.fogCtx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
        
        // Cria "buracos" nas áreas reveladas
        this.fogCtx.globalCompositeOperation = 'destination-out';
        
        this.fogAreas.forEach(area => {
            // Gradiente radial para transição suave
            const gradient = this.fogCtx.createRadialGradient(
                area.x, area.y, 0,
                area.x, area.y, area.radius
            );
            gradient.addColorStop(0, 'rgba(0, 0, 0, 1)');
            gradient.addColorStop(0.7, 'rgba(0, 0, 0, 0.8)');
            gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
            
            this.fogCtx.fillStyle = gradient;
            this.fogCtx.beginPath();
            this.fogCtx.arc(area.x, area.y, area.radius, 0, Math.PI * 2);
            this.fogCtx.fill();
        });
        
        // Restaura composite operation
        this.fogCtx.globalCompositeOperation = 'source-over';
        
        // Desenha fog no canvas principal
        targetCtx.drawImage(this.fogCanvas, 0, 0);
    }
    
    drawPreview(targetCtx, x, y) {
        if (!this.fogMode) return;
        
        // Desenha círculo de preview
        targetCtx.save();
        targetCtx.strokeStyle = this.fogAction === 'reveal' ? '#2ed573' : '#e74c3c';
        targetCtx.lineWidth = 3;
        targetCtx.setLineDash([10, 5]);
        targetCtx.beginPath();
        targetCtx.arc(x, y, this.fogRadius, 0, Math.PI * 2);
        targetCtx.stroke();
        targetCtx.setLineDash([]);
        targetCtx.restore();
    }
    
    updateModeIndicator() {
        let indicator = document.getElementById('fogModeIndicator');
        
        if (this.fogMode) {
            if (!indicator) {
                indicator = document.createElement('div');
                indicator.id = 'fogModeIndicator';
                indicator.className = 'fog-mode-indicator';
                document.body.appendChild(indicator);
            }
            
            const actionText = this.fogAction === 'reveal' ? 'Revelar' : 'Ocultar';
            indicator.textContent = `🌫️ Modo Fog: ${actionText} (Raio: ${this.fogRadius}px)`;
            indicator.classList.add('show');
        } else {
            if (indicator) {
                indicator.classList.remove('show');
            }
        }
    }
    
    exportData() {
        return {
            enabled: this.enabled,
            areas: this.fogAreas
        };
    }
    
    importData(data) {
        if (data) {
            this.enabled = data.enabled !== undefined ? data.enabled : true;
            this.fogAreas = data.areas || [];
            console.log(`🌫️ Fog importado: ${this.fogAreas.length} áreas`);
        }
    }
}

window.FogOfWar = FogOfWar;
console.log('🌫️ FogOfWar.js carregado com sucesso!');