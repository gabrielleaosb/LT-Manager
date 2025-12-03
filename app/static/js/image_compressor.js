// ==========================================
// COMPRESSOR DE IMAGENS
// ==========================================

const ImageCompressor = {
    // Configurações padrão
    MAX_WIDTH: 1920,
    MAX_HEIGHT: 1920,
    QUALITY: 0.85, // 85% de qualidade
    
    /**
     * Comprimir imagem mantendo proporção
     * @param {string} base64Image - Imagem em base64
     * @param {number} maxWidth - Largura máxima
     * @param {number} maxHeight - Altura máxima
     * @param {number} quality - Qualidade (0-1)
     * @returns {Promise<string>} - Imagem comprimida em base64
     */
    compress(base64Image, maxWidth = this.MAX_WIDTH, maxHeight = this.MAX_HEIGHT, quality = this.QUALITY) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            
            img.onload = () => {
                try {
                    // Calcular novas dimensões mantendo proporção
                    let width = img.width;
                    let height = img.height;
                    
                    console.log('🖼️ Imagem original:', width + 'x' + height);
                    
                    // Se já é pequena, não comprimir
                    if (width <= maxWidth && height <= maxHeight) {
                        console.log('✅ Imagem já está no tamanho ideal');
                        resolve(base64Image);
                        return;
                    }
                    
                    // Calcular escala
                    const scaleWidth = maxWidth / width;
                    const scaleHeight = maxHeight / height;
                    const scale = Math.min(scaleWidth, scaleHeight);
                    
                    width = Math.floor(width * scale);
                    height = Math.floor(height * scale);
                    
                    console.log('📐 Nova dimensão:', width + 'x' + height);
                    
                    // Criar canvas para redimensionar
                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    
                    const ctx = canvas.getContext('2d');
                    
                    // Melhorar qualidade do redimensionamento
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'high';
                    
                    // Desenhar imagem redimensionada
                    ctx.drawImage(img, 0, 0, width, height);
                    
                    // Converter para base64 com compressão
                    const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
                    
                    // Calcular redução de tamanho
                    const originalSize = (base64Image.length * 0.75 / 1024 / 1024).toFixed(2);
                    const compressedSize = (compressedBase64.length * 0.75 / 1024 / 1024).toFixed(2);
                    const reduction = ((1 - compressedBase64.length / base64Image.length) * 100).toFixed(1);
                    
                    console.log('✅ Compressão concluída:');
                    console.log('   Original:', originalSize + 'MB');
                    console.log('   Comprimida:', compressedSize + 'MB');
                    console.log('   Redução:', reduction + '%');
                    
                    resolve(compressedBase64);
                    
                } catch (error) {
                    console.error('❌ Erro ao comprimir:', error);
                    reject(error);
                }
            };
            
            img.onerror = () => {
                reject(new Error('Erro ao carregar imagem'));
            };
            
            img.src = base64Image;
        });
    },
    
    /**
     * Comprimir múltiplas imagens
     */
    async compressMultiple(images, onProgress = null) {
        const results = [];
        
        for (let i = 0; i < images.length; i++) {
            try {
                const compressed = await this.compress(images[i]);
                results.push(compressed);
                
                if (onProgress) {
                    onProgress((i + 1) / images.length * 100);
                }
            } catch (error) {
                console.error('Erro ao comprimir imagem', i, error);
                results.push(images[i]); // Manter original se falhar
            }
        }
        
        return results;
    },
    
    /**
     * Verificar tamanho de dados no localStorage
     */
    getLocalStorageSize() {
        let total = 0;
        
        for (let key in localStorage) {
            if (localStorage.hasOwnProperty(key)) {
                total += localStorage[key].length + key.length;
            }
        }
        
        return (total / 1024 / 1024).toFixed(2); // MB
    },
    
    /**
     * Verificar se há espaço disponível
     */
    hasSpaceFor(dataSize) {
        const currentSize = parseFloat(this.getLocalStorageSize());
        const maxSize = 5; // 5MB limite estimado
        
        return (currentSize + dataSize) < maxSize;
    }
};

// Exportar para uso global
window.ImageCompressor = ImageCompressor;