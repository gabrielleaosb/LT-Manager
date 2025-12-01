from flask_socketio import emit, join_room, leave_room
from flask import request
from app import socketio

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
            'chat_messages': []  # Novo: histórico de chat
        }

@socketio.on('connect')
def handle_connect():
    print(f'Cliente conectado: {request.sid}')

@socketio.on('disconnect')
def handle_disconnect():
    print(f'Cliente desconectado: {request.sid}')
    
    for session_id, session_data in active_sessions.items():
        players_to_remove = [pid for pid, pdata in session_data['players'].items() if pdata.get('socket_id') == request.sid]
        for pid in players_to_remove:
            player_name = session_data['players'][pid]['name']
            del session_data['players'][pid]
            emit('player_left', {'player_id': pid, 'player_name': player_name}, room=session_id)
            print(f'Jogador {player_name} saiu da sessão {session_id}')

@socketio.on('join_session')
def handle_join_session(data):
    """Mestre se conecta à sessão"""
    session_id = data.get('session_id')
    join_room(session_id)
    init_session(session_id)
    
    session_state = active_sessions[session_id]
    emit('session_state', {
        'maps': session_state['maps'],
        'entities': session_state['entities'],
        'tokens': session_state['tokens'],
        'drawings': session_state['drawings']
    })
    
    emit('players_list', {'players': list(session_state['players'].values())})
    emit('chat_history', {'messages': session_state['chat_messages']})
    emit('session_joined', {'session_id': session_id})
    print(f'Mestre entrou na sessão: {session_id}')

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
    
    emit('chat_history', {'messages': session_state['chat_messages']})
    emit('player_joined', {'player_id': player_id, 'player_name': player_name}, room=session_id)
    emit('players_list', {'players': list(session_state['players'].values())}, room=session_id)
    
    print(f'Jogador {player_name} entrou na sessão: {session_id}')

@socketio.on('leave_session')
def handle_leave_session(data):
    session_id = data.get('session_id')
    leave_room(session_id)
    print(f'Cliente saiu da sessão: {session_id}')

# ==================
# MAPS MANAGEMENT
# ==================
@socketio.on('add_map')
def handle_add_map(data):
    session_id = data.get('session_id')
    map_data = data.get('map')
    
    init_session(session_id)
    active_sessions[session_id]['maps'].append(map_data)
    
    emit('maps_sync', {'maps': active_sessions[session_id]['maps']}, room=session_id)
    print(f'Mapa adicionado na sessão: {session_id}')

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
    
    emit('maps_sync', {'maps': active_sessions[session_id]['maps']}, room=session_id)

@socketio.on('delete_map')
def handle_delete_map(data):
    session_id = data.get('session_id')
    map_id = data.get('map_id')
    
    init_session(session_id)
    active_sessions[session_id]['maps'] = [m for m in active_sessions[session_id]['maps'] if m['id'] != map_id]
    
    emit('maps_sync', {'maps': active_sessions[session_id]['maps']}, room=session_id)
    print(f'Mapa removido na sessão: {session_id}')

# ==================
# ENTITIES MANAGEMENT
# ==================
@socketio.on('add_entity')
def handle_add_entity(data):
    session_id = data.get('session_id')
    entity_data = data.get('entity')
    
    init_session(session_id)
    active_sessions[session_id]['entities'].append(entity_data)
    
    emit('entities_sync', {'entities': active_sessions[session_id]['entities']}, room=session_id)
    print(f'Entidade adicionada na sessão: {session_id}')

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
    
    emit('entities_sync', {'entities': active_sessions[session_id]['entities']}, room=session_id)

@socketio.on('delete_entity')
def handle_delete_entity(data):
    session_id = data.get('session_id')
    entity_id = data.get('entity_id')
    
    init_session(session_id)
    active_sessions[session_id]['entities'] = [e for e in active_sessions[session_id]['entities'] if e['id'] != entity_id]
    
    emit('entities_sync', {'entities': active_sessions[session_id]['entities']}, room=session_id)
    print(f'Entidade removida na sessão: {session_id}')

# ==================
# TOKENS MANAGEMENT
# ==================
@socketio.on('token_update')
def handle_token_update(data):
    session_id = data.get('session_id')
    tokens = data.get('tokens', [])
    
    init_session(session_id)
    active_sessions[session_id]['tokens'] = tokens
    
    emit('token_sync', {'tokens': tokens}, room=session_id)

