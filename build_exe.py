import PyInstaller.__main__
import os

# Diretórios importantes
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
APP_DIR = os.path.join(BASE_DIR, 'app')

PyInstaller.__main__.run([
    'run.py',                           # Arquivo principal
    '--name=RPG_Manager',               # Nome do executável
    '--onefile',                         # Tudo em um único arquivo
    #'--windowed',                        # Sem console (opcional)
    '--noconfirm'
    
    # Incluir templates e arquivos estáticos
    f'--add-data={os.path.join(APP_DIR, "templates")};app/templates',
    f'--add-data={os.path.join(APP_DIR, "static")};app/static',
    
    # Incluir dependências do Flask-SocketIO
    '--hidden-import=engineio.async_drivers.threading',
    '--hidden-import=socketio',
    '--hidden-import=flask_socketio',
    
    # Otimizações
    '--clean',
    '--noconfirm',
])

print("\n✅ Executável criado em: dist/RPG_Manager.exe")
print("📦 Distribua a pasta 'dist' completa para seu amigo!")