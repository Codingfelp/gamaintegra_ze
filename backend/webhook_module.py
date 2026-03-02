"""
Módulo de Webhooks para Sistema Externo
Envia notificações quando há mudanças nos pedidos
"""

import os
import json
import requests
import threading
from datetime import datetime
from typing import Optional, Dict, Any, List
import mysql.connector

# Configuração do MySQL
DB_CONFIG = {
    'host': 'mainline.proxy.rlwy.net',
    'port': 52996,
    'user': 'root',
    'password': 'eHeoVCebYyaJVBEBtCLfYNHgRCrxWVXU',
    'database': 'railway'
}

# Arquivo de configuração do webhook
WEBHOOK_CONFIG_FILE = '/app/backend/webhook_config.json'

# Mapeamento de status
STATUS_MAP = {
    0: 'Pendente',
    1: 'Entregue',
    2: 'Aceito',
    3: 'A caminho',
    4: 'Cancelado',
    5: 'Rejeitado',
    6: 'Expirado'
}

def get_webhook_config() -> Dict:
    """Carrega configuração do webhook"""
    if os.path.exists(WEBHOOK_CONFIG_FILE):
        with open(WEBHOOK_CONFIG_FILE, 'r') as f:
            return json.load(f)
    return {
        'url': None,
        'secret': None,
        'ativo': False,
        'eventos': ['pedido.novo', 'pedido.status', 'pedido.detalhes', 'pedido.retirada_pendente']
    }

def save_webhook_config(config: Dict):
    """Salva configuração do webhook"""
    with open(WEBHOOK_CONFIG_FILE, 'w') as f:
        json.dump(config, f, indent=2)

def get_db():
    """Obtém conexão com o banco"""
    return mysql.connector.connect(**DB_CONFIG)

def get_pedido_completo(pedido_id: str) -> Optional[Dict]:
    """
    Busca todos os dados de um pedido
    Retorna o payload completo para o webhook
    """
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        
        # Buscar pedido
        cursor.execute("""
            SELECT 
                delivery_id,
                delivery_code,
                delivery_status,
                delivery_name_cliente,
                delivery_cpf_cliente,
                delivery_telefone,
                delivery_email_entregador,
                delivery_endereco_rota,
                delivery_endereco_complemento,
                delivery_endereco_bairro,
                delivery_endereco_cidade_uf,
                delivery_endereco_cep,
                delivery_codigo_entrega,
                delivery_tipo_pedido,
                delivery_subtotal,
                delivery_frete,
                delivery_taxa_conveniencia,
                delivery_troco,
                delivery_troco_para,
                delivery_desconto,
                delivery_desconto_descricao,
                delivery_total,
                delivery_forma_pagamento,
                delivery_obs,
                delivery_date_time,
                delivery_data_hora_captura,
                delivery_tem_itens
            FROM delivery 
            WHERE delivery_code = %s OR delivery_id = %s
            LIMIT 1
        """, (pedido_id, pedido_id))
        
        pedido = cursor.fetchone()
        
        if not pedido:
            cursor.close()
            conn.close()
            return None
        
        # Buscar itens do pedido
        cursor.execute("""
            SELECT 
                delivery_itens_descricao as descricao,
                delivery_itens_qtd as quantidade,
                delivery_itens_valor_unitario as valor_unitario,
                delivery_itens_valor_total as valor_total
            FROM delivery_itens 
            WHERE delivery_itens_id_delivery = %s
        """, (pedido['delivery_id'],))
        
        itens = cursor.fetchall()
        
        cursor.close()
        conn.close()
        
        # Montar payload completo
        status_codigo = pedido['delivery_status'] or 0
        
        payload = {
            'numero_pedido': pedido['delivery_code'],
            'id_interno': pedido['delivery_id'],
            'status': {
                'codigo': status_codigo,
                'descricao': STATUS_MAP.get(status_codigo, 'Desconhecido')
            },
            'cliente': {
                'nome': pedido['delivery_name_cliente'],
                'cpf': pedido['delivery_cpf_cliente'],
                'telefone': pedido['delivery_telefone']
            },
            'entregador': {
                'email': pedido['delivery_email_entregador']
            },
            'endereco': {
                'logradouro': pedido['delivery_endereco_rota'],
                'complemento': pedido['delivery_endereco_complemento'],
                'bairro': pedido['delivery_endereco_bairro'],
                'cidade_uf': pedido['delivery_endereco_cidade_uf'],
                'cep': pedido['delivery_endereco_cep']
            },
            'codigo_entrega': pedido['delivery_codigo_entrega'],
            'tipo_pedido': pedido['delivery_tipo_pedido'],
            'itens': itens if itens else [],
            'valores': {
                'subtotal': float(pedido['delivery_subtotal'] or 0),
                'frete': float(pedido['delivery_frete'] or 0),
                'taxa_conveniencia': float(pedido['delivery_taxa_conveniencia'] or 0),
                'troco': float(pedido['delivery_troco'] or 0),
                'troco_para': float(pedido['delivery_troco_para'] or 0),
                'desconto': float(pedido['delivery_desconto'] or 0),
                'desconto_descricao': pedido['delivery_desconto_descricao'],
                'total': float(pedido['delivery_total'] or 0)
            },
            'forma_pagamento': pedido['delivery_forma_pagamento'],
            'observacoes': pedido['delivery_obs'],
            'data_pedido': pedido['delivery_date_time'].isoformat() if pedido['delivery_date_time'] else None,
            'data_captura': pedido['delivery_data_hora_captura'].isoformat() if pedido['delivery_data_hora_captura'] else None,
            'tem_itens': bool(pedido['delivery_tem_itens'])
        }
        
        return payload
        
    except Exception as e:
        print(f"[WEBHOOK] Erro ao buscar pedido {pedido_id}: {e}")
        return None

