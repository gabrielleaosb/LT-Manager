import base64
import io
from PIL import Image
import json
import os
from datetime import datetime

class ImageCompressor:
    """Classe para comprimir imagens"""
    
    @staticmethod
    def compress_image(base64_string, max_width=1920, quality=85):
        """
        Comprime uma imagem em base64
        
        Args:
            base64_string: String base64 da imagem
            max_width: Largura máxima em pixels
            quality: Qualidade JPEG (1-100)
            
        Returns:
            String base64 da imagem comprimida
        """
        try:
            if ',' in base64_string:
                header, base64_data = base64_string.split(',', 1)
            else:
                base64_data = base64_string
                header = 'data:image/jpeg;base64'
            
            # Decodifica base64
            image_data = base64.b64decode(base64_data)
            
            # Abre a imagem
            image = Image.open(io.BytesIO(image_data))
            
            # Converte RGBA para RGB se necessário
            if image.mode == 'RGBA':
                background = Image.new('RGB', image.size, (255, 255, 255))
                background.paste(image, mask=image.split()[3])
                image = background
            elif image.mode != 'RGB':
                image = image.convert('RGB')
            
            # Redimensiona se necessário
            if image.width > max_width:
                ratio = max_width / image.width
                new_height = int(image.height * ratio)
                image = image.resize((max_width, new_height), Image.Resampling.LANCZOS)
            
            # Salva como JPEG em memória
            output = io.BytesIO()
            image.save(output, format='JPEG', quality=quality, optimize=True)
            output.seek(0)
            
            # Converte de volta para base64
            compressed_base64 = base64.b64encode(output.read()).decode('utf-8')
            
            return f"{header},{compressed_base64}"
            
        except Exception as e:
            print(f"Erro ao comprimir imagem: {e}")
            return base64_string  # Retorna original em caso de erro

    @staticmethod
    def get_image_size(base64_string):
        """Retorna o tamanho da imagem em bytes"""
        if ',' in base64_string:
            _, base64_data = base64_string.split(',', 1)
        else:
            base64_data = base64_string
        
        return len(base64_data.encode('utf-8'))


class SessionManager:
    """Gerenciador de persistência de sessões"""
    
    SESSIONS_DIR = 'sessions'
    
    @classmethod
    def ensure_sessions_dir(cls):
        """Cria o diretório de sessões se não existir"""
        if not os.path.exists(cls.SESSIONS_DIR):
            os.makedirs(cls.SESSIONS_DIR)
    
    @classmethod
    def save_session(cls, session_id, session_data):
        """
        Salva o estado de uma sessão em arquivo JSON
        
        Args:
            session_id: ID da sessão
            session_data: Dicionário com os dados da sessão
        """
        cls.ensure_sessions_dir()
        
        # Preparar dados para salvar (sem imagens grandes)
        save_data = {
            'session_id': session_id,
            'maps': session_data.get('maps', []),
            'entities': session_data.get('entities', []),
            'tokens': session_data.get('tokens', []),
            'drawings': session_data.get('drawings', []),
            'fog_areas': session_data.get('fog_areas', []),
            'map_notes': session_data.get('map_notes', []),
            'last_updated': datetime.now().isoformat()
        }
        
        filepath = os.path.join(cls.SESSIONS_DIR, f"{session_id}.json")
        
        try:
            with open(filepath, 'w', encoding='utf-8') as f:
                json.dump(save_data, f, indent=2, ensure_ascii=False)
            return True
        except Exception as e:
            print(f"Erro ao salvar sessão {session_id}: {e}")
            return False
    
    @classmethod
    def load_session(cls, session_id):
        """
        Carrega o estado de uma sessão do arquivo JSON
        
        Args:
            session_id: ID da sessão
            
        Returns:
            Dicionário com os dados da sessão ou None se não existir
        """
        filepath = os.path.join(cls.SESSIONS_DIR, f"{session_id}.json")
        
        if not os.path.exists(filepath):
            return None
        
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception as e:
            print(f"Erro ao carregar sessão {session_id}: {e}")
            return None
    
    @classmethod
    def delete_session(cls, session_id):
        """Deleta o arquivo de uma sessão"""
        filepath = os.path.join(cls.SESSIONS_DIR, f"{session_id}.json")
        
        if os.path.exists(filepath):
            try:
                os.remove(filepath)
                return True
            except Exception as e:
                print(f"Erro ao deletar sessão {session_id}: {e}")
                return False
        return False
    
    @classmethod
    def list_sessions(cls):
        """Lista todas as sessões salvas"""
        cls.ensure_sessions_dir()
        
        sessions = []
        for filename in os.listdir(cls.SESSIONS_DIR):
            if filename.endswith('.json'):
                session_id = filename[:-5]
                data = cls.load_session(session_id)
                if data:
                    sessions.append({
                        'session_id': session_id,
                        'last_updated': data.get('last_updated', 'Unknown')
                    })
        
        return sessions


class ActionHistory:
    """Gerenciador de histórico de ações para desfazer/refazer"""
    
    def __init__(self, max_size=50):
        self.max_size = max_size
        self.history = []
        self.current_index = -1
    
    def add_action(self, action_type, before_state, after_state):
        """
        Adiciona uma ação ao histórico
        
        Args:
            action_type: Tipo da ação (add_token, move_token, etc)
            before_state: Estado antes da ação
            after_state: Estado depois da ação
        """
        # Remove ações após o índice atual
        self.history = self.history[:self.current_index + 1]
        
        # Adiciona nova ação
        self.history.append({
            'type': action_type,
            'before': before_state,
            'after': after_state,
            'timestamp': datetime.now().isoformat()
        })
        
        # Limita o tamanho do histórico
        if len(self.history) > self.max_size:
            self.history.pop(0)
        else:
            self.current_index += 1
    
    def can_undo(self):
        """Verifica se é possível desfazer"""
        return self.current_index >= 0
    
    def can_redo(self):
        """Verifica se é possível refazer"""
        return self.current_index < len(self.history) - 1
    
    def undo(self):
        """Desfaz a última ação"""
        if not self.can_undo():
            return None
        
        action = self.history[self.current_index]
        self.current_index -= 1
        return action['before']
    
    def redo(self):
        """Refaz a última ação desfeita"""
        if not self.can_redo():
            return None
        
        self.current_index += 1
        action = self.history[self.current_index]
        return action['after']
    
    def clear(self):
        """Limpa o histórico"""
        self.history = []
        self.current_index = -1