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
from dotenv import load_dotenv

# Carregar variáveis de ambiente do arquivo .env (com caminho explícito)
env_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.env')
if os.path.exists(env_path):
    load_dotenv(env_path)
else:
    # Tentar caminhos alternativos
    for path in ['/app/backend/.env', '.env']:
        if os.path.exists(path):
            load_dotenv(path)
            break

# Flag para evitar múltiplas inicializações
_init_started = False
_init_lock = threading.Lock()

def run_shell(cmd, timeout=30):
    """Executa comando shell com timeout curto"""
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=timeout)
        return result.returncode == 0, result.stdout + result.stderr
    except subprocess.TimeoutExpired:
        return False, "timeout"
    except Exception as e:
        return False, str(e)

def start_node_script(name, script, workdir, logfile):
    """Inicia script Node.js se não estiver rodando"""
    # Verificar se já está rodando
    ok, output = run_shell(f"pgrep -f '{script}'", timeout=5)
    if ok and output.strip():
        print(f"   ✅ {name}: já rodando")
        return True
    
    # Iniciar com nohup
    cmd = f"cd {workdir} && NODE_ENV=production PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium nohup /usr/bin/node {script} >> {logfile} 2>&1 &"
    run_shell(cmd, timeout=10)
    time.sleep(2)
    
    # Verificar
    ok, output = run_shell(f"pgrep -f '{script}'", timeout=5)
    if ok and output.strip():
        print(f"   ✅ {name}: iniciado")
        return True
    print(f"   ⚠️ {name}: não iniciou")
    return False

