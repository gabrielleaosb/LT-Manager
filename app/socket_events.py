from flask_socketio import emit, join_room, leave_room
from flask import request
from app import socketio
import time

# Estrutura de dados das sessões
active_sessions = {}

def init_session(session_id):
    """Inicializa uma nova sessão"""
    if session_id not in active_sessions:
        active_sessions[session_id] = {
            'maps': [],
            'entities': [],
            'tokens': [],
            'drawings': [],
            'players': {},
            'permissions': {},
            'chat_conversations': {}
        }

@socketio.on('connect')
def handle_connect():
    print(f'Cliente conectado: {request.sid}')

@socketio.on('disconnect')
def handle_disconnect():
    print(f'Cliente desconectado: {request.sid}')
    
    for session_id, session_data in active_sessions.items():
        players_to_remove = [pid for pid, pdata in session_data['players'].items() 
                            if pdata.get('socket_id') == request.sid]
        for pid in players_to_remove:
            player_name = session_data['players'][pid]['name']
            del session_data['players'][pid]
            emit('player_left', {'player_id': pid, 'player_name': player_name}, 
                 room=session_id, skip_sid=request.sid)

@socketio.on('join_session')
def handle_join_session(data):
    """Mestre se conecta à sessão"""
    session_id = data.get('session_id')
    join_room(session_id)
    init_session(session_id)
    
    session_state = active_sessions[session_id]
    
    # Enviar estado completo
    emit('session_state', {
        'maps': session_state['maps'],
        'entities': session_state['entities'],
        'tokens': session_state['tokens'],
        'drawings': session_state['drawings']
    })
    
    emit('players_list', {'players': list(session_state['players'].values())})
    print(f'✅ Mestre entrou na sessão: {session_id}')

@socketio.on('player_join')
def handle_player_join(data):
    """Jogador se conecta à sessão"""
    session_id = data.get('session_id')
    player_id = data.get('player_id')
    player_name = data.get('player_name')
    
    join_room(session_id)
    init_session(session_id)
    
    active_sessions[session_id]['players'][player_id] = {
        'id': player_id,
        'name': player_name,
        'socket_id': request.sid
    }
    
    active_sessions[session_id]['permissions'][player_id] = {
        'moveTokens': [],
        'draw': False,
        'ping': True
    }
    
    # Enviar estado completo ao jogador
    session_state = active_sessions[session_id]
    emit('session_state', {
        'maps': session_state['maps'],
        'entities': session_state['entities'],
        'tokens': session_state['tokens'],
        'drawings': session_state['drawings']
    })
    
    emit('permissions_updated', {
        'player_id': player_id,
        'permissions': active_sessions[session_id]['permissions'][player_id]
    })
    
    # Notificar todos sobre novo jogador
    emit('player_joined', {'player_id': player_id, 'player_name': player_name}, 
         room=session_id, include_self=False)
    
    # Atualizar lista de jogadores para todos
    emit('players_list', {'players': list(session_state['players'].values())}, 
         room=session_id)
    
    print(f'✅ Jogador {player_name} entrou na sessão: {session_id}')

# ==================
# MAPS - TEMPO REAL CORRIGIDO
# ==================
@socketio.on('add_map')
def handle_add_map(data):
    session_id = data.get('session_id')
    map_data = data.get('map')
    
    init_session(session_id)
    active_sessions[session_id]['maps'].append(map_data)
    
    # BROADCAST para TODOS na sala (incluindo quem enviou)
    emit('maps_sync', {'maps': active_sessions[session_id]['maps']}, 
         room=session_id, include_self=True)
    print(f'📍 Mapa adicionado e enviado para todos na sessão {session_id}')

@socketio.on('update_map')
def handle_update_map(data):
    session_id = data.get('session_id')
    map_id = data.get('map_id')
    map_data = data.get('map')
    
    init_session(session_id)
    
    for i, m in enumerate(active_sessions[session_id]['maps']):
        if m['id'] == map_id:
            active_sessions[session_id]['maps'][i] = map_data
            break
    
    # BROADCAST para TODOS
    emit('maps_sync', {'maps': active_sessions[session_id]['maps']}, 
         room=session_id, include_self=True)
    print(f'📍 Mapa atualizado e enviado para todos na sessão {session_id}')

