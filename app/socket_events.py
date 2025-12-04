from flask_socketio import emit, join_room, leave_room # type: ignore
from flask import request # type: ignore
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
            'chat_conversations': {},
            'master_socket': None,
            'fog_image': None,  # ✅ ALTERADO: fog_image ao invés de fog_areas
            'scenes': [],
            'active_scene_id': None,
            'grid_settings': {
                'enabled': True,
                'size': 50,
                'color': 'rgba(155, 89, 182, 0.3)',
                'lineWidth': 1
            }
        }

@socketio.on('connect')
def handle_connect():
    print(f'Cliente conectado: {request.sid}')

@socketio.on('disconnect')
def handle_disconnect():
    print(f'Cliente desconectado: {request.sid}')
    
    for session_id, session_data in active_sessions.items():
        # Remover jogadores desconectados
        players_to_remove = [pid for pid, pdata in session_data['players'].items() 
                            if pdata.get('socket_id') == request.sid]
        for pid in players_to_remove:
            player_name = session_data['players'][pid]['name']
            del session_data['players'][pid]
            emit('player_left', {'player_id': pid, 'player_name': player_name}, 
                 room=session_id, skip_sid=request.sid)
        
        # Remover mestre desconectado
        if session_data.get('master_socket') == request.sid:
            session_data['master_socket'] = None

@socketio.on('join_session')
def handle_join_session(data):
    """Mestre se conecta à sessão"""
    session_id = data.get('session_id')
    join_room(session_id)
    init_session(session_id)
    
    # Registrar socket do mestre
    active_sessions[session_id]['master_socket'] = request.sid
    
    session_state = active_sessions[session_id]
    
    # Enviar estado completo
    emit('session_state', {
        'maps': session_state.get('maps', []),
        'entities': session_state.get('entities', []),
        'tokens': session_state.get('tokens', []),
        'drawings': session_state.get('drawings', []),
        'scenes': session_state.get('scenes', [])
    })

    # ✅ CORRIGIDO: Enviar fog_image
    emit('fog_state_sync', {
        'fog_image': session_state.get('fog_image')
    })

    # Enviar grid
    emit('grid_settings_sync', {
        'grid_settings': session_state.get('grid_settings', {
            'enabled': True,
            'size': 50,
            'color': 'rgba(155, 89, 182, 0.3)',
            'lineWidth': 1
        })
    })
    
    emit('players_list', {'players': list(session_state.get('players', {}).values())})
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
    
    session_state = active_sessions[session_id]
    active_scene_id = session_state.get('active_scene_id')
    
    if active_scene_id:
        scenes = session_state.get('scenes', [])
        active_scene = next((s for s in scenes if s.get('id') == active_scene_id), None)
        
        if active_scene:
            visible_players = active_scene.get('visible_to_players', [])
            is_visible = player_id in visible_players
            
            if is_visible:
                emit('scene_activated', {
                    'scene_id': active_scene_id,
                    'scene': active_scene
                })
            else:
                emit('session_state', {
                    'maps': [],
                    'entities': [],
                    'tokens': [],
                    'drawings': []
                })
        else:
            emit('session_state', {
                'maps': session_state.get('maps', []),
                'entities': session_state.get('entities', []),
                'tokens': session_state.get('tokens', []),
                'drawings': session_state.get('drawings', [])
            })
    else:
        emit('session_state', {
            'maps': session_state.get('maps', []),
            'entities': session_state.get('entities', []),
            'tokens': session_state.get('tokens', []),
            'drawings': session_state.get('drawings', [])
        })
    
    # ✅ CORRIGIDO: Sempre enviar fog_image atual
    emit('fog_state_sync', {
        'fog_image': session_state.get('fog_image')
    })
    
    emit('grid_settings_sync', {
        'grid_settings': session_state.get('grid_settings', {
            'enabled': True,
            'size': 50,
            'color': 'rgba(155, 89, 182, 0.3)',
            'lineWidth': 1
        })
    })
        
    emit('permissions_updated', {
        'player_id': player_id,
        'permissions': active_sessions[session_id]['permissions'][player_id]
    })
    
    emit('player_joined', {'player_id': player_id, 'player_name': player_name}, 
         room=session_id, include_self=False)
    
    emit('players_list', {'players': list(session_state['players'].values())}, 
         room=session_id)
    
    print(f'✅ Jogador {player_name} entrou na sessão: {session_id}')

