from . import app
from flask import render_template, jsonify, request

@app.route("/")
def index():
    """Landing page inicial"""
    return render_template("index.html")

@app.route("/dashboard")
def dashboard():
    """Dashboard principal do RPG Manager"""
    return render_template("dashboard.html")

@app.route("/map-manager")
def map_manager():
    """Gerenciador de Mapas com Grid"""
    return render_template("map_manager.html")

@app.route("/entity-manager")
def combat_tracker():
    """Tracker de Combate"""
    return render_template("entity_manager.html")

@app.route("/dice-roller")
def dice_roller():
    """Rolador de Dados"""
    return render_template("dice_roller.html")

# ===== API ENDPOINTS =====

@app.route("/api/map/state", methods=["GET", "POST"])
def map_state():
    """API para estado do mapa (para compartilhamento em tempo real)"""
    if request.method == "POST":
        # Salvar estado do mapa
        data = request.json
        # TODO: Implementar salvamento no banco
        return jsonify({"status": "success", "data": data})
    else:
        # Retornar estado atual do mapa
        # TODO: Buscar do banco
        return jsonify({"status": "success", "data": {}})

@app.route("/api/combat/save", methods=["POST"])
def save_combat():
    """Salvar estado do combate"""
    data = request.json
    # TODO: Implementar salvamento no banco
    return jsonify({"status": "success"})

@app.route("/api/dice/history", methods=["GET"])
def dice_history():
    """Histórico de rolagens"""
    # TODO: Buscar do banco
    return jsonify({"status": "success", "history": []})

# Rota para visão do jogador (somente leitura)
@app.route("/player-view/<session_id>")
def player_view(session_id):
    """Visão compartilhada para jogadores (somente mapa)"""
    return render_template("player_view.html", session_id=session_id)