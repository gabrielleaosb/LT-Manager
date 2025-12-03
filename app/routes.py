from . import app
from flask import render_template, jsonify, request, redirect, url_for, session # type: ignore
import uuid
from datetime import timedelta  # noqa: F401
from .database import db


@app.route("/")
def root():
    return redirect(url_for("dashboard"))

@app.route("/dashboard")
def dashboard():
    """Dashboard principal do RPG Manager"""
    return render_template("dashboard.html") 

@app.route("/map-manager")
def map_manager():
    """Gerenciador de Mapas com Grid"""
    if 'rpg_session_id' not in session:
        session_id = str(uuid.uuid4())[:8]
        session['rpg_session_id'] = session_id
        session.permanent = True  
        print(f'🆕 Nova sessão criada: {session_id}')
    else:
        session_id = session['rpg_session_id']
        print(f'♻️ Sessão existente restaurada: {session_id}')
    
    return render_template("map_manager.html", session_id=session_id)

@app.route("/dice-roller")
def dice_roller():
    """Rolador de Dados"""
    return render_template("dice_roller.html")

@app.route("/notes")
def notes():
    """Notas do Mestre"""
    return render_template("notes.html")

# ===== API ENDPOINTS =====

@app.route("/api/map/state", methods=["GET", "POST"])
def map_state():
    """API para estado do mapa (para compartilhamento em tempo real)"""
    if request.method == "POST":
        data = request.json
        return jsonify({"status": "success", "data": data})
    else:
        return jsonify({"status": "success", "data": {}})

@app.route("/api/dice/history", methods=["GET"])
def dice_history():
    """Histórico de rolagens"""
    return jsonify({"status": "success", "history": []})

@app.route("/api/notes/save", methods=["POST"])
def save_notes():
    """Salvar notas do mestre"""
    data = request.json
    return jsonify({"status": "success"})

@app.route("/api/notes/get", methods=["GET"])
def get_notes():
    """Buscar notas do mestre"""
    return jsonify({"status": "success", "notes": []})

# Rota para visão do jogador (somente leitura)
@app.route("/player-view/<session_id>")
def player_view(session_id):
    """Visão compartilhada para jogadores (somente mapa)"""
    return render_template("player_view.html", session_id=session_id)

# ==================
# API DE PERSISTÊNCIA
# ==================

@app.route("/api/session/save", methods=["POST"])
def save_session_data():
    """Salvar estado completo da sessão"""
    try:
        data = request.json
        session_id = data.get('session_id')
        session_data = data.get('data')
        
        if not session_id or not session_data:
            return jsonify({"error": "Dados inválidos"}), 400
        
        db.save_session(session_id, session_data)
        
        return jsonify({
            "status": "success",
            "message": "Sessão salva com sucesso"
        })
    
    except Exception as e:
        print(f"❌ Erro ao salvar sessão: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/session/load/<session_id>", methods=["GET"])
def load_session_data(session_id):
    """Carregar estado da sessão"""
    try:
        data = db.load_session(session_id)
        
        if data:
            return jsonify({
                "status": "success",
                "data": data
            })
        
        return jsonify({
            "status": "not_found",
            "data": None
        })
    
    except Exception as e:
        print(f"❌ Erro ao carregar sessão: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/scenes/save", methods=["POST"])
def save_scenes_data():
    """Salvar cenas"""
    try:
        data = request.json
        session_id = data.get('session_id')
        scenes = data.get('scenes')
        
        if not session_id or not scenes:
            return jsonify({"error": "Dados inválidos"}), 400
        
        db.save_scenes(session_id, scenes)
        
        return jsonify({
            "status": "success",
            "message": f"{len(scenes)} cenas salvas"
        })
    
    except Exception as e:
        print(f"❌ Erro ao salvar cenas: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/scenes/load/<session_id>", methods=["GET"])
def load_scenes_data(session_id):
    """Carregar cenas"""
    try:
        scenes = db.load_scenes(session_id)
        
        return jsonify({
            "status": "success",
            "scenes": scenes
        })
    
    except Exception as e:
        print(f"❌ Erro ao carregar cenas: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/grid/save", methods=["POST"])
def save_grid_data():
    """Salvar grid settings"""
    try:
        data = request.json
        session_id = data.get('session_id')
        settings = data.get('settings')
        
        db.save_grid_settings(session_id, settings)
        
        return jsonify({"status": "success"})
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/grid/load/<session_id>", methods=["GET"])
def load_grid_data(session_id):
    """Carregar grid settings"""
    try:
        settings = db.load_grid_settings(session_id)
        
        return jsonify({
            "status": "success",
            "settings": settings
        })
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/api/sessions/list", methods=["GET"])
def list_sessions():
    """Listar todas as sessões"""
    try:
        sessions = db.get_all_sessions()
        
        return jsonify({
            "status": "success",
            "sessions": sessions
        })
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    