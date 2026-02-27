from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
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

# CONFIGURAÇÃO RAILWAY CLOUD - HARDCODED COMO FALLBACK ABSOLUTO
# Isso garante que MESMO SEM .env, o sistema conecta no Railway MySQL
RAILWAY_MYSQL_CONFIG = {
    'host': 'mainline.proxy.rlwy.net',
    'port': 52996,
    'user': 'root',
    'password': 'eHeoVCebYyaJVBEBtCLfYNHgRCrxWVXU',
    'database': 'railway'
}

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
    
    # HARDENING: Instalação DETERMINÍSTICA de dependências
    def install_deps_hardened():
        """Instala dependências com validação obrigatória"""
        print("📦 [HARDENING] Verificando e instalando dependências...")
        
        # 1. PHP + cURL + MySQL - OBRIGATÓRIO (Gmail API usa cURL, não IMAP)
        ok, _ = run_shell("php -m | grep -i curl", timeout=5)
        if not ok:
            print("   📦 Instalando PHP completo...")
            run_shell("apt-get update -qq", timeout=60)
            ok, out = run_shell(
                "apt-get install -y php php-cli php-curl php-mysql php-mbstring 2>&1", 
                timeout=180
            )
            if not ok:
                print(f"   ❌ ERRO CRÍTICO: Falha ao instalar PHP: {out[:200]}")
                return False
        
        # 2. VALIDAÇÃO OBRIGATÓRIA: cURL DEVE estar carregado (usado pela Gmail API)
        ok, out = run_shell("php -r \"echo extension_loaded('curl') ? 'CURL_OK' : 'CURL_FAIL';\"", timeout=10)
        if not ok or 'CURL_OK' not in out:
            print("   ❌ ERRO CRÍTICO: cURL não está carregado no PHP!")
            return False
        
        print("   ✅ PHP + cURL validado (Gmail API pronto)")
        
        # 3. Chromium
        ok, _ = run_shell("which chromium", timeout=5)
        if not ok:
            print("   📦 Instalando Chromium...")
            ok, out = run_shell("apt-get install -y chromium 2>&1", timeout=300)
            if not ok:
                print(f"   ⚠️ Erro instalando Chromium: {out[:200]}")
        else:
            print("   ✅ Chromium já instalado")
        
        # 4. Node modules
        if not os.path.exists("/app/zedelivery-clean/node_modules"):
            print("   📦 Instalando node_modules (zedelivery-clean)...")
            run_shell("cd /app/zedelivery-clean && npm install --silent 2>/dev/null", timeout=180)
        if not os.path.exists("/app/bridge/node_modules"):
            print("   📦 Instalando node_modules (bridge)...")
            run_shell("cd /app/bridge && npm install --silent 2>/dev/null", timeout=180)
        
        return True
    
    # Executar instalação
    deps_ok = install_deps_hardened()
    
    if is_production:
        print("🚀 Iniciando serviços para PRODUÇÃO...")
        
        if not deps_ok:
            print("⚠️ AVISO: Dependências podem estar incompletas. Scrapers podem falhar.")
        
        # Iniciar scripts Node.js
        start_node_script("ze-v1", "puppeteer-wrapper.js v1.js", "/app/zedelivery-clean", "/app/logs/ze-v1-out.log")
        start_node_script("ze-v1-itens", "puppeteer-wrapper.js v1-itens.js", "/app/zedelivery-clean", "/app/logs/ze-v1-itens-out.log")
        start_node_script("ze-sync", "sync-cron.js", "/app/bridge", "/app/logs/ze-sync-out.log")
    else:
        print("📋 Usando Supervisor para PREVIEW...")
        
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

# DEBUG - Testa conexão PHP com o banco
@app.get("/api/debug/php-db-test")
async def debug_php_db_test():
    """Testa conexão do PHP com o banco MySQL"""
    try:
        ok, output = run_shell("php /app/integrador/db-test.php", timeout=15)
        if ok and output:
            try:
                return {"success": True, "php_output": json.loads(output)}
            except:
                return {"success": True, "php_output": output}
        else:
            return {"success": False, "error": output or "PHP execution failed"}
    except Exception as e:
        return {"success": False, "error": str(e)}

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pool de conexões MySQL - FORÇANDO Railway Cloud
# SEMPRE usar Railway MySQL, ignorar qualquer variável que aponte para MongoDB/zeconnect-base

# Verificar TODAS as possíveis variáveis de ambiente (produção usa MYSQL*, preview usa DB_*)
env_db_name = os.environ.get('DB_NAME', '') or os.environ.get('MYSQL_DATABASE', '') or os.environ.get('MYSQLDATABASE', '')
env_db_host = os.environ.get('DB_HOST', '') or os.environ.get('MYSQLHOST', '')
env_db_port = os.environ.get('DB_PORT', '') or os.environ.get('MYSQLPORT', '')
env_db_user = os.environ.get('DB_USER', '') or os.environ.get('MYSQLUSER', '')
env_db_pass = os.environ.get('DB_PASSWORD', '') or os.environ.get('MYSQLPASSWORD', '') or os.environ.get('MYSQL_ROOT_PASSWORD', '')
env_mongo = os.environ.get('MONGO_URL', '') or os.environ.get('MONGODB_URI', '')

# Detectar configuração errada (MongoDB, zeconnect-base, internal)
# IMPORTANTE: mysql.railway.internal NÃO funciona externamente, usar proxy público
is_wrong_config = (
    'mongodb' in env_mongo.lower() or
    'zeconnect' in env_db_name.lower() or
    env_db_name == 'test_database' or
    env_db_host == '' or
    'localhost' in env_db_host.lower() or
    'railway.internal' in env_db_host.lower()  # Internal não funciona externamente
)

