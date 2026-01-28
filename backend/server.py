from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import mysql.connector
from mysql.connector import pooling
import subprocess
import os
import json
from datetime import datetime
import hashlib
import random

app = FastAPI(title="Zé Delivery Integrador API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pool de conexão MySQL
db_config = {
    "host": "localhost",
    "user": "root",
    "password": "",
    "database": "zedelivery",
    "port": 3306
}

connection_pool = pooling.MySQLConnectionPool(
    pool_name="mypool",
    pool_size=5,
    **db_config
)

def get_db():
    return connection_pool.get_connection()

# Store de logs
node_logs = []
MAX_LOGS = 500

def add_log(log_type: str, message: str):
    global node_logs
    log = {
        "timestamp": datetime.now().isoformat(),
        "type": log_type,
        "message": message
    }
    node_logs.append(log)
    if len(node_logs) > MAX_LOGS:
        node_logs = node_logs[-MAX_LOGS:]

# ==================== MODELOS ====================

class LojaCreate(BaseModel):
    nome: str
    email: str
    senha: str
    id_company: Optional[int] = 1

class ConfigUpdate(BaseModel):
    login: Optional[str] = None
    senha: Optional[str] = None
    token: Optional[str] = None

class DuploCreate(BaseModel):
    codigo: str

class StatusUpdate(BaseModel):
    status: int

# ==================== ROTAS DE PEDIDOS ====================

@app.get("/api/pedidos")
async def listar_pedidos(status: Optional[str] = None, limit: int = 50, search: Optional[str] = None):
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    try:
        query = """
            SELECT d.*, 
                (SELECT COUNT(*) FROM delivery_itens WHERE delivery_itens_id_delivery = d.delivery_id) as total_itens
            FROM delivery d
            WHERE d.delivery_trash = 0
        """
        params = []
        
        if status and status != "all":
            query += " AND d.delivery_status = %s"
            params.append(int(status))
        
        if search:
            query += " AND (d.delivery_code LIKE %s OR d.delivery_name_cliente LIKE %s)"
            params.extend([f"%{search}%", f"%{search}%"])
        
        query += " ORDER BY d.delivery_date_time DESC LIMIT %s"
        params.append(limit)
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        
        # Converter datetime para string
        for row in rows:
            for key, value in row.items():
                if isinstance(value, datetime):
                    row[key] = value.isoformat()
        
        return {"success": True, "data": rows}
    finally:
        cursor.close()
        conn.close()

@app.get("/api/pedidos/stats/summary")
async def stats_pedidos():
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT COUNT(*) as count FROM delivery WHERE delivery_trash = 0")
        total = cursor.fetchone()["count"]
        
        cursor.execute("SELECT COUNT(*) as count FROM delivery WHERE delivery_status = 0 AND delivery_trash = 0")
        pendentes = cursor.fetchone()["count"]
        
        cursor.execute("SELECT COUNT(*) as count FROM delivery WHERE delivery_status = 2 AND delivery_trash = 0")
        aceitos = cursor.fetchone()["count"]
        
        cursor.execute("SELECT COUNT(*) as count FROM delivery WHERE delivery_status = 1 AND delivery_trash = 0")
        entregues = cursor.fetchone()["count"]
        
        cursor.execute("SELECT COUNT(*) as count FROM delivery WHERE delivery_status = 3 AND delivery_trash = 0")
        acaminho = cursor.fetchone()["count"]
        
        cursor.execute("SELECT COUNT(*) as count FROM delivery WHERE delivery_status IN (4,5) AND delivery_trash = 0")
        cancelados = cursor.fetchone()["count"]
        
        cursor.execute("SELECT COALESCE(SUM(delivery_total), 0) as total FROM delivery WHERE delivery_status = 1 AND delivery_trash = 0")
        faturamento = float(cursor.fetchone()["total"])
        
        return {
            "success": True,
            "data": {
                "total": total,
                "pendentes": pendentes,
                "aceitos": aceitos,
                "entregues": entregues,
                "acaminho": acaminho,
                "cancelados": cancelados,
                "faturamento": faturamento
            }
        }
    finally:
        cursor.close()
        conn.close()

@app.get("/api/pedidos/{pedido_id}")
async def detalhe_pedido(pedido_id: int):
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT * FROM delivery WHERE delivery_id = %s", (pedido_id,))
        pedido = cursor.fetchone()
        
        cursor.execute("""
            SELECT di.*, p.produto_descricao, p.produto_link_imagem, p.produto_codigo_ze
            FROM delivery_itens di
            LEFT JOIN produto p ON p.produto_id = di.delivery_itens_id_produto
            WHERE di.delivery_itens_id_delivery = %s
        """, (pedido_id,))
        itens = cursor.fetchall()
        
        # Converter datetime
        if pedido:
            for key, value in pedido.items():
                if isinstance(value, datetime):
                    pedido[key] = value.isoformat()
        
        return {"success": True, "data": {"pedido": pedido, "itens": itens}}
    finally:
        cursor.close()
        conn.close()

@app.patch("/api/pedidos/{pedido_id}/status")
async def atualizar_status(pedido_id: int, body: StatusUpdate):
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "UPDATE delivery SET delivery_status = %s WHERE delivery_id = %s",
            (body.status, pedido_id)
        )
        conn.commit()
        return {"success": True, "message": "Status atualizado"}
    finally:
        cursor.close()
        conn.close()

