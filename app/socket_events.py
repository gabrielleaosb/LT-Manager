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
            'chat_conversations': {},
            'master_socket': None,
            'fog_areas': []
        }

@socketio.on('update_grid_settings')
def handle_update_grid_settings(data):
    """Sincronizar configurações de grid para todos"""
    session_id = data.get('session_id')
    grid_settings = data.get('grid_settings')
    
    init_session(session_id)
    
    # Salvar configurações na sessão
    active_sessions[session_id]['grid_settings'] = grid_settings
    
    # Broadcast para TODA A SALA
    emit('grid_settings_sync', {'grid_settings': grid_settings}, 
         room=session_id, include_self=True)
    
    print(f'📐 Grid settings atualizados na sessão {session_id}')

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
        'maps': session_state['maps'],
        'entities': session_state['entities'],
        'tokens': session_state['tokens'],
        'drawings': session_state['drawings'],
        'scenes': session_state.get('scenes', [])  

    })

    emit('fog_areas_sync', {
    'fog_areas': session_state.get('fog_areas', [])
    })

    grid_settings = session_state.get('grid_settings', {
    'enabled': True,
    'size': 50,
    'color': 'rgba(155, 89, 182, 0.3)',
    'lineWidth': 1
    })
    emit('grid_settings_sync', {'grid_settings': grid_settings})
    
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

    emit('fog_areas_sync', {
    'fog_areas': session_state.get('fog_areas', [])
    })

    grid_settings = session_state.get('grid_settings', {
    'enabled': True,
    'size': 50,
    'color': 'rgba(155, 89, 182, 0.3)',
    'lineWidth': 1
    })
    emit('grid_settings_sync', {'grid_settings': grid_settings})
        
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
# MAPS - BROADCAST PARA TODOS
# ==================
@socketio.on('add_map')
def handle_add_map(data):
    session_id = data.get('session_id')
    map_data = data.get('map')
    
    init_session(session_id)
    active_sessions[session_id]['maps'].append(map_data)
    
    # BROADCAST para TODA A SALA
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
    
    # BROADCAST para TODA A SALA
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
    
    # BROADCAST para TODA A SALA
    emit('maps_sync', {'maps': active_sessions[session_id]['maps']}, 
         room=session_id, include_self=True)
    print(f'📍 Mapa removido - broadcasting para sessão {session_id}')

# ==================
# ENTITIES - BROADCAST PARA TODOS
# ==================

@socketio.on('add_entity')
def handle_add_entity(data):
    session_id = data.get('session_id')
    entity_data = data.get('entity')
    
    init_session(session_id)
    
    active_sessions[session_id]['entities'].append(entity_data)
    
    if 'scenes' in active_sessions[session_id]:
        for scene in active_sessions[session_id]['scenes']:
            if scene.get('active', False):  
                if 'entities' not in scene:
                    scene['entities'] = []
                scene['entities'].append(entity_data)
                print(f'🎭 Entidade adicionada à cena ativa: {scene["name"]} (total: {len(scene["entities"])})')
                break
    
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
    
    # BROADCAST para TODA A SALA
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
    
    # BROADCAST para TODA A SALA
    emit('entities_sync', {'entities': active_sessions[session_id]['entities']}, 
         room=session_id, include_self=True)
    print(f'🎭 Entidade removida - broadcasting para sessão {session_id}')

# ==================
# TOKENS - BROADCAST PARA TODOS
# ==================
@socketio.on('token_update')
def handle_token_update(data):
    session_id = data.get('session_id')
    tokens = data.get('tokens', [])
    sender_sid = request.sid
    
    init_session(session_id)
    active_sessions[session_id]['tokens'] = tokens
    
    print('🎯 TOKEN UPDATE recebido:')
    print(f'   - Session: {session_id}')
    print(f'   - Sender SID: {sender_sid}')
    print(f'   - Tokens: {len(tokens)}')
    print(f'   - Jogadores na sessão: {list(active_sessions[session_id]["players"].keys())}')
    print(f'   - Master socket: {active_sessions[session_id].get("master_socket")}')
    
    # Enviar para TODOS na sala, EXCETO quem enviou (ele já tem os dados)
    emit('token_sync', {'tokens': tokens}, 
         room=session_id, 
         skip_sid=sender_sid)
    
    # IMPORTANTE: Enviar também diretamente para o mestre
    master_socket = active_sessions[session_id].get('master_socket')
    if master_socket and master_socket != sender_sid:
        print(f'   📤 Enviando diretamente para o mestre: {master_socket}')
        emit('token_sync', {'tokens': tokens}, room=master_socket)
    
    print('   ✅ Broadcast concluído')