# ==================
# MAPS
# ==================
@socketio.on('add_map')
def handle_add_map(data):
    session_id = data.get('session_id')
    map_data = data.get('map')
    
    init_session(session_id)
    active_sessions[session_id]['maps'].append(map_data)
    
    emit('maps_sync', {'maps': active_sessions[session_id]['maps']}, 
         room=session_id, include_self=True)
    print(f'📍 Mapa adicionado - broadcasting para sessão {session_id}')

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
    
    emit('maps_sync', {'maps': active_sessions[session_id]['maps']}, 
         room=session_id, include_self=True)
    print(f'📍 Mapa atualizado - broadcasting para sessão {session_id}')

@socketio.on('delete_map')
def handle_delete_map(data):
    session_id = data.get('session_id')
    map_id = data.get('map_id')
    
    init_session(session_id)
    active_sessions[session_id]['maps'] = [m for m in active_sessions[session_id]['maps'] 
                                            if m['id'] != map_id]
    
    emit('maps_sync', {'maps': active_sessions[session_id]['maps']}, 
         room=session_id, include_self=True)
    print(f'📍 Mapa removido - broadcasting para sessão {session_id}')

# ==================
# ENTITIES
# ==================
@socketio.on('add_entity')
def handle_add_entity(data):
    session_id = data.get('session_id')
    entity_data = data.get('entity')
    
    init_session(session_id)
    active_sessions[session_id]['entities'].append(entity_data)
    
    emit('entities_sync', {'entities': active_sessions[session_id]['entities']}, 
         room=session_id, include_self=True)
    print(f'🎭 Entidade adicionada - broadcasting para sessão {session_id}')

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
    
    emit('entities_sync', {'entities': active_sessions[session_id]['entities']}, 
         room=session_id, include_self=True)
    print(f'🎭 Entidade atualizada - broadcasting para sessão {session_id}')

@socketio.on('delete_entity')
def handle_delete_entity(data):
    session_id = data.get('session_id')
    entity_id = data.get('entity_id')
    
    init_session(session_id)
    active_sessions[session_id]['entities'] = [e for e in active_sessions[session_id]['entities'] 
                                                if e['id'] != entity_id]
    
    emit('entities_sync', {'entities': active_sessions[session_id]['entities']}, 
         room=session_id, include_self=True)
    print(f'🎭 Entidade removida - broadcasting para sessão {session_id}')

# ==================
# TOKENS
# ==================
@socketio.on('token_update')
def handle_token_update(data):
    session_id = data.get('session_id')
    tokens = data.get('tokens', [])
    
    init_session(session_id)
    active_sessions[session_id]['tokens'] = tokens
    
    print(f'🎯 TOKEN UPDATE: {len(tokens)} tokens na sessão {session_id}')
    
    # ✅ BROADCAST para TODOS na sala
    emit('token_sync', {'tokens': tokens}, 
         room=session_id, 
         include_self=True)  # ✅ INCLUIR o próprio remetente

# ==================
# DRAWINGS - ✅ CORRIGIDO
# ==================
@socketio.on('drawing_update')
def handle_drawing_update(data):
    session_id = data.get('session_id')
    drawing = data.get('drawing')
    
    init_session(session_id)
    active_sessions[session_id]['drawings'].append(drawing)
    
    print('✏️ Desenho adicionado - broadcasting')
    
    # ✅ BROADCAST para TODOS
    emit('drawing_sync', {'drawing': drawing}, 
         room=session_id, include_self=True)