# ==================== ROTAS DE LOJAS ====================

@app.get("/api/lojas")
async def listar_lojas():
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT * FROM hub_delivery ORDER BY hub_delivery_id DESC")
        rows = cursor.fetchall()
        for row in rows:
            for key, value in row.items():
                if isinstance(value, datetime):
                    row[key] = value.isoformat()
        return {"success": True, "data": rows}
    finally:
        cursor.close()
        conn.close()

@app.post("/api/lojas")
async def criar_loja(loja: LojaCreate):
    conn = get_db()
    cursor = conn.cursor()
    try:
        ide = hashlib.md5(f"{datetime.now()}{random.random()}".encode()).hexdigest()
        cursor.execute(
            """INSERT INTO hub_delivery (hub_delivery_ide, hub_delivery_nome, hub_delivery_email, 
               hub_delivery_senha, hub_delivery_token, hub_delivery_id_company)
               VALUES (%s, %s, %s, %s, %s, %s)""",
            (ide, loja.nome, loja.email, loja.senha, ide, loja.id_company)
        )
        conn.commit()
        return {"success": True, "message": "Loja criada", "ide": ide}
    finally:
        cursor.close()
        conn.close()

@app.delete("/api/lojas/{loja_id}")
async def deletar_loja(loja_id: int):
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM hub_delivery WHERE hub_delivery_id = %s", (loja_id,))
        conn.commit()
        return {"success": True, "message": "Loja removida"}
    finally:
        cursor.close()
        conn.close()

# ==================== ROTAS DE PRODUTOS ====================

@app.get("/api/produtos")
async def listar_produtos():
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT * FROM produto ORDER BY produto_id DESC LIMIT 100")
        rows = cursor.fetchall()
        for row in rows:
            for key, value in row.items():
                if isinstance(value, datetime):
                    row[key] = value.isoformat()
        return {"success": True, "data": rows}
    finally:
        cursor.close()
        conn.close()

# ==================== MONITORAMENTO ====================

@app.get("/api/services/status")
async def status_services():
    services = {
        "mysql": {"status": "offline", "message": ""},
        "php": {"status": "offline", "message": ""},
        "node_integrador": {"status": "offline", "message": "", "pid": None},
        "node_itens": {"status": "offline", "message": "", "pid": None}
    }
    
    # MySQL
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT 1")
        cursor.fetchone()
        services["mysql"] = {"status": "online", "message": "Conectado"}
        cursor.close()
        conn.close()
    except Exception as e:
        services["mysql"] = {"status": "offline", "message": str(e)}
    
    # PHP
    try:
        result = subprocess.run(["php", "-v"], capture_output=True, text=True)
        if result.returncode == 0:
            version = result.stdout.split("\n")[0]
            services["php"] = {"status": "online", "message": version}
    except Exception as e:
        services["php"] = {"status": "offline", "message": str(e)}
    
    # Node integrador
    try:
        result = subprocess.run(["pgrep", "-f", "v1.js"], capture_output=True, text=True)
        if result.returncode == 0 and result.stdout.strip():
            pid = result.stdout.strip().split("\n")[0]
            services["node_integrador"] = {"status": "online", "message": "Rodando", "pid": pid}
    except:
        pass
    
    # Node itens
    try:
        result = subprocess.run(["pgrep", "-f", "v1-itens.js"], capture_output=True, text=True)
        if result.returncode == 0 and result.stdout.strip():
            pid = result.stdout.strip().split("\n")[0]
            services["node_itens"] = {"status": "online", "message": "Rodando", "pid": pid}
    except:
        pass
    
    return {"success": True, "data": services}

