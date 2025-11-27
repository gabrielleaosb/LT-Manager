// ====================
// GRID HEXAGONAL MÍSTICO
// ====================
const canvas = document.getElementById("gridCanvas");
const ctx = canvas.getContext("2d");

let w = canvas.width = window.innerWidth;
let h = canvas.height = window.innerHeight;

const hexSize = 40;
const hexagons = [];
const mouse = { x: null, y: null };

// Criar grid hexagonal
function createHexGrid() {
    hexagons.length = 0;
    const cols = Math.ceil(w / (hexSize * 1.5)) + 2;
    const rows = Math.ceil(h / (hexSize * Math.sqrt(3))) + 2;

    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const x = col * hexSize * 1.5;
            const y = row * hexSize * Math.sqrt(3) + (col % 2) * (hexSize * Math.sqrt(3) / 2);
            hexagons.push({ x, y, opacity: 0.1, glowIntensity: 0 });
        }
    }
}

// Desenhar hexágono
function drawHexagon(x, y, size, opacity, glow) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i;
        const hx = x + size * Math.cos(angle);
        const hy = y + size * Math.sin(angle);
        if (i === 0) ctx.moveTo(hx, hy);
        else ctx.lineTo(hx, hy);
    }
    ctx.closePath();
    if (glow > 0) { ctx.shadowBlur = 20 * glow; ctx.shadowColor = `rgba(155,89,182,${glow})`; }
    ctx.strokeStyle = `rgba(155,89,182,${opacity})`;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.shadowBlur = 0;
}

// Partículas místicas
const particles = [];
const PARTICLE_COUNT = 30;
for (let i = 0; i < PARTICLE_COUNT; i++) {
    particles.push({ x: Math.random()*w, y: Math.random()*h, dx:(Math.random()-0.5)*0.5, dy:(Math.random()-0.5)*0.5, r:Math.random()*2+1, opacity:Math.random()*0.5+0.3 });
}

// Loop de animação
function animate() {
    const gradient = ctx.createRadialGradient(w/2,h/2,0,w/2,h/2,w/1.5);
    gradient.addColorStop(0,"#1a1a2e");
    gradient.addColorStop(1,"#0a0a0f");
    ctx.fillStyle = gradient;
    ctx.fillRect(0,0,w,h);

    hexagons.forEach(hex => {
        if(mouse.x && mouse.y){
            const dist = Math.hypot(hex.x - mouse.x, hex.y - mouse.y);
            hex.glowIntensity = dist < 150 ? Math.max(0, 1 - dist / 150) : hex.glowIntensity * 0.95;
            hex.opacity = 0.1 + hex.glowIntensity * 0.5;
        } else { hex.glowIntensity *= 0.95; hex.opacity = 0.1 + hex.glowIntensity * 0.5; }
        drawHexagon(hex.x, hex.y, hexSize, hex.opacity, hex.glowIntensity);
    });

    particles.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
        ctx.fillStyle = `rgba(155,89,182,${p.opacity})`;
        ctx.shadowBlur=10;
        ctx.shadowColor=`rgba(155,89,182,${p.opacity})`;
        ctx.fill();
        ctx.shadowBlur=0;

        p.x += p.dx; p.y += p.dy;
        if(p.x<0||p.x>w)p.dx*=-1;
        if(p.y<0||p.y>h)p.dy*=-1;
    });

    requestAnimationFrame(animate);
}

createHexGrid();
animate();
window.addEventListener("mousemove", e=>{ mouse.x=e.clientX; mouse.y=e.clientY; });
window.addEventListener("resize", ()=>{ w=canvas.width=window.innerWidth; h=canvas.height=window.innerHeight; createHexGrid(); });

// ====================
// TYPEWRITER TITLE
// ====================
function initTextAnimation(){
    const titleEl = document.getElementById("titleText");
    const subtitleEl = document.getElementById("subtitle");
    if(!titleEl || !subtitleEl) return;

    const finalText="Dashboard";
    let index=0;
    function typeEffect(){
        if(index<finalText.length){
            titleEl.textContent=finalText.substring(0,index+1);
            index++;
            setTimeout(typeEffect,100);
        } else { titleEl.classList.add("glow-pulse"); subtitleEl.classList.add("show"); }
    }
    setTimeout(()=>{ typeEffect(); },400);
}
document.addEventListener('DOMContentLoaded', initTextAnimation);

// ====================
// REDIRECIONAMENTO PELOS BOTÕES
// ====================
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-url]').forEach(el=>{
        el.addEventListener('click', ()=>{ window.location.href = el.dataset.url; });
    });
});