@socketio.on('clear_drawings')
def handle_clear_drawings(data):
    session_id = data.get('session_id')
    
    init_session(session_id)
    active_sessions[session_id]['drawings'] = []
    
    print('🧹 Desenhos limpos - broadcasting')
    
    # ✅ BROADCAST para TODOS
    emit('drawings_cleared', {}, room=session_id, include_self=True)

# ==================
# FOG OF WAR - ✅ TOTALMENTE REESCRITO
# ==================
@socketio.on('update_fog_state')
def handle_update_fog_state(data):
    """Atualizar estado da névoa (imagem completa)"""
    session_id = data.get('session_id')
    fog_image = data.get('fog_image')
    
    init_session(session_id)
    
    # ✅ Salvar imagem da névoa no servidor
    active_sessions[session_id]['fog_image'] = fog_image
    
    print('🌫️ Fog atualizado - broadcasting para TODOS')
    
    # ✅ BROADCAST para TODA A SALA (incluindo mestre)
    emit('fog_state_sync', {
        'fog_image': fog_image
    }, room=session_id, include_self=True)

@socketio.on('clear_fog_state')
def handle_clear_fog_state(data):
    """Limpar toda a névoa"""
    session_id = data.get('session_id')
    
    init_session(session_id)
    active_sessions[session_id]['fog_image'] = None
    
    print('🌫️ Fog limpo - broadcasting para TODOS')
    
    # ✅ BROADCAST para TODA A SALA
    emit('fog_state_sync', {
        'fog_image': None
    }, room=session_id, include_self=True)

# ==================
# GRID
# ==================
@socketio.on('update_grid_settings')
def handle_update_grid_settings(data):
    session_id = data.get('session_id')
    grid_settings = data.get('grid_settings')
    
    init_session(session_id)
    active_sessions[session_id]['grid_settings'] = grid_settings
    
    emit('grid_settings_sync', {'grid_settings': grid_settings}, 
         room=session_id, include_self=True)
    
    print(f'📐 Grid settings atualizados na sessão {session_id}')

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
# CHAT
# ==================
@socketio.on('get_chat_contacts')
def handle_get_contacts(data):
    session_id = data.get('session_id')
    user_id = data.get('user_id')
    
    init_session(session_id)
    
    if 'unread_messages' not in active_sessions[session_id]:
        active_sessions[session_id]['unread_messages'] = {}
    
    contacts = []
    unread_data = active_sessions[session_id]['unread_messages']
    
    if user_id == 'master':
        for player_id, player_data in active_sessions[session_id]['players'].items():
            unread_count = unread_data.get(f"{user_id}_{player_id}", 0)
            contacts.append({
                'id': player_id,
                'name': player_data['name'],
                'unread': unread_count,
                'type': 'player'
            })
        
        seen_pairs = set()
        for sender_id, conversations in active_sessions[session_id]['chat_conversations'].items():
            if sender_id == 'master':
                continue
            for recipient_id in conversations.keys():
                if recipient_id == 'master':
                    continue
                
                pair = tuple(sorted([sender_id, recipient_id]))
                if pair not in seen_pairs:
                    seen_pairs.add(pair)
                    
                    player1 = active_sessions[session_id]['players'].get(pair[0], {})
                    player2 = active_sessions[session_id]['players'].get(pair[1], {})
                    
                    if player1 and player2:
                        conversation_id = f"{pair[0]}_{pair[1]}"
                        unread_count = unread_data.get(f"{user_id}_{conversation_id}", 0)
                        contacts.append({
                            'id': conversation_id,
                            'name': f"{player1['name']} ↔ {player2['name']}",
                            'unread': unread_count,
                            'type': 'conversation'
                        })
    else:
        unread_count = unread_data.get(f"{user_id}_master", 0)
        contacts.append({
            'id': 'master',
            'name': '🗣️ A Voz',
            'unread': unread_count,
            'type': 'player'
        })
        
        for player_id, player_data in active_sessions[session_id]['players'].items():
            if player_id != user_id:
                unread_count = unread_data.get(f"{user_id}_{player_id}", 0)
                contacts.append({
                    'id': player_id,
                    'name': player_data['name'],
                    'unread': unread_count,
                    'type': 'player'
                })
    
    emit('chat_contacts_loaded', {'contacts': contacts})

