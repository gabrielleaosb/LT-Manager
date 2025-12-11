from flask import Flask
from flask_socketio import SocketIO
from datetime import timedelta
import os
from dotenv import load_dotenv

load_dotenv()  # Carregar variáveis de ambiente

app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'fallback-key-change-me')
app.config['PERMANENT_SESSION_LIFETIME'] = timedelta(days=7)
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['SESSION_COOKIE_SECURE'] = os.getenv('FLASK_ENV') == 'production'  # HTTPS em produção
app.config['SESSION_COOKIE_HTTPONLY'] = True

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