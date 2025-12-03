import sqlite3
import json
import os
from datetime import datetime

class Database:
    def __init__(self):
        # Criar pasta data se não existir
        if not os.path.exists('data'):
            os.makedirs('data')
        
        self.db_path = 'data/rpg_manager.db'
        self.init_database()
    
    def get_connection(self):
        """Criar conexão com banco"""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row  # Retornar resultados como dicionários
        return conn
    
    def init_database(self):
        """Inicializar tabelas do banco"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        # Tabela de Sessões
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS sessions (
                session_id TEXT PRIMARY KEY,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                data TEXT,
                active_scene_id TEXT
            )
        ''')
        
        # Tabela de Cenas
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS scenes (
                id TEXT PRIMARY KEY,
                session_id TEXT,
                name TEXT,
                data TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (session_id) REFERENCES sessions(session_id)
            )
        ''')
        
        # Tabela de Grid Settings
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS grid_settings (
                session_id TEXT PRIMARY KEY,
                settings TEXT,
                FOREIGN KEY (session_id) REFERENCES sessions(session_id)
            )
        ''')
        
        conn.commit()
        conn.close()
        
        print('✅ Banco de dados inicializado')
    
    # ==================
    # SESSÕES
    # ==================
    
    def save_session(self, session_id, data):
        """Salvar/atualizar estado da sessão"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        data_json = json.dumps(data)
        
        cursor.execute('''
            INSERT OR REPLACE INTO sessions (session_id, data, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
        ''', (session_id, data_json))
        
        conn.commit()
        conn.close()
        
        print(f'💾 Sessão {session_id} salva no banco')
    
    def load_session(self, session_id):
        """Carregar estado da sessão"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute('SELECT data FROM sessions WHERE session_id = ?', (session_id,))
        result = cursor.fetchone()
        
        conn.close()
        
        if result:
            print(f'✅ Sessão {session_id} carregada do banco')
            return json.loads(result['data'])
        
        print(f'ℹ️ Sessão {session_id} não encontrada')
        return None
    
    def delete_session(self, session_id):
        """Deletar sessão e seus dados"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute('DELETE FROM sessions WHERE session_id = ?', (session_id,))
        cursor.execute('DELETE FROM scenes WHERE session_id = ?', (session_id,))
        cursor.execute('DELETE FROM grid_settings WHERE session_id = ?', (session_id,))
        
        conn.commit()
        conn.close()
        
        print(f'🗑️ Sessão {session_id} deletada')
    
    # ==================
    # CENAS
    # ==================
    
    def save_scenes(self, session_id, scenes):
        """Salvar cenas da sessão"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        # Deletar cenas antigas
        cursor.execute('DELETE FROM scenes WHERE session_id = ?', (session_id,))
        
        # Inserir novas
        for scene in scenes:
            scene_data = json.dumps(scene)
            cursor.execute('''
                INSERT INTO scenes (id, session_id, name, data)
                VALUES (?, ?, ?, ?)
            ''', (scene['id'], session_id, scene.get('name', 'Sem nome'), scene_data))
        
        conn.commit()
        conn.close()
        
        print(f'💾 {len(scenes)} cenas salvas para sessão {session_id}')
    
    def load_scenes(self, session_id):
        """Carregar cenas da sessão"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute('SELECT data FROM scenes WHERE session_id = ?', (session_id,))
        results = cursor.fetchall()
        
        conn.close()
        
        scenes = [json.loads(row['data']) for row in results]
        
        if scenes:
            print(f'✅ {len(scenes)} cenas carregadas')
        
        return scenes
    
    # ==================
    # GRID
    # ==================
    
    def save_grid_settings(self, session_id, settings):
        """Salvar configurações de grid"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        settings_json = json.dumps(settings)
        
        cursor.execute('''
            INSERT OR REPLACE INTO grid_settings (session_id, settings)
            VALUES (?, ?)
        ''', (session_id, settings_json))
        
        conn.commit()
        conn.close()
    
    def load_grid_settings(self, session_id):
        """Carregar configurações de grid"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute('SELECT settings FROM grid_settings WHERE session_id = ?', (session_id,))
        result = cursor.fetchone()
        
        conn.close()
        
        if result:
            return json.loads(result['settings'])
        
        return None
    
    # ==================
    # UTILITÁRIOS
    # ==================
    
    def get_all_sessions(self):
        """Listar todas as sessões"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute('SELECT session_id, created_at, updated_at FROM sessions ORDER BY updated_at DESC')
        results = cursor.fetchall()
        
        conn.close()
        
        return [dict(row) for row in results]
    
    def cleanup_old_sessions(self, days=30):
        """Limpar sessões antigas"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        cursor.execute('''
            DELETE FROM sessions 
            WHERE updated_at < datetime('now', '-' || ? || ' days')
        ''', (days,))
        
        deleted = cursor.rowcount
        conn.commit()
        conn.close()
        
        print(f'🧹 {deleted} sessões antigas removidas')
        return deleted

# Instância global
db = Database()