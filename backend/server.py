from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import mysql.connector
from mysql.connector import pooling
import subprocess
import os
import json
import signal
from datetime import datetime
import hashlib
import random
import time
import threading

# Flag para controlar inicialização
services_initialized = False
script_processes = {}  # Guarda processos dos scripts

def run_shell(cmd, timeout=120):
    """Executa comando shell"""
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=timeout)
        return result.returncode == 0, result.stdout + result.stderr
    except Exception as e:
        return False, str(e)

def start_script_directly(script_name, script_path, log_prefix):
    """Inicia script Node diretamente sem PM2"""
    global script_processes
    try:
        log_out = open(f"/app/logs/{log_prefix}-out.log", "a")
        log_err = open(f"/app/logs/{log_prefix}-error.log", "a")
        
        env = os.environ.copy()
        env["PUPPETEER_EXECUTABLE_PATH"] = "/usr/bin/chromium"
        
        proc = subprocess.Popen(
            ["node", "puppeteer-wrapper.js", script_name],
            cwd="/app/zedelivery-clean",
            stdout=log_out,
            stderr=log_err,
            env=env
        )
        script_processes[log_prefix] = proc
        print(f"✅ {script_name} iniciado (PID: {proc.pid})")
        return True
    except Exception as e:
        print(f"❌ Erro ao iniciar {script_name}: {e}")
        return False

def ensure_services_running():
    """Garante que os serviços estejam rodando"""
    global services_initialized
    
    print("🔧 Verificando e iniciando serviços...")
    
    # Criar diretório de logs
    os.makedirs("/app/logs", exist_ok=True)
    
    # 1. Tentar PM2 primeiro
    ok, _ = run_shell("which pm2")
    pm2_available = ok
    
    if not pm2_available:
        print("📦 Instalando PM2...")
        ok, output = run_shell("npm install -g pm2", timeout=120)
        pm2_available = ok
    
    # 2. Tentar Apache (pode falhar no deploy)
    ok, _ = run_shell("which apache2")
    if ok:
        ok, output = run_shell("ss -tlnp | grep ':8088'")
        if not ok or "apache" not in output:
            print("🌐 Configurando Apache...")
            run_shell("pkill -9 apache2 2>/dev/null; sleep 1")
            run_shell("echo 'Listen 8088' > /etc/apache2/ports.conf 2>/dev/null")
            run_shell("""cat > /etc/apache2/sites-available/zeduplo.conf << 'VHOST'
<VirtualHost *:8088>
    DocumentRoot /app/integrador
    <Directory /app/integrador>
        Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>
</VirtualHost>
VHOST""")
            run_shell("a2dissite 000-default 2>/dev/null; a2ensite zeduplo 2>/dev/null")
            run_shell("apachectl start 2>/dev/null")
            print("✅ Apache configurado")
    
    # 3. Iniciar scripts - tentar PM2, fallback para direto
    if pm2_available:
        ok, output = run_shell("pm2 list 2>/dev/null")
        if not ok or "ze-v1" not in output:
            print("🚀 Iniciando scripts via PM2...")
            run_shell("cd /app/zedelivery-clean && npm install --silent 2>/dev/null")
            run_shell("cd /app/bridge && npm install --silent 2>/dev/null")
            run_shell("pm2 delete all 2>/dev/null")
            ok, output = run_shell("pm2 start /app/pm2.ecosystem.config.js")
            if ok:
                run_shell("pm2 save")
                print("✅ PM2 iniciado")
            else:
                print(f"⚠️ PM2 falhou: {output[:200]}")
                pm2_available = False
    
    # 4. Fallback: iniciar scripts diretamente se PM2 falhou
    if not pm2_available:
        print("🚀 Iniciando scripts diretamente (sem PM2)...")
        start_script_directly("v1.js", "/app/zedelivery-clean/v1.js", "ze-v1")
        start_script_directly("v1-itens.js", "/app/zedelivery-clean/v1-itens.js", "ze-v1-itens")
    
    # 5. Iniciar sync (sempre via Node direto se PM2 falhar)
    if not pm2_available:
        try:
            log_out = open("/app/logs/ze-sync-out.log", "a")
            log_err = open("/app/logs/ze-sync-error.log", "a")
            proc = subprocess.Popen(
                ["node", "sync-cron.js"],
                cwd="/app/bridge",
                stdout=log_out,
                stderr=log_err
            )
            script_processes["ze-sync"] = proc
            print(f"✅ sync-cron.js iniciado (PID: {proc.pid})")
        except Exception as e:
            print(f"❌ Erro ao iniciar sync: {e}")
    
    services_initialized = True
    print("✅ Serviços verificados e rodando")
    
    services_initialized = True
    print("✅ Serviços verificados e rodando")

