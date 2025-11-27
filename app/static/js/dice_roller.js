/* dice_rollet.js
   - Fundo hexagonal animado + partículas
   - Lógica do rolador de dados + histórico
*/

// -----------------------------
// BACKGROUND: HEX GRID + PARTICLES
// -----------------------------
const canvas = document.getElementById('gridCanvas');
const ctx = canvas.getContext('2d');

let w = canvas.width = window.innerWidth;
let h = canvas.height = window.innerHeight;

const hexSize = 40;
const hexagons = [];
const mouse = { x: -9999, y: -9999 };

// criar grid hexagonal
function createHexGrid() {
    hexagons.length = 0;
    const cols = Math.ceil(w / (hexSize * 1.5)) + 2;
    const rows = Math.ceil(h / (hexSize * Math.sqrt(3))) + 2;

    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const x = col * hexSize * 1.5;
            const y = row * hexSize * Math.sqrt(3) + (col % 2) * (hexSize * Math.sqrt(3) / 2);
            hexagons.push({ x, y, opacity: 0.08, glowIntensity: 0 });
        }
    }
}

// partículas
const particles = [];
const PARTICLE_COUNT = 28;
for (let i = 0; i < PARTICLE_COUNT; i++) {
    particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        dx: (Math.random() - 0.5) * 0.6,
        dy: (Math.random() - 0.5) * 0.6,
        r: Math.random() * 2 + 0.8,
        opacity: Math.random() * 0.5 + 0.25
    });
}

// desenhar hexagono
function drawHexagon(x, y, size, opacity, glow) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i;
        const hx = x + size * Math.cos(angle);
        const hy = y + size * Math.sin(angle);
        if (i === 0) ctx.moveTo(hx, hy); else ctx.lineTo(hx, hy);
    }
    ctx.closePath();

    if (glow > 0) {
        ctx.shadowBlur = 18 * glow;
        ctx.shadowColor = `rgba(155,89,182,${Math.min(0.9, glow)})`;
    }

    ctx.strokeStyle = `rgba(155,89,182,${opacity})`;
    ctx.lineWidth = 1.3;
    ctx.stroke();

    ctx.shadowBlur = 0;
}

