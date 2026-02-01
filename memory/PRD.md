# Gamatauri Zé Integrador - PRD

## Status: ✅ FUNCIONANDO - SISTEMA MONITORÁVEL 24/7

**Última atualização:** 01/02/2026 - Dashboard de Monitoramento implementado

---

## 🎉 Implementações Recentes

### 01/02/2026 - Sistema de Monitoramento 24/7
- **Health Check Detalhado**: `/api/health/detailed` com status de todos componentes
- **Métricas em Tempo Real**: `/api/metrics/realtime` com pedidos 24h, faturamento
- **Backup de Sessões Zé**: Sistema de backup/restore das sessões do Chromium
- **Logs Estruturados**: `/api/logs/structured` com filtro por serviço e nível
- **Dashboard Monitor**: Nova aba "Monitor 24/7" no frontend

### 03/02/2026 - Migração IMAP → Gmail API (OAuth 2.0)
- **Problema:** `php-imap` era instável em produção
- **Solução:** Gmail API REST com OAuth 2.0
- **Resultado:** 
  - Zero dependência de `php-imap`
  - Autenticação permanente via refresh_token
  - Resposta < 5 segundos (vs 60+ com IMAP)

---

## Endpoints de Monitoramento

```
GET  /api/health/detailed           # Health check completo
GET  /api/metrics/realtime          # Métricas em tempo real
GET  /api/sessions/status           # Status das sessões Zé
POST /api/sessions/backup           # Criar backup de sessões
GET  /api/sessions/backups          # Listar backups
POST /api/sessions/restore/{name}   # Restaurar sessão
GET  /api/logs/structured           # Logs estruturados
GET  /api/logs/errors               # Apenas erros
```

---

## Status Atual dos Serviços

- ✅ **MySQL**: Railway Cloud (`mainline.proxy.rlwy.net`)
- ✅ **PHP**: CLI mode com **Gmail API** (não mais IMAP)
- ✅ **Scrapers**: v1.js + v1-itens.js rodando
- ✅ **Sync**: Lovable Cloud + sincronização local
- ✅ **Monitor**: Dashboard 24/7 com métricas em tempo real
- ✅ **Backup**: Sistema de backup/restore de sessões

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
          │(Gmail API)   │                             │
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

## Tarefas Pendentes

### P1: Lovable Cloud Sync Data Conformance
- Alinhar payload de `sync-cron.js` com estrutura esperada pelo Supabase Edge Function
- Status: NÃO INICIADO

### P2: Verificar Prevenção de Duplicatas
- Confirmar que duplicatas não ocorrem mais
- Status: AGUARDANDO VERIFICAÇÃO DO USUÁRIO

### P2: Finalizar Documentação
- `resumo_do_projeto.md` - atualizar com Gmail API
- Status: EM PROGRESSO

---

## Garantias para Produção

1. **Gmail API OAuth 2.0**: Refresh token não expira, funciona em qualquer ambiente
2. **PHP via CLI**: Não depende de servidor HTTP, cada chamada é isolada
3. **Credenciais Hardcoded**: Se variáveis de ambiente forem erradas, usa Railway direto
4. **Sincronização Automática**: `sync-cron.js` sincroniza dados a cada 10 segundos
5. **Detecção de Ambiente**: Reconhece tanto `DB_*` quanto `MYSQL*` variables

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

---

## Changelog

| Data       | Mudança                                    |
|------------|---------------------------------------------|
| 03/02/2026 | Migração IMAP → Gmail API (OAuth 2.0)       |
| 01/02/2026 | PHP Bridge refatorado (arquivo temp)        |
| 31/01/2026 | Arquitetura PHP HTTP → CLI                  |
| 30/01/2026 | Suporte MYSQL* variables em produção        |
| 29/01/2026 | Remoção de duplicatas                       |
