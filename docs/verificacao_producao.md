# Verificação de Scripts em Produção

## O Que Foi Alterado

O código do backend agora tem **duas formas** de iniciar os scripts:

1. **Modo Supervisor** (preview): Usa o Supervisor nativo do Emergent
2. **Modo Manual** (produção): Usa `nohup` para iniciar os processos diretamente

### Detecção Automática
O código detecta automaticamente qual modo usar:
- Se `supervisorctl status ze-sync` retorna "RUNNING", "STOPPED" ou "STARTING" → usa Supervisor
- Caso contrário → usa modo manual com nohup

### Watchdog
Um **watchdog** verifica a cada 60 segundos se os scripts estão rodando e os reinicia automaticamente se caírem.

---

## Verificação Após Deploy

### 1. Verificar Logs do Backend
```bash
tail -100 /var/log/supervisor/backend.out.log | grep -E "Zé|Manual|Supervisor|iniciado|rodando"
```

Você deve ver uma dessas mensagens:
- `📋 Usando Supervisor para gerenciar scripts...` (preview)
- `⚠️ Supervisor não aceita scripts externos - usando inicialização manual` (produção)
- `🚀 Iniciando scripts manualmente (modo produção)...`

### 2. Verificar Processos Node.js
```bash
ps aux | grep -E "v1.js|v1-itens.js|sync-cron.js" | grep -v grep
```

Deve mostrar 3 processos:
- `node puppeteer-wrapper.js v1.js`
- `node puppeteer-wrapper.js v1-itens.js`
- `node sync-cron.js`

### 3. Verificar Logs dos Scripts
```bash
tail -20 /app/logs/ze-v1-out.log
tail -20 /app/logs/ze-v1-itens-out.log
tail -20 /app/logs/ze-sync-out.log
```

### 4. Verificar Apache
```bash
ss -tlnp | grep 8088
curl -s http://localhost:8088/zeduplo/ze_pedido_id.php?ide=e8194a871a0e6d26fe620d13f7baad86
```

---

## Solução de Problemas

### Scripts não estão rodando
1. Verificar se o Apache está rodando: `ss -tlnp | grep 8088`
2. Verificar se Chromium está instalado: `which chromium`
3. Verificar logs de erro: `tail -50 /app/logs/ze-v1-error.log`

### Scripts caem após alguns minutos
O watchdog deve reiniciá-los automaticamente. Verifique os logs:
```bash
tail -100 /var/log/supervisor/backend.out.log | grep Watchdog
```

### Apache não está rodando
O backend instala automaticamente, mas se falhar:
```bash
apt-get update && apt-get install -y apache2 libapache2-mod-php php-mysql
echo 'Listen 8088' > /etc/apache2/ports.conf
apachectl start
```

---

## Comandos Úteis

```bash
# Reiniciar backend (reinicia todos os scripts)
supervisorctl restart backend

# Matar todos os scripts manualmente e deixar o backend reiniciar
pkill -f "v1.js"
pkill -f "v1-itens.js"
pkill -f "sync-cron.js"
# Aguarde 60 segundos para o watchdog reiniciar

# Forçar reenvio de todos os pedidos para Lovable
cd /app/bridge && node force-resync.js

# Ver status da API
curl -s http://localhost:8001/api/services/status | python3 -m json.tool
```

---

*Documento atualizado: 31/01/2026*