# ==================
# DRAWINGS
# ==================
@socketio.on('drawing_update')
def handle_drawing_update(data):
    session_id = data.get('session_id')
    drawing = data.get('drawing')
    
    init_session(session_id)
    active_sessions[session_id]['drawings'].append(drawing)
    
    emit('drawing_sync', {'drawing': drawing}, room=session_id, include_self=False)

@socketio.on('clear_drawings')
def handle_clear_drawings(data):
    session_id = data.get('session_id')
    
    init_session(session_id)
    active_sessions[session_id]['drawings'] = []
    
    emit('drawings_cleared', {}, room=session_id)

# ==================
# PERMISSIONS SYSTEM
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
        
        print(f'Permissões atualizadas para jogador {player_id} na sessão {session_id}')

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
# PING SYSTEM
# ==================
@socketio.on('send_ping')
def handle_send_ping(data):
    session_id = data.get('session_id')
    player_id = data.get('player_id')
    x = data.get('x')
    y = data.get('y')
    
    init_session(session_id)
    
    if player_id in active_sessions[session_id]['permissions']:
        if active_sessions[session_id]['permissions'][player_id].get('ping', False):
            player_name = active_sessions[session_id]['players'][player_id]['name']
            
            emit('ping_received', {
                'x': x,
                'y': y,
                'player_id': player_id,
                'player_name': player_name
            }, room=session_id)
            
            print(f'Ping enviado por {player_name} na sessão {session_id}')

# ==================
# CHAT SYSTEM
# ==================
@socketio.on('send_message')
def handle_send_message(data):
    """Envia mensagem no chat (privada ou global)"""
    session_id = data.get('session_id')
    sender_id = data.get('sender_id')
    message_text = data.get('message')
    recipient_id = data.get('recipient_id')  # None = mensagem para todos (visível apenas para o mestre)
    
    init_session(session_id)
    
    if sender_id not in active_sessions[session_id]['players']:
        return
    
    sender_name = active_sessions[session_id]['players'][sender_id]['name']
    
    message_data = {
        'id': len(active_sessions[session_id]['chat_messages']) + 1,
        'sender_id': sender_id,
        'sender_name': sender_name,
        'message': message_text,
        'recipient_id': recipient_id,
        'timestamp': __import__('datetime').datetime.now().isoformat()
    }
    
    active_sessions[session_id]['chat_messages'].append(message_data)
    
    # Se for mensagem privada, enviar apenas para o destinatário e o mestre
    if recipient_id and recipient_id in active_sessions[session_id]['players']:
        recipient_socket = active_sessions[session_id]['players'][recipient_id].get('socket_id')
        sender_socket = active_sessions[session_id]['players'][sender_id].get('socket_id')
        
        # Enviar para o destinatário
        if recipient_socket:
            emit('new_message', message_data, room=recipient_socket)
        
        # Enviar para o remetente (confirmação)
        if sender_socket:
            emit('new_message', message_data, room=sender_socket)
    else:
        # Mensagem para todos (apenas mestre vê)
        # Apenas o remetente recebe de volta
        sender_socket = active_sessions[session_id]['players'][sender_id].get('socket_id')
        if sender_socket:
            emit('new_message', message_data, room=sender_socket)
    
    # O MESTRE SEMPRE VÊ TODAS AS MENSAGENS
    # Broadcast para todos na sala (mestre está na sala)
    emit('master_message_notification', message_data, room=session_id)
    
    print(f'Mensagem de {sender_name}: {message_text[:50]}...')

@socketio.on('get_chat_history')
def handle_get_chat_history(data):
    """Retorna histórico de chat"""
    session_id = data.get('session_id')
    player_id = data.get('player_id')
    
    init_session(session_id)
    
    # Filtrar mensagens que o jogador pode ver
    visible_messages = []
    for msg in active_sessions[session_id]['chat_messages']:
        # Jogador pode ver: mensagens enviadas por ele ou recebidas por ele
        if msg['sender_id'] == player_id or msg['recipient_id'] == player_id:
            visible_messages.append(msg)
    
    emit('chat_history', {'messages': visible_messages})