# ==================
# DRAWINGS
# ==================
@socketio.on('drawing_update')
def handle_drawing_update(data):
    session_id = data.get('session_id')
    drawing = data.get('drawing')
    
    init_session(session_id)
    active_sessions[session_id]['drawings'].append(drawing)
    
    # BROADCAST para TODA A SALA
    emit('drawing_sync', {'drawing': drawing}, 
         room=session_id, include_self=True)

@socketio.on('clear_drawings')
def handle_clear_drawings(data):
    session_id = data.get('session_id')
    
    init_session(session_id)
    active_sessions[session_id]['drawings'] = []
    
    # BROADCAST para TODA A SALA
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
# CHAT - CORRIGIDO COM MESTRE VENDO TUDO
# ==================
@socketio.on('get_chat_contacts')
def handle_get_contacts(data):
    """Retorna lista de contatos disponíveis com contagem de não lidas"""
    session_id = data.get('session_id')
    user_id = data.get('user_id')
    
    init_session(session_id)
    
    # Inicializar estrutura de não lidas se não existir
    if 'unread_messages' not in active_sessions[session_id]:
        active_sessions[session_id]['unread_messages'] = {}
    
    contacts = []
    unread_data = active_sessions[session_id]['unread_messages']
    
    if user_id == 'master':
        # MESTRE: Ver todos os jogadores E todas as conversas entre eles
        for player_id, player_data in active_sessions[session_id]['players'].items():
            unread_count = unread_data.get(f"{user_id}_{player_id}", 0)
            contacts.append({
                'id': player_id,
                'name': player_data['name'],
                'unread': unread_count,
                'type': 'player'
            })
        
        # Adicionar conversas entre jogadores
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
        # JOGADOR: Ver mestre e outros jogadores
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
    print(f'📋 Contatos enviados para {user_id}: {len(contacts)} contatos')

@socketio.on('send_private_message')
def handle_send_message(data):
    """Enviar mensagem privada e incrementar contador de não lidas"""
    session_id = data.get('session_id')
    sender_id = data.get('sender_id')
    recipient_id = data.get('recipient_id')
    message_text = data.get('message')
    
    init_session(session_id)
    
    # Inicializar estrutura de não lidas se não existir
    if 'unread_messages' not in active_sessions[session_id]:
        active_sessions[session_id]['unread_messages'] = {}
    
    # Validar remetente
    if sender_id == 'master':
        sender_name = 'Mestre'
    else:
        sender_data = active_sessions[session_id]['players'].get(sender_id)
        sender_name = sender_data['name'] if sender_data else 'Desconhecido'
    
    # Criar mensagem
    message_data = {
        'id': f"{int(time.time() * 1000)}_{sender_id}_{recipient_id}",
        'sender_id': sender_id,
        'sender_name': sender_name,
        'recipient_id': recipient_id,
        'message': message_text,
        'timestamp': time.time() * 1000
    }
    
    # Salvar mensagem
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
    
    # INCREMENTAR contador de não lidas para o destinatário
    unread_key = f"{recipient_id}_{sender_id}"
    if unread_key not in active_sessions[session_id]['unread_messages']:
        active_sessions[session_id]['unread_messages'][unread_key] = 0
    active_sessions[session_id]['unread_messages'][unread_key] += 1
    
    # Enviar para o remetente
    emit('new_private_message', message_data, room=request.sid)
    
    # Enviar para o destinatário
    if recipient_id == 'master':
        master_socket = active_sessions[session_id].get('master_socket')
        if master_socket and master_socket != request.sid:
            emit('new_private_message', message_data, room=master_socket)
    else:
        recipient_socket = active_sessions[session_id]['players'].get(recipient_id, {}).get('socket_id')
        if recipient_socket:
            emit('new_private_message', message_data, room=recipient_socket)
    
    # ENVIAR PARA O MESTRE se ele não for nem remetente nem destinatário
    if sender_id != 'master' and recipient_id != 'master':
        master_socket = active_sessions[session_id].get('master_socket')
        if master_socket:
            # Incrementar não lidas para o mestre observando conversa
            conversation_id = '_'.join(sorted([sender_id, recipient_id]))
            mestre_unread_key = f"master_{conversation_id}"
            if mestre_unread_key not in active_sessions[session_id]['unread_messages']:
                active_sessions[session_id]['unread_messages'][mestre_unread_key] = 0
            active_sessions[session_id]['unread_messages'][mestre_unread_key] += 1
            
            emit('new_private_message', message_data, room=master_socket)
    
    print(f'💬 Mensagem de {sender_name} para {recipient_id}')

