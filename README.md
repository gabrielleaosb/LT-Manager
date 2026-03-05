# 🗺️ Last Take Manager

> Sistema pessoal de gerenciamento de sessões de RPG de mesa, desenvolvido para uso próprio.

Este projeto nasceu da necessidade de ter uma ferramenta centralizada para conduzir sessões de RPG — com mapa interativo, controle de névoa de guerra, tokens, dados e chat entre jogadores, tudo rodando localmente na minha rede.

---

## ✨ Funcionalidades

### 🗺️ Gerenciador de Mapas
- Canvas interativo com zoom e pan
- Upload de imagens de mapa
- **Tokens** personalizáveis (redondos ou quadrados, com imagem ou cor)
- **Névoa de Guerra** — cobrir e revelar áreas do mapa em tempo real
- **Desenho colaborativo** com paleta de cores e controle de espessura
- **Grid** configurável (tamanho, cor, ativação)
- **Sistema de Cenas** — organize múltiplas cenas e controle a visibilidade por jogador
- Desfazer/Refazer ações (Ctrl+Z / Ctrl+Y)

### 👥 Multiplayer em Tempo Real (WebSocket)
- O mestre abre a sessão e compartilha um link para os jogadores
- Jogadores entram pelo navegador sem instalar nada
- Sincronização em tempo real de tokens, fog, desenhos e cenas
- Controle de permissões por jogador (mover tokens, desenhar)
- Visibilidade de cenas configurável individualmente

### 🎲 Rolador de Dados
- Dados rápidos: d4, d6, d8, d10, d12, d20, d100
- Rolagem personalizada com quantidade e modificador
- Histórico de rolagens
- **Rolagens compartilhadas** — resultado aparece para todos os jogadores na sessão
- Suporte a rolagens públicas ou privadas

### 💬 Chat Privado
- Mensagens privadas entre mestre e jogadores
- Mensagens privadas entre jogadores
- **Monitor de conversas** — o mestre pode acompanhar todas as conversas em modo somente leitura
- Contador de mensagens não lidas

### 📝 Notas do Mestre
- Organize anotações por categorias: NPCs, Locais, Missões, Itens, História, Outros
- Busca em tempo real
- Armazenamento local (localStorage)

### 💾 Persistência de Sessão
- Estado completo das sessões salvo em banco SQLite
- Auto-save periódico
- API REST para salvar, carregar e deletar sessões

---

## 🛠️ Stack

| Camada | Tecnologia |
|--------|-----------|
| Backend | Python + Flask |
| Tempo Real | Flask-SocketIO (WebSocket) |
| Banco de Dados | SQLite (via Python nativo) |
| Frontend | HTML5 Canvas + JavaScript puro |
| Estilização | CSS customizado (sem frameworks) |
| Servidor prod. | Gunicorn + Eventlet |

---

## 📁 Estrutura do Projeto

```
last-take-manager/
├── app/
│   ├── __init__.py          # Configuração do Flask e SocketIO
│   ├── database.py          # Camada de acesso ao SQLite
│   ├── routes.py            # Rotas HTTP e API REST
│   ├── socket_events.py     # Eventos WebSocket em tempo real
│   ├── static/
│   │   ├── css/             # Estilos por módulo
│   │   └── js/              # Lógica de frontend
│   └── templates/           # Templates HTML (Jinja2)
├── data/                    # Banco de dados SQLite (gerado automaticamente)
├── run.py                   # Ponto de entrada
├── gunicorn_config.py       # Configuração para produção
└── requirements.txt
```

---

## 🎮 Fluxo de Uso

1. O **mestre** acessa `/dashboard` e abre o **Gerenciador de Mapas**
2. Uma sessão é criada automaticamente com um ID único
3. O mestre compartilha o link `/player-view/{session_id}` com os jogadores
4. Jogadores entram pelo link, digitam seus nomes e são conectados
5. O mestre controla tudo: mapas, fog, tokens, visibilidade de cenas e permissões
6. Jogadores interagem conforme as permissões concedidas pelo mestre

---

## ⚠️ Aviso

Este projeto foi feito **para uso pessoal**, para rodar em rede local durante sessões de RPG. Não foi desenvolvido pensando em segurança para exposição pública na internet. Use por sua conta e risco se quiser hospedar externamente.

---

## 📜 Licença

Uso pessoal. Fique à vontade para adaptar para os seus próprios jogos.
