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
    """
    Salvar estado COMPLETO da sessão
    
    Body:
    {
        "session_id": "abc123",
        "data": {
            "images": [...],
            "tokens": [...],
            "drawings": [...],
            "fogImage": "data:image/...",
            "scenes": [...],
            "grid_settings": {...}
        }
    }
    """
    try:
        payload = request.json
        session_id = payload.get('session_id')
        data = payload.get('data')
        
        if not session_id:
            return jsonify({"error": "session_id obrigatório"}), 400
        
        if not data or not isinstance(data, dict):
            return jsonify({"error": "data inválido"}), 400
        
        # Salvar no database
        success = db.save_session(session_id, data)
        
        if success:
            size_mb = db.get_session_size(session_id)
            return jsonify({
                "status": "success",
                "message": "Sessão salva com sucesso",
                "size_mb": size_mb
            })
        else:
            return jsonify({"error": "Erro ao salvar no banco"}), 500
    
    except Exception as e:
        print(f"❌ Erro ao salvar sessão: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/session/load/<session_id>", methods=["GET"])
def load_session_data(session_id):
    """Carregar estado da sessão"""
    try:
        result = db.load_session(session_id)
        
        if result:
            return jsonify({
                "status": "success",
                "data": result['data'],
                "version": result['version'],
                "updated_at": result['updated_at']
            })
        
        return jsonify({
            "status": "not_found",
            "data": None
        }), 404
    
    except Exception as e:
        print(f"❌ Erro ao carregar sessão: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/session/delete/<session_id>", methods=["DELETE"])
def delete_session_data(session_id):
    """Deletar sessão"""
    try:
        success = db.delete_session(session_id)
        
        if success:
            return jsonify({
                "status": "success",
                "message": "Sessão deletada"
            })
        else:
            return jsonify({"error": "Erro ao deletar"}), 500
    
    except Exception as e:
        print(f"❌ Erro ao deletar sessão: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/sessions/list", methods=["GET"])
def list_sessions():
    """Listar todas as sessões"""
    try:
        limit = request.args.get('limit', 50, type=int)
        sessions = db.list_sessions(limit)
        
        # Adicionar tamanho para cada sessão
        for s in sessions:
            s['size_mb'] = db.get_session_size(s['session_id'])
        
        return jsonify({
            "status": "success",
            "sessions": sessions
        })
    
    except Exception as e:
        print(f"❌ Erro ao listar sessões: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/sessions/cleanup", methods=["POST"])
def cleanup_sessions():
    """Limpar sessões antigas"""
    try:
        days = request.json.get('days', 30)
        deleted = db.cleanup_old_sessions(days)
        
        return jsonify({
            "status": "success",
            "deleted": deleted,
            "message": f"{deleted} sessões removidas"
        })
    
    except Exception as e:
        print(f"❌ Erro ao limpar sessões: {e}")
        return jsonify({"error": str(e)}), 500
    