@socketio.on('send_private_message')
def handle_send_message(data):
    session_id = data.get('session_id')
    sender_id = data.get('sender_id')
    recipient_id = data.get('recipient_id')
    message_text = data.get('message')
    
    init_session(session_id)
    
    if 'unread_messages' not in active_sessions[session_id]:
        active_sessions[session_id]['unread_messages'] = {}
    
    if sender_id == 'master':
        sender_name = 'Mestre'
    else:
        sender_data = active_sessions[session_id]['players'].get(sender_id)
        sender_name = sender_data['name'] if sender_data else 'Desconhecido'
    
    message_data = {
        'id': f"{int(time.time() * 1000)}_{sender_id}_{recipient_id}",
        'sender_id': sender_id,
        'sender_name': sender_name,
        'recipient_id': recipient_id,
        'message': message_text,
        'timestamp': time.time() * 1000
    }
    
    if sender_id not in active_sessions[session_id]['chat_conversations']:
        active_sessions[session_id]['chat_conversations'][sender_id] = {}
    if recipient_id not in active_sessions[session_id]['chat_conversations'][sender_id]:
        active_sessions[session_id]['chat_conversations'][sender_id][recipient_id] = []
    
    if recipient_id not in active_sessions[session_id]['chat_conversations']:
        active_sessions[session_id]['chat_conversations'][recipient_id] = {}
    if sender_id not in active_sessions[session_id]['chat_conversations'][recipient_id]:
        active_sessions[session_id]['chat_conversations'][recipient_id][sender_id] = []
    
    active_sessions[session_id]['chat_conversations'][sender_id][recipient_id].append(message_data)
    active_sessions[session_id]['chat_conversations'][recipient_id][sender_id].append(message_data)
    
    unread_key = f"{recipient_id}_{sender_id}"
    if unread_key not in active_sessions[session_id]['unread_messages']:
        active_sessions[session_id]['unread_messages'][unread_key] = 0
    active_sessions[session_id]['unread_messages'][unread_key] += 1
    
    emit('new_private_message', message_data, room=request.sid)
    
    if recipient_id == 'master':
        master_socket = active_sessions[session_id].get('master_socket')
        if master_socket and master_socket != request.sid:
            emit('new_private_message', message_data, room=master_socket)
    else:
        recipient_socket = active_sessions[session_id]['players'].get(recipient_id, {}).get('socket_id')
        if recipient_socket:
            emit('new_private_message', message_data, room=recipient_socket)
    
    if sender_id != 'master' and recipient_id != 'master':
        master_socket = active_sessions[session_id].get('master_socket')
        if master_socket:
            conversation_id = '_'.join(sorted([sender_id, recipient_id]))
            mestre_unread_key = f"master_{conversation_id}"
            if mestre_unread_key not in active_sessions[session_id]['unread_messages']:
                active_sessions[session_id]['unread_messages'][mestre_unread_key] = 0
            active_sessions[session_id]['unread_messages'][mestre_unread_key] += 1
            
            emit('new_private_message', message_data, room=master_socket)

@socketio.on('get_conversation')
def handle_get_conversation(data):
    session_id = data.get('session_id')
    user_id = data.get('user_id')
    other_user_id = data.get('other_user_id')
    
    init_session(session_id)
    
    messages = []
    
    if user_id == 'master' and '_' in other_user_id:
        player_ids = other_user_id.split('_')
        if len(player_ids) == 2:
            player1_id, player2_id = player_ids
            
            if player1_id in active_sessions[session_id]['chat_conversations']:
                if player2_id in active_sessions[session_id]['chat_conversations'][player1_id]:
                    messages = active_sessions[session_id]['chat_conversations'][player1_id][player2_id]
    else:
        if user_id in active_sessions[session_id]['chat_conversations']:
            if other_user_id in active_sessions[session_id]['chat_conversations'][user_id]:
                messages = active_sessions[session_id]['chat_conversations'][user_id][other_user_id]
    
    emit('conversation_loaded', {
        'messages': messages,
        'other_user_id': other_user_id
    })

