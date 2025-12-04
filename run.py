from app import app, socketio
from pyngrok import ngrok
import os
import sys

def start_ngrok():
    """Inicia o túnel ngrok otimizado"""
    ngrok_auth_token = '2w5ggh7AVEPuw4UCR4g8rBK8VLK_fWadm6LreTzgcm9d1DgC'
    
    if ngrok_auth_token:
        ngrok.set_auth_token(ngrok_auth_token)
    
    # Matar sessões antigas
    print("🔄 Encerrando sessões ngrok antigas...")
    ngrok.kill()
    
    # ✅ Configurar ngrok com opções otimizadas
    options = {
        "bind_tls": True,
        "inspect": False  # Desabilita interface de inspeção
    }
    
    # Criar túnel
    public_url = ngrok.connect(5000, **options)
    
    print("\n" + "="*70)
    print("🌐 NGROK ATIVO!")
    print("="*70)
    print(f"📡 URL Pública: {public_url}")
    print(f"🔗 Link Direto: {public_url}/dashboard")
    print("="*70)
    print("\n💡 DICA: Compartilhe o 'Link Direto' com seus jogadores")
    print("   (Eles verão um aviso de segurança apenas na PRIMEIRA vez)\n")
    
    return public_url

if __name__ == "__main__":
    ngrok_url = None
    
    try:
        # Inicia o ngrok
        ngrok_url = start_ngrok()
        
        # Salva a URL
        os.environ['NGROK_URL'] = str(ngrok_url)
        
        # Inicia o servidor Flask
        print("🚀 Iniciando servidor Flask na porta 5000...")
        print("💻 Acesse localmente: http://localhost:5000/dashboard")
        print("\n⚠️  Mantenha esta janela aberta!\n")
        
        socketio.run(
            app, 
            debug=False,  
            host='0.0.0.0', 
            port=5000,
            use_reloader=False,
            log_output=True
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
        print("🧹 Limpando sessões ngrok...")
        try:
            ngrok.kill()
        except Exception:
            pass