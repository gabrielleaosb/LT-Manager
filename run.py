from app import app, socketio

if __name__ == "__main__":
    print("\n" + "="*70)
    print("🚀 RPG MANAGER - Last Take")
    print("="*70)
    print("💻 Acesso Local: http://localhost:5000/dashboard")
    print("🌐 Rede Local: http://[SEU_IP]:5000/dashboard")
    print("="*70)
    print("\n⚠️  Mantenha esta janela aberta durante o jogo!\n")
    
    try:
        socketio.run(
            app, 
            debug=False,  
            host='0.0.0.0', 
            port=5000,
            use_reloader=False,
            log_output=True
        )
    except KeyboardInterrupt:
        print("\n\n👋 Servidor encerrado pelo usuário")
    except Exception as e:
        print(f"\n❌ Erro ao iniciar servidor: {e}")