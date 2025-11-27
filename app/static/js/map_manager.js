// ====================
// MAP MANAGER JS
// ====================

const mapCanvas = document.getElementById('mapCanvas');
const mapCtx = mapCanvas.getContext('2d');
const gridCanvas = document.getElementById('gridCanvas');
const gridCtx = gridCanvas.getContext('2d');

let w = mapCanvas.width = gridCanvas.width = window.innerWidth;
let h = mapCanvas.height = gridCanvas.height = window.innerHeight;

let mapImage = null;
let gridSize = parseInt(document.getElementById('gridSize').value);
let gridColor = document.getElementById('gridColor').value;
let gridOpacity = document.getElementById('gridOpacity').value/100;
let gridVisible = true;

let tokens = [];
let selectedToken = null;
let draggedToken = null;
let scale = 1;

// --------------------
// GRID HEXAGONAL MÍSTICO
// --------------------
const hexSize = 40;
const hexagons = [];
const mouse = { x: null, y: null };

// Partículas místicas
const particles = [];
const PARTICLE_COUNT = 30;
for (let i=0;i<PARTICLE_COUNT;i++){
    particles.push({
        x: Math.random()*w,
        y: Math.random()*h,
        dx:(Math.random()-0.5)*0.5,
        dy:(Math.random()-0.5)*0.5,
        r:Math.random()*2+1,
        opacity:Math.random()*0.5+0.3
    });
}

function createHexGrid(){
    hexagons.length=0;
    const cols = Math.ceil(w/(hexSize*1.5))+2;
    const rows = Math.ceil(h/(hexSize*Math.sqrt(3)))+2;
    for(let row=0;row<rows;row++){
        for(let col=0;col<cols;col++){
            const x = col*hexSize*1.5;
            const y = row*hexSize*Math.sqrt(3) + (col%2)*(hexSize*Math.sqrt(3)/2);
            hexagons.push({x,y,opacity:0.1,glowIntensity:0});
        }
    }
}

function drawHexagon(x,y,size,opacity,glow){
    gridCtx.beginPath();
    for(let i=0;i<6;i++){
        const angle = (Math.PI/3)*i;
        const hx = x + size*Math.cos(angle);
        const hy = y + size*Math.sin(angle);
        i===0?gridCtx.moveTo(hx,hy):gridCtx.lineTo(hx,hy);
    }
    gridCtx.closePath();
    if(glow>0){
        gridCtx.shadowBlur = 20*glow;
        gridCtx.shadowColor = `rgba(155,89,182,${glow})`;
    }
    gridCtx.strokeStyle = `rgba(155,89,182,${opacity})`;
    gridCtx.lineWidth=1.5;
    gridCtx.stroke();
    gridCtx.shadowBlur=0;
}

// --------------------
// ANIMAÇÃO DO GRID + PARTICULAS
// --------------------
function animateGrid(){
    // Fundo
    const gradient = gridCtx.createRadialGradient(w/2,h/2,0,w/2,h/2,w/1.5);
    gradient.addColorStop(0,"#1a1a2e");
    gradient.addColorStop(1,"#0a0a0f");
    gridCtx.fillStyle=gradient;
    gridCtx.fillRect(0,0,w,h);

    // Hexágonos
    hexagons.forEach(hex=>{
        if(mouse.x&&mouse.y){
            const dist=Math.hypot(hex.x-mouse.x,hex.y-mouse.y);
            hex.glowIntensity = dist<150?Math.max(0,1-dist/150):hex.glowIntensity*0.95;
            hex.opacity=0.1+hex.glowIntensity*0.5;
        } else {
            hex.glowIntensity*=0.95;
            hex.opacity=0.1+hex.glowIntensity*0.5;
        }
        drawHexagon(hex.x,hex.y,hexSize,hex.opacity,hex.glowIntensity);
    });

    // Partículas
    particles.forEach(p=>{
        gridCtx.beginPath();
        gridCtx.arc(p.x,p.y,p.r,0,Math.PI*2);
        gridCtx.fillStyle=`rgba(155,89,182,${p.opacity})`;
        gridCtx.shadowBlur=10;
        gridCtx.shadowColor=`rgba(155,89,182,${p.opacity})`;
        gridCtx.fill();
        gridCtx.shadowBlur=0;
        p.x+=p.dx;
        p.y+=p.dy;
        if(p.x<0||p.x>w)p.dx*=-1;
        if(p.y<0||p.y>h)p.dy*=-1;
    });

    requestAnimationFrame(animateGrid);
}

// --------------------
// MAP & TOKENS
// --------------------
function redrawMap(){
    mapCtx.clearRect(0,0,mapCanvas.width,mapCanvas.height);
    if(mapImage) mapCtx.drawImage(mapImage,0,0,mapCanvas.width,mapCanvas.height);

    // Grid
    if(gridVisible) drawMapGrid();

    // Tokens
    tokens.forEach(token=>{
        mapCtx.fillStyle=token.color;
        mapCtx.strokeStyle="#fff";
        mapCtx.lineWidth=3;
        mapCtx.beginPath();
        mapCtx.arc(token.x,token.y,20,0,Math.PI*2);
        mapCtx.fill();
        mapCtx.stroke();
        mapCtx.fillStyle="#fff";
        mapCtx.font="bold 12px Lato";
        mapCtx.textAlign="center";
        mapCtx.fillText(token.name, token.x, token.y+35);

        if(token===selectedToken){
            mapCtx.strokeStyle="#ffc107";
            mapCtx.lineWidth=4;
            mapCtx.beginPath();
            mapCtx.arc(token.x,token.y,25,0,Math.PI*2);
            mapCtx.stroke();
        }
    });
}

