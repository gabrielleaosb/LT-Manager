// ==========================================
// CHAT WHATSAPP MODULE - Sistema de Chat
// ==========================================

let chatContacts = [];
let currentChatContact = null;
let currentConversation = [];
let chatMinimized = false;
let chatCollapsed = false;
let messageIds = new Set();

// ==================
// TOGGLE CHAT
// ==================
function toggleChatMinimize() {
    chatMinimized = !chatMinimized;
    const chatContainer = document.getElementById('chatContainer');
    const icon = document.getElementById('chatMinimizeIcon');
    
    if (chatMinimized) {
        chatContainer.classList.add('minimized');
        chatContainer.classList.remove('collapsed');
        if (icon) icon.textContent = '▲';
    } else {
        chatContainer.classList.remove('minimized');
        if (icon) icon.textContent = '▼';
        loadChatContacts();
    }
}

function toggleChatCollapse() {
    chatCollapsed = !chatCollapsed;
    const chatContainer = document.getElementById('chatContainer');
    
    if (chatCollapsed) {
        chatContainer.classList.add('collapsed');
        chatContainer.classList.remove('minimized');
    } else {
        chatContainer.classList.remove('collapsed');
        if (chatMinimized) {
            chatContainer.classList.add('minimized');
        }
    }
}

// ==================
// WEBSOCKET HANDLERS
// ==================
function handleReceiveMessage(data) {
    console.log('📩 Mensagem recebida:', data);
    
    // Evitar duplicação
    if (messageIds.has(data.id)) {
        console.log('⚠️ Mensagem duplicada ignorada:', data.id);
        return;
    }
    messageIds.add(data.id);
    
    // Se é da conversa atual, adiciona
    if (currentChatContact && 
        (data.sender_id === currentChatContact || data.recipient_id === currentChatContact)) {
        currentConversation.push(data);
        renderConversation();
        
        // Auto-scroll
        const messagesContainer = document.getElementById('conversationMessages');
        if (messagesContainer) {
            setTimeout(() => {
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }, 50);
        }
    }
    
    // Notificação se não for própria
    if (data.sender_id !== 'master') {
        playNotificationSound();
        window.toolsModule.showToast(`Nova mensagem de ${data.sender_name}`);
    }
    
    // Recarregar contatos
    setTimeout(() => loadChatContacts(), 100);
}

function handleContactsLoaded(data) {
    chatContacts = data.contacts || [];
    renderChatContacts();
}

function handleConversationLoaded(data) {
    currentConversation = data.messages || [];
    messageIds.clear();
    
    // Adicionar IDs ao Set
    currentConversation.forEach(msg => {
        messageIds.add(msg.id);
    });
    
    renderConversation();
    
    // Auto-scroll
    const messagesContainer = document.getElementById('conversationMessages');
    if (messagesContainer) {
        setTimeout(() => {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }, 50);
    }
}

// ==================
// CARREGAR CONTATOS
// ==================
function loadChatContacts() {
    window.socketModule.socket.emit('get_contacts', {
        session_id: window.SESSION_ID,
        user_id: 'master'
    });
}

// ==================
// RENDERIZAR CONTATOS
// ==================
function renderChatContacts() {
    const contactsList = document.getElementById('contactsList');
    if (!contactsList) return;
    
    contactsList.innerHTML = '';
    
    if (chatContacts.length === 0) {
        contactsList.innerHTML = '<div class="empty-state">Nenhum contato</div>';
        return;
    }
    
    chatContacts.forEach(contact => {
        const item = document.createElement('div');
        item.className = 'contact-item';
        if (currentChatContact === contact.id) {
            item.classList.add('active');
        }
        
        item.onclick = () => openConversation(contact.id);
        
        item.innerHTML = `
            <div class="contact-avatar">${contact.name.charAt(0).toUpperCase()}</div>
            <div class="contact-name">${contact.name}</div>
        `;
        
        contactsList.appendChild(item);
    });
}

// ==================
// ABRIR CONVERSA
// ==================
function openConversation(contactId) {
    currentChatContact = contactId;
    
    // Atualizar UI
    document.querySelectorAll('.contact-item').forEach(item => item.classList.remove('active'));
    event.currentTarget?.classList.add('active');
    
    // Limpar mensagens
    currentConversation = [];
    messageIds.clear();
    
    // Carregar do servidor
    window.socketModule.socket.emit('get_conversation', {
        session_id: window.SESSION_ID,
        user_id: 'master',
        other_user_id: contactId
    });
    
    // Mostrar área de conversa
    document.getElementById('conversationPlaceholder').style.display = 'none';
    document.getElementById('conversationArea').style.display = 'flex';
    
    // Atualizar header
    const contact = chatContacts.find(c => c.id === contactId);
    if (contact) {
        document.getElementById('conversationContactName').textContent = contact.name;
        document.getElementById('conversationContactAvatar').textContent = contact.name.charAt(0).toUpperCase();
    }
}

// ==================
// RENDERIZAR CONVERSA
// ==================
function renderConversation() {
    const messagesContainer = document.getElementById('conversationMessages');
    if (!messagesContainer) return;
    
    messagesContainer.innerHTML = '';
    
    if (currentConversation.length === 0) {
        messagesContainer.innerHTML = '<div class="empty-state">Nenhuma mensagem ainda</div>';
        return;
    }
    
    currentConversation.forEach(msg => {
        const bubble = document.createElement('div');
        bubble.className = msg.sender_id === 'master' ? 'message-bubble sent' : 'message-bubble received';
        
        const time = new Date(msg.timestamp).toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit'
        });
        
        bubble.innerHTML = `
            <div class="message-text">${escapeHtml(msg.message)}</div>
            <div class="message-time">${time}</div>
        `;
        
        messagesContainer.appendChild(bubble);
    });
}

// ==================
// ENVIAR MENSAGEM
// ==================
function sendChatMessage() {
    const input = document.getElementById('conversationInput');
    const message = input.value.trim();
    
    if (!message || !currentChatContact) {
        return;
    }
    
    window.socketModule.socket.emit('send_message', {
        session_id: window.SESSION_ID,
        sender_id: 'master',
        recipient_id: currentChatContact,
        message: message
    });
    
    input.value = '';
}

// ==================
// UTILITÁRIOS
// ==================
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

function playNotificationSound() {
    try {
        const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIGGa88OScTgwOWK3n77BdGAg+ltf');
        audio.volume = 0.2;
        audio.play().catch(() => {});
    } catch (e) {
        console.log('Não foi possível tocar som');
    }
}

// ==================
// ENTER PARA ENVIAR
// ==================
document.addEventListener('DOMContentLoaded', () => {
    const conversationInput = document.getElementById('conversationInput');
    if (conversationInput) {
        conversationInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendChatMessage();
            }
        });
    }
    
    // Carregar contatos ao iniciar
    setTimeout(() => {
        loadChatContacts();
    }, 1000);
});

// Exportar funções
window.chatModule = {
    toggleChatMinimize,
    toggleChatCollapse,
    loadChatContacts,
    openConversation,
    sendChatMessage,
    handleReceiveMessage,
    handleContactsLoaded,
    handleConversationLoaded
};