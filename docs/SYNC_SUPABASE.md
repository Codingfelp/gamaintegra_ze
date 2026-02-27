# Sistema de Sincronização Zé Delivery → Supabase

## Arquitetura de Sincronização

```
┌─────────────────────┐     ┌─────────────────────┐
│  Site Zé Delivery   │────▶│  SCRAPERS           │
│  seu.ze.delivery    │     │  v1.js / v1-itens.js│
└─────────────────────┘     └─────────────────────┘
                                     │
                                     ▼
                            ┌─────────────────────┐
                            │    MySQL (Railway)  │
                            │    Tabela: delivery │
                            └─────────────────────┘
                                     │
                    ┌────────────────┴────────────────┐
                    ▼                                 ▼
           PUSH IMEDIATO                      SYNC PERIÓDICO
        (novo - mais rápido)                (backup - existente)
                    │                                 │
                    ▼                                 ▼
        ┌─────────────────────┐          ┌─────────────────────┐
        │  supabase-push.js   │          │   sync-cron.js      │
        │  (após cada update) │          │   (cada 3 segundos) │
        └─────────────────────┘          └─────────────────────┘
                    │                                 │
                    └────────────────┬────────────────┘
                                     ▼
                            ┌─────────────────────┐
                            │  Edge Function      │
                            │  ze-sync-mysql      │
                            └─────────────────────┘
                                     │
                                     ▼
                            ┌─────────────────────┐
                            │     SUPABASE        │
                            │   Tabela: orders    │
                            └─────────────────────┘
```

## Dois Métodos de Sincronização

### 1. PUSH IMEDIATO (Novo - Recomendado)
**Quando:** Logo após cada atualização no scraper
**Como:** `supabase-push.js` envia dados direto para Edge Function
**Velocidade:** ~2-3 segundos após evento
**Ativação:** Integrado no `php-bridge.js` e `v1-itens.js`

**Eventos que disparam push:**
- Atualização de status (v1.js → php-bridge.js)
- Captura de detalhes/telefone (v1-itens.js)

### 2. SYNC PERIÓDICO (Existente - Backup)
**Quando:** A cada 3 segundos
**Como:** `sync-cron.js` consulta MySQL e envia mudanças
**Velocidade:** Até 3 segundos de delay
**Uso:** Backup caso o push falhe

## Configuração

### Variáveis de Ambiente (`/app/bridge/.env`)
```
LOVABLE_SUPABASE_URL=https://uppkjvovtvlgwfciqrbt.supabase.co
LOVABLE_ZE_SYNC_KEY=ze-sync-2026-mmjjzahms6m1lxfwomn0q25kquc7eun8
```

### URL da Edge Function
```
POST https://uppkjvovtvlgwfciqrbt.supabase.co/functions/v1/ze-sync-mysql
```

### Headers
```
Authorization: Bearer ze-sync-2026-mmjjzahms6m1lxfwomn0q25kquc7eun8
Content-Type: application/json
```

### Formato do Payload
```json
{
  "pedidos": [
    {
      "id_local": 12345,
      "external_id": "123456789",
      "order_number": "123456789",
      "customer_name": "João Silva",
      "customer_phone": "31999999999",
      "status": 2,
      "total": 50.00,
      "items": [
        {
          "nome": "Cerveja Brahma 350ml",
          "quantidade": 6,
          "preco_unitario": 3.99,
          "preco_total": 23.94
        }
      ]
    }
  ],
  "source": "gamatauri-ze-push",
  "timestamp": "2025-12-15T14:30:00Z",
  "force_update": true,
  "is_push": true
}
```

## Monitoramento

### Logs de Push
```bash
tail -f /app/logs/supabase-push.log
```

### Logs dos Scrapers
```bash
tail -f /app/logs/ze-v1-out.log
tail -f /app/logs/ze-v1-itens-out.log
```

### Logs do Sync-Cron
```bash
tail -f /app/logs/sync-cron.log
```

## Arquivos Principais

| Arquivo | Função |
|---------|--------|
| `/app/zedelivery-clean/supabase-push.js` | Módulo de push imediato |
| `/app/zedelivery-clean/php-bridge.js` | Bridge para PHP + integração push |
| `/app/zedelivery-clean/v1.js` | Scraper principal (aceite, status) |
| `/app/zedelivery-clean/v1-itens.js` | Scraper de detalhes (telefone, itens) |
| `/app/bridge/sync-cron.js` | Sync periódico (backup) |

## Solução de Problemas

### Push não está enviando
1. Verificar se `supabase-push.js` está sendo carregado:
   ```
   grep -i "supabase-push" /app/logs/ze-v1-out.log
   ```
2. Verificar erros de conexão:
   ```
   grep -i "erro\|error" /app/logs/supabase-push.log
   ```

### Dados atrasados no Supabase
1. Verificar se sync-cron está rodando:
   ```
   supervisorctl status sync-cron
   ```
2. Verificar payload:
   ```
   cat /app/logs/sync-payload.json
   ```

### Edge Function retornando erro
1. Verificar chave:
   ```
   grep ZE_SYNC_KEY /app/bridge/.env
   ```
2. Verificar no Supabase Dashboard → Edge Functions → ze-sync-mysql → Logs
