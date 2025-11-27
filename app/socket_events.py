from flask_socketio import emit, join_room, leave_room
from app import socketio

# Armazenar sessões ativas
active_sessions = {}

@socketio.on('connect')
def handle_connect():
    print('Cliente conectado')

@socketio.on('disconnect')
def handle_disconnect():
    print('Cliente desconectado')

@socketio.on('join_session')
def handle_join_session(data):
    session_id = data.get('session_id')
    join_room(session_id)
    emit('session_joined', {'session_id': session_id})
    print(f'Cliente entrou na sessão: {session_id}')

@socketio.on('leave_session')
def handle_leave_session(data):
    session_id = data.get('session_id')
    leave_room(session_id)
    print(f'Cliente saiu da sessão: {session_id}')

@socketio.on('map_update')
def handle_map_update(data):
    session_id = data.get('session_id')
    # Broadcast para todos na sala exceto o remetente
    emit('map_sync', data, room=session_id, include_self=False)

@socketio.on('token_update')
def handle_token_update(data):
    session_id = data.get('session_id')
    emit('token_sync', data, room=session_id, include_self=False)

@socketio.on('drawing_update')
def handle_drawing_update(data):
    session_id = data.get('session_id')
    emit('drawing_sync', data, room=session_id, include_self=False)

@socketio.on('clear_drawings')
def handle_clear_drawings(data):
    session_id = data.get('session_id')
    emit('drawings_cleared', {}, room=session_id, include_self=False)