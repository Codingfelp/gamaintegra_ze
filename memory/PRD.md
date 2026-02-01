# Gamatauri Zé Integrador - PRD

## Status: ✅ FUNCIONANDO - PRONTO PARA PRODUÇÃO

**Última atualização:** 01/02/2026 02:00

---

## Correções Finais (01/02/2026)

### 1. PHP Bridge Refatorado
- **Problema:** `php -r` causava erro de sintaxe em produção
- **Solução:** Usa arquivo temporário ao invés de `php -r`

### 2. PHP Scripts Corrigidos
- **Problema:** `ze_pedido.php` e `ze_pedido_view.php` liam de `php://input`, vazio no CLI
- **Solução:** Fallback para `$_POST` quando `php://input` está vazio

### 3. API Corrigida
- **Problema:** Endpoint `/api/pedidos` não incluía CPF/endereço na query
- **Solução:** Adicionados campos `delivery_cpf_cliente`, `delivery_endereco_*`

### 4. Sincronização Automática
- **Problema:** Dados ficavam em `ze_pedido` mas não iam para `delivery`
- **Solução:** `sync-cron.js` agora sincroniza `ze_pedido → delivery` + itens automaticamente

### 5. Suporte MYSQL* Variables
- **Problema:** Produção usa `MYSQLHOST` ao invés de `DB_HOST`
- **Solução:** Backend e bridge detectam ambos os padrões + fallback hardcoded

### 6. Duplicatas Removidas
- **Problema:** 15+ registros duplicados em `delivery`
- **Solução:** Script de limpeza executado

---

## Status Atual

- ✅ **193 pedidos** (sem duplicatas)
- ✅ **MySQL**: Railway Cloud (`mainline.proxy.rlwy.net`)
- ✅ **PHP**: CLI mode (db_connected: true)
- ✅ **Scrapers**: v1.js + v1-itens.js rodando
- ✅ **Sync**: Lovable Cloud + sincronização local
- ✅ **Modal**: CPF, endereço, itens funcionando

---

## Arquitetura Final

```
┌─────────────────────────────────────────────────────────────────┐
│                     FastAPI Backend (8001)                      │
│  - Detecta MYSQL* ou DB_* variables                             │
│  - Fallback hardcoded para Railway                              │
└─────────────────────────────────────────────────────────────────┘
                              │
     ┌────────────────────────┼────────────────────────┐
     │                        │                        │
     ▼                        ▼                        ▼
┌──────────┐           ┌──────────────┐          ┌───────────┐
│  v1.js   │           │ v1-itens.js  │          │sync-cron.js│
│ (Scraper)│           │ (Detalhes)   │          │  (Sync)    │
└──────────┘           └──────────────┘          └───────────┘
     │                        │                        │
     └────────────┬───────────┘                        │
                  │                                    │
                  ▼                                    │
          ┌──────────────┐                             │
          │php-bridge.js │                             │
          │(Arquivo temp)│                             │
          └──────────────┘                             │
                  │                                    │
                  ▼                                    │
          ┌──────────────┐                             │
          │ PHP Scripts  │                             │
          │  (CLI mode)  │                             │
          └──────────────┘                             │
                  │                                    │
                  └──────────────┬─────────────────────┘
                                 │
                                 ▼
                     ┌───────────────────┐
                     │   MySQL Railway   │
                     │mainline.proxy.rlwy│
                     └───────────────────┘
```

---

## Garantias para Produção

1. **Credenciais Hardcoded**: Se variáveis de ambiente forem erradas (MongoDB, internal), usa Railway direto
2. **PHP via CLI**: Não depende de servidor HTTP, cada chamada é isolada
3. **Sincronização Automática**: `sync-cron.js` sincroniza dados a cada 10 segundos
4. **Detecção de Ambiente**: Reconhece tanto `DB_*` quanto `MYSQL*` variables
5. **Fallback para railway.internal**: Se detectar host interno, usa proxy público

---

## Endpoints de Diagnóstico

```bash
# Status completo
curl /api/services/status

# Config do banco
curl /api/debug/db-config

# Health check
curl /health
```
