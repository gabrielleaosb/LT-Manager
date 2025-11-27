// Sistema de Notas do Mestre
let notes = [];
let currentCategory = 'all';
let editingNoteId = null;

// Carregar notas do localStorage
function loadNotes() {
    const saved = localStorage.getItem('rpg_notes');
    if (saved) {
        notes = JSON.parse(saved);
    }
    renderNotes();
    updateCategoryCounts();
}

// Salvar notas no localStorage
function saveNotesToStorage() {
    localStorage.setItem('rpg_notes', JSON.stringify(notes));
}

// Abrir modal para nova nota
function openNoteModal() {
    editingNoteId = null;
    document.getElementById('modalTitle').textContent = 'Nova Nota';
    document.getElementById('noteTitle').value = '';
    document.getElementById('noteCategory').value = 'npcs';
    document.getElementById('noteContent').value = '';
    document.getElementById('noteModal').classList.add('show');
}

// Fechar modal
function closeNoteModal() {
    document.getElementById('noteModal').classList.remove('show');
    editingNoteId = null;
}

// Salvar nota
function saveNote() {
    const title = document.getElementById('noteTitle').value.trim();
    const category = document.getElementById('noteCategory').value;
    const content = document.getElementById('noteContent').value.trim();
    
    if (!title) {
        alert('Por favor, digite um título para a nota');
        return;
    }
    
    if (!content) {
        alert('Por favor, escreva algum conteúdo na nota');
        return;
    }
    
    if (editingNoteId) {
        // Editar nota existente
        const note = notes.find(n => n.id === editingNoteId);
        if (note) {
            note.title = title;
            note.category = category;
            note.content = content;
            note.updatedAt = new Date().toISOString();
        }
        showToast('Nota atualizada com sucesso!');
    } else {
        // Criar nova nota
        const newNote = {
            id: Date.now(),
            title: title,
            category: category,
            content: content,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        notes.unshift(newNote);
        showToast('Nota criada com sucesso!');
    }
    
    saveNotesToStorage();
    renderNotes();
    updateCategoryCounts();
    closeNoteModal();
}

// Editar nota
function editNote(noteId) {
    const note = notes.find(n => n.id === noteId);
    if (!note) return;
    
    editingNoteId = noteId;
    document.getElementById('modalTitle').textContent = 'Editar Nota';
    document.getElementById('noteTitle').value = note.title;
    document.getElementById('noteCategory').value = note.category;
    document.getElementById('noteContent').value = note.content;
    document.getElementById('noteModal').classList.add('show');
}

// Deletar nota
function deleteNote(noteId) {
    if (confirm('Tem certeza que deseja excluir esta nota?')) {
        notes = notes.filter(n => n.id !== noteId);
        saveNotesToStorage();
        renderNotes();
        updateCategoryCounts();
        showToast('Nota excluída');
    }
}

// Renderizar notas
function renderNotes() {
    const grid = document.getElementById('notesGrid');
    const searchTerm = document.getElementById('searchBox').value.toLowerCase();
    
    // Filtrar notas
    let filteredNotes = notes;
    
    if (currentCategory !== 'all') {
        filteredNotes = notes.filter(n => n.category === currentCategory);
    }
    
    if (searchTerm) {
        filteredNotes = filteredNotes.filter(n => 
            n.title.toLowerCase().includes(searchTerm) || 
            n.content.toLowerCase().includes(searchTerm)
        );
    }
    
    // Renderizar
    if (filteredNotes.length === 0) {
        grid.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📝</div>
                <p>${searchTerm ? 'Nenhuma nota encontrada' : 'Nenhuma nota nesta categoria'}</p>
                <p style="font-size: 0.9rem; margin-top: 10px; color: #888;">
                    ${searchTerm ? 'Tente buscar por outros termos' : 'Clique em "Nova Nota" para começar'}
                </p>
            </div>
        `;
        return;
    }
    
    grid.innerHTML = filteredNotes.map(note => {
        const date = new Date(note.updatedAt);
        const formattedDate = date.toLocaleDateString('pt-BR', { 
            day: '2-digit', 
            month: '2-digit', 
            year: 'numeric' 
        });
        
        const categoryIcons = {
            npcs: '👥',
            locations: '🏰',
            quests: '⚔️',
            items: '💎',
            lore: '📖',
            other: '📌'
        };
        
        return `
            <div class="note-card" onclick="editNote(${note.id})">
                <div class="note-card-header">
                    <div class="note-title">
                        ${categoryIcons[note.category] || '📌'} ${note.title}
                    </div>
                    <div class="note-actions">
                        <button class="note-action-btn" onclick="editNote(${note.id}); event.stopPropagation();">✏️</button>
                        <button class="note-action-btn delete" onclick="deleteNote(${note.id}); event.stopPropagation();">🗑️</button>
                    </div>
                </div>
                <div class="note-content">${note.content}</div>
                <div class="note-footer">
                    Atualizado em ${formattedDate}
                </div>
            </div>
        `;
    }).join('');
}

// Atualizar contadores de categorias
function updateCategoryCounts() {
    document.getElementById('count-all').textContent = notes.length;
    
    const categories = ['npcs', 'locations', 'quests', 'items', 'lore', 'other'];
    categories.forEach(cat => {
        const count = notes.filter(n => n.category === cat).length;
        const element = document.getElementById(`count-${cat}`);
        if (element) {
            element.textContent = count;
        }
    });
}

// Selecionar categoria
function selectCategory(category) {
    currentCategory = category;
    
    // Atualizar visual
    document.querySelectorAll('.category-item').forEach(item => {
        item.classList.remove('active');
    });
    event.currentTarget.classList.add('active');
    
    // Atualizar título
    const categoryTitles = {
        all: '📋 Todas as Notas',
        npcs: '👥 NPCs',
        locations: '🏰 Locais',
        quests: '⚔️ Missões',
        items: '💎 Itens',
        lore: '📖 História',
        other: '📌 Outros'
    };
    
    document.getElementById('currentCategoryTitle').textContent = categoryTitles[category] || category;
    
    renderNotes();
}

// Busca em tempo real
document.addEventListener('DOMContentLoaded', () => {
    const searchBox = document.getElementById('searchBox');
    if (searchBox) {
        searchBox.addEventListener('input', renderNotes);
    }
    
    // Event listeners para categorias
    document.querySelectorAll('.category-item').forEach(item => {
        item.addEventListener('click', function() {
            const category = this.dataset.category;
            currentCategory = category;
            selectCategory.call(this, category);
        });
    });
    
    // Carregar notas
    loadNotes();
});

// Adicionar categoria customizada (para implementação futura)
function addCustomCategory() {
    const categoryName = prompt('Nome da nova categoria:');
    if (categoryName && categoryName.trim()) {
        showToast('Funcionalidade em desenvolvimento');
        // TODO: Implementar categorias customizadas
    }
}

// Toast notification
function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Fechar modal com ESC
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeNoteModal();
    }
});