@socketio.on('get_conversation')
def handle_get_conversation(data):
    """Retorna conversa entre dois usuários"""
    session_id = data.get('session_id')
    user_id = data.get('user_id')
    other_user_id = data.get('other_user_id')
    
    init_session(session_id)
    
    messages = []
    
    # Mestre visualizando conversa entre dois jogadores
    if user_id == 'master' and '_' in other_user_id:
        player_ids = other_user_id.split('_')
        if len(player_ids) == 2:
            player1_id, player2_id = player_ids
            
            if player1_id in active_sessions[session_id]['chat_conversations']:
                if player2_id in active_sessions[session_id]['chat_conversations'][player1_id]:
                    messages = active_sessions[session_id]['chat_conversations'][player1_id][player2_id]
    else:
        # Conversa normal
        if user_id in active_sessions[session_id]['chat_conversations']:
            if other_user_id in active_sessions[session_id]['chat_conversations'][user_id]:
                messages = active_sessions[session_id]['chat_conversations'][user_id][other_user_id]
    
    emit('conversation_loaded', {
        'messages': messages,
        'other_user_id': other_user_id
    })
    
    print(f'💬 Conversa carregada: {user_id} <-> {other_user_id}, {len(messages)} mensagens')

@socketio.on('mark_conversation_read')
def handle_mark_read(data):
    """Marcar conversa como lida"""
    session_id = data.get('session_id')
    user_id = data.get('user_id')
    other_user_id = data.get('other_user_id')
    
    init_session(session_id)
    
    if 'unread_messages' not in active_sessions[session_id]:
        active_sessions[session_id]['unread_messages'] = {}
    
    # Zerar contador de não lidas
    unread_key = f"{user_id}_{other_user_id}"
    active_sessions[session_id]['unread_messages'][unread_key] = 0
    
    print(f'✅ Conversa marcada como lida: {user_id} <-> {other_user_id}')


# ==================
# SCENES (CENAS) - REFORMULADO
# ==================

@socketio.on('create_scene')
def handle_create_scene(data):
    """Criar nova cena vazia"""
    session_id = data.get('session_id')
    scene_name = data.get('scene_name')
    
    init_session(session_id)
    
    if 'scenes' not in active_sessions[session_id]:
        active_sessions[session_id]['scenes'] = []
    
    # Criar cena com estrutura completa e vazia
    scene = {
        'id': f"scene_{int(time.time() * 1000)}",
        'name': scene_name,
        'active': False,
        'content': {
            'maps': [],
            'entities': [],
            'tokens': [],
            'drawings': [],
            'fog_areas': []
        },
        'visible_to_players': []
    }
    
    active_sessions[session_id]['scenes'].append(scene)
    
    # Broadcast para todos
    emit('scenes_updated', {
        'scenes': active_sessions[session_id]['scenes']
    }, room=session_id, include_self=True)
    
    print(f'🎬 [create_scene] Nova cena criada: "{scene_name}"')
    print(f'🎬 Total de cenas: {len(active_sessions[session_id]["scenes"])}')

