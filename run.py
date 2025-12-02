from app import app, socketio
from pyngrok import ngrok
import os

def start_ngrok():
    """Inicia o túnel ngrok e retorna a URL pública"""
    # Token de autenticação (opcional, mas recomendado)
    ngrok_auth_token = '2w5ggh7AVEPuw4UCR4g8rBK8VLK_fWadm6LreTzgcm9d1DgC'
    
    if ngrok_auth_token:
        ngrok.set_auth_token(ngrok_auth_token)
    
    # IMPORTANTE: Mata todas as sessões ngrok antigas primeiro
    print("🔄 Encerrando sessões ngrok antigas...")
    ngrok.kill()
    
    # Cria o túnel HTTP na porta 5000
    public_url = ngrok.connect(5000, bind_tls=True)
    print("\n" + "="*60)
    print("🌐 NGROK ATIVO!")
    print("="*60)
    print(f"📡 URL Pública: {public_url}")
    print(f"🔗 Compartilhe com jogadores: {public_url}")
    print("="*60 + "\n")
    
    return public_url

if __name__ == "__main__":
    ngrok_url = None
    
    try:
        # Inicia o ngrok
        ngrok_url = start_ngrok()
        
        # Salva a URL em uma variável de ambiente
        os.environ['NGROK_URL'] = str(ngrok_url)
        
        # Inicia o servidor Flask
        print("🚀 Iniciando servidor Flask na porta 5000...")
        print("💻 Acesse localmente: http://localhost:5000/dashboard")
        print("\n⚠️  Mantenha esta janela aberta!\n")
        
        socketio.run(
            app, 
            debug=False,  # Desativa debug para evitar reinicializações
            allow_unsafe_werkzeug=True, 
            host='0.0.0.0', 
            port=5000,
            use_reloader=False  # IMPORTANTE: Evita reiniciar e criar nova sessão ngrok
        )
        
    except KeyboardInterrupt:
        print("\n\n👋 Encerrando servidor...")
        
    except Exception as e:
        print(f"\n❌ Erro ao iniciar: {e}")
        print("\n💡 SOLUÇÕES:")
        print("1. Feche todas as janelas do ngrok")
        print("2. Acesse: https://dashboard.ngrok.com/agents")
        print("3. Encerre todas as sessões ativas")
        print("4. Execute novamente este programa\n")
        
    finally:
        # Limpa as sessões ngrok ao encerrar
        print("🧹 Limpando sessões ngrok...")
        try:
            ngrok.kill()
        except Exception:
            pass