@app.get("/api/services/logs")
async def get_logs(limit: int = 100):
    return {"success": True, "data": node_logs[-limit:]}

@app.post("/api/services/{service}/{action}")
async def controlar_servico(service: str, action: str):
    try:
        if service == "integrador":
            if action == "start":
                process = subprocess.Popen(
                    ["node", "v1.js"],
                    cwd="/app/zedelivery-clean",
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    start_new_session=True
                )
                add_log("info", f"Integrador iniciado com PID {process.pid}")
                return {"success": True, "message": "Integrador iniciado", "pid": process.pid}
            elif action == "stop":
                subprocess.run(["pkill", "-f", "node v1.js"], capture_output=True)
                add_log("info", "Integrador parado")
                return {"success": True, "message": "Integrador parado"}
            elif action == "restart":
                subprocess.run(["pkill", "-f", "node v1.js"], capture_output=True)
                import time
                time.sleep(1)
                process = subprocess.Popen(
                    ["node", "v1.js"],
                    cwd="/app/zedelivery-clean",
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    start_new_session=True
                )
                add_log("info", f"Integrador reiniciado com PID {process.pid}")
                return {"success": True, "message": "Integrador reiniciado", "pid": process.pid}
                
        elif service == "itens":
            if action == "start":
                process = subprocess.Popen(
                    ["node", "v1-itens.js"],
                    cwd="/app/zedelivery-clean",
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    start_new_session=True
                )
                add_log("info", f"Serviço de itens iniciado com PID {process.pid}")
                return {"success": True, "message": "Serviço de itens iniciado", "pid": process.pid}
            elif action == "stop":
                subprocess.run(["pkill", "-f", "node v1-itens.js"], capture_output=True)
                add_log("info", "Serviço de itens parado")
                return {"success": True, "message": "Serviço de itens parado"}
        
        return {"success": False, "error": "Ação desconhecida"}
    except Exception as e:
        return {"success": False, "error": str(e)}

# ==================== CONFIGURAÇÃO ====================

@app.get("/api/config")
async def get_config():
    try:
        with open("/app/zedelivery-clean/configuracao.json", "r") as f:
            config = json.load(f)
        config["senha"] = "***"
        return {"success": True, "data": config}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.put("/api/config")
async def update_config(config: ConfigUpdate):
    try:
        with open("/app/zedelivery-clean/configuracao.json", "r") as f:
            current = json.load(f)
        
        if config.login:
            current["login"] = config.login
        if config.senha and config.senha != "***":
            current["senha"] = config.senha
        if config.token:
            current["token"] = config.token
        
        with open("/app/zedelivery-clean/configuracao.json", "w") as f:
            json.dump(current, f, indent=4)
        
        return {"success": True, "message": "Configuração atualizada"}
    except Exception as e:
        return {"success": False, "error": str(e)}

# Dupla autenticação
@app.get("/api/duplo")
async def get_duplo():
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT * FROM ze_duplo WHERE duplo_usado = 0 ORDER BY duplo_id DESC LIMIT 1")
        row = cursor.fetchone()
        if row:
            cursor.execute("UPDATE ze_duplo SET duplo_usado = 1 WHERE duplo_id = %s", (row["duplo_id"],))
            conn.commit()
            return {"codigo": row["duplo_codigo"]}
        return {"codigo": None}
    finally:
        cursor.close()
        conn.close()

@app.post("/api/duplo")
async def create_duplo(duplo: DuploCreate):
    conn = get_db()
    cursor = conn.cursor()
    try:
        cursor.execute("INSERT INTO ze_duplo (duplo_codigo) VALUES (%s)", (duplo.codigo,))
        conn.commit()
        return {"success": True, "message": "Código salvo"}
    finally:
        cursor.close()
        conn.close()

@app.get("/api/health")
async def health():
    return {"status": "ok", "timestamp": datetime.now().isoformat()}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
