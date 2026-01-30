#!/bin/bash
# Script de inicialização 24/7 - Gamatauri Zé Delivery
# Este script deve ser executado para iniciar todos os serviços

echo "========================================="
echo "  Gamatauri Zé Delivery - Startup 24/7"
echo "========================================="
echo ""

# Criar diretórios necessários
mkdir -p /app/logs
mkdir -p /run/mysqld
chmod 777 /run/mysqld

# 1. Iniciar MariaDB na porta 3309
echo "[1/4] Iniciando MariaDB na porta 3309..."
if ! pgrep -x "mariadbd" > /dev/null; then
    /usr/sbin/mariadbd --port=3309 --socket=/run/mysqld/mysqld.sock --skip-grant-tables --user=root &
    sleep 5
    if pgrep -x "mariadbd" > /dev/null; then
        echo "✅ MariaDB iniciado com sucesso na porta 3309"
    else
        echo "❌ Erro ao iniciar MariaDB"
    fi
else
    echo "✅ MariaDB já está rodando"
fi

# 2. Iniciar Apache na porta 8088
echo ""
echo "[2/4] Iniciando Apache na porta 8088..."
if ! pgrep -x "apache2" > /dev/null; then
    apachectl start
    sleep 2
    if pgrep -x "apache2" > /dev/null; then
        echo "✅ Apache iniciado com sucesso na porta 8088"
    else
        echo "❌ Erro ao iniciar Apache"
    fi
else
    echo "✅ Apache já está rodando"
fi

# 3. Instalar dependências Node.js
echo ""
echo "[3/4] Verificando dependências Node.js..."
cd /app/zedelivery-clean && npm install --silent 2>/dev/null
cd /app/bridge && npm install --silent 2>/dev/null
echo "✅ Dependências verificadas"

# 4. Iniciar PM2 com todos os serviços
echo ""
echo "[4/4] Iniciando serviços PM2..."
pm2 delete all 2>/dev/null || true
pm2 start /app/pm2.ecosystem.config.js
pm2 save

echo ""
echo "========================================="
echo "  Status dos Serviços"
echo "========================================="
echo ""
echo "MariaDB (porta 3309):"
ss -tlnp | grep 3309 || echo "  ❌ Não está escutando"
echo ""
echo "Apache (porta 8088):"
ss -tlnp | grep 8088 || echo "  ❌ Não está escutando"
echo ""
echo "PM2 Processos:"
pm2 list

echo ""
echo "========================================="
echo "  Integração está pronta para uso!"
echo "========================================="