@socketio.on('delete_scene')
def handle_delete_scene(data):
    """Deletar cena"""
    session_id = data.get('session_id')
    scene_id = data.get('scene_id')
    
    init_session(session_id)
    
    if 'scenes' not in active_sessions[session_id]:
        return
    
    # Remover cena
    active_sessions[session_id]['scenes'] = [
        s for s in active_sessions[session_id]['scenes'] 
        if s['id'] != scene_id
    ]
    
    # Se era a cena ativa, voltar para o estado global
    emit('scenes_updated', {
        'scenes': active_sessions[session_id]['scenes']
    }, room=session_id, include_self=True)
    
    print(f'🗑️ [delete_scene] Cena deletada: {scene_id}')

@socketio.on('switch_scene')
def handle_switch_scene(data):
    """Trocar de cena ativa"""
    session_id = data.get('session_id')
    scene_id = data.get('scene_id')
    
    init_session(session_id)
    
    if 'scenes' not in active_sessions[session_id]:
        return
    
    # Desativar todas as cenas
    for scene in active_sessions[session_id]['scenes']:
        scene['active'] = False
    
    # Ativar a cena selecionada
    target_scene = None
    for scene in active_sessions[session_id]['scenes']:
        if scene['id'] == scene_id:
            scene['active'] = True
            target_scene = scene
            break
    
    if not target_scene:
        print(f'❌ [switch_scene] Cena não encontrada: {scene_id}')
        return
    
    print(f'🎬 [switch_scene] Ativando cena: "{target_scene["name"]}"')
    print(f'🎬 Conteúdo:')
    print(f'   - Maps: {len(target_scene["content"]["maps"])}')
    print(f'   - Entities: {len(target_scene["content"]["entities"])}')
    print(f'   - Tokens: {len(target_scene["content"]["tokens"])}')
    print(f'   - Fog: {len(target_scene["content"]["fog_areas"])}')
    
    # Broadcast para TODOS (mestre e jogadores)
    emit('scene_activated', {
        'scene_id': scene_id,
        'scene': target_scene
    }, room=session_id, include_self=True)
    
    # Atualizar lista de cenas
    emit('scenes_updated', {
        'scenes': active_sessions[session_id]['scenes']
    }, room=session_id, include_self=True)

@socketio.on('save_scene_state')
def handle_save_scene_state(data):
    """Salvar estado completo da cena ativa"""
    session_id = data.get('session_id')
    scene_id = data.get('scene_id')
    content = data.get('content')
    
    init_session(session_id)
    
    if 'scenes' not in active_sessions[session_id]:
        return
    
    # Encontrar e atualizar a cena
    for scene in active_sessions[session_id]['scenes']:
        if scene['id'] == scene_id:
            scene['content'] = content
            
            print(f'💾 [save_scene_state] Cena salva: "{scene["name"]}"')
            print(f'💾 Conteúdo:')
            print(f'   - Maps: {len(content.get("maps", []))}')
            print(f'   - Entities: {len(content.get("entities", []))}')
            print(f'   - Tokens: {len(content.get("tokens", []))}')
            print(f'   - Fog: {len(content.get("fog_areas", []))}')
            break
    
    # Confirmar salvamento
    emit('scene_saved', {
        'scene_id': scene_id,
        'success': True
    })
    
    # Atualizar lista de cenas (para mostrar contadores corretos)
    emit('scenes_updated', {
        'scenes': active_sessions[session_id]['scenes']
    }, room=session_id, include_self=True)