@socketio.on('mark_conversation_read')
def handle_mark_read(data):
    session_id = data.get('session_id')
    user_id = data.get('user_id')
    other_user_id = data.get('other_user_id')
    
    init_session(session_id)
    
    if 'unread_messages' not in active_sessions[session_id]:
        active_sessions[session_id]['unread_messages'] = {}
    
    unread_key = f"{user_id}_{other_user_id}"
    active_sessions[session_id]['unread_messages'][unread_key] = 0

# ==================
# SCENES
# ==================
@socketio.on('scene_create')
def handle_scene_create(data):
    session_id = data.get('session_id')
    scene = data.get('scene')
    
    init_session(session_id)
    
    if 'scenes' not in active_sessions[session_id]:
        active_sessions[session_id]['scenes'] = []
    
    active_sessions[session_id]['scenes'].append(scene)
    
    emit('scenes_sync', {
        'scenes': active_sessions[session_id]['scenes']
    }, room=session_id, include_self=True)
    
    print(f'🎬 Nova cena criada: {scene.get("name")} na sessão {session_id}')

@socketio.on('scene_update')
def handle_scene_update(data):
    """✅ REESCRITO - Atualizar cena e notificar mudanças de visibilidade"""
    session_id = data.get('session_id')
    scene = data.get('scene')
    scene_id = scene.get('id')
    
    init_session(session_id)
    
    if 'scenes' not in active_sessions[session_id]:
        active_sessions[session_id]['scenes'] = []
    
    # Encontrar cena antiga para comparar visibilidade
    old_scene = None
    updated = False
    for i, s in enumerate(active_sessions[session_id]['scenes']):
        if s.get('id') == scene_id:
            old_scene = active_sessions[session_id]['scenes'][i]
            active_sessions[session_id]['scenes'][i] = scene
            updated = True
            break
    
    if not updated:
        active_sessions[session_id]['scenes'].append(scene)
    
    # ✅ Sincronizar lista de cenas para o mestre
    emit('scenes_sync', {
        'scenes': active_sessions[session_id]['scenes']
    }, room=session_id, include_self=True)
    
    print(f'🎬 Cena atualizada: {scene.get("name")}')
    
    # ✅ SE ESTA É A CENA ATIVA, ATUALIZAR TODOS OS JOGADORES
    if active_sessions[session_id].get('active_scene_id') == scene_id:
        print('🎬 Cena ativa modificada - atualizando jogadores')
        
        # Pegar lista de jogadores
        session_data = active_sessions[session_id]
        
        # ✅ NOVA LÓGICA: Verificar mudanças de visibilidade
        old_visible = set(old_scene.get('visible_to_players', [])) if old_scene else set()
        new_visible = set(scene.get('visible_to_players', []))
        
        # Jogadores que PERDERAM acesso
        lost_access = old_visible - new_visible
        
        # Jogadores que GANHARAM acesso
        gained_access = new_visible - old_visible
        
        print(f'📊 Mudanças de acesso:')
        print(f'   ✅ Ganharam: {gained_access}')
        print(f'   ❌ Perderam: {lost_access}')
        
        # ✅ Para cada jogador conectado
        for player_id, player_data in session_data.get('players', {}).items():
            player_socket = player_data.get('socket_id')
            
            if not player_socket:
                continue
            
            is_visible = player_id in new_visible
            
            if is_visible:
                # ✅ JOGADOR TEM PERMISSÃO - Enviar cena completa
                print(f'  👁️ {player_id} - Enviando cena completa')
                emit('scene_activated', {
                    'scene_id': scene_id,
                    'scene': scene
                }, room=player_socket)
            else:
                # ❌ JOGADOR NÃO TEM PERMISSÃO - Bloquear
                print(f'  🚫 {player_id} - Bloqueando acesso')
                emit('scene_blocked', {
                    'scene_id': scene_id,
                    'scene_name': scene.get('name')
                }, room=player_socket)
        
        print('✅ Todos os jogadores atualizados')