def setup_services():
    """Configura e inicia serviços em background - roda apenas uma vez"""
    global _init_started
    
    with _init_lock:
        if _init_started:
            return
        _init_started = True
    
    print("🔧 Iniciando setup de serviços Zé Delivery...")
    print("📌 ARQUITETURA: PHP é CLI (não HTTP) - produção estável")
    
    # Criar diretório de logs
    os.makedirs("/app/logs", exist_ok=True)
    
    # Detectar ambiente
    is_production = not os.path.exists("/var/run/supervisor.sock")
    print(f"{'🏭 PRODUÇÃO' if is_production else '🔧 PREVIEW'} detectado")
    
    # Limpar locks do Chromium
    run_shell("rm -rf /app/zedelivery-clean/profile-ze-*/Singleton* 2>/dev/null", timeout=5)
    
    # Instalar dependências ANTES de iniciar serviços
    def install_deps():
        """Instala dependências necessárias"""
        print("📦 Verificando dependências...")
        
        # 1. PHP e IMAP (usado via CLI pelos scrapers para 2FA e inserção)
        ok, _ = run_shell("php -m | grep -i imap", timeout=5)
        if not ok:
            print("   📦 Instalando PHP + IMAP...")
            run_shell("apt-get update -qq", timeout=60)
            ok, out = run_shell("apt-get install -y php php-imap php-mysql php-curl 2>&1", timeout=180)
            if ok:
                print("   ✅ PHP + IMAP instalado")
            else:
                print(f"   ⚠️ Erro instalando PHP: {out[:200]}")
        else:
            print("   ✅ PHP + IMAP já instalado")
        
        # 2. Chromium (CRÍTICO para scraping)
        ok, _ = run_shell("which chromium", timeout=5)
        if not ok:
            print("   📦 Instalando Chromium...")
            ok, out = run_shell("apt-get install -y chromium 2>&1", timeout=300)
            if ok:
                print("   ✅ Chromium instalado")
            else:
                print(f"   ⚠️ Erro instalando Chromium: {out[:200]}")
        else:
            print("   ✅ Chromium já instalado")
        
        # 3. Node modules
        if not os.path.exists("/app/zedelivery-clean/node_modules"):
            print("   📦 Instalando node_modules (zedelivery-clean)...")
            run_shell("cd /app/zedelivery-clean && npm install --silent 2>/dev/null", timeout=180)
        if not os.path.exists("/app/bridge/node_modules"):
            print("   📦 Instalando node_modules (bridge)...")
            run_shell("cd /app/bridge && npm install --silent 2>/dev/null", timeout=180)
    
    if is_production:
        # PRODUÇÃO: instalar dependências de forma SÍNCRONA antes de continuar
        install_deps()
        
        print("🚀 Iniciando serviços para PRODUÇÃO...")
        # PHP NÃO é mais servidor HTTP - é chamado via CLI pelos scripts Node.js
        # Isso elimina o gargalo do PHP built-in single-threaded
        
        # Iniciar scripts Node.js
        start_node_script("ze-v1", "puppeteer-wrapper.js v1.js", "/app/zedelivery-clean", "/app/logs/ze-v1-out.log")
        start_node_script("ze-v1-itens", "puppeteer-wrapper.js v1-itens.js", "/app/zedelivery-clean", "/app/logs/ze-v1-itens-out.log")
        start_node_script("ze-sync", "sync-cron.js", "/app/bridge", "/app/logs/ze-sync-out.log")
    else:
        # PREVIEW: usar Supervisor (Apache opcional para debug)
        print("📋 Usando Supervisor para PREVIEW...")
        
        # Instalar dependências em background (não bloquear preview)
        threading.Thread(target=install_deps, daemon=True).start()
        time.sleep(3)
        
        # Configurar Supervisor para scripts Node.js
        run_shell("cp /app/ze-scripts.supervisor.conf /etc/supervisor/conf.d/ze-scripts.conf 2>/dev/null", timeout=5)
        run_shell("supervisorctl reread 2>/dev/null; supervisorctl update 2>/dev/null", timeout=10)
        
        for svc in ["ze-v1", "ze-v1-itens", "ze-sync"]:
            ok, out = run_shell(f"supervisorctl status {svc} 2>/dev/null", timeout=10)
            if "RUNNING" in out:
                print(f"   ✅ {svc}: rodando (Supervisor)")
            else:
                run_shell(f"supervisorctl start {svc} 2>/dev/null", timeout=10)
    
    print("✅ Setup concluído")
                run_shell("a2dissite 000-default 2>/dev/null; a2ensite zeduplo 2>/dev/null", timeout=5)
                run_shell("phpenmod imap 2>/dev/null", timeout=5)
                run_shell("apachectl start 2>/dev/null", timeout=10)
            
            ok, _ = run_shell("which chromium", timeout=5)
            if not ok:
                run_shell("apt-get install -y -qq chromium 2>/dev/null", timeout=300)
            
            if not os.path.exists("/app/zedelivery-clean/node_modules"):
                run_shell("cd /app/zedelivery-clean && npm install --silent 2>/dev/null", timeout=180)
            if not os.path.exists("/app/bridge/node_modules"):
                run_shell("cd /app/bridge && npm install --silent 2>/dev/null", timeout=180)
        
        threading.Thread(target=install_deps_async, daemon=True).start()
        time.sleep(3)
        
        # Configurar Supervisor
        run_shell("cp /app/ze-scripts.supervisor.conf /etc/supervisor/conf.d/ze-scripts.conf 2>/dev/null", timeout=5)
        run_shell("supervisorctl reread 2>/dev/null; supervisorctl update 2>/dev/null", timeout=10)
        
        for svc in ["ze-v1", "ze-v1-itens", "ze-sync"]:
            ok, out = run_shell(f"supervisorctl status {svc} 2>/dev/null", timeout=10)
            if "RUNNING" in out:
                print(f"   ✅ {svc}: rodando (Supervisor)")
            else:
                run_shell(f"supervisorctl start {svc} 2>/dev/null", timeout=10)
    
    print("✅ Setup concluído")

def watchdog():
    """Verifica scripts Node.js a cada 2 minutos e reinicia se necessário"""
    while True:
        time.sleep(120)
        
        # Verificar scripts Node.js (PHP agora é CLI, não precisa de watchdog)
        scripts = [
            ("ze-v1", "puppeteer-wrapper.js v1.js", "/app/zedelivery-clean", "/app/logs/ze-v1-out.log"),
            ("ze-v1-itens", "puppeteer-wrapper.js v1-itens.js", "/app/zedelivery-clean", "/app/logs/ze-v1-itens-out.log"),
            ("ze-sync", "sync-cron.js", "/app/bridge", "/app/logs/ze-sync-out.log"),
        ]
        for name, script, workdir, logfile in scripts:
            ok, _ = run_shell(f"pgrep -f '{script}'", timeout=5)
            if not ok:
                print(f"⚠️ Watchdog: reiniciando {name}")
                start_node_script(name, script, workdir, logfile)

# Iniciar em background após 3 segundos
def delayed_init():
    time.sleep(3)
    setup_services()
    threading.Thread(target=watchdog, daemon=True).start()

threading.Thread(target=delayed_init, daemon=True).start()

# ============= FASTAPI APP =============

app = FastAPI(title="Zé Delivery Integrador API")

# HEALTH CHECK - SEMPRE RESPONDE IMEDIATAMENTE
@app.get("/health")
async def health():
    return {"status": "healthy"}