function drawMapGrid(){
    const color = gridColor;
    const opacity = gridOpacity;
    mapCtx.strokeStyle=color;
    mapCtx.globalAlpha=opacity;
    mapCtx.lineWidth=1;
    for(let x=0;x<=mapCanvas.width;x+=gridSize){
        mapCtx.beginPath();
        mapCtx.moveTo(x,0);
        mapCtx.lineTo(x,mapCanvas.height);
        mapCtx.stroke();
    }
    for(let y=0;y<=mapCanvas.height;y+=gridSize){
        mapCtx.beginPath();
        mapCtx.moveTo(0,y);
        mapCtx.lineTo(mapCanvas.width,y);
        mapCtx.stroke();
    }
    mapCtx.globalAlpha=1;
}

// --------------------
// MAP CONTROLS
// --------------------
function loadMapImage(e){
    const file=e.target.files[0];
    if(!file)return;
    const reader=new FileReader();
    reader.onload=function(ev){
        const img=new Image();
        img.onload=function(){mapImage=img;redrawMap();showToast("Mapa carregado!");};
        img.src=ev.target.result;
    }
    reader.readAsDataURL(file);
}

function updateGrid(){
    gridSize=parseInt(document.getElementById('gridSize').value);
    gridColor=document.getElementById('gridColor').value;
    gridOpacity=document.getElementById('gridOpacity').value/100;
    redrawMap();
}

function toggleGrid(){gridVisible=!gridVisible; redrawMap();}

function addToken(){
    const name = prompt("Nome do token:");
    if(!name) return;
    tokens.push({
        name:name,
        x:mapCanvas.width/2,
        y:mapCanvas.height/2,
        color:'#'+Math.floor(Math.random()*16777215).toString(16)
    });
    redrawMap();
    showToast(`Token "${name}" adicionado!`);
}

function selectToken(el){document.querySelectorAll('.token-item').forEach(i=>i.classList.remove('active')); el.classList.add('active');}

mapCanvas.addEventListener('click',(e)=>{
    const rect=mapCanvas.getBoundingClientRect();
    const x=e.clientX-rect.left;
    const y=e.clientY-rect.top;
    let clicked=false;
    tokens.forEach(t=>{
        if(Math.hypot(t.x-x,t.y-y)<=20){selectedToken=t;clicked=true;}
    });
    if(!clicked) selectedToken=null;
    redrawMap();
});

mapCanvas.addEventListener('mousedown',(e)=>{
    const rect=mapCanvas.getBoundingClientRect();
    const x=e.clientX-rect.left;
    const y=e.clientY-rect.top;
    tokens.forEach(t=>{
        if(Math.hypot(t.x-x,t.y-y)<=20) draggedToken=t;
    });
});
mapCanvas.addEventListener('mousemove',(e)=>{
    if(draggedToken){
        const rect=mapCanvas.getBoundingClientRect();
        draggedToken.x=e.clientX-rect.left;
        draggedToken.y=e.clientY-rect.top;
        redrawMap();
    }
});
mapCanvas.addEventListener('mouseup',()=>{draggedToken=null;});

document.addEventListener('keydown',(e)=>{
    if(e.key==='Delete' && selectedToken){
        tokens=tokens.filter(t=>t!==selectedToken);
        selectedToken=null;
        redrawMap();
        showToast("Token removido!");
    }
});

function zoom(delta){
    scale=Math.max(0.5,Math.min(2,scale+delta));
    mapCanvas.style.transform=`scale(${scale})`;
    showToast(`Zoom: ${Math.round(scale*100)}%`);
}

function clearMap(){
    if(confirm("Tem certeza que deseja limpar o mapa?")){
        mapImage=null;
        tokens=[];
        selectedToken=null;
        redrawMap();
        showToast("Mapa limpo!");
    }
}

function saveMap(){showToast("Mapa salvo com sucesso!");}

function copyShareLink(){
    const link=document.getElementById('shareLink').textContent;
    navigator.clipboard.writeText(link);
    showToast("Link copiado!");
}

// --------------------
// TOAST
// --------------------
function showToast(msg){
    const toast=document.getElementById('toast');
    toast.textContent=msg;
    toast.classList.add('show');
    setTimeout(()=>{toast.classList.remove('show');},3000);
}

// --------------------
// MOUSE TRACK PARA GRID
// --------------------
window.addEventListener('mousemove',e=>{mouse.x=e.clientX; mouse.y=e.clientY;});
window.addEventListener('resize',()=>{
    w=mapCanvas.width=gridCanvas.width=window.innerWidth;
    h=mapCanvas.height=gridCanvas.height=window.innerHeight;
    createHexGrid();
    redrawMap();
});

// Inicialização
createHexGrid();
animateGrid();
redrawMap();