def enviar_webhook(evento: str, pedido_id: str, dados_extras: Dict = None):
    """
    Envia webhook para o sistema externo
    Executa em background para não bloquear
    """
    config = get_webhook_config()
    
    if not config.get('ativo') or not config.get('url'):
        print(f"[WEBHOOK] Desativado ou URL não configurada")
        return False
    
    if evento not in config.get('eventos', []):
        print(f"[WEBHOOK] Evento {evento} não está na lista de eventos ativos")
        return False
    
    def _enviar():
        try:
            # Buscar dados completos do pedido
            pedido_data = get_pedido_completo(pedido_id)
            
            if not pedido_data:
                print(f"[WEBHOOK] Pedido {pedido_id} não encontrado")
                return
            
            # Montar payload do webhook
            payload = {
                'evento': evento,
                'timestamp': datetime.now().isoformat(),
                'pedido': pedido_data
            }
            
            # Adicionar dados extras se houver
            if dados_extras:
                payload['extras'] = dados_extras
            
            # Headers
            headers = {
                'Content-Type': 'application/json',
                'X-Webhook-Event': evento,
                'X-Webhook-Timestamp': payload['timestamp']
            }
            
            # Adicionar secret se configurado
            if config.get('secret'):
                headers['X-Webhook-Secret'] = config['secret']
            
            # Enviar
            response = requests.post(
                config['url'],
                json=payload,
                headers=headers,
                timeout=30
            )
            
            if response.status_code >= 200 and response.status_code < 300:
                print(f"[WEBHOOK] ✅ {evento} enviado para pedido {pedido_id}")
            else:
                print(f"[WEBHOOK] ⚠️ {evento} retornou status {response.status_code}")
                
        except requests.exceptions.Timeout:
            print(f"[WEBHOOK] ❌ Timeout ao enviar {evento} para pedido {pedido_id}")
        except Exception as e:
            print(f"[WEBHOOK] ❌ Erro ao enviar {evento}: {e}")
    
    # Executar em thread separada
    thread = threading.Thread(target=_enviar)
    thread.daemon = True
    thread.start()
    
    return True

def webhook_pedido_novo(pedido_id: str):
    """Dispara webhook quando um pedido novo é capturado"""
    return enviar_webhook('pedido.novo', pedido_id)

def webhook_pedido_status(pedido_id: str, status_anterior: int, status_novo: int):
    """Dispara webhook quando o status do pedido muda"""
    return enviar_webhook('pedido.status', pedido_id, {
        'status_anterior': {
            'codigo': status_anterior,
            'descricao': STATUS_MAP.get(status_anterior, 'Desconhecido')
        },
        'status_novo': {
            'codigo': status_novo,
            'descricao': STATUS_MAP.get(status_novo, 'Desconhecido')
        }
    })

def webhook_pedido_detalhes(pedido_id: str, campos_atualizados: List[str]):
    """Dispara webhook quando detalhes do pedido são atualizados"""
    return enviar_webhook('pedido.detalhes', pedido_id, {
        'campos_atualizados': campos_atualizados
    })

def webhook_retirada_pendente(pedido_id: str):
    """Dispara webhook quando um pedido de retirada está aguardando código"""
    return enviar_webhook('pedido.retirada_pendente', pedido_id)

# Funções para buscar múltiplos pedidos (sync)
def get_pedidos_desde(timestamp: str, limit: int = 100) -> List[Dict]:
    """Busca todos os pedidos modificados desde um timestamp"""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute("""
            SELECT delivery_code
            FROM delivery 
            WHERE delivery_data_hora_captura >= %s
            ORDER BY delivery_data_hora_captura ASC
            LIMIT %s
        """, (timestamp, limit))
        
        codigos = [row['delivery_code'] for row in cursor.fetchall()]
        
        cursor.close()
        conn.close()
        
        # Buscar dados completos de cada pedido
        pedidos = []
        for codigo in codigos:
            pedido = get_pedido_completo(codigo)
            if pedido:
                pedidos.append(pedido)
        
        return pedidos
        
    except Exception as e:
        print(f"[WEBHOOK] Erro ao buscar pedidos desde {timestamp}: {e}")
        return []

def get_pedidos_por_status(status: int, limit: int = 100) -> List[Dict]:
    """Busca pedidos por status"""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute("""
            SELECT delivery_code
            FROM delivery 
            WHERE delivery_status = %s AND delivery_trash = 0
            ORDER BY delivery_date_time DESC
            LIMIT %s
        """, (status, limit))
        
        codigos = [row['delivery_code'] for row in cursor.fetchall()]
        
        cursor.close()
        conn.close()
        
        pedidos = []
        for codigo in codigos:
            pedido = get_pedido_completo(codigo)
            if pedido:
                pedidos.append(pedido)
        
        return pedidos
        
    except Exception as e:
        print(f"[WEBHOOK] Erro ao buscar pedidos com status {status}: {e}")
        return []
