# Gamatauri Zé Integrador - PRD

## Status: ✅ FUNCIONANDO - GMAIL API IMPLEMENTADA

**Última atualização:** 03/02/2026 - Migração IMAP → Gmail API concluída

---

## 🎉 Migração P0 Concluída (03/02/2026)

### IMAP → Gmail API (OAuth 2.0)
- **Problema:** `php-imap` era instável em produção (causa raiz identificada pelo usuário)
- **Solução:** Gmail API REST com OAuth 2.0
- **Resultado:** 
  - Zero dependência de `php-imap`
  - Autenticação permanente via refresh_token
  - Resposta < 5 segundos (vs 60+ com IMAP)

### Credenciais OAuth
- **Client ID:** `187165168994-bn629eu6t7rb601v54i5j4q258hpcacm.apps.googleusercontent.com`
- **Refresh Token:** Armazenado em `ze_pedido_mail.php`

---

## Status Atual dos Serviços

- ✅ **MySQL**: Railway Cloud (`mainline.proxy.rlwy.net`)
- ✅ **PHP**: CLI mode com **Gmail API** (não mais IMAP)
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