@socketio.on('toggle_scene_visibility')
def handle_toggle_scene_visibility(data):
    """Toggle visibilidade de cena para um jogador específico"""
    session_id = data.get('session_id')
    scene_id = data.get('scene_id')
    player_id = data.get('player_id')
    
    init_session(session_id)
    
    if 'scenes' not in active_sessions[session_id]:
        return
    
    # Encontrar cena
    for scene in active_sessions[session_id]['scenes']:
        if scene['id'] == scene_id:
            if 'visible_to_players' not in scene:
                scene['visible_to_players'] = []
            
            # Toggle visibilidade
            if player_id in scene['visible_to_players']:
                scene['visible_to_players'].remove(player_id)
                print(f'👁️ [toggle_visibility] Cena "{scene["name"]}" OCULTA para jogador {player_id}')
            else:
                scene['visible_to_players'].append(player_id)
                print(f'👁️ [toggle_visibility] Cena "{scene["name"]}" VISÍVEL para jogador {player_id}')
            
            break
    
    # ✅ BROADCAST IMEDIATO para atualizar UI em tempo real
    emit('scenes_updated', {
        'scenes': active_sessions[session_id]['scenes']
    }, room=session_id, include_self=True)
    
    # Notificar jogador afetado se a cena estiver ativa
    for scene in active_sessions[session_id]['scenes']:
        if scene['id'] == scene_id and scene.get('active', False):
            emit('scene_activated', {
                'scene_id': scene_id,
                'scene': scene
            }, room=session_id, include_self=True)
            break

@socketio.on('get_active_scene')
def handle_get_active_scene(data):
    """Obter cena ativa atual"""
    session_id = data.get('session_id')
    
    init_session(session_id)
    
    if 'scenes' not in active_sessions[session_id]:
        emit('active_scene', {'scene': None})
        return
    
    # Buscar cena ativa
    active_scene = None
    for scene in active_sessions[session_id]['scenes']:
        if scene.get('active', False):
            active_scene = scene
            break
    
    emit('active_scene', {
        'scene': active_scene
    })

# ==================
# FOG OF WAR
# ==================
@socketio.on('add_fog_area')
def handle_add_fog_area(data):
    session_id = data.get('session_id')
    fog_area = data.get('fog_area')
    
    init_session(session_id)
    
    if 'fog_areas' not in active_sessions[session_id]:
        active_sessions[session_id]['fog_areas'] = []
    
    active_sessions[session_id]['fog_areas'].append(fog_area)
    
    print(f'🌫️ Fog area adicionada na sessão {session_id}')
    print(f'🌫️ Total fog areas: {len(active_sessions[session_id]["fog_areas"])}')
    print(f'🌫️ Fog area: {fog_area}')
    
    # Broadcast para TODA A SALA (incluindo jogadores)
    emit('fog_areas_sync', {
        'fog_areas': active_sessions[session_id]['fog_areas']
    }, room=session_id, include_self=True)
    
    print(f'🌫️ Fog areas enviadas para sala {session_id}')

@socketio.on('delete_fog_area')
def handle_delete_fog_area(data):
    session_id = data.get('session_id')
    fog_id = data.get('fog_id')
    
    init_session(session_id)
    
    if 'fog_areas' not in active_sessions[session_id]:
        active_sessions[session_id]['fog_areas'] = []
    
    active_sessions[session_id]['fog_areas'] = [
        f for f in active_sessions[session_id]['fog_areas'] 
        if f['id'] != fog_id
    ]
    
    print(f'🌫️ Fog area removida na sessão {session_id}')
    
    # Broadcast para TODA A SALA
    emit('fog_areas_sync', {
        'fog_areas': active_sessions[session_id]['fog_areas']
    }, room=session_id, include_self=True)

@socketio.on('clear_all_fog')
def handle_clear_all_fog(data):
    session_id = data.get('session_id')
    
    init_session(session_id)
    active_sessions[session_id]['fog_areas'] = []
    
    print(f'🌫️ Todo fog limpo na sessão {session_id}')
    
    # Broadcast para TODA A SALA
    emit('fog_areas_sync', {'fog_areas': []}, 
         room=session_id, include_self=True)

@socketio.on('reveal_fog_area')
def handle_reveal_fog_area(data):
    session_id = data.get('session_id')
    fog_id = data.get('fog_id')
    
    init_session(session_id)
    
    if 'fog_areas' not in active_sessions[session_id]:
        return
    
    for fog in active_sessions[session_id]['fog_areas']:
        if fog['id'] == fog_id:
            fog['revealed'] = True
            break
    
    emit('fog_areas_sync', {
        'fog_areas': active_sessions[session_id]['fog_areas']
    }, room=session_id, include_self=True)
    
    print(f'🌫️ Fog area revelada: {fog_id}')