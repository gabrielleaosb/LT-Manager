/* ========================
   BACKGROUND ANIMADO
======================== */
const hexBg = document.getElementById("hexBg");

for (let i = 0; i < 90; i++) {
    const h = document.createElement("div");
    h.classList.add("hex");
    h.style.left = Math.random() * 100 + "%";
    h.style.top = Math.random() * 100 + "%";
    h.style.animationDelay = (Math.random() * 5) + "s";
    h.style.transform = `scale(${0.6 + Math.random() * 0.8})`;
    hexBg.appendChild(h);
}

/* ========================
   COMBAT TRACKER
======================== */

let combatants = [];
let currentTurn = 0;
let currentRound = 1;
let modalTarget = null;

// Inicialização com personagens
function initializeCombat() {
    combatants = [
        { name: 'Kael (Guerreiro)', init: 18, hpCurrent: 45, hpMax: 45, type: 'player', conditions: [] },
        { name: 'Luna (Maga)', init: 15, hpCurrent: 28, hpMax: 28, type: 'player', conditions: [] },
        { name: 'Goblin Chefe', init: 14, hpCurrent: 32, hpMax: 32, type: 'monster', conditions: [] },
        { name: 'Goblin 1', init: 10, hpCurrent: 15, hpMax: 15, type: 'monster', conditions: [] },
        { name: 'Goblin 2', init: 8, hpCurrent: 15, hpMax: 15, type: 'monster', conditions: [] },
    ];
    sortInitiative();
    renderCombatants();
}

function renderCombatants() {
    const list = document.getElementById("combatantList");
    list.innerHTML = "";

    combatants.forEach((c, index) => {
        const hpPercent = (c.hpCurrent / c.hpMax) * 100;
        let hpClass = "";
        if (hpPercent < 25) hpClass = "low";
        else if (hpPercent < 50) hpClass = "medium";

        const active = index === currentTurn;
        const dead = c.hpCurrent <= 0;

        const card = document.createElement("div");
        card.className = `combatant-card ${active ? "active" : ""} ${dead ? "dead" : ""}`;

        card.innerHTML = `
            <div class="combatant-init">${c.init}</div>

            <div class="combatant-info">
                <div class="combatant-name">
                    ${c.name}
                    <span class="type-badge type-${c.type}">
                        ${c.type === "player" ? "PC" : c.type === "npc" ? "NPC" : "Inimigo"}
                    </span>
                    ${dead ? '<span style="color:red;">💀 Morto</span>' : ""}
                </div>

                <div class="hp-bar-container">
                    <div class="hp-bar">
                        <div class="hp-fill ${hpClass}" style="width:${hpPercent}%"></div>
                    </div>
                    <div class="hp-text">${c.hpCurrent} / ${c.hpMax}</div>

                    <div class="hp-controls">
                        <button class="hp-btn" onclick="quickHeal(${index})">+</button>
                        <button class="hp-btn" onclick="quickDamage(${index})">−</button>
                        <button class="hp-btn" onclick="openDamageModal(${index})">⚡</button>
                    </div>
                </div>

                ${c.conditions.length > 0 ? `
                    <div class="conditions">
                        ${c.conditions.map(cond => `<span class="condition-tag">${cond}</span>`).join("")}
                    </div>
                ` : ""}
            </div>

            <div class="combatant-actions">
                <button class="action-btn" onclick="addCondition(${index})">🏷️ Condição</button>
                <button class="action-btn" onclick="editInit(${index})">✏️ Init</button>
                <button class="action-btn" onclick="removeCombatant(${index})">🗑️ Remover</button>
            </div>
        `;

        list.appendChild(card);
    });
}

/* TURN SYSTEM */
function nextTurn() {
    currentTurn++;
    if (currentTurn >= combatants.length) {
        currentTurn = 0;
        currentRound++;
        document.getElementById("roundNumber").textContent = currentRound;
    }
    document.getElementById("turnNumber").textContent = currentTurn + 1;
    renderCombatants();
}

/* INITIATIVE */
function sortInitiative() {
    combatants.sort((a, b) => b.init - a.init);
    currentTurn = 0;
    renderCombatants();
}

/* ADD FORM */
function toggleAddForm() {
    const f = document.getElementById("addForm");
    f.style.display = f.style.display === "none" ? "block" : "none";
}

function addCombatant() {
    const name = document.getElementById("newName").value;
    const init = Number(document.getElementById("newInit").value);
    const hpCurrent = Number(document.getElementById("newHpCurrent").value);
    const hpMax = Number(document.getElementById("newHpMax").value);
    const type = document.getElementById("newType").value;

    if (!name) return;

    combatants.push({ name, init, hpCurrent, hpMax, type, conditions: [] });

    sortInitiative();
    toggleAddForm();

    document.getElementById("newName").value = "";
}

/* HP CONTROLS */
function quickDamage(i) {
    combatants[i].hpCurrent = Math.max(0, combatants[i].hpCurrent - 5);
    renderCombatants();
}
function quickHeal(i) {
    combatants[i].hpCurrent = Math.min(combatants[i].hpMax, combatants[i].hpCurrent + 5);
    renderCombatants();
}

function openDamageModal(index) {
    modalTarget = index;
    document.getElementById("damageModalTitle").textContent = `Modificar HP - ${combatants[index].name}`;
    document.getElementById("damageModal").classList.add("show");
}

function closeModal() {
    document.getElementById("damageModal").classList.remove("show");
}

function applyDamage() {
    const amount = Number(document.getElementById("damageAmount").value);
    combatants[modalTarget].hpCurrent = Math.max(0, combatants[modalTarget].hpCurrent - amount);
    renderCombatants();
    closeModal();
}

function applyHealing() {
    const amount = Number(document.getElementById("damageAmount").value);
    combatants[modalTarget].hpCurrent = Math.min(combatants[modalTarget].hpMax, combatants[modalTarget].hpCurrent + amount);
    renderCombatants();
    closeModal();
}

/* CONDITIONS */
function addCondition(i) {
    const cond = prompt("Digite a condição:");
    if (cond) combatants[i].conditions.push(cond);
    renderCombatants();
}

/* EDIT INIT */
function editInit(i) {
    const nv = prompt("Nova iniciativa:", combatants[i].init);
    if (nv !== null) combatants[i].init = Number(nv);
    sortInitiative();
}

/* REMOVE */
function removeCombatant(i) {
    if (confirm(`Remover ${combatants[i].name}?`)) {
        combatants.splice(i, 1);
        if (currentTurn >= combatants.length) currentTurn = 0;
        renderCombatants();
    }
}

/* CLEAR DEAD */
function clearDead() {
    combatants = combatants.filter(c => c.hpCurrent > 0);
    currentTurn = 0;
    renderCombatants();
}

/* ROLL INIT */
function rollAllInitiative() {
    combatants.forEach(c => c.init = Math.floor(Math.random() * 20) + 1);
    sortInitiative();
}

/* END COMBAT */
function endCombat() {
    if (confirm("Finalizar combate?")) {
        alert("Combate encerrado!");
    }
}

/* START */
initializeCombat();
