from flask import Flask # type: ignore
from flask_socketio import SocketIO # type: ignore
from datetime import timedelta

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key-here'
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=7)
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['SESSION_COOKIE_SECURE'] = False

socketio = SocketIO(
    app, 
    cors_allowed_origins="*",
    async_mode='threading',
    logger=False,
    ping_timeout=60,
    ping_interval=25
)

from app.database import db
print('✅ Banco de dados inicializado')

from app import routes, socket_events