@app.get("/api/health")
async def api_health():
    return {"status": "healthy"}

# DEBUG - Mostra configuração atual do banco
@app.get("/api/debug/db-config")
async def debug_db_config():
    return {
        "host": DB_CONFIG.get('host'),
        "port": DB_CONFIG.get('port'),
        "database": DB_CONFIG.get('database'),
        "user": DB_CONFIG.get('user'),
        "env_db_name": os.environ.get('DB_NAME', 'NÃO DEFINIDO'),
        "env_db_host": os.environ.get('DB_HOST', 'NÃO DEFINIDO'),
    }

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pool de conexões MySQL - FORÇANDO banco 'railway' (Railway Cloud)
# IMPORTANTE: Ignorar DB_NAME se for 'zeconnect-base' (valor errado em produção)
db_name_env = os.environ.get('DB_NAME', 'railway')
if db_name_env == 'zeconnect-base' or db_name_env == 'test_database':
    db_name_env = 'railway'  # Corrigir valor errado

DB_CONFIG = {
    'host': os.environ.get('DB_HOST', 'mainline.proxy.rlwy.net'),
    'port': int(os.environ.get('DB_PORT', '52996')),
    'user': os.environ.get('DB_USER', 'root'),
    'password': os.environ.get('DB_PASSWORD', 'eHeoVCebYyaJVBEBtCLfYNHgRCrxWVXU'),
    'database': db_name_env,  # Usar valor corrigido
    'connection_timeout': 10,
    'autocommit': True
}

# Adicionar SSL se necessário (Railway pode requerer)
if os.environ.get('DB_SSL', '').lower() == 'true':
    DB_CONFIG['ssl_disabled'] = False
else:
    DB_CONFIG['ssl_disabled'] = True

print(f"🔧 MySQL Config: {DB_CONFIG['host']}:{DB_CONFIG['port']}/{DB_CONFIG['database']}")

db_pool = None

def create_db_pool():
    global db_pool
    try:
        db_pool = pooling.MySQLConnectionPool(pool_name="ze_pool", pool_size=3, pool_reset_session=True, **DB_CONFIG)
        print("✅ Pool MySQL criado com sucesso")
        return True
    except Exception as e:
        print(f"⚠️ Erro ao criar pool MySQL: {e}")
        db_pool = None
        return False

# Tentar criar pool na inicialização
create_db_pool()

def get_db():
    global db_pool
    try:
        if db_pool:
            return db_pool.get_connection()
    except Exception as e:
        print(f"⚠️ Pool falhou, tentando conexão direta: {e}")
    
    # Fallback: conexão direta
    try:
        return mysql.connector.connect(**DB_CONFIG)
    except Exception as e:
        print(f"❌ Conexão MySQL falhou: {e}")
        raise

# ============= ROTAS DA API =============

@app.get("/api/services/status")
async def get_services_status():
    """Retorna status dos serviços"""
    status = {"success": True, "data": {}}
    
    # MySQL
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT 1")
        cursor.fetchone()
        cursor.close()
        conn.close()
        status["data"]["mysql"] = {"status": "online", "host": DB_CONFIG['host']}
    except Exception as e:
        status["data"]["mysql"] = {"status": "offline", "error": str(e)[:100], "host": DB_CONFIG['host']}
    
    # PHP Server (pode ser Apache ou built-in)
    ok, _ = run_shell("ss -tlnp | grep ':8088'", timeout=5)
    if ok:
        # Testar se IMAP funciona (esse é o endpoint crítico para 2FA)
        test_ok, test_out = run_shell("curl -s http://localhost:8088/zeduplo/ze_pedido_mail.php 2>/dev/null", timeout=10)
        if test_ok and 'codigo' in test_out:
            status["data"]["php"] = {"status": "online", "port": 8088}
        else:
            status["data"]["php"] = {"status": "degraded", "port": 8088, "note": "IMAP pode não estar funcionando"}
    else:
        status["data"]["php"] = {"status": "offline"}
    
    # Verificar se IMAP está disponível para login 2FA
    ok, _ = run_shell("php -m | grep -i imap", timeout=5)
    status["data"]["php_imap"] = {"status": "online" if ok else "offline"}
    
    # Scripts Node.js
    for name, script in [("v1.js", "puppeteer-wrapper.js v1.js"), ("v1-itens.js", "puppeteer-wrapper.js v1-itens.js"), ("sync", "sync-cron.js")]:
        ok, out = run_shell(f"pgrep -f '{script}'", timeout=5)
        pid = out.strip().split()[0] if ok and out.strip() else None
        status["data"][name] = {"status": "online" if ok else "offline", "pid": pid}
    
    # Chromium
    ok, _ = run_shell("which chromium", timeout=5)
    status["data"]["chromium"] = {"status": "online" if ok else "offline"}
    
    return status