// animação
function animateBackground() {
    // fundo radial
    const gradient = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) / 1.2);
    gradient.addColorStop(0, "#171725");
    gradient.addColorStop(1, "#05050a");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, w, h);

    // hexágonos
    hexagons.forEach(hex => {
        // distância para mouse
        const dist = Math.hypot(hex.x - mouse.x, hex.y - mouse.y);
        if (dist < 160) {
            hex.glowIntensity = Math.max(hex.glowIntensity, 1 - dist / 160);
            hex.opacity = 0.08 + hex.glowIntensity * 0.5;
        } else {
            hex.glowIntensity *= 0.92;
            hex.opacity = 0.08 + hex.glowIntensity * 0.5;
        }
        drawHexagon(hex.x, hex.y, hexSize, hex.opacity, hex.glowIntensity);
    });

    // partículas
    particles.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(155,89,182,${p.opacity})`;
        ctx.shadowBlur = 8;
        ctx.shadowColor = `rgba(155,89,182,${p.opacity})`;
        ctx.fill();
        ctx.shadowBlur = 0;

        p.x += p.dx;
        p.y += p.dy;

        if (p.x < -10 || p.x > w + 10) p.dx *= -1;
        if (p.y < -10 || p.y > h + 10) p.dy *= -1;
    });

    requestAnimationFrame(animateBackground);
}

// eventos do mouse e resize
window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
});
window.addEventListener('mouseleave', () => { mouse.x = -9999; mouse.y = -9999; });
window.addEventListener('resize', () => {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
    // reposicionar partículas levemente dentro do novo tamanho
    particles.forEach(p => {
        p.x = Math.min(Math.max(p.x, 0), w);
        p.y = Math.min(Math.max(p.y, 0), h);
    });
    createHexGrid();
});

// inicializa fundo
createHexGrid();
animateBackground();

// -----------------------------
// DICE ROLLER LOGIC
// -----------------------------
let history = [];

// helpers
function randInt(max) {
    return Math.floor(Math.random() * max) + 1;
}

// exibir resultado
function displayResult(value, formula, details, rolls, isCritSuccess, isCritFail, breakdown = null) {
    const display = document.getElementById('resultDisplay');
    const resultValue = document.getElementById('resultValue');
    const resultDetails = document.getElementById('resultDetails');
    const resultBreakdown = document.getElementById('resultBreakdown');

    display.classList.remove('critical-success', 'critical-failure');

    if (isCritSuccess) {
        display.classList.add('critical-success');
        resultValue.style.color = '#ffd700';
        resultDetails.textContent = '🎉 ACERTO CRÍTICO! 🎉';
    } else if (isCritFail) {
        display.classList.add('critical-failure');
        resultValue.style.color = '#e74c3c';
        resultDetails.textContent = '💀 FALHA CRÍTICA! 💀';
    } else {
        resultValue.style.color = '#2ed573';
        resultDetails.textContent = details;
    }

    resultValue.textContent = '—';
    setTimeout(() => {
        resultValue.textContent = value;
        display.style.animation = 'none';
        setTimeout(() => { display.style.animation = 'pulse 0.5s ease'; }, 10);
    }, 100);

    resultBreakdown.textContent = breakdown ? `Dados: ${breakdown}` : '';
}

// adiciona ao histórico
function addToHistory(formula, result) {
    const timestamp = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    history.unshift({ formula, result, timestamp });
    if (history.length > 80) history = history.slice(0, 80);
    renderHistory();
}

// render histórico
function renderHistory() {
    const list = document.getElementById('historyList');
    if (!history.length) {
        list.innerHTML = '<div class="empty-state">Nenhuma rolagem ainda</div>';
        return;
    }
    list.innerHTML = history.map(item => `
        <div class="history-item">
            <div class="history-roll"><strong>${item.formula}</strong> <span style="color:#666; margin-left:10px;">${item.timestamp}</span></div>
            <div class="history-result">${item.result}</div>
        </div>
    `).join('');
}

// limpar
function clearHistory() {
    if (confirm('Limpar todo o histórico?')) {
        history = [];
        renderHistory();
    }
}

// rolar dado simples
function rollDice(sides) {
    const result = randInt(sides);
    const isCritSuccess = sides === 20 && result === 20;
    const isCritFail = sides === 20 && result === 1;

    displayResult(result, `1d${sides}`, `Rolagem: 1d${sides}`, [result], isCritSuccess, isCritFail);
    addToHistory(`1d${sides}`, result);
}

// rolagem personalizada
function customRoll() {
    const count = parseInt(document.getElementById('diceCount').value) || 1;
    const type = parseInt(document.getElementById('diceType').value) || 20;
    const modifier = parseInt(document.getElementById('modifier').value) || 0;

    const rolls = [];
    let sum = 0;
    for (let i = 0; i < count; i++) {
        const r = randInt(type);
        rolls.push(r);
        sum += r;
    }
    const total = sum + modifier;
    const isCritSuccess = type === 20 && count === 1 && rolls[0] === 20;
    const isCritFail = type === 20 && count === 1 && rolls[0] === 1;
    const formula = `${count}d${type}${modifier !== 0 ? (modifier > 0 ? `+${modifier}` : modifier) : ''}`;
    const breakdown = rolls.join(' + ') + (modifier !== 0 ? ` ${modifier > 0 ? '+' : ''}${modifier}` : '');

    displayResult(total, formula, `Rolagem: ${formula}`, rolls, isCritSuccess, isCritFail, breakdown);
    addToHistory(formula, total);
}

// Atalhos e listeners - aguarda DOM
document.addEventListener('DOMContentLoaded', () => {
    // dice buttons
    document.querySelectorAll('.dice-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const sides = parseInt(btn.dataset.sides);
            rollDice(sides);
        });
    });

    // custom
    const customBtn = document.getElementById('customRollBtn');
    if (customBtn) customBtn.addEventListener('click', customRoll);

    // clear history
    const clearBtn = document.getElementById('clearHistoryBtn');
    if (clearBtn) clearBtn.addEventListener('click', clearHistory);

    // back button
    const backBtn = document.getElementById('backBtn');
    if (backBtn) backBtn.addEventListener('click', () => { window.location.href = '/dashboard'; });

    // inicial render do histórico
    renderHistory();

    // Enter para rolagem rápida (quando não estiver em um input)
    document.addEventListener('keydown', (e) => {
        const active = document.activeElement;
        if (e.key === 'Enter' && (!active || (active.tagName !== 'INPUT' && active.tagName !== 'SELECT' && active.tagName !== 'TEXTAREA'))) {
            customRoll();
        }
    });
});