if is_wrong_config:
    print("⚠️ PRODUÇÃO: Detectada configuração errada, forçando Railway MySQL PÚBLICO")
    DB_CONFIG = {
        'host': RAILWAY_MYSQL_CONFIG['host'],
        'port': RAILWAY_MYSQL_CONFIG['port'],
        'user': RAILWAY_MYSQL_CONFIG['user'],
        'password': RAILWAY_MYSQL_CONFIG['password'],
        'database': RAILWAY_MYSQL_CONFIG['database'],
        'connection_timeout': 10,
        'autocommit': True,
        'ssl_disabled': True
    }
else:
    # Usar variáveis de ambiente se disponíveis e válidas
    DB_CONFIG = {
        'host': env_db_host or RAILWAY_MYSQL_CONFIG['host'],
        'port': int(env_db_port) if env_db_port else RAILWAY_MYSQL_CONFIG['port'],
        'user': env_db_user or RAILWAY_MYSQL_CONFIG['user'],
        'password': env_db_pass or RAILWAY_MYSQL_CONFIG['password'],
        'database': env_db_name or RAILWAY_MYSQL_CONFIG['database'],
        'connection_timeout': 10,
        'autocommit': True,
        'ssl_disabled': True
    }
    # Corrigir DB_NAME se necessário
    if DB_CONFIG['database'] in ['zeconnect-base', 'test_database', '']:
        DB_CONFIG['database'] = 'railway'

print(f"🔧 MySQL Config: {DB_CONFIG['host']}:{DB_CONFIG['port']}/{DB_CONFIG['database']}")

db_pool = None
_pool_init_attempted = False

def create_db_pool():
    global db_pool, _pool_init_attempted
    
    # Só tentar uma vez
    if _pool_init_attempted:
        return db_pool is not None
    _pool_init_attempted = True
    
    try:
        # Timeout curto para não travar
        pool_config = {**DB_CONFIG, 'connection_timeout': 3}
        db_pool = pooling.MySQLConnectionPool(pool_name="ze_pool", pool_size=3, pool_reset_session=True, **pool_config)
        print("✅ Pool MySQL criado com sucesso")
        return True
    except Exception as e:
        print(f"⚠️ Erro ao criar pool MySQL: {e}")
        db_pool = None
        return False

# NÃO criar pool na inicialização - será criado na primeira requisição
# create_db_pool()

def get_db():
    global db_pool
    
    # Lazy initialization do pool
    if not _pool_init_attempted:
        create_db_pool()
    
    try:
        if db_pool:
            return db_pool.get_connection()
    except Exception as e:
        print(f"⚠️ Pool falhou, tentando conexão direta: {e}")
    
    # Fallback: conexão direta com timeout curto
    try:
        direct_config = {**DB_CONFIG, 'connection_timeout': 5}
        return mysql.connector.connect(**direct_config)
    except Exception as e:
        print(f"❌ Conexão MySQL falhou: {e}")
        raise

# ============= ROTAS DA API =============

@app.get("/api/services/status")
async def get_services_status():
    """Retorna status dos serviços - versão simplificada sem bloqueio"""
    import asyncio
    import concurrent.futures
    
    status = {"success": True, "data": {}}
    
    # 1. MySQL - teste rápido com timeout curto (não bloqueia)
    def do_mysql_test():
        try:
            test_config = {**DB_CONFIG, 'connection_timeout': 2}
            conn = mysql.connector.connect(**test_config)
            cursor = conn.cursor()
            cursor.execute("SELECT 1")
            cursor.fetchone()
            cursor.close()
            conn.close()
            return "online"
        except Exception as e:
            return "offline"
    
    # Executar teste MySQL em thread separada com timeout
    try:
        loop = asyncio.get_event_loop()
        with concurrent.futures.ThreadPoolExecutor() as executor:
            future = loop.run_in_executor(executor, do_mysql_test)
            mysql_status = await asyncio.wait_for(future, timeout=3.0)
    except asyncio.TimeoutError:
        mysql_status = "offline"
    except Exception:
        mysql_status = "offline"
    
    status["data"]["mysql"] = {
        "status": mysql_status,
        "host": DB_CONFIG.get('host', 'N/A'),
        "database": DB_CONFIG.get('database', 'N/A')
    }
    
    # 2. PHP - verifica se o comando existe
    try:
        result = subprocess.run(["php", "-v"], capture_output=True, text=True, timeout=2)
        status["data"]["php"] = {
            "status": "online" if result.returncode == 0 else "offline",
            "mode": "CLI"
        }
    except:
        status["data"]["php"] = {"status": "offline", "mode": "CLI"}
    
    # 3. Scripts Node - verificar processos rápido
    for name, pattern in [("v1.js", "v1.js"), ("v1-itens.js", "v1-itens.js"), ("sync", "sync-cron")]:
        try:
            result = subprocess.run(["pgrep", "-f", pattern], capture_output=True, text=True, timeout=2)
            pid = result.stdout.strip().split()[0] if result.returncode == 0 and result.stdout.strip() else None
            status["data"][name] = {
                "status": "online" if pid else "offline",
                "pid": pid
            }
        except:
            status["data"][name] = {"status": "unknown"}
    
    # 4. Chromium
    try:
        result = subprocess.run(["which", "chromium"], capture_output=True, text=True, timeout=2)
        status["data"]["chromium"] = {"status": "online" if result.returncode == 0 else "offline"}
    except:
        status["data"]["chromium"] = {"status": "unknown"}
    
    return status


