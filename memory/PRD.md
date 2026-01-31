# Gamatauri Zé Integrador - PRD

## Status: ✅ PRONTO PARA DEPLOY

## Correções Desta Sessão (31/01/2026)

### 1. Health Check Adicionado
- Endpoint `/health` e `/api/health` adicionados
- Retorna `{"status":"healthy","service":"ze-integrador"}`
- **CRÍTICO** para o deploy funcionar

### 2. Detecção de Ambiente Corrigida
- Detecta automaticamente se está em **preview** (com Supervisor) ou **produção** (sem Supervisor)
- Verifica existência de `/var/run/supervisor.sock`
- Em produção: usa `nohup` para iniciar scripts manualmente

### 3. Instalações em Background
- Apache, PHP, Chromium e dependências Node.js são instalados em **threads separadas**
- Não bloqueia mais o startup do servidor
- Health check responde imediatamente

### 4. Preservação de Dados
- PHP modificado para **NÃO sobrescrever** dados que já existem no banco
- Endereço, CPF, código de entrega são preservados após pedido ser entregue
- Resolve o problema de dados ficarem NULL

### 5. Watchdog Corrigido
- Usa apenas `pgrep` para verificar scripts (não `supervisorctl`)
- Funciona tanto em preview quanto em produção

## Arquitetura de Inicialização (Atualizada)

```
Backend Inicia
     │
     ├─► /health responde IMEDIATAMENTE {"status":"healthy"}
     │
     ▼
Thread Background (após 5s)
     │
     ├─► Detecta ambiente (preview ou produção)
     │
     ├─► Threads paralelas:
     │   ├─► Instala Apache + PHP
     │   ├─► Instala Chromium
     │   └─► Instala dependências Node.js
     │
     ▼
Se Preview (Supervisor existe):
     └─► supervisorctl start ze-v1 ze-v1-itens ze-sync

Se Produção (sem Supervisor):
     └─► nohup node puppeteer-wrapper.js v1.js &
     └─► nohup node puppeteer-wrapper.js v1-itens.js &
     └─► nohup node sync-cron.js &
     │
     ▼
Watchdog (a cada 60s)
     └─► pgrep -f "script.js"
     └─► Se não encontrar, reinicia com nohup
```

## Endpoints de Health Check

| Endpoint | Resposta |
|----------|----------|
| `/health` | `{"status":"healthy","service":"ze-integrador"}` |
| `/api/health` | `{"status":"healthy","service":"ze-integrador"}` |

## Dados do Banco
- 124 pedidos
- 122 com itens completos
- 2 pedidos históricos sem itens (não recuperáveis)

## Arquivos Modificados

```
/app/backend/server.py                    # Health check + detecção ambiente + instalação background
/app/integrador/zeduplo/ze_pedido_view.php # Preservação de dados existentes
```

## Para Testar Após Deploy

```bash
# 1. Verificar health check
curl https://seu-app.emergentagent.com/health

# 2. Verificar logs
tail -50 /var/log/supervisor/backend.out.log

# Deve mostrar:
# 🏭 Ambiente de PRODUÇÃO detectado (sem Supervisor)
# 🚀 Iniciando scripts manualmente...
# ✅ ze-v1: iniciado (PID xxx)
# ✅ ze-v1-itens: iniciado (PID xxx)
# ✅ ze-sync: iniciado (PID xxx)

# 3. Verificar processos
ps aux | grep -E "v1.js|sync-cron.js" | grep -v grep
```

---

## Changelog

### 31/01/2026 v3 (Atual)
- **FIX:** Adicionado endpoint `/health` para deploy
- **FIX:** Instalações movidas para threads background
- **FIX:** Detecção de ambiente por `/var/run/supervisor.sock`
- **FIX:** Watchdog não usa mais supervisorctl
- **FIX:** PHP preserva dados existentes (não sobrescreve com NULL)

### 31/01/2026 v2
- Modo dual de inicialização (Supervisor/manual)
- Watchdog para reiniciar scripts
- Documentação de verificação em produção

### 31/01/2026 v1
- Bridge verificado e funcionando
- 122 pedidos com itens corretos
- Campo delivery_tipo_pedido com valores exatos

---

*Atualizado: 31/01/2026 09:45*
