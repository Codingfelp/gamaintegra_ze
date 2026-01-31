# Gamatauri Zé Integrador - PRD

## Status: ✅ FUNCIONANDO - ARQUITETURA REFATORADA

**Última atualização:** 31/01/2026 23:30

---

## Refatoração Arquitetural (31/01/2026)

### Problema Identificado pelo Usuário
O PHP ficava "offline" em produção por causa da arquitetura:
- PHP built-in server é **single-threaded**
- IMAP é **bloqueante** e travava todo o servidor
- Preview funcionava, produção não

### Solução Implementada
**PHP NÃO é mais servidor HTTP**

- Criado `php-bridge.js` - Node.js chama PHP via `exec()` (CLI)
- Removido PHP HTTP server da arquitetura
- Cada chamada PHP é isolada (não trava outras operações)
- Zero porta HTTP exposta pelo PHP

### Arquivos Criados/Modificados
```
CRIADO:  /app/zedelivery-clean/php-bridge.js    # Bridge Node→PHP via CLI
MODIF:   /app/zedelivery-clean/v1.js            # Usa php-bridge ao invés de HTTP
MODIF:   /app/zedelivery-clean/v1-itens.js      # Usa php-bridge ao invés de HTTP
MODIF:   /app/backend/server.py                 # Removido PHP server, mantido apenas Node
MODIF:   /app/integrador/zeduplo/ze_pedido.php  # Fix duplicatas (delivery_id auto-increment)
MODIF:   /app/docs/arquitetura_php.md           # Documentação atualizada
```

---

## Bug Fixes (31/01/2026)

### 1. Pedidos não sendo inseridos
**Causa:** `ze_pedido.php` usava `delivery_id = pedido_id`, mas delivery_id é auto-incremento
**Correção:** Removido assignment manual, adicionada verificação de duplicatas

### 2. Duplicatas no banco
**Causa:** Inserções duplicadas quando o processamento falhava
**Correção:** 
- Verificação `SELECT delivery_id FROM delivery WHERE delivery_code = '...'` antes de inserir
- Script de limpeza executado para remover 24+ duplicatas

### 3. php-imap não instalado
**Causa:** Container de produção é limpo a cada deploy
**Correção:** Instalação síncrona no startup do `server.py`

---

## Status Atual (23:30)
- ✅ MySQL: Online (Railway Cloud)
- ✅ PHP: Online (modo **CLI**, não HTTP)
- ✅ PHP-IMAP: Online
- ✅ Chromium: Online
- ✅ Integrador (v1.js): Online - PID 31255
- ✅ Itens (v1-itens.js): Online - PID 31401
- ✅ Sync (sync-cron.js): Online - PID 31563
- ✅ **166 pedidos totais**
- ✅ **R$ 11.336,72 faturamento**

---

## Próximas Tarefas

### P1 - Alinhar Sync com Lovable Cloud
- Modificar `/app/bridge/sync-cron.js` para formato da Edge Function do Supabase
- Resolver erros 504/500 do Cloudflare

### P2 - Verificar Fix de Dados Nulos
- Confirmar que endereço/CPF não está sendo sobrescrito com null para pedidos entregues

### P2 - Documentação Final
- Completar `/app/docs/resumo_do_projeto.md`

---

## Arquitetura Final

```
┌─────────────────────────────────────────────────────────────┐
│                    FastAPI (server.py)                       │
│                    Porta 8001 - API                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 Scrapers Node.js                             │
│  v1.js (PID 31255)    │   v1-itens.js (PID 31401)           │
│  - Scraping Puppeteer  │   - Coleta itens dos pedidos       │
│  - Usa php-bridge.js   │   - Usa php-bridge.js              │
└─────────────────────────────────────────────────────────────┘
                              │
                        exec() CLI
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    PHP Scripts (CLI)                         │
│  ze_pedido.php     │  ze_pedido_mail.php  │  ze_pedido_view │
│  (Inserção)        │  (2FA via IMAP)       │  (Atualização)  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 MySQL (Railway Cloud)                        │
│  Host: mainline.proxy.rlwy.net:52996                         │
│  Database: railway                                           │
│  Tabelas: delivery, ze_pedido, delivery_itens                │
└─────────────────────────────────────────────────────────────┘
```

---

## Comandos Úteis

```bash
# Status dos serviços
curl http://localhost:8001/api/services/status

# Health check
curl http://localhost:8001/health

# Logs do scraper
tail -f /app/logs/ze-v1-out.log

# Testar PHP CLI
php /app/integrador/zeduplo/ze_pedido_mail.php

# Limpar duplicatas
php -r "chdir('/app/integrador/zeduplo'); require '_class/AutoLoad.php'; ..."
```

---

*Documentação técnica detalhada em:* `/app/docs/arquitetura_php.md`