# Iniciar em background na startup
def init_background():
    time.sleep(2)  # Aguardar servidor iniciar
    ensure_services_running()

threading.Thread(target=init_background, daemon=True).start()

app = FastAPI(title="Zé Delivery Integrador API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuração do banco - Railway Cloud (mainline)
db_config = {
    "host": "mainline.proxy.rlwy.net",
    "user": "root",
    "password": "eHeoVCebYyaJVBEBtCLfYNHgRCrxWVXU",
    "database": "railway",
    "port": 52996
}

connection_pool = None

def get_pool():
    global connection_pool
    if connection_pool is None:
        try:
            connection_pool = pooling.MySQLConnectionPool(
                pool_name="zepool",
                pool_size=5,
                pool_reset_session=True,
                **db_config
            )
        except Exception as e:
            print(f"Erro ao criar pool: {e}")
            return None
    return connection_pool

def get_db():
    pool = get_pool()
    if pool:
        try:
            return pool.get_connection()
        except:
            # Tentar reconectar
            global connection_pool
            connection_pool = None
            pool = get_pool()
            if pool:
                return pool.get_connection()
    return None

# Store de logs separados
logs_v1 = []
logs_v1_itens = []
MAX_LOGS = 200

def add_log(log_type: str, message: str, source: str = "system"):
    global logs_v1, logs_v1_itens
    log = {
        "timestamp": datetime.now().isoformat(),
        "type": log_type,
        "message": message.strip() if message else ""
    }
    
    if source == "v1":
        logs_v1.append(log)
        if len(logs_v1) > MAX_LOGS:
            logs_v1 = logs_v1[-MAX_LOGS:]
    elif source == "v1-itens":
        logs_v1_itens.append(log)
        if len(logs_v1_itens) > MAX_LOGS:
            logs_v1_itens = logs_v1_itens[-MAX_LOGS:]
    else:
        # Adiciona em ambos para logs de sistema
        logs_v1.append(log)
        logs_v1_itens.append(log)
        if len(logs_v1) > MAX_LOGS:
            logs_v1 = logs_v1[-MAX_LOGS:]
        if len(logs_v1_itens) > MAX_LOGS:
            logs_v1_itens = logs_v1_itens[-MAX_LOGS:]

# PIDs dos processos gerenciados
managed_processes = {
    "integrador": None,
    "itens": None
}

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
    if not conn:
        return {"success": False, "error": "Banco de dados offline", "data": []}
    
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
                elif value is None:
                    row[key] = ""
        
        return {"success": True, "data": rows}
    except Exception as e:
        return {"success": False, "error": str(e), "data": []}
    finally:
        cursor.close()
        conn.close()

@app.get("/api/pedidos/stats/summary")
async def stats_pedidos():
    conn = get_db()
    if not conn:
        return {"success": False, "error": "Banco offline", "data": {"total": 0, "pendentes": 0, "aceitos": 0, "entregues": 0, "acaminho": 0, "cancelados": 0, "faturamento": 0}}
    
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
    except Exception as e:
        return {"success": False, "error": str(e), "data": {"total": 0, "pendentes": 0, "aceitos": 0, "entregues": 0, "acaminho": 0, "cancelados": 0, "faturamento": 0}}
    finally:
        cursor.close()
        conn.close()

@app.get("/api/pedidos/{pedido_id}")
async def detalhe_pedido(pedido_id: int):
    conn = get_db()
    if not conn:
        return {"success": False, "error": "Banco offline"}
    
    cursor = conn.cursor(dictionary=True)
    try:
        # Buscar pedido com todos os campos (Railway Cloud)
        cursor.execute("""
            SELECT 
                delivery_id, delivery_ide, delivery_ide_hub_delivery, delivery_code,
                delivery_name_cliente, delivery_date_time, delivery_data_hora_captura,
                delivery_status, delivery_subtotal,
                delivery_forma_pagamento, delivery_desconto, delivery_frete, delivery_total,
                delivery_trash, delivery_id_company, delivery_cpf_cliente,
                delivery_endereco_rota, delivery_endereco_complemento,
                delivery_endereco_cidade_uf, delivery_endereco_cep, delivery_endereco_bairro,
                delivery_troco_para, delivery_troco, delivery_taxa_conveniencia,
                delivery_obs, delivery_tipo_pedido, delivery_codigo_entrega, delivery_tem_itens
            FROM delivery WHERE delivery_id = %s
        """, (pedido_id,))
        pedido = cursor.fetchone()
        
        # Buscar itens do pedido
        cursor.execute("""
            SELECT 
                di.delivery_itens_id, di.delivery_itens_id_delivery, 
                di.delivery_itens_id_produto, di.delivery_itens_descricao,
                di.delivery_itens_qtd, di.delivery_itens_valor_unitario,
                di.delivery_itens_valor_total,
                p.produto_descricao, p.produto_link_imagem, p.produto_codigo_ze
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
                elif value is None:
                    pedido[key] = ""
        
        for item in itens:
            for key, value in item.items():
                if value is None:
                    item[key] = ""
        
        return {"success": True, "data": {"pedido": pedido, "itens": itens}}
    except Exception as e:
        return {"success": False, "error": str(e)}
    finally:
        cursor.close()
        conn.close()

@app.patch("/api/pedidos/{pedido_id}/status")
async def atualizar_status(pedido_id: int, body: StatusUpdate):
    conn = get_db()
    if not conn:
        return {"success": False, "error": "Banco offline"}
    
    cursor = conn.cursor()
    try:
        cursor.execute(
            "UPDATE delivery SET delivery_status = %s WHERE delivery_id = %s",
            (body.status, pedido_id)
        )
        conn.commit()
        return {"success": True, "message": "Status atualizado"}
    except Exception as e:
        return {"success": False, "error": str(e)}
    finally:
        cursor.close()
        conn.close()

# ==================== ROTAS DE LOJAS ====================

@app.get("/api/lojas")
async def listar_lojas():
    conn = get_db()
    if not conn:
        return {"success": False, "error": "Banco offline", "data": []}
    
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT * FROM hub_delivery ORDER BY hub_delivery_id DESC")
        rows = cursor.fetchall()
        for row in rows:
            for key, value in row.items():
                if isinstance(value, datetime):
                    row[key] = value.isoformat()
        return {"success": True, "data": rows}
    except Exception as e:
        return {"success": False, "error": str(e), "data": []}
    finally:
        cursor.close()
        conn.close()

@app.post("/api/lojas")
async def criar_loja(loja: LojaCreate):
    conn = get_db()
    if not conn:
        return {"success": False, "error": "Banco offline"}
    
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
    except Exception as e:
        return {"success": False, "error": str(e)}
    finally:
        cursor.close()
        conn.close()

@app.delete("/api/lojas/{loja_id}")
async def deletar_loja(loja_id: int):
    conn = get_db()
    if not conn:
        return {"success": False, "error": "Banco offline"}
    
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM hub_delivery WHERE hub_delivery_id = %s", (loja_id,))
        conn.commit()
        return {"success": True, "message": "Loja removida"}
    except Exception as e:
        return {"success": False, "error": str(e)}
    finally:
        cursor.close()
        conn.close()

# ==================== ROTAS DE PRODUTOS ====================

@app.get("/api/produtos")
async def listar_produtos():
    conn = get_db()
    if not conn:
        return {"success": False, "error": "Banco offline", "data": []}
    
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT * FROM produto ORDER BY produto_id DESC LIMIT 100")
        rows = cursor.fetchall()
        for row in rows:
            for key, value in row.items():
                if isinstance(value, datetime):
                    row[key] = value.isoformat()
        return {"success": True, "data": rows}
    except Exception as e:
        return {"success": False, "error": str(e), "data": []}
    finally:
        cursor.close()
        conn.close()

# ==================== MONITORAMENTO DE SERVIÇOS ====================

def check_process_running(name):
    """Verifica se um processo está rodando pelo nome"""
    try:
        # Mapear nome do processo para nome PM2
        pm2_names = {
            "v1.js": "ze-v1",
            "v1-itens.js": "ze-v1-itens"
        }
        pm2_name = pm2_names.get(name, name)
        
        # Verificar via PM2 list (mais confiável)
        result = subprocess.run(
            "pm2 jlist 2>/dev/null",
            capture_output=True,
            text=True,
            timeout=10,
            shell=True,
            env={**os.environ, "HOME": "/root", "PM2_HOME": "/root/.pm2"}
        )
        if result.returncode == 0 and result.stdout.strip():
            try:
                import json
                pm2_list = json.loads(result.stdout)
                for proc in pm2_list:
                    if proc.get("name") == pm2_name:
                        status = proc.get("pm2_env", {}).get("status", "")
                        pid = proc.get("pid", None)
                        # Considerar online ou waiting (restartando) como rodando
                        if status in ["online", "launching"] or (status == "stopped" and proc.get("pm2_env", {}).get("restart_time", 0) > 0):
                            return True, pid
                        # Se está em waiting mas tem restarts, está funcionando (scraper reinicia após cada ciclo)
                        if proc.get("pm2_env", {}).get("restart_time", 0) > 0:
                            return True, pid
            except:
                pass
        
        # Fallback: verificar se tem logs recentes (últimos 60 segundos)
        log_files = {
            "v1.js": "/app/logs/ze-v1-out.log",
            "v1-itens.js": "/app/logs/ze-v1-itens-out.log"
        }
        if name in log_files and os.path.exists(log_files[name]):
            mtime = os.path.getmtime(log_files[name])
            if time.time() - mtime < 60:  # Log modificado nos últimos 60 segundos
                return True, None
        
        # Fallback: pgrep
        result = subprocess.run(
            ["pgrep", "-f", name],
            capture_output=True,
            text=True,
            timeout=5
        )
        if result.returncode == 0 and result.stdout.strip():
            pids = result.stdout.strip().split('\n')
            return True, pids[0]
        return False, None
    except Exception as e:
        print(f"Erro ao verificar processo {name}: {e}")
        return False, None

def check_mysql():
    """Verifica se MySQL está rodando"""
    try:
        conn = mysql.connector.connect(**db_config)
        conn.close()
        return True, "Conectado"
    except Exception as e:
        return False, str(e)

def check_php():
    """Verifica PHP/Apache - adapta para local ou produção"""
    try:
        # Tenta Apache local primeiro
        result = subprocess.run(["pgrep", "-f", "apache2"], capture_output=True, text=True, timeout=5)
        if result.returncode == 0:
            return True, "Apache + PHP 8.2"
        
        # Tenta PHP-FPM (produção)
        result = subprocess.run(["pgrep", "-f", "php-fpm"], capture_output=True, text=True, timeout=5)
        if result.returncode == 0:
            return True, "PHP-FPM"
        
        # Em produção Railway: PHP não é necessário, scripts Node conectam direto ao banco
        # Verifica se banco Railway está acessível
        conn = get_db()
        if conn:
            conn.close()
            return True, "Railway Direct (sem PHP)"
        
        return False, "Não encontrado"
    except Exception as e:
        return False, str(e)

@app.get("/api/services/status")
async def status_services():
    services = {
        "mysql": {"status": "offline", "message": ""},
        "php": {"status": "offline", "message": ""},
        "node_integrador": {"status": "offline", "message": "", "pid": None},
        "node_itens": {"status": "offline", "message": "", "pid": None}
    }
    
    # MySQL
    is_online, msg = check_mysql()
    services["mysql"] = {"status": "online" if is_online else "offline", "message": msg}
    
    # PHP
    is_online, msg = check_php()
    services["php"] = {"status": "online" if is_online else "offline", "message": msg}
    
    # Node integrador (v1.js)
    is_online, pid = check_process_running("v1.js")
    services["node_integrador"] = {
        "status": "online" if is_online else "offline",
        "message": f"PID {pid}" if pid else "",
        "pid": pid
    }
    
    # Node itens (v1-itens.js)
    is_online, pid = check_process_running("v1-itens.js")
    services["node_itens"] = {
        "status": "online" if is_online else "offline", 
        "message": f"PID {pid}" if pid else "",
        "pid": pid
    }
    
    return {"success": True, "data": services}

@app.get("/api/services/logs")
async def get_logs(limit: int = 100, source: str = "all"):
    """Retorna logs separados por fonte"""
    if source == "v1":
        return {"success": True, "data": logs_v1[-limit:], "source": "v1"}
    elif source == "v1-itens":
        return {"success": True, "data": logs_v1_itens[-limit:], "source": "v1-itens"}
    else:
        # Retorna ambos
        return {
            "success": True, 
            "data": {
                "v1": logs_v1[-limit:],
                "v1_itens": logs_v1_itens[-limit:]
            }
        }

@app.get("/api/services/logs/files")
async def get_log_files():
    """Lê os arquivos de log do PM2/sistema"""
    logs = {"v1": [], "v1_itens": []}
    
    # Tentar ler logs do PM2
    log_files = {
        "v1": "/app/logs/ze-v1-out.log",
        "v1_itens": "/app/logs/ze-v1-itens-out.log"
    }
    
    for key, path in log_files.items():
        try:
            if os.path.exists(path):
                with open(path, 'r') as f:
                    lines = f.readlines()[-100:]  # Últimas 100 linhas
                    logs[key] = [{"timestamp": datetime.now().isoformat(), "type": "info", "message": line.strip()} for line in lines if line.strip()]
        except Exception as e:
            logs[key] = [{"timestamp": datetime.now().isoformat(), "type": "error", "message": f"Erro ao ler log: {e}"}]
    
    return {"success": True, "data": logs}

@app.post("/api/services/{service}/{action}")
async def controlar_servico(service: str, action: str):
    global managed_processes
    
    try:
        if service == "integrador":
            process_name = "v1.js"
            log_file = "/app/logs/ze-v1-out.log"
            
            if action == "start":
                # Verificar se já está rodando
                is_running, existing_pid = check_process_running(process_name)
                if is_running:
                    add_log("info", f"Integrador já está rodando com PID {existing_pid}", "v1")
                    return {"success": True, "message": "Integrador já está rodando", "pid": existing_pid}
                
                # Iniciar processo usando wrapper com log em arquivo
                add_log("info", "Iniciando integrador v1.js...", "v1")
                
                env = os.environ.copy()
                env["PUPPETEER_EXECUTABLE_PATH"] = "/usr/bin/chromium"
                
                # Abrir arquivo de log
                os.makedirs("/app/logs", exist_ok=True)
                log_out = open(log_file, "a")
                log_err = open("/app/logs/ze-v1-error.log", "a")
                
                process = subprocess.Popen(
                    ["node", "puppeteer-wrapper.js", "v1.js"],
                    cwd="/app/zedelivery-clean",
                    stdout=log_out,
                    stderr=log_err,
                    env=env,
                    start_new_session=True
                )
                
                managed_processes["integrador"] = process.pid
                add_log("info", f"Integrador iniciado com PID {process.pid}", "v1")
                
                return {"success": True, "message": "Integrador iniciado", "pid": process.pid}
                
            elif action == "stop":
                try:
                    subprocess.run(["pkill", "-f", process_name], timeout=5)
                    managed_processes["integrador"] = None
                    add_log("info", "Integrador parado", "v1")
                    return {"success": True, "message": "Integrador parado"}
                except:
                    return {"success": False, "error": "Erro ao parar"}
                    
            elif action == "restart":
                # Parar
                try:
                    subprocess.run(["pkill", "-f", process_name], timeout=5)
                    add_log("info", "Parando integrador para reiniciar...", "v1")
                except:
                    pass
                
                time.sleep(2)
                
                # Iniciar usando wrapper
                env = os.environ.copy()
                env["PUPPETEER_EXECUTABLE_PATH"] = "/usr/bin/chromium"
                
                os.makedirs("/app/logs", exist_ok=True)
                log_out = open(log_file, "a")
                log_err = open("/app/logs/ze-v1-error.log", "a")
                
                process = subprocess.Popen(
                    ["node", "puppeteer-wrapper.js", "v1.js"],
                    cwd="/app/zedelivery-clean",
                    stdout=log_out,
                    stderr=log_err,
                    env=env,
                    start_new_session=True
                )
                
                managed_processes["integrador"] = process.pid
                add_log("info", f"Integrador reiniciado com PID {process.pid}", "v1")
                
                return {"success": True, "message": "Integrador reiniciado", "pid": process.pid}
                
        elif service == "itens":
            process_name = "v1-itens.js"
            log_file = "/app/logs/ze-v1-itens-out.log"
            
            if action == "start":
                is_running, existing_pid = check_process_running(process_name)
                if is_running:
                    add_log("info", f"Serviço de itens já está rodando com PID {existing_pid}", "v1-itens")
                    return {"success": True, "message": "Já está rodando", "pid": existing_pid}
                
                add_log("info", "Iniciando serviço de itens v1-itens.js...", "v1-itens")
                
                env = os.environ.copy()
                env["PUPPETEER_EXECUTABLE_PATH"] = "/usr/bin/chromium"
                
                os.makedirs("/app/logs", exist_ok=True)
                log_out = open(log_file, "a")
                log_err = open("/app/logs/ze-v1-itens-error.log", "a")
                
                process = subprocess.Popen(
                    ["node", "puppeteer-wrapper.js", "v1-itens.js"],
                    cwd="/app/zedelivery-clean",
                    stdout=log_out,
                    stderr=log_err,
                    env=env,
                    start_new_session=True
                )
                
                managed_processes["itens"] = process.pid
                add_log("info", f"Serviço de itens iniciado com PID {process.pid}", "v1-itens")
                
                return {"success": True, "message": "Serviço de itens iniciado", "pid": process.pid}
                
            elif action == "stop":
                try:
                    subprocess.run(["pkill", "-f", process_name], timeout=5)
                    managed_processes["itens"] = None
                    add_log("info", "Serviço de itens parado", "v1-itens")
                    return {"success": True, "message": "Serviço de itens parado"}
                except:
                    return {"success": False, "error": "Erro ao parar"}
        
        elif service == "all":
            if action == "start":
                results = []
                
                env = os.environ.copy()
                env["PUPPETEER_EXECUTABLE_PATH"] = "/usr/bin/chromium"
                os.makedirs("/app/logs", exist_ok=True)
                
                # Iniciar integrador
                is_running, _ = check_process_running("v1.js")
                if not is_running:
                    log_out = open("/app/logs/ze-v1-out.log", "a")
                    log_err = open("/app/logs/ze-v1-error.log", "a")
                    p1 = subprocess.Popen(
                        ["node", "puppeteer-wrapper.js", "v1.js"],
                        cwd="/app/zedelivery-clean",
                        stdout=log_out,
                        stderr=log_err,
                        env=env,
                        start_new_session=True
                    )
                    managed_processes["integrador"] = p1.pid
                    add_log("info", f"Integrador iniciado com PID {p1.pid}", "v1")
                    results.append(f"Integrador: PID {p1.pid}")
                else:
                    results.append("Integrador: já rodando")
                
                # Iniciar itens
                is_running, _ = check_process_running("v1-itens.js")
                if not is_running:
                    log_out = open("/app/logs/ze-v1-itens-out.log", "a")
                    log_err = open("/app/logs/ze-v1-itens-error.log", "a")
                    p2 = subprocess.Popen(
                        ["node", "puppeteer-wrapper.js", "v1-itens.js"],
                        cwd="/app/zedelivery-clean",
                        stdout=log_out,
                        stderr=log_err,
                        env=env,
                        start_new_session=True
                    )
                    managed_processes["itens"] = p2.pid
                    add_log("info", f"Itens iniciado com PID {p2.pid}", "v1-itens")
                    results.append(f"Itens: PID {p2.pid}")
                else:
                    results.append("Itens: já rodando")
                
                return {"success": True, "message": "Serviços iniciados", "details": results}
                
            elif action == "stop":
                subprocess.run(["pkill", "-f", "v1.js"], capture_output=True)
                subprocess.run(["pkill", "-f", "v1-itens.js"], capture_output=True)
                managed_processes["integrador"] = None
                managed_processes["itens"] = None
                add_log("info", "Todos os serviços parados")
                return {"success": True, "message": "Todos os serviços parados"}
        
        return {"success": False, "error": "Serviço ou ação desconhecida"}
        
    except Exception as e:
        add_log("error", f"Erro: {str(e)}")
        return {"success": False, "error": str(e)}

# ==================== CONFIGURAÇÃO ====================

@app.get("/api/config")
async def get_config():
    try:
        config_path = "/app/zedelivery-clean/configuracao.json"
        with open(config_path, "r") as f:
            config = json.load(f)
        config["senha"] = "***"
        return {"success": True, "data": config}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.put("/api/config")
async def update_config(config: ConfigUpdate):
    try:
        config_path = "/app/zedelivery-clean/configuracao.json"
        with open(config_path, "r") as f:
            current = json.load(f)
        
        if config.login:
            current["login"] = config.login
        if config.senha and config.senha != "***":
            current["senha"] = config.senha
        if config.token:
            current["token"] = config.token
        
        with open(config_path, "w") as f:
            json.dump(current, f, indent=4)
        
        return {"success": True, "message": "Configuração atualizada"}
    except Exception as e:
        return {"success": False, "error": str(e)}

# Dupla autenticação
@app.get("/api/duplo")
async def get_duplo():
    conn = get_db()
    if not conn:
        return {"codigo": None}
    
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
    if not conn:
        return {"success": False, "error": "Banco offline"}
    
    cursor = conn.cursor()
    try:
        cursor.execute("INSERT INTO ze_duplo (duplo_codigo) VALUES (%s)", (duplo.codigo,))
        conn.commit()
        return {"success": True, "message": "Código salvo"}
    finally:
        cursor.close()
        conn.close()

# ==================== SYNC API (para Lovable Cloud) ====================

@app.post("/api/sync")
async def sync_to_cloud():
    """Endpoint para sincronizar pedidos com Lovable Cloud"""
    conn = get_db()
    if not conn:
        return {"success": False, "error": "Banco offline"}
    
    cursor = conn.cursor(dictionary=True)
    try:
        # Buscar pedidos ativos do dia
        cursor.execute("""
            SELECT d.*,
                (SELECT JSON_ARRAYAGG(JSON_OBJECT(
                    'descricao', di.delivery_itens_descricao,
                    'qtd', di.delivery_itens_qtd,
                    'valor_unitario', di.delivery_itens_valor_unitario,
                    'valor_total', di.delivery_itens_valor_total
                )) FROM delivery_itens di WHERE di.delivery_itens_id_delivery = d.delivery_id) as itens_json
            FROM delivery d
            WHERE d.delivery_status IN (0, 2, 3)
            AND DATE(d.delivery_date_time) = CURDATE()
            AND d.delivery_trash = 0
        """)
        pedidos = cursor.fetchall()
        
        # Converter para formato serializable
        for pedido in pedidos:
            for key, value in pedido.items():
                if isinstance(value, datetime):
                    pedido[key] = value.isoformat()
        
        add_log("info", f"Sync: {len(pedidos)} pedidos prontos para sincronizar")
        
        return {
            "success": True,
            "pedidos_count": len(pedidos),
            "pedidos": pedidos
        }
    except Exception as e:
        return {"success": False, "error": str(e)}
    finally:
        cursor.close()
        conn.close()

@app.get("/api/health")
async def health():
    # Verificar MySQL
    mysql_ok, _ = check_mysql()
    return {
        "status": "ok" if mysql_ok else "degraded",
        "timestamp": datetime.now().isoformat(),
        "database": "connected" if mysql_ok else "disconnected"
    }

@app.post("/api/services/init")
async def init_services():
    """Endpoint para forçar inicialização dos serviços"""
    try:
        ensure_services_running()
        return {"success": True, "message": "Serviços iniciados"}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/api/services/restart")
async def restart_all_services():
    """Reinicia todos os serviços (Apache + PM2)"""
    try:
        # Reiniciar Apache
        run_shell("pkill -9 apache2 2>/dev/null; sleep 1; apachectl start")
        
        # Reiniciar PM2
        run_shell("pm2 restart all")
        
        return {"success": True, "message": "Serviços reiniciados"}
    except Exception as e:
        return {"success": False, "error": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