# Endpoint separado para testar MySQL (com timeout)
@app.get("/api/services/mysql-test")
async def test_mysql_connection():
    """Testa conexão MySQL em background - não bloqueia"""
    import asyncio
    import concurrent.futures
    
    def do_test():
        try:
            test_config = {**DB_CONFIG, 'connection_timeout': 3}
            conn = mysql.connector.connect(**test_config)
            cursor = conn.cursor()
            cursor.execute("SELECT 1")
            cursor.fetchone()
            cursor.close()
            conn.close()
            return {"status": "online", "host": DB_CONFIG['host'], "database": DB_CONFIG['database']}
        except Exception as e:
            return {"status": "offline", "error": str(e)[:100], "host": DB_CONFIG.get('host', 'N/A')}
    
    loop = asyncio.get_event_loop()
    with concurrent.futures.ThreadPoolExecutor() as executor:
        try:
            future = loop.run_in_executor(executor, do_test)
            result = await asyncio.wait_for(future, timeout=5.0)
            return {"success": True, "data": result}
        except asyncio.TimeoutError:
            return {"success": False, "data": {"status": "offline", "error": "Connection timeout (5s)"}}
        except Exception as e:
            return {"success": False, "data": {"status": "offline", "error": str(e)[:100]}}

@app.get("/api/pedidos")
async def get_pedidos(limit: int = 50, status: Optional[int] = None, search: Optional[str] = None):
    """Lista pedidos com filtro de busca"""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        
        query = """
            SELECT delivery_id, delivery_code, delivery_name_cliente, delivery_status,
                   delivery_total, delivery_date_time, delivery_tipo_pedido, delivery_forma_pagamento,
                   delivery_cpf_cliente, delivery_endereco_rota, delivery_endereco_bairro, 
                   delivery_endereco_cep, delivery_endereco_cidade_uf, delivery_tem_itens,
                   delivery_telefone, delivery_desconto_descricao
            FROM delivery WHERE delivery_trash = 0
        """
        params = []
        
        if status is not None:
            query += " AND delivery_status = %s"
            params.append(status)
        
        # Adicionar busca por código do pedido ou nome do cliente
        if search:
            search_term = f"%{search}%"
            query += " AND (delivery_code LIKE %s OR delivery_name_cliente LIKE %s OR delivery_telefone LIKE %s)"
            params.extend([search_term, search_term, search_term])
        
        query += f" ORDER BY delivery_date_time DESC LIMIT {limit}"
        
        cursor.execute(query, params)
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

@app.post("/api/pedidos/{delivery_code}/reprocessar")
async def reprocessar_pedido(delivery_code: str):
    """
    Marca um pedido para reprocessamento pelo scraper v1-itens.
    Reseta pedido_st_validacao para 0 e delivery_tem_itens para NULL.
    """
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        
        # Verificar se o pedido existe
        cursor.execute("SELECT delivery_id, delivery_code FROM delivery WHERE delivery_code = %s", (delivery_code,))
        pedido = cursor.fetchone()
        
        if not pedido:
            raise HTTPException(status_code=404, detail="Pedido não encontrado")
        
        delivery_id = pedido['delivery_id']
        
        # Resetar flags para permitir reprocessamento
        cursor.execute("""
            UPDATE ze_pedido SET pedido_st_validacao = 0 
            WHERE pedido_code = %s
        """, (delivery_code,))
        
        cursor.execute("""
            UPDATE delivery SET delivery_tem_itens = NULL 
            WHERE delivery_code = %s
        """, (delivery_code,))
        
        # Deletar itens antigos de ze_itens_pedido para evitar duplicação
        cursor.execute("""
            DELETE FROM ze_itens_pedido 
            WHERE itens_pedido_id_pedido IN (
                SELECT pedido_id FROM ze_pedido WHERE pedido_code = %s
            )
        """, (delivery_code,))
        
        # Deletar itens antigos de delivery_itens também
        cursor.execute("""
            DELETE FROM delivery_itens 
            WHERE delivery_itens_id_delivery = %s
        """, (delivery_id,))
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return {
            "success": True, 
            "message": f"Pedido {delivery_code} marcado para reprocessamento",
            "delivery_id": delivery_id
        }
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

@app.post("/api/services/{service}/{action}")
async def control_service(service: str, action: str):
    """Controla serviços individuais"""
    try:
        service_map = {
            "integrador": "ze-v1",
            "itens": "ze-v1-itens",
            "sync": "ze-sync",
            "all": None
        }
        
        if service not in service_map:
            return {"success": False, "error": f"Serviço desconhecido: {service}"}
        
        if action not in ["start", "stop", "restart"]:
            return {"success": False, "error": f"Ação inválida: {action}"}
        
        if service == "all":
            services_to_control = ["ze-v1", "ze-v1-itens", "ze-sync"]
        else:
            services_to_control = [service_map[service]]
        
        results = []
        for svc in services_to_control:
            cmd = f"supervisorctl {action} {svc}"
            result = run_shell(cmd, timeout=15)
            results.append({"service": svc, "result": result or "OK"})
        
        return {"success": True, "action": action, "results": results}
    except Exception as e:
        return {"success": False, "error": str(e)}


# ============= WEBHOOK CONFIRMAR RETIRADA =============

class ConfirmarRetiradaRequest(BaseModel):
    order_id: str
    webhook_secret: Optional[str] = None

