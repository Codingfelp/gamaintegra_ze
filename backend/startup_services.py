#!/usr/bin/env python3
"""
Script de inicialização automática dos serviços do Gamatauri Zé
Executa na inicialização do backend para garantir que Chromium e scripts Supervisor estejam rodando
"""

import subprocess
import os
import time
import shutil

def run_cmd(cmd, timeout=120):
    """Executa comando e retorna resultado"""
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=timeout)
        return result.returncode == 0, result.stdout + result.stderr
    except Exception as e:
        return False, str(e)

def check_and_install_chromium():
    """Verifica e instala Chromium se necessário"""
    print("🔧 Verificando Chromium...")
    
    # Verificar se Chromium está instalado
    ok, _ = run_cmd("which chromium")
    if ok:
        print("✅ Chromium já instalado")
        return True
    
    print("📦 Instalando Chromium...")
    ok, output = run_cmd("apt-get update && apt-get install -y chromium chromium-driver", timeout=180)
    if ok:
        print("✅ Chromium instalado com sucesso")
        return True
    else:
        print(f"⚠️ Erro ao instalar Chromium: {output}")
        return False

def install_node_dependencies():
    """Instala dependências Node.js dos scrapers"""
    print("📦 Verificando dependências Node.js...")
    
    # Scrapers
    if os.path.exists("/app/zedelivery-clean/package.json"):
        if not os.path.exists("/app/zedelivery-clean/node_modules"):
            print("   Instalando dependências zedelivery-clean...")
            run_cmd("cd /app/zedelivery-clean && npm install --silent 2>/dev/null", timeout=120)
    
    # Bridge
    if os.path.exists("/app/bridge/package.json"):
        if not os.path.exists("/app/bridge/node_modules"):
            print("   Instalando dependências bridge...")
            run_cmd("cd /app/bridge && npm install --silent 2>/dev/null", timeout=120)
    
    print("✅ Dependências Node.js verificadas")

def clear_chromium_locks():
    """Limpa locks do Chromium que podem travar os scrapers"""
    print("🔓 Limpando locks do Chromium...")
    
    profiles = [
        "/app/zedelivery-clean/profile-ze-v1",
        "/app/zedelivery-clean/profile-ze-v1-itens"
    ]
    
    for profile in profiles:
        if os.path.exists(profile):
            # Remover arquivos de lock
            for lock_file in ["SingletonLock", "SingletonSocket", "SingletonCookie"]:
                lock_path = os.path.join(profile, lock_file)
                if os.path.exists(lock_path):
                    try:
                        os.remove(lock_path)
                        print(f"   Removido: {lock_path}")
                    except:
                        pass
    
    print("✅ Locks limpos")

def setup_supervisor_config():
    """Copia configuração do Supervisor para o diretório correto"""
    print("⚙️ Configurando Supervisor...")
    
    source = "/app/ze-scripts.supervisor.conf"
    dest = "/etc/supervisor/conf.d/ze-scripts.conf"
    
    # Garantir diretório de logs existe
    os.makedirs("/app/logs", exist_ok=True)
    
    if os.path.exists(source):
        try:
            # Copiar config
            shutil.copy(source, dest)
            print(f"   Config copiado: {dest}")
            
            # Recarregar supervisor
            run_cmd("supervisorctl reread")
            run_cmd("supervisorctl update")
            print("✅ Supervisor atualizado")
            return True
        except Exception as e:
            print(f"⚠️ Erro ao copiar config: {e}")
    
    return False

def start_supervisor_services():
    """Inicia os serviços via Supervisor"""
    print("🚀 Iniciando serviços Supervisor...")
    
    services = ["ze-v1", "ze-v1-itens", "ze-sync"]
    
    for service in services:
        # Verificar status
        ok, output = run_cmd(f"supervisorctl status {service}")
        if "RUNNING" in output:
            print(f"   ✅ {service}: já rodando")
        else:
            # Tentar iniciar
            ok, _ = run_cmd(f"supervisorctl start {service}")
            time.sleep(2)
            
            # Verificar novamente
            ok, output = run_cmd(f"supervisorctl status {service}")
            if "RUNNING" in output:
                print(f"   ✅ {service}: iniciado")
            else:
                print(f"   ⚠️ {service}: {output.strip()}")

def initialize_services():
    """Função principal de inicialização"""
    print("\n" + "="*50)
    print("  GAMATAURI ZÉ - Inicialização de Serviços")
    print("  Usando Supervisor (não PM2)")
    print("="*50 + "\n")
    
    # 1. Instalar Chromium se necessário
    check_and_install_chromium()
    
    # 2. Instalar dependências Node.js
    install_node_dependencies()
    
    # 3. Limpar locks do Chromium
    clear_chromium_locks()
    
    # 4. Configurar Supervisor
    setup_supervisor_config()
    
    # 5. Iniciar serviços
    start_supervisor_services()
    
    print("\n" + "="*50)
    print("  Inicialização concluída!")
    print("="*50 + "\n")

if __name__ == "__main__":
    initialize_services()
