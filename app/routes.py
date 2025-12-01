from . import app
from flask import render_template, jsonify, request
import uuid

@app.route("/dashboard")
def dashboard():
    """Dashboard principal do RPG Manager"""
    return render_template("dashboard.html")

@app.route("/map-manager")
def map_manager():
    """Gerenciador de Mapas com Grid"""
    session_id = str(uuid.uuid4())[:8]
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