@app.post("/api/webhook/confirmar-retirada")
async def webhook_confirmar_retirada(request: ConfirmarRetiradaRequest, background_tasks: BackgroundTasks):
    """
    Webhook para confirmar retirada de pedido
    
    Exemplo de chamada:
    POST /api/webhook/confirmar-retirada
    {
        "order_id": "472230265",
        "webhook_secret": "sua-secret-opcional"
    }
    """
    try:
        order_id = request.order_id.strip()
        
        if not order_id or not order_id.isdigit():
            return {"success": False, "error": "order_id inválido"}
        
        # Executar confirmação em background para não bloquear
        def executar_confirmacao():
            try:
                import subprocess
                result = subprocess.run(
                    ['node', '/app/zedelivery-clean/confirmar-retirada.js', order_id],
                    capture_output=True,
                    text=True,
                    timeout=60,
                    cwd='/app/zedelivery-clean'
                )
                print(f"[WEBHOOK] Retirada {order_id}: {result.stdout}")
                if result.stderr:
                    print(f"[WEBHOOK] Erro: {result.stderr}")
            except Exception as e:
                print(f"[WEBHOOK] Erro ao confirmar retirada {order_id}: {e}")
        
        background_tasks.add_task(executar_confirmacao)
        
        return {
            "success": True, 
            "message": f"Confirmação de retirada do pedido #{order_id} iniciada",
            "order_id": order_id
        }
        
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/api/pedidos/{order_id}/confirmar-retirada")
async def confirmar_retirada_pedido(order_id: str, background_tasks: BackgroundTasks):
    """
    Endpoint direto para confirmar retirada de pedido (usado pelo frontend)
    """
    try:
        if not order_id or not order_id.isdigit():
            return {"success": False, "error": "order_id inválido"}
        
        # Executar em background
        def executar_confirmacao():
            try:
                import subprocess
                result = subprocess.run(
                    ['node', '/app/zedelivery-clean/confirmar-retirada.js', order_id],
                    capture_output=True,
                    text=True,
                    timeout=60,
                    cwd='/app/zedelivery-clean'
                )
                print(f"[RETIRADA] Pedido {order_id}: {result.stdout}")
            except Exception as e:
                print(f"[RETIRADA] Erro: {e}")
        
        background_tasks.add_task(executar_confirmacao)
        
        return {
            "success": True,
            "message": f"Confirmação de retirada iniciada para pedido #{order_id}"
        }
        
    except Exception as e:
        return {"success": False, "error": str(e)}


# ============= INTEGRADOR API =============
# A API do integrador é servida pelo PHP em /app/integrador/zeduplo/
# Endpoints disponíveis:
# - ze_pedido.php: Receber e processar pedidos
# - ze_pedido_view.php: Processar itens e detalhes dos pedidos  
# - ze_pedido_view_status.php: Atualizar status dos pedidos
# - ze_pedido_id.php: Processar pedido por ID específico
# Documentação: /app/docs/API_INTEGRADOR.md

# ============= PRODUTOS =============