@app.get("/api/pedidos")
async def get_pedidos(limit: int = 50, status: Optional[int] = None):
    """Lista pedidos"""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        
        query = """
            SELECT delivery_id, delivery_code, delivery_name_cliente, delivery_status,
                   delivery_total, delivery_date_time, delivery_tipo_pedido, delivery_forma_pagamento
            FROM delivery WHERE delivery_trash = 0
        """
        if status is not None:
            query += f" AND delivery_status = {status}"
        query += f" ORDER BY delivery_date_time DESC LIMIT {limit}"
        
        cursor.execute(query)
        pedidos = cursor.fetchall()
        
        # Converter datetime para string
        for p in pedidos:
            if p.get('delivery_date_time'):
                p['delivery_date_time'] = p['delivery_date_time'].isoformat()
        
        cursor.close()
        conn.close()
        return {"success": True, "data": pedidos}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.get("/api/pedidos/stats/summary")
async def get_stats_summary():
    """Estatísticas dos pedidos"""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute("""
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN delivery_status = 0 THEN 1 ELSE 0 END) as pendentes,
                SUM(CASE WHEN delivery_status = 2 THEN 1 ELSE 0 END) as aceitos,
                SUM(CASE WHEN delivery_status = 3 THEN 1 ELSE 0 END) as em_rota,
                SUM(CASE WHEN delivery_status = 1 THEN 1 ELSE 0 END) as entregues,
                SUM(CASE WHEN delivery_status IN (4,5) THEN 1 ELSE 0 END) as cancelados,
                SUM(CASE WHEN delivery_status = 1 THEN delivery_total ELSE 0 END) as faturamento
            FROM delivery WHERE delivery_trash = 0
        """)
        stats = cursor.fetchone()
        
        cursor.close()
        conn.close()
        return {"success": True, "data": stats}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.get("/api/pedidos/{pedido_id}")
async def get_pedido(pedido_id: int):
    """Detalhes de um pedido"""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute("SELECT * FROM delivery WHERE delivery_id = %s", (pedido_id,))
        pedido = cursor.fetchone()
        
        if not pedido:
            raise HTTPException(status_code=404, detail="Pedido não encontrado")
        
        # Converter datetime
        for k, v in pedido.items():
            if isinstance(v, datetime):
                pedido[k] = v.isoformat()
        
        # Buscar itens
        cursor.execute("""
            SELECT di.*, p.produto_descricao, p.produto_link_imagem
            FROM delivery_itens di
            LEFT JOIN produto p ON p.produto_id = di.delivery_itens_id_produto
            WHERE di.delivery_itens_id_delivery = %s
        """, (pedido_id,))
        pedido['itens'] = cursor.fetchall()
        
        cursor.close()
        conn.close()
        return {"success": True, "data": pedido}
    except HTTPException:
        raise
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.get("/api/services/logs")
async def get_logs():
    """Retorna últimas linhas dos logs"""
    logs = {}
    log_files = {
        "v1": "/app/logs/ze-v1-out.log",
        "v1-itens": "/app/logs/ze-v1-itens-out.log",
        "sync": "/app/logs/ze-sync-out.log"
    }
    for name, path in log_files.items():
        try:
            if os.path.exists(path):
                with open(path, 'r') as f:
                    lines = f.readlines()
                    logs[name] = ''.join(lines[-50:])
            else:
                logs[name] = "Arquivo não existe"
        except:
            logs[name] = "Erro ao ler"
    return {"success": True, "data": logs}

@app.get("/api/services/logs/files")
async def get_log_files():
    """Lista arquivos de log disponíveis"""
    files = []
    log_dir = "/app/logs"
    if os.path.exists(log_dir):
        for f in os.listdir(log_dir):
            path = os.path.join(log_dir, f)
            if os.path.isfile(path):
                files.append({"name": f, "size": os.path.getsize(path)})
    return {"success": True, "data": files}

@app.post("/api/services/start")
async def start_services():
    """Força reinicialização dos serviços"""
    global _init_started
    _init_started = False
    threading.Thread(target=setup_services, daemon=True).start()
    return {"success": True, "message": "Serviços sendo iniciados"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
