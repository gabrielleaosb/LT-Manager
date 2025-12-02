import PyInstaller.__main__
import os

# Diretórios importantes
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
APP_DIR = os.path.join(BASE_DIR, 'app')

print("🔨 Construindo executável com suporte a ngrok...")

PyInstaller.__main__.run([
    'run.py',                           
    '--name=RPG_Manager',               
    '--onefile',                         
    '--console',  # Mantém console para ver URL do ngrok
    '--noconfirm',
    
    # Incluir templates e arquivos estáticos
    f'--add-data={os.path.join(APP_DIR, "templates")};app/templates',
    f'--add-data={os.path.join(APP_DIR, "static")};app/static',
    
    # Incluir dependências
    '--hidden-import=engineio.async_drivers.threading',
    '--hidden-import=socketio',
    '--hidden-import=flask_socketio',
    '--hidden-import=pyngrok',
    '--hidden-import=pyngrok.ngrok',
    
    # Otimizações
    '--clean',
])

print("\n" + "="*60)
print("✅ Executável criado com sucesso!")
print("="*60)
print(f"📁 Localização: {os.path.join(BASE_DIR, 'dist', 'RPG_Manager.exe')}")
print("\n📝 INSTRUÇÕES DE USO:")
print("1. Execute RPG_Manager.exe")
print("2. Copie a URL do ngrok que aparece no console")
print("3. Envie para seus jogadores!")
print("\n⚠️  IMPORTANTE:")
print("- Mantenha o console aberto enquanto joga")
print("- A URL muda cada vez que reinicia")
print("- Configure NGROK_AUTH_TOKEN para URL fixa (opcional)")
print("="*60 + "\n")