@socketio.on('request_current_scene')
def handle_request_current_scene(data):
    """✅ NOVO - Jogador solicita a cena atual após reconexão"""
    session_id = data.get('session_id')
    player_id = data.get('player_id')
    
    init_session(session_id)
    
    session_data = active_sessions[session_id]
    active_scene_id = session_data.get('active_scene_id')
    
    if not active_scene_id:
        print(f'ℹ️ Nenhuma cena ativa para {player_id}')
        emit('no_active_scene', {})
        return
    
    # Encontrar cena ativa
    scenes = session_data.get('scenes', [])
    active_scene = next((s for s in scenes if s.get('id') == active_scene_id), None)
    
    if not active_scene:
        print('⚠️ Cena ativa não encontrada')
        emit('no_active_scene', {})
        return
    
    # Verificar permissão
    visible_players = active_scene.get('visible_to_players', [])
    is_visible = player_id in visible_players
    
    if is_visible:
        print(f'✅ {player_id} tem acesso à cena {active_scene.get("name")}')
        emit('scene_activated', {
            'scene_id': active_scene_id,
            'scene': active_scene
        })
    else:
        print(f'❌ {player_id} não tem acesso à cena {active_scene.get("name")}')
        emit('scene_blocked', {
            'scene_id': active_scene_id,
            'scene_name': active_scene.get('name')
        })

@socketio.on('scene_delete')
def handle_scene_delete(data):
    session_id = data.get('session_id')
    scene_id = data.get('scene_id')
    
    init_session(session_id)
    
    if 'scenes' not in active_sessions[session_id]:
        return
    
    active_sessions[session_id]['scenes'] = [
        s for s in active_sessions[session_id]['scenes']
        if s.get('id') != scene_id
    ]
    
    emit('scenes_sync', {
        'scenes': active_sessions[session_id]['scenes']
    }, room=session_id, include_self=True)
    
    print(f'🎬 Cena removida: {scene_id} da sessão {session_id}')

@socketio.on('scene_switch')
def handle_scene_switch(data):
    """✅ TOTALMENTE REESCRITO - Trocar cena ativa"""
    session_id = data.get('session_id')
    scene_id = data.get('scene_id')
    scene = data.get('scene')
    
    init_session(session_id)
    
    # Salvar ID da cena ativa
    active_sessions[session_id]['active_scene_id'] = scene_id
    
    print(f'🎬 Trocando para cena: {scene.get("name")}')
    
    # ✅ ENVIAR PARA TODOS OS JOGADORES
    session_data = active_sessions[session_id]
    
    for player_id, player_data in session_data.get('players', {}).items():
        player_socket = player_data.get('socket_id')
        
        if not player_socket:
            continue
        
        visible_players = scene.get('visible_to_players', [])
        is_visible = player_id in visible_players
        
        print(f'  👤 {player_id} - Visível: {is_visible}')
        
        if is_visible:
            # ✅ Enviar cena completa COM fog
            emit('scene_activated', {
                'scene_id': scene_id,
                'scene': scene
            }, room=player_socket)
        else:
            # ✅ Enviar cena vazia
            emit('scene_activated', {
                'scene_id': scene_id,
                'scene': {
                    'id': scene_id,
                    'name': scene.get('name'),
                    'maps': [],
                    'entities': [],
                    'tokens': [],
                    'drawings': [],
                    'fog_image': None,
                    'visible_to_players': []
                }
            }, room=player_socket)
    
    # ✅ Notificar mestre
    master_socket = session_data.get('master_socket')
    if master_socket:
        emit('scene_switched', {
            'scene_id': scene_id,
            'scene': scene
        }, room=master_socket)
    
    print('✅ Cena ativada para todos')