@socketio.on('delete_map')
def handle_delete_map(data):
    session_id = data.get('session_id')
    map_id = data.get('map_id')
    
    init_session(session_id)
    active_sessions[session_id]['maps'] = [m for m in active_sessions[session_id]['maps'] 
                                            if m['id'] != map_id]
    
    # BROADCAST para TODOS
    emit('maps_sync', {'maps': active_sessions[session_id]['maps']}, 
         room=session_id, include_self=True)
    print(f'📍 Mapa removido e enviado para todos na sessão {session_id}')

# ==================
# ENTITIES - TEMPO REAL CORRIGIDO
# ==================
@socketio.on('add_entity')
def handle_add_entity(data):
    session_id = data.get('session_id')
    entity_data = data.get('entity')
    
    init_session(session_id)
    active_sessions[session_id]['entities'].append(entity_data)
    
    # BROADCAST para TODOS
    emit('entities_sync', {'entities': active_sessions[session_id]['entities']}, 
         room=session_id, include_self=True)
    print(f'🎭 Entidade adicionada e enviada para todos na sessão {session_id}')

@socketio.on('update_entity')
def handle_update_entity(data):
    session_id = data.get('session_id')
    entity_id = data.get('entity_id')
    entity_data = data.get('entity')
    
    init_session(session_id)
    
    for i, e in enumerate(active_sessions[session_id]['entities']):
        if e['id'] == entity_id:
            active_sessions[session_id]['entities'][i] = entity_data
            break
    
    # BROADCAST para TODOS
    emit('entities_sync', {'entities': active_sessions[session_id]['entities']}, 
         room=session_id, include_self=True)
    print(f'🎭 Entidade atualizada e enviada para todos na sessão {session_id}')

@socketio.on('delete_entity')
def handle_delete_entity(data):
    session_id = data.get('session_id')
    entity_id = data.get('entity_id')
    
    init_session(session_id)
    active_sessions[session_id]['entities'] = [e for e in active_sessions[session_id]['entities'] 
                                                if e['id'] != entity_id]
    
    # BROADCAST para TODOS
    emit('entities_sync', {'entities': active_sessions[session_id]['entities']}, 
         room=session_id, include_self=True)
    print(f'🎭 Entidade removida e enviada para todos na sessão {session_id}')

# ==================
# TOKENS - TEMPO REAL CORRIGIDO
# ==================
@socketio.on('token_update')
def handle_token_update(data):
    session_id = data.get('session_id')
    tokens = data.get('tokens', [])
    
    init_session(session_id)
    active_sessions[session_id]['tokens'] = tokens
    
    # BROADCAST para TODOS (incluindo quem enviou)
    emit('token_sync', {'tokens': tokens}, 
         room=session_id, include_self=True)
    print(f'🎯 Tokens atualizados e enviados para todos na sessão {session_id}')

# ==================
# DRAWINGS
# ==================
@socketio.on('drawing_update')
def handle_drawing_update(data):
    session_id = data.get('session_id')
    drawing = data.get('drawing')
    
    init_session(session_id)
    active_sessions[session_id]['drawings'].append(drawing)
    
    # BROADCAST para TODOS (incluindo quem enviou)
    emit('drawing_sync', {'drawing': drawing}, 
         room=session_id, include_self=True)

@socketio.on('clear_drawings')
def handle_clear_drawings(data):
    session_id = data.get('session_id')
    
    init_session(session_id)
    active_sessions[session_id]['drawings'] = []
    
    # BROADCAST para TODOS
    emit('drawings_cleared', {}, room=session_id, include_self=True)

# ==================
# PERMISSIONS
# ==================
@socketio.on('update_permissions')
def handle_update_permissions(data):
    session_id = data.get('session_id')
    player_id = data.get('player_id')
    permissions = data.get('permissions')
    
    init_session(session_id)
    
    if player_id in active_sessions[session_id]['players']:
        active_sessions[session_id]['permissions'][player_id] = permissions
        
        player_socket_id = active_sessions[session_id]['players'][player_id].get('socket_id')
        if player_socket_id:
            emit('permissions_updated', {
                'player_id': player_id,
                'permissions': permissions
            }, room=player_socket_id)

@socketio.on('get_players')
def handle_get_players(data):
    session_id = data.get('session_id')
    init_session(session_id)
    
    players_list = []
    for player_id, player_data in active_sessions[session_id]['players'].items():
        players_list.append({
            'id': player_id,
            'name': player_data['name'],
            'permissions': active_sessions[session_id]['permissions'].get(player_id, {})
        })
    
    emit('players_list', {'players': players_list})

