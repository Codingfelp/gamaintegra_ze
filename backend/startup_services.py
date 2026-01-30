#!/usr/bin/env python3
"""
Script de inicialização automática dos serviços do Gamatauri Zé
Executa na inicialização do backend para garantir que Apache, PM2 e scripts estejam rodando
"""

import subprocess
import os
import time

def run_cmd(cmd, timeout=60):
    """Executa comando e retorna resultado"""
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=timeout)
        return result.returncode == 0, result.stdout + result.stderr
    except Exception as e:
        return False, str(e)

def check_and_install_dependencies():
    """Verifica e instala dependências necessárias"""
    print("🔧 Verificando dependências...")
    
    # Verificar se PM2 está instalado
    ok, _ = run_cmd("which pm2")
    if not ok:
        print("📦 Instalando PM2...")
        run_cmd("npm install -g pm2", timeout=120)
    
    # Verificar se Apache está instalado
    ok, _ = run_cmd("which apache2")
    if not ok:
        print("📦 Instalando Apache + PHP...")
        run_cmd("apt-get update && apt-get install -y apache2 php libapache2-mod-php php-mysql", timeout=180)
    
    # Verificar se Chromium está instalado
    ok, _ = run_cmd("which chromium")
    if not ok:
        print("📦 Instalando Chromium...")
        run_cmd("apt-get install -y chromium", timeout=180)
    
    # Verificar se MySQL client está instalado
    ok, _ = run_cmd("which mysql")
    if not ok:
        print("📦 Instalando MySQL client...")
        run_cmd("apt-get install -y mariadb-client", timeout=60)

def configure_apache():
    """Configura Apache na porta 8088"""
    print("🌐 Configurando Apache...")
    
    # Verificar se já está rodando na porta 8088
    ok, output = run_cmd("ss -tlnp | grep 8088")
    if ok and "apache" in output:
        print("✅ Apache já está rodando na porta 8088")
        return True
    
    # Criar configuração
    ports_conf = "Listen 8088\n"
    vhost_conf = """<VirtualHost *:8088>
    DocumentRoot /app/integrador
    <Directory /app/integrador>
        Options Indexes FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>
</VirtualHost>
"""
    
    try:
        with open("/etc/apache2/ports.conf", "w") as f:
            f.write(ports_conf)
        with open("/etc/apache2/sites-available/zeduplo.conf", "w") as f:
            f.write(vhost_conf)
        
        run_cmd("a2dissite 000-default 2>/dev/null")
        run_cmd("a2ensite zeduplo")
        run_cmd("pkill -9 apache2 2>/dev/null")
        time.sleep(1)
        ok, _ = run_cmd("apachectl start")
        
        if ok:
            print("✅ Apache iniciado na porta 8088")
            return True
    except Exception as e:
        print(f"❌ Erro ao configurar Apache: {e}")
    
    return False

def start_pm2_services():
    """Inicia serviços PM2"""
    print("🚀 Iniciando serviços PM2...")
    
    # Verificar se PM2 já está rodando os serviços
    ok, output = run_cmd("pm2 list 2>/dev/null")
    if ok and "ze-v1" in output and "online" in output:
        print("✅ Serviços PM2 já estão rodando")
        return True
    
    # Instalar dependências Node.js
    run_cmd("cd /app/zedelivery-clean && npm install --silent 2>/dev/null")
    run_cmd("cd /app/bridge && npm install --silent 2>/dev/null")
    
    # Iniciar PM2
    config_path = "/app/pm2.ecosystem.config.js"
    if os.path.exists(config_path):
        run_cmd("pm2 delete all 2>/dev/null")
        ok, output = run_cmd(f"pm2 start {config_path}")
        if ok:
            run_cmd("pm2 save")
            print("✅ Serviços PM2 iniciados")
            return True
    
    print("❌ Erro ao iniciar PM2")
    return False

def initialize_services():
    """Função principal de inicialização"""
    print("\n" + "="*50)
    print("  GAMATAURI ZÉ - Inicialização de Serviços")
    print("="*50 + "\n")
    
    check_and_install_dependencies()
    configure_apache()
    start_pm2_services()
    
    print("\n" + "="*50)
    print("  Inicialização concluída!")
    print("="*50 + "\n")

if __name__ == "__main__":
    initialize_services()