@app.get("/api/produtos")
async def get_produtos():
    """Lista todos os produtos"""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT produto_id, produto_descricao, produto_tipo, 
                   produto_link_imagem, produto_codigo_ze
            FROM produto
            ORDER BY produto_descricao
        """)
        produtos = cursor.fetchall()
        cursor.close()
        conn.close()
        return {"success": True, "data": produtos}
    except Exception as e:
        return {"success": False, "error": str(e)}


# ============= LOJAS =============

@app.get("/api/lojas")
async def get_lojas():
    """Lista todas as lojas cadastradas"""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("""
            SELECT hub_delivery_id, hub_delivery_ide, hub_delivery_status,
                   hub_delivery_ide_client, hub_delivery_clientid, 
                   hub_delivery_secretid, hub_delivery_auth
            FROM hub_delivery
            WHERE hub_delivery_trash = 0
        """)
        lojas = cursor.fetchall()
        
        # Adicionar nomes para exibição
        for loja in lojas:
            loja['hub_delivery_nome'] = f"Loja {loja['hub_delivery_id']}"
            loja['hub_delivery_email'] = loja.get('hub_delivery_ide_client', 'N/A')
        
        cursor.close()
        conn.close()
        return {"success": True, "data": lojas}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.post("/api/lojas")
async def criar_loja(loja: dict):
    """Cria uma nova loja"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO hub_delivery (hub_delivery_id_company, hub_delivery_ide_client, 
                                      hub_delivery_ide, hub_delivery_status, hub_delivery_trash)
            VALUES (2, %s, %s, 1, 0)
        """, (loja.get('email', ''), loja.get('nome', '')))
        conn.commit()
        cursor.close()
        conn.close()
        return {"success": True, "message": "Loja criada"}
    except Exception as e:
        return {"success": False, "error": str(e)}

@app.delete("/api/lojas/{loja_id}")
async def deletar_loja(loja_id: int):
    """Deleta uma loja (soft delete)"""
    try:
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("UPDATE hub_delivery SET hub_delivery_trash = 1 WHERE hub_delivery_id = %s", (loja_id,))
        conn.commit()
        cursor.close()
        conn.close()
        return {"success": True, "message": "Loja deletada"}
    except Exception as e:
        return {"success": False, "error": str(e)}


# ============= CONFIG =============

@app.get("/api/config")
async def get_config():
    """Retorna configuração do sistema"""
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        
        # Buscar loja principal
        cursor.execute("""
            SELECT hub_delivery_id, hub_delivery_ide, hub_delivery_ide_client,
                   hub_delivery_clientid, hub_delivery_secretid
            FROM hub_delivery
            WHERE hub_delivery_trash = 0
            LIMIT 1
        """)
        loja = cursor.fetchone()
        
        config = {
            "login": loja.get('hub_delivery_ide_client', '') if loja else '',
            "token": loja.get('hub_delivery_ide', '') if loja else '',
            "url_pedido": "https://www.ze.delivery/parceiros",
            "url_view": "https://www.ze.delivery/parceiros/pedidos",
            "url_duplo": "https://www.ze.delivery/parceiros/duplo"
        }
        
        cursor.close()
        conn.close()
        return {"success": True, "data": config}
    except Exception as e:
        return {"success": False, "error": str(e)}

# ============= HEALTH CHECK AVANÇADO =============

@app.get("/api/health/detailed")
async def detailed_health_check():
    """
    Health check completo para monitoramento externo.
    Retorna status detalhado de todos os componentes.
    Use este endpoint para monitorar o sistema 24/7.
    """
    health_status = {
        "timestamp": datetime.now().isoformat(),
        "overall_status": "healthy",
        "components": {},
        "alerts": [],
        "metrics": {}
    }
    
    critical_failures = 0
    warnings = 0
    
    # 1. MySQL Railway Cloud
    try:
        start = time.time()
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT COUNT(*) as total FROM delivery WHERE delivery_trash = 0")
        result = cursor.fetchone()
        cursor.execute("SELECT MAX(delivery_date_time) as last_order FROM delivery")
        last_order = cursor.fetchone()
        latency = round((time.time() - start) * 1000, 2)
        cursor.close()
        conn.close()
        
        health_status["components"]["mysql"] = {
            "status": "healthy",
            "latency_ms": latency,
            "total_orders": result['total'] if result else 0,
            "last_order": last_order['last_order'].isoformat() if last_order and last_order['last_order'] else None
        }
        health_status["metrics"]["db_latency_ms"] = latency
        health_status["metrics"]["total_orders"] = result['total'] if result else 0
    except Exception as e:
        critical_failures += 1
        health_status["components"]["mysql"] = {"status": "unhealthy", "error": str(e)[:100]}
        health_status["alerts"].append({"level": "critical", "component": "mysql", "message": f"Database offline: {str(e)[:50]}"})
    
    # 2. PHP + Gmail API
    ok, out = run_shell("php -r \"echo extension_loaded('curl') ? 'OK' : 'FAIL';\"", timeout=10)
    if ok and 'OK' in out:
        health_status["components"]["php_gmail_api"] = {"status": "healthy", "curl_enabled": True}
    else:
        critical_failures += 1
        health_status["components"]["php_gmail_api"] = {"status": "unhealthy", "curl_enabled": False}
        health_status["alerts"].append({"level": "critical", "component": "php", "message": "PHP cURL not loaded - Gmail API broken"})
    
    # 3. Node.js Scrapers
    scrapers = [
        {"name": "v1_scraper", "pattern": "puppeteer-wrapper.js v1.js", "log": "/app/logs/ze-v1-out.log"},
        {"name": "v1_itens_scraper", "pattern": "puppeteer-wrapper.js v1-itens.js", "log": "/app/logs/ze-v1-itens-out.log"},
        {"name": "sync_cron", "pattern": "sync-cron.js", "log": "/app/logs/ze-sync-out.log"}
    ]
    
    for scraper in scrapers:
        ok, out = run_shell(f"pgrep -f '{scraper['pattern']}'", timeout=5)
        pid = out.strip().split()[0] if ok and out.strip() else None
        
        # Verificar última atividade no log
        last_activity = None
        log_lines = 0
        if os.path.exists(scraper['log']):
            try:
                mtime = os.path.getmtime(scraper['log'])
                last_activity = datetime.fromtimestamp(mtime).isoformat()
                with open(scraper['log'], 'r') as f:
                    log_lines = sum(1 for _ in f)
            except:
                pass
        
        if ok and pid:
            health_status["components"][scraper['name']] = {
                "status": "healthy",
                "pid": pid,
                "last_activity": last_activity,
                "log_lines": log_lines
            }
        else:
            warnings += 1
            health_status["components"][scraper['name']] = {
                "status": "unhealthy",
                "pid": None,
                "last_activity": last_activity
            }
            health_status["alerts"].append({
                "level": "warning",
                "component": scraper['name'],
                "message": f"Scraper not running"
            })
    
    # 4. Chromium
    ok, _ = run_shell("which chromium && pgrep chromium", timeout=5)
    health_status["components"]["chromium"] = {"status": "healthy" if ok else "degraded"}
    
    # 5. Sessão do Zé Delivery
    session_files = [
        "/app/zedelivery-clean/profile-ze-v1/Default/Cookies",
        "/app/zedelivery-clean/profile-ze-v1-itens/Default/Cookies"
    ]
    sessions_valid = 0
    for sf in session_files:
        if os.path.exists(sf):
            age_hours = (time.time() - os.path.getmtime(sf)) / 3600
            if age_hours < 24:
                sessions_valid += 1
    
    health_status["components"]["ze_sessions"] = {
        "status": "healthy" if sessions_valid > 0 else "degraded",
        "valid_sessions": sessions_valid,
        "total_sessions": len(session_files)
    }
    if sessions_valid == 0:
        warnings += 1
        health_status["alerts"].append({
            "level": "warning",
            "component": "ze_sessions",
            "message": "No valid Zé Delivery sessions found"
        })
    
    # 6. Disk Space
    try:
        ok, out = run_shell("df -h /app | tail -1 | awk '{print $5}'", timeout=5)
        if ok:
            usage = int(out.strip().replace('%', ''))
            health_status["metrics"]["disk_usage_percent"] = usage
            if usage > 90:
                warnings += 1
                health_status["alerts"].append({"level": "warning", "component": "disk", "message": f"Disk usage at {usage}%"})
    except:
        pass
    
    # 7. Memory
    try:
        ok, out = run_shell("free -m | grep Mem | awk '{print int($3/$2*100)}'", timeout=5)
        if ok:
            mem_usage = int(out.strip())
            health_status["metrics"]["memory_usage_percent"] = mem_usage
    except:
        pass
    
    # Determinar status geral
    if critical_failures > 0:
        health_status["overall_status"] = "unhealthy"
    elif warnings > 0:
        health_status["overall_status"] = "degraded"
    
    health_status["metrics"]["critical_failures"] = critical_failures
    health_status["metrics"]["warnings"] = warnings
    
    return health_status


# ============= LOGS ESTRUTURADOS =============

@app.get("/api/logs/structured")
async def get_structured_logs(
    service: Optional[str] = None,
    level: Optional[str] = None,
    limit: int = 100
):
    """
    Retorna logs estruturados em formato JSON.
    Filtra por serviço (v1, v1-itens, sync) e nível (error, warning, info).
    """
    logs = []
    log_files = {
        "v1": ["/app/logs/ze-v1-out.log", "/app/logs/ze-v1-error.log"],
        "v1-itens": ["/app/logs/ze-v1-itens-out.log", "/app/logs/ze-v1-itens-error.log"],
        "sync": ["/app/logs/ze-sync-out.log", "/app/logs/ze-sync-error.log"]
    }
    
    files_to_read = []
    if service and service in log_files:
        files_to_read = [(service, f) for f in log_files[service]]
    else:
        for svc, files in log_files.items():
            files_to_read.extend([(svc, f) for f in files])
    
    for svc, filepath in files_to_read:
        if not os.path.exists(filepath):
            continue
        try:
            is_error_file = "error" in filepath
            with open(filepath, 'r') as f:
                lines = f.readlines()[-limit:]
                for i, line in enumerate(lines):
                    line = line.strip()
                    if not line:
                        continue
                    
                    # Detectar nível do log
                    log_level = "error" if is_error_file else "info"
                    if "❌" in line or "error" in line.lower() or "fail" in line.lower():
                        log_level = "error"
                    elif "⚠️" in line or "warn" in line.lower():
                        log_level = "warning"
                    elif "✅" in line or "success" in line.lower():
                        log_level = "info"
                    
                    if level and log_level != level:
                        continue
                    
                    logs.append({
                        "service": svc,
                        "level": log_level,
                        "message": line[:500],
                        "file": os.path.basename(filepath),
                        "line_number": i + 1
                    })
        except Exception as e:
            logs.append({
                "service": svc,
                "level": "error",
                "message": f"Error reading {filepath}: {str(e)}",
                "file": os.path.basename(filepath)
            })
    
    # Ordenar por nível (errors primeiro)
    level_order = {"error": 0, "warning": 1, "info": 2}
    logs.sort(key=lambda x: level_order.get(x["level"], 3))
    
    return {
        "success": True,
        "total": len(logs),
        "logs": logs[:limit]
    }


@app.get("/api/logs/errors")
async def get_error_logs(limit: int = 50):
    """Retorna apenas logs de erro dos últimos arquivos."""
    return await get_structured_logs(level="error", limit=limit)


# ============= BACKUP DE SESSÃO ZÉ DELIVERY =============

@app.get("/api/sessions/status")
async def get_sessions_status():
    """
    Verifica status das sessões do Zé Delivery.
    Importante para monitorar se o login ainda está válido.
    """
    sessions = []
    profile_dirs = [
        "/app/zedelivery-clean/profile-ze-v1",
        "/app/zedelivery-clean/profile-ze-v1-itens"
    ]
    
    for profile_dir in profile_dirs:
        session_info = {
            "profile": os.path.basename(profile_dir),
            "exists": os.path.exists(profile_dir),
            "cookies_valid": False,
            "last_activity": None,
            "age_hours": None
        }
        
        cookies_path = os.path.join(profile_dir, "Default", "Cookies")
        if os.path.exists(cookies_path):
            mtime = os.path.getmtime(cookies_path)
            age_hours = (time.time() - mtime) / 3600
            session_info["cookies_valid"] = age_hours < 48  # Válido por 48h
            session_info["last_activity"] = datetime.fromtimestamp(mtime).isoformat()
            session_info["age_hours"] = round(age_hours, 2)
        
        sessions.append(session_info)
    
    all_valid = all(s["cookies_valid"] for s in sessions)
    
    return {
        "success": True,
        "overall_valid": all_valid,
        "sessions": sessions,
        "recommendation": None if all_valid else "Sessões podem estar expiradas. Verifique se o scraper está funcionando."
    }


@app.post("/api/sessions/backup")
async def backup_sessions():
    """
    Cria backup das sessões do Zé Delivery.
    Útil para restaurar em caso de problemas.
    """
    backup_dir = "/app/backups/sessions"
    os.makedirs(backup_dir, exist_ok=True)
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = os.path.join(backup_dir, f"sessions_{timestamp}")
    os.makedirs(backup_path, exist_ok=True)
    
    backed_up = []
    profile_dirs = [
        "/app/zedelivery-clean/profile-ze-v1",
        "/app/zedelivery-clean/profile-ze-v1-itens"
    ]
    
    for profile_dir in profile_dirs:
        if os.path.exists(profile_dir):
            profile_name = os.path.basename(profile_dir)
            dest = os.path.join(backup_path, profile_name)
            ok, _ = run_shell(f"cp -r {profile_dir} {dest}", timeout=30)
            if ok:
                backed_up.append(profile_name)
    
    return {
        "success": len(backed_up) > 0,
        "backup_path": backup_path,
        "profiles_backed_up": backed_up,
        "timestamp": timestamp
    }


@app.get("/api/sessions/backups")
async def list_session_backups():
    """Lista backups de sessão disponíveis."""
    backup_dir = "/app/backups/sessions"
    backups = []
    
    if os.path.exists(backup_dir):
        for item in sorted(os.listdir(backup_dir), reverse=True):
            item_path = os.path.join(backup_dir, item)
            if os.path.isdir(item_path):
                backups.append({
                    "name": item,
                    "path": item_path,
                    "created": datetime.fromtimestamp(os.path.getctime(item_path)).isoformat()
                })
    
    return {"success": True, "backups": backups[:10]}  # Últimos 10


@app.post("/api/sessions/restore/{backup_name}")
async def restore_session_backup(backup_name: str):
    """
    Restaura sessões de um backup anterior.
    CUIDADO: Isso irá parar os scrapers temporariamente.
    """
    backup_path = f"/app/backups/sessions/{backup_name}"
    
    if not os.path.exists(backup_path):
        raise HTTPException(status_code=404, detail="Backup não encontrado")
    
    # Parar scrapers
    run_shell("pkill -f 'puppeteer-wrapper.js'", timeout=10)
    time.sleep(2)
    
    # Restaurar profiles
    restored = []
    for profile_name in ["profile-ze-v1", "profile-ze-v1-itens"]:
        src = os.path.join(backup_path, profile_name)
        dest = f"/app/zedelivery-clean/{profile_name}"
        if os.path.exists(src):
            run_shell(f"rm -rf {dest}", timeout=10)
            ok, _ = run_shell(f"cp -r {src} {dest}", timeout=30)
            if ok:
                restored.append(profile_name)
    
    # Reiniciar scrapers
    global _init_started
    _init_started = False
    threading.Thread(target=setup_services, daemon=True).start()
    
    return {
        "success": len(restored) > 0,
        "restored_profiles": restored,
        "message": "Scrapers sendo reiniciados"
    }


# ============= MÉTRICAS EM TEMPO REAL =============

# ============= AUTO-ACCEPT STATUS =============

@app.get("/api/aceite/status")
async def get_aceite_status():
    """
    Retorna status em tempo real do auto-accept de pedidos.
    O script v1.js salva estatísticas em /app/logs/aceite-stats.json
    """
    stats_file = "/app/logs/aceite-stats.json"
    
    try:
        if os.path.exists(stats_file):
            with open(stats_file, 'r') as f:
                stats = json.load(f)
            
            # Calcular tempo desde último check
            last_check = stats.get('lastCheck')
            if last_check:
                try:
                    last_dt = datetime.fromisoformat(last_check.replace('Z', '+00:00'))
                    seconds_ago = (datetime.now() - last_dt.replace(tzinfo=None)).total_seconds()
                    stats['secondsSinceLastCheck'] = int(seconds_ago)
                    stats['isActive'] = seconds_ago < 30  # Considerado ativo se checou nos últimos 30s
                except:
                    stats['secondsSinceLastCheck'] = None
                    stats['isActive'] = False
            else:
                stats['secondsSinceLastCheck'] = None
                stats['isActive'] = False
            
            # Calcular taxa de sucesso
            total = stats.get('totalAttempts', 0)
            accepted = stats.get('totalAccepted', 0)
            if total > 0:
                stats['successRate'] = round((accepted / total) * 100, 1)
            else:
                stats['successRate'] = None
            
            return {"success": True, "data": stats}
        else:
            # Verificar se o script está rodando
            ok, out = run_shell("pgrep -f 'v1.js'", timeout=5)
            is_running = ok and out.strip() != ""
            
            return {
                "success": True,
                "data": {
                    "status": "running" if is_running else "stopped",
                    "isActive": bool(is_running),
                    "message": "Script rodando, aguardando primeiro check" if is_running else "Script não está rodando",
                    "totalAccepted": 0,
                    "totalFailed": 0,
                    "totalAttempts": 0,
                    "recentAccepts": []
                }
            }
    except Exception as e:
        return {"success": False, "error": str(e)}


# ============= REPROCESSAMENTO EM MASSA =============

@app.post("/api/reprocessar/todos")
async def reprocessar_todos_pedidos(background_tasks: BackgroundTasks):
    """
    Marca TODOS os pedidos que precisam de reprocessamento para serem capturados novamente.
    Isso inclui pedidos sem itens ou com dados financeiros faltando.
    CUIDADO: Esta operação pode demorar dependendo do volume de pedidos.
    """
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        
        # 1. Encontrar pedidos que precisam de reprocessamento
        # Critérios: sem itens, ou com delivery_tem_itens = NULL, ou pedido_st_validacao = 0
        cursor.execute("""
            SELECT d.delivery_id, d.delivery_code, zp.pedido_id, zp.pedido_st_validacao,
                   (SELECT COUNT(*) FROM delivery_itens di WHERE di.delivery_itens_id_delivery = d.delivery_id) as qtd_itens
            FROM delivery d
            LEFT JOIN ze_pedido zp ON zp.pedido_code = d.delivery_code
            WHERE d.delivery_trash = 0
            AND (
                d.delivery_tem_itens IS NULL
                OR d.delivery_tem_itens = 0
                OR (SELECT COUNT(*) FROM delivery_itens di WHERE di.delivery_itens_id_delivery = d.delivery_id) = 0
            )
            ORDER BY d.delivery_date_time DESC
            LIMIT 500
        """)
        
        pedidos_para_reprocessar = cursor.fetchall()
        total = len(pedidos_para_reprocessar)
        
        if total == 0:
            cursor.close()
            conn.close()
            return {
                "success": True,
                "message": "Nenhum pedido precisa de reprocessamento",
                "total_checked": 0,
                "total_marked": 0
            }
        
        # 2. Marcar cada pedido para reprocessamento
        marked = 0
        errors = []
        
        for pedido in pedidos_para_reprocessar:
            try:
                delivery_code = pedido['delivery_code']
                delivery_id = pedido['delivery_id']
                
                # Resetar flag de validação
                cursor.execute("""
                    UPDATE ze_pedido SET pedido_st_validacao = 0 
                    WHERE pedido_code = %s
                """, (delivery_code,))
                
                # Resetar flag de tem_itens
                cursor.execute("""
                    UPDATE delivery SET delivery_tem_itens = NULL 
                    WHERE delivery_code = %s
                """, (delivery_code,))
                
                # Deletar itens antigos de ze_itens_pedido
                cursor.execute("""
                    DELETE FROM ze_itens_pedido 
                    WHERE itens_pedido_id_pedido IN (
                        SELECT pedido_id FROM ze_pedido WHERE pedido_code = %s
                    )
                """, (delivery_code,))
                
                # Deletar itens antigos de delivery_itens
                cursor.execute("""
                    DELETE FROM delivery_itens 
                    WHERE delivery_itens_id_delivery = %s
                """, (delivery_id,))
                
                marked += 1
                
            except Exception as e:
                errors.append({"code": delivery_code, "error": str(e)[:50]})
        
        conn.commit()
        cursor.close()
        conn.close()
        
        return {
            "success": True,
            "message": f"{marked} pedidos marcados para reprocessamento",
            "total_checked": total,
            "total_marked": marked,
            "errors": errors[:10] if errors else []
        }
        
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.get("/api/reprocessar/pedidos-sem-itens")
async def get_pedidos_sem_itens(limit: int = 100):
    """
    Lista pedidos que estão sem itens e precisam de reprocessamento.
    """
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute("""
            SELECT d.delivery_id, d.delivery_code, d.delivery_name_cliente, 
                   d.delivery_date_time, d.delivery_status, d.delivery_total,
                   d.delivery_tem_itens, zp.pedido_st_validacao,
                   (SELECT COUNT(*) FROM delivery_itens di WHERE di.delivery_itens_id_delivery = d.delivery_id) as qtd_itens
            FROM delivery d
            LEFT JOIN ze_pedido zp ON zp.pedido_code = d.delivery_code
            WHERE d.delivery_trash = 0
            AND (
                d.delivery_tem_itens IS NULL
                OR d.delivery_tem_itens = 0
                OR (SELECT COUNT(*) FROM delivery_itens di WHERE di.delivery_itens_id_delivery = d.delivery_id) = 0
            )
            ORDER BY d.delivery_date_time DESC
            LIMIT %s
        """, (limit,))
        
        pedidos = cursor.fetchall()
        
        # Converter datetime
        for p in pedidos:
            if p.get('delivery_date_time'):
                p['delivery_date_time'] = p['delivery_date_time'].isoformat()
        
        cursor.close()
        conn.close()
        
        return {
            "success": True,
            "total": len(pedidos),
            "data": pedidos
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.get("/api/metrics/realtime")
async def get_realtime_metrics():
    """
    Métricas em tempo real para dashboard.
    Atualizar a cada 10-30 segundos no frontend.
    """
    metrics = {
        "timestamp": datetime.now().isoformat(),
        "scrapers": {},
        "orders": {},
        "sync": {}
    }
    
    # Status dos scrapers
    for name, pattern in [("v1", "puppeteer-wrapper.js v1.js"), ("v1_itens", "puppeteer-wrapper.js v1-itens.js"), ("sync", "sync-cron.js")]:
        ok, out = run_shell(f"pgrep -f '{pattern}'", timeout=5)
        metrics["scrapers"][name] = {
            "running": ok,
            "pid": out.strip().split()[0] if ok and out.strip() else None
        }
    
    # Métricas de pedidos
    try:
        conn = get_db()
        cursor = conn.cursor(dictionary=True)
        
        # Pedidos nas últimas 24h
        cursor.execute("""
            SELECT 
                COUNT(*) as total_24h,
                SUM(CASE WHEN delivery_status = 1 THEN 1 ELSE 0 END) as entregues_24h,
                SUM(CASE WHEN delivery_status = 1 THEN delivery_total ELSE 0 END) as faturamento_24h
            FROM delivery 
            WHERE delivery_trash = 0 
            AND delivery_date_time >= NOW() - INTERVAL 24 HOUR
        """)
        stats_24h = cursor.fetchone()
        metrics["orders"]["last_24h"] = stats_24h
        
        # Último pedido
        cursor.execute("SELECT delivery_code, delivery_name_cliente, delivery_date_time FROM delivery ORDER BY delivery_date_time DESC LIMIT 1")
        last = cursor.fetchone()
        if last and last.get('delivery_date_time'):
            last['delivery_date_time'] = last['delivery_date_time'].isoformat()
        metrics["orders"]["latest"] = last
        
        cursor.close()
        conn.close()
    except Exception as e:
        metrics["orders"]["error"] = str(e)[:100]
    
    # Status do sync
    sync_log = "/app/logs/ze-sync-out.log"
    if os.path.exists(sync_log):
        mtime = os.path.getmtime(sync_log)
        metrics["sync"]["last_activity"] = datetime.fromtimestamp(mtime).isoformat()
        metrics["sync"]["age_seconds"] = int(time.time() - mtime)
    
    return metrics


# ============= SERVIR FRONTEND REACT =============
# Caminhos possíveis para o build do frontend
FRONTEND_BUILD_PATHS = [
    "/app/frontend/build",
    "../frontend/build",
    os.path.join(os.path.dirname(__file__), "..", "frontend", "build"),
]

# Encontrar o caminho correto do build
FRONTEND_BUILD_DIR = None
for path in FRONTEND_BUILD_PATHS:
    if os.path.exists(path) and os.path.isfile(os.path.join(path, "index.html")):
        FRONTEND_BUILD_DIR = os.path.abspath(path)
        break

if FRONTEND_BUILD_DIR:
    print(f"📂 Frontend encontrado em: {FRONTEND_BUILD_DIR}")
    
    # Servir arquivos estáticos (JS, CSS, imagens)
    app.mount("/static", StaticFiles(directory=os.path.join(FRONTEND_BUILD_DIR, "static")), name="static")
    
    # Servir outros arquivos na raiz do build (favicon, manifest, etc)
    @app.get("/favicon.ico")
    async def favicon():
        favicon_path = os.path.join(FRONTEND_BUILD_DIR, "favicon.ico")
        if os.path.exists(favicon_path):
            return FileResponse(favicon_path)
        raise HTTPException(status_code=404)
    
    @app.get("/manifest.json")
    async def manifest():
        manifest_path = os.path.join(FRONTEND_BUILD_DIR, "manifest.json")
        if os.path.exists(manifest_path):
            return FileResponse(manifest_path)
        raise HTTPException(status_code=404)
    
    @app.get("/robots.txt")
    async def robots():
        robots_path = os.path.join(FRONTEND_BUILD_DIR, "robots.txt")
        if os.path.exists(robots_path):
            return FileResponse(robots_path)
        raise HTTPException(status_code=404)
    
    # Catch-all: Qualquer rota não-API serve o index.html (SPA routing)
    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        # Se é uma rota de API, deixar o 404 padrão
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="API endpoint not found")
        
        # Para qualquer outra rota, servir o index.html (SPA)
        index_path = os.path.join(FRONTEND_BUILD_DIR, "index.html")
        if os.path.exists(index_path):
            return FileResponse(index_path)
        raise HTTPException(status_code=404, detail="Frontend not found")
else:
    print("⚠️ Frontend build não encontrado - apenas API disponível")
    
    @app.get("/")
    async def root():
        return {
            "status": "ok",
            "service": "ze-delivery-integrador",
            "message": "Frontend não disponível - use /api/health para verificar a API"
        }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