# ==================
# CHAT WHATSAPP - REFORMULADO SEM DUPLICAÇÃO
# ==================
@socketio.on('send_message')
def handle_send_message(data):
    """Enviar mensagem privada - REFORMULADO"""
    session_id = data.get('session_id')
    sender_id = data.get('sender_id')
    recipient_id = data.get('recipient_id')
    message_text = data.get('message')
    
    init_session(session_id)
    
    # Validar remetente
    sender_name = 'Mestre' if sender_id == 'master' else \
                  active_sessions[session_id]['players'].get(sender_id, {}).get('name', 'Desconhecido')
    
    # Criar mensagem única
    message_id = f"{int(time.time() * 1000)}_{sender_id}_{recipient_id}"
    
    message_data = {
        'id': message_id,
        'sender_id': sender_id,
        'sender_name': sender_name,
        'recipient_id': recipient_id,
        'message': message_text,
        'timestamp': time.time() * 1000,
        'read': False
    }
    
    # Salvar mensagem UMA VEZ no servidor
    if sender_id not in active_sessions[session_id]['chat_conversations']:
        active_sessions[session_id]['chat_conversations'][sender_id] = {}
    if recipient_id not in active_sessions[session_id]['chat_conversations'][sender_id]:
        active_sessions[session_id]['chat_conversations'][sender_id][recipient_id] = []
    
    if recipient_id not in active_sessions[session_id]['chat_conversations']:
        active_sessions[session_id]['chat_conversations'][recipient_id] = {}
    if sender_id not in active_sessions[session_id]['chat_conversations'][recipient_id]:
        active_sessions[session_id]['chat_conversations'][recipient_id][sender_id] = []
    
    # Adicionar mensagem nas duas conversas
    active_sessions[session_id]['chat_conversations'][sender_id][recipient_id].append(message_data)
    active_sessions[session_id]['chat_conversations'][recipient_id][sender_id].append(message_data)
    
    # Enviar para o remetente
    if sender_id == 'master':
        emit('receive_message', message_data, room=request.sid)
    else:
        sender_socket = active_sessions[session_id]['players'].get(sender_id, {}).get('socket_id')
        if sender_socket:
            emit('receive_message', message_data, room=sender_socket)
    
    # Enviar para o destinatário
    if recipient_id == 'master':
        # Enviar para o mestre (broadcast na sessão, exceto remetente)
        emit('receive_message', message_data, room=session_id, skip_sid=request.sid)
    else:
        recipient_socket = active_sessions[session_id]['players'].get(recipient_id, {}).get('socket_id')
        if recipient_socket:
            emit('receive_message', message_data, room=recipient_socket)
    
    print(f'💬 Mensagem de {sender_name} para {recipient_id}')

@socketio.on('get_conversation')
def handle_get_conversation(data):
    """Retorna conversa entre dois usuários"""
    session_id = data.get('session_id')
    user_id = data.get('user_id')
    other_user_id = data.get('other_user_id')
    
    init_session(session_id)
    
    messages = []
    
    if user_id in active_sessions[session_id]['chat_conversations']:
        if other_user_id in active_sessions[session_id]['chat_conversations'][user_id]:
            messages = active_sessions[session_id]['chat_conversations'][user_id][other_user_id]
    
    emit('conversation_loaded', {
        'messages': messages,
        'other_user_id': other_user_id
    })

@socketio.on('get_contacts')
def handle_get_contacts(data):
    """Retorna lista de contatos"""
    session_id = data.get('session_id')
    user_id = data.get('user_id')
    
    init_session(session_id)
    
    contacts = []
    
    # Adicionar mestre
    if user_id != 'master':
        last_message = None
        if user_id in active_sessions[session_id]['chat_conversations']:
            if 'master' in active_sessions[session_id]['chat_conversations'][user_id]:
                messages = active_sessions[session_id]['chat_conversations'][user_id]['master']
                if messages:
                    last_message = messages[-1]
        
        contacts.append({
            'id': 'master',
            'name': '👑 Mestre',
            'last_message': last_message
        })
    
    # Adicionar jogadores
    for player_id, player_data in active_sessions[session_id]['players'].items():
        if player_id == user_id:
            continue
        
        last_message = None
        if user_id in active_sessions[session_id]['chat_conversations']:
            if player_id in active_sessions[session_id]['chat_conversations'][user_id]:
                messages = active_sessions[session_id]['chat_conversations'][user_id][player_id]
                if messages:
                    last_message = messages[-1]
        
        contacts.append({
            'id': player_id,
            'name': player_data['name'],
            'last_message': last_message
        })
    
    emit('contacts_loaded', {'contacts': contacts})