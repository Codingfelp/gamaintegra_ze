# Gamatauri Zé Integrador - PRD

## Status: ✅ FUNCIONANDO - PRONTO PARA PRODUÇÃO

**Última atualização:** 01/02/2026 00:00

---

## Correções Críticas (Sessão 31/01/2026)

### 1. Arquitetura PHP Refatorada
**Problema:** PHP built-in server é single-threaded, IMAP bloqueante travava produção.
**Solução:** PHP agora é CLI, não HTTP. Node.js chama PHP via `exec()`.

### 2. Bug de IDs Diferentes
**Problema:** `ze_pedido.pedido_id` ≠ `delivery.delivery_id`, UPDATE falhava silenciosamente.
**Solução:** Corrigido `ze_pedido_view.php` para usar apenas `delivery_code`.

### 3. Dados de Cliente Não Aparecem
**Problema:** `ze_pedido.php` não definia `pedido_st_validacao=0`, v1-itens não coletava detalhes.
**Solução:** Adicionado campo + script de sincronização retroativa.

### 4. Itens Não Aparecem no Modal
**Problema:** Itens ficavam em `ze_itens_pedido`, não copiados para `delivery_itens`.
**Solução:** Script de sincronização + correção no frontend.

### 5. Modal de Detalhes Vazio
**Problema:** Frontend esperava `pedidoDetails.pedido`, API retornava `data.data`.
**Solução:** Ajustado `fetchPedidoDetails` no App.js.

---

## Arquitetura Final

```
┌──────────────────────────────────────────────────────────────┐
│                 FastAPI Backend (server.py)                  │
│                 Porta 8001 - API REST                        │
│  - Gerencia scrapers via nohup (produção) ou Supervisor      │
│  - Instala dependências no startup (php, chromium)           │
└──────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│   v1.js     │       │ v1-itens.js │       │ sync-cron   │
│  (Scraper)  │       │  (Detalhes) │       │  (Lovable)  │
└─────────────┘       └─────────────┘       └─────────────┘
        │                     │
        └──────────┬──────────┘
                   │
                   ▼
         ┌─────────────────┐
         │  php-bridge.js  │
         │  (exec() CLI)   │
         └─────────────────┘
                   │
                   ▼
         ┌─────────────────┐
         │   PHP Scripts   │
         │  (CLI, não HTTP)│
         └─────────────────┘
                   │
                   ▼
         ┌─────────────────┐
         │     MySQL       │
         │ Railway Cloud   │
         └─────────────────┘
```

---

## Arquivos Modificados

```
/app/zedelivery-clean/
├── php-bridge.js                  # NOVO - Bridge Node→PHP via CLI
├── v1.js                          # Usa php-bridge
├── v1-itens.js                    # Usa php-bridge

/app/integrador/zeduplo/
├── ze_pedido.php                  # Fix: pedido_st_validacao=0, delivery_id auto-increment
├── ze_pedido_view.php             # Fix: UPDATE usa delivery_code apenas

/app/backend/
├── server.py                      # Removido PHP HTTP server

/app/frontend/src/
├── App.js                         # Fix: fetchPedidoDetails formata dados corretamente
```

---

## Sincronização de Dados

Os dados fluem assim:
1. `ze_pedido` ← v1.js insere pedido básico
2. `delivery` ← ze_pedido.php copia para tabela final
3. `ze_pedido` ← v1-itens.js atualiza com CPF, endereço, itens
4. `delivery` ← ze_pedido_view.php sincroniza detalhes
5. `delivery_itens` ← ze_pedido_view.php insere itens
6. Lovable Cloud ← sync-cron.js envia tudo formatado

---

## Comandos de Verificação

```bash
# Status dos serviços
curl http://localhost:8001/api/services/status

# Ver último pedido com detalhes
curl http://localhost:8001/api/pedidos/160358

# Logs do scraper
tail -f /app/logs/ze-v1-out.log

# Sincronizar itens pendentes manualmente
php -r "chdir('/app/integrador/zeduplo'); require '_class/AutoLoad.php'; ..."
```

---

## Para Produção

O sistema está pronto. O `server.py` agora:
1. Detecta se é produção (`/var/run/supervisor.sock` não existe)
2. Instala PHP + IMAP + Chromium de forma **síncrona**
3. Inicia scrapers via nohup (não depende de Supervisor)
4. PHP não expõe porta HTTP (chamado via CLI)

**Isso elimina todos os problemas anteriores de instabilidade.**

---

## Status Atual

- ✅ **168 pedidos** no sistema
- ✅ **R$ 11.500+** faturamento
- ✅ Modal de detalhes funcionando com CPF, endereço, itens
- ✅ Sync para Lovable Cloud enviando dados completos
- ✅ Arquitetura estável para produção

---

*Documentação técnica detalhada em:* `/app/docs/arquitetura_php.md`
