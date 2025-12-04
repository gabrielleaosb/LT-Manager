import sqlite3
import json
import os
from datetime import datetime
import threading

class Database:
    def __init__(self):
        if not os.path.exists('data'):
            os.makedirs('data')
        
        self.db_path = 'data/rpg_manager.db'
        self._local = threading.local()
        self.init_database()
    
    def get_connection(self):
        """Thread-safe connection"""
        if not hasattr(self._local, 'conn') or self._local.conn is None:
            self._local.conn = sqlite3.connect(self.db_path, check_same_thread=False)
            self._local.conn.row_factory = sqlite3.Row
        return self._local.conn
    
    def init_database(self):
        """Inicializar tabelas com índices"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        # Tabela de Sessões (simplificada)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS sessions (
                session_id TEXT PRIMARY KEY,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                data TEXT NOT NULL,
                version INTEGER DEFAULT 1
            )
        ''')
        
        # Índice para busca rápida
        cursor.execute('''
            CREATE INDEX IF NOT EXISTS idx_sessions_updated 
            ON sessions(updated_at DESC)
        ''')
        
        conn.commit()
        print('✅ Banco de dados inicializado')
    
    # ==================
    # SESSÕES - CRUD SIMPLES
    # ==================
    
    def save_session(self, session_id, data):
        """
        Salvar/atualizar estado completo da sessão
        
        Args:
            session_id: ID da sessão
            data: Dict contendo {images, tokens, drawings, fogImage, scenes, grid_settings}
        """
        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            # Serializar dados
            data_json = json.dumps(data, ensure_ascii=False)
            
            # Verificar se existe
            cursor.execute('SELECT version FROM sessions WHERE session_id = ?', (session_id,))
            result = cursor.fetchone()
            
            if result:
                # Update com versionamento
                new_version = result['version'] + 1
                cursor.execute('''
                    UPDATE sessions 
                    SET data = ?, updated_at = CURRENT_TIMESTAMP, version = ?
                    WHERE session_id = ?
                ''', (data_json, new_version, session_id))
            else:
                # Insert novo
                cursor.execute('''
                    INSERT INTO sessions (session_id, data, version)
                    VALUES (?, ?, 1)
                ''', (session_id, data_json))
            
            conn.commit()
            print(f'💾 Sessão {session_id} salva (versão {new_version if result else 1})')
            return True
            
        except Exception as e:
            print(f'❌ Erro ao salvar sessão: {e}')
            conn.rollback()
            return False
    
    def load_session(self, session_id):
        """Carregar estado da sessão"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute('''
                SELECT data, version, updated_at 
                FROM sessions 
                WHERE session_id = ?
            ''', (session_id,))
            
            result = cursor.fetchone()
            
            if result:
                data = json.loads(result['data'])
                print(f'✅ Sessão {session_id} carregada (versão {result["version"]})')
                return {
                    'data': data,
                    'version': result['version'],
                    'updated_at': result['updated_at']
                }
            
            print(f'ℹ️ Sessão {session_id} não encontrada')
            return None
            
        except Exception as e:
            print(f'❌ Erro ao carregar sessão: {e}')
            return None
    
    def delete_session(self, session_id):
        """Deletar sessão"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute('DELETE FROM sessions WHERE session_id = ?', (session_id,))
            conn.commit()
            print(f'🗑️ Sessão {session_id} deletada')
            return True
            
        except Exception as e:
            print(f'❌ Erro ao deletar sessão: {e}')
            conn.rollback()
            return False
    
    def list_sessions(self, limit=50):
        """Listar sessões recentes"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute('''
                SELECT session_id, created_at, updated_at, version
                FROM sessions 
                ORDER BY updated_at DESC 
                LIMIT ?
            ''', (limit,))
            
            results = cursor.fetchall()
            return [dict(row) for row in results]
            
        except Exception as e:
            print(f'❌ Erro ao listar sessões: {e}')
            return []
    
    def cleanup_old_sessions(self, days=30):
        """Limpar sessões antigas"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute('''
                DELETE FROM sessions 
                WHERE updated_at < datetime('now', '-' || ? || ' days')
            ''', (days,))
            
            deleted = cursor.rowcount
            conn.commit()
            print(f'🧹 {deleted} sessões antigas removidas')
            return deleted
            
        except Exception as e:
            print(f'❌ Erro ao limpar sessões: {e}')
            conn.rollback()
            return 0
    
    def get_session_size(self, session_id):
        """Obter tamanho da sessão em MB"""
        conn = self.get_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute('''
                SELECT length(data) as size 
                FROM sessions 
                WHERE session_id = ?
            ''', (session_id,))
            
            result = cursor.fetchone()
            if result:
                size_mb = result['size'] / (1024 * 1024)
                return round(size_mb, 2)
            
            return 0
            
        except Exception as e:
            print(f'❌ Erro ao calcular tamanho: {e}')
            return 0

db = Database()