# Documentação: Integração Sistema → Supabase

## Resumo

**NÃO é necessário alterar a Edge Function `ze-sync-mysql`.**

O sistema de push imediato (`supabase-push.js`) envia dados no **mesmo formato** que o `sync-cron.js` já utiliza.

---

## Como Funciona

### Fluxo de Dados

```
┌─────────────────────────────────────────────────────────────────────┐
│                        SISTEMA INTEGRADOR                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌────────────┐     ┌────────────┐     ┌──────────────────┐        │
│  │  v1.js     │────▶│ php-bridge │────▶│ supabase-push.js │        │
│  │ (scraper)  │     │    .js     │     │  (PUSH IMEDIATO) │        │
│  └────────────┘     └────────────┘     └──────────────────┘        │
│        │                  │                     │                   │
│        │                  │                     │                   │
│        ▼                  ▼                     │                   │
│  ┌────────────┐     ┌────────────┐              │                   │
│  │ v1-itens.js│────▶│   MySQL    │              │                   │
│  │ (detalhes) │     │  (Railway) │              │                   │
│  └────────────┘     └────────────┘              │                   │
│                           │                     │                   │
│                           ▼                     │                   │
│                    ┌────────────┐               │                   │
│                    │sync-cron.js│               │                   │
│                    │  (BACKUP)  │               │                   │
│                    └────────────┘               │                   │
│                           │                     │                   │
└───────────────────────────┼─────────────────────┼───────────────────┘
                            │                     │
                            └──────────┬──────────┘
                                       ▼
                         ┌─────────────────────────┐
                         │    Edge Function        │
                         │    ze-sync-mysql        │
                         │ (NÃO PRECISA ALTERAR)   │
                         └─────────────────────────┘
                                       │
                                       ▼
                         ┌─────────────────────────┐
                         │       SUPABASE          │
                         │    Tabela: orders       │
                         └─────────────────────────┘
```

---

## Configuração Atual

### Edge Function: `ze-sync-mysql`

**URL:**
```
https://uppkjvovtvlgwfciqrbt.supabase.co/functions/v1/ze-sync-mysql
```

**Autenticação:**
```
Authorization: Bearer ze-sync-2026-mmjjzahms6m1lxfwomn0q25kquc7eun8
```

**Método:** `POST`

---

## Formato do Payload (Igual para Push e Sync)

```json
{
  "pedidos": [
    {
      "id_local": 12345,
      "external_id": "123456789",
      "order_number": "123456789",
      "delivery_code": "1234",
      "pickup_code": "1234",
      "ide": "HUB_DELIVERY_IDE",
      "delivery_id": 12345,
      
      "customer_name": "João Silva",
      "customer_cpf": "12345678900",
      "customer_phone": "31999999999",
      
      "address": "Rua das Flores, 123",
      "address_complement": "Apt 101",
      "address_neighborhood": "Centro",
      "address_city": "Belo Horizonte - MG",
      "address_zip": "30130000",
      
      "status": 2,
      "delivery_status": 2,
      "status_text": "Aceito",
      
      "created_at": "2025-12-15T14:30:00",
      "delivery_date_time": "2025-12-15T14:30:00",
      "order_datetime": "2025-12-15T14:30:00",
      "captured_at": "2025-12-15T14:31:00",
      
      "subtotal": 42.00,
      "delivery_subtotal": 42.00,
      "discount": 5.00,
      "delivery_desconto": 5.00,
      "discount_description": "CUPOM10",
      "coupon_description": "CUPOM10",
      "delivery_fee": 7.99,
      "delivery_frete": 7.99,
      "total": 44.99,
      "delivery_total": 44.99,
      "convenience_fee": 0,
      
      "payment_method": "Cartão de Crédito",
      "delivery_forma_pagamento": "Cartão de Crédito",
      "change_for": 0,
      "change": 0,
      
      "delivery_type": "Pedido Comum",
      "delivery_tipo_pedido": "Pedido Comum",
      "courier_email": "entregador@email.com",
      "delivery_email_entregador": "entregador@email.com",
      
      "notes": "Sem cebola",
      
      "items": [
        {
          "id": 1,
          "nome": "Cerveja Brahma 350ml",
          "quantidade": 12,
          "preco_unitario": 3.50,
          "preco_total": 42.00,
          "codigo_ze": "SKU123",
          "imagem": "https://exemplo.com/img.jpg"
        }
      ],
      "items_json": "[...]",
      "items_count": 1,
      "has_items": true,
      
      "source": "ze-delivery",
      "synced_at": "2025-12-15T14:32:00Z",
      "push_immediate": true
    }
  ],
  "source": "gamatauri-ze-push",
  "timestamp": "2025-12-15T14:32:00Z",
  "force_update": true,
  "is_push": true
}
```

---

## Diferença entre Push e Sync

| Característica | Push Imediato | Sync Periódico |
|----------------|---------------|----------------|
| **Arquivo** | `supabase-push.js` | `sync-cron.js` |
| **Quando executa** | Imediatamente após evento | A cada 3 segundos |
| **Payload** | Mesmo formato | Mesmo formato |
| **Campo identificador** | `is_push: true` | `is_push: false` ou ausente |
| **Source** | `gamatauri-ze-push` | `gamatauri-ze` |
| **Latência** | ~2-3 segundos | Até 3 segundos + processamento |

---

## Códigos de Status

| Código | Status | Descrição |
|--------|--------|-----------|
| 0 | Pendente | Pedido criado, aguardando aceite |
| 1 | Entregue | Pedido finalizado |
| 2 | Aceito | Pedido confirmado pelo estabelecimento |
| 3 | A Caminho | Pedido saiu para entrega |
| 4 | Cancelado | Pedido cancelado |
| 5 | Rejeitado | Pedido rejeitado/expirado |

---

## Eventos que Disparam Push

### 1. Atualização de Status (v1.js → php-bridge.js)
Quando o scraper detecta mudança de status:
```
Pendente → Aceito → A Caminho → Entregue
```

### 2. Captura de Detalhes (v1-itens.js)
Quando o scraper captura:
- Telefone do cliente
- Itens do pedido
- Endereço completo
- CPF
- Valores financeiros

---

## Verificação

### Verificar se Push está funcionando

```bash
# Ver logs do push
tail -f /app/logs/supabase-push.log

# Ver logs do scraper (procurar por PUSH)
tail -f /app/logs/ze-v1-out.log | grep -i push
tail -f /app/logs/ze-v1-itens-out.log | grep -i push
```

### Verificar no Supabase

1. Acesse: **Supabase Dashboard** → **Edge Functions** → **ze-sync-mysql** → **Logs**
2. Procure por requisições com `source: "gamatauri-ze-push"`
3. Verifique se `is_push: true` está presente

### Testar manualmente

```bash
curl -X POST "https://uppkjvovtvlgwfciqrbt.supabase.co/functions/v1/ze-sync-mysql" \
  -H "Authorization: Bearer ze-sync-2026-mmjjzahms6m1lxfwomn0q25kquc7eun8" \
  -H "Content-Type: application/json" \
  -d '{
    "pedidos": [{
      "id_local": 99999,
      "external_id": "TESTE123",
      "order_number": "TESTE123",
      "customer_name": "Teste Push",
      "status": 0,
      "total": 10.00
    }],
    "source": "teste-manual",
    "timestamp": "'$(date -Iseconds)'",
    "force_update": true,
    "is_push": true
  }'
```

---

## Checklist de Configuração

- [x] Edge Function `ze-sync-mysql` implantada no Supabase
- [x] Chave `ZE_SYNC_KEY` configurada: `ze-sync-2026-mmjjzahms6m1lxfwomn0q25kquc7eun8`
- [x] URL configurada em `/app/bridge/.env`
- [x] `supabase-push.js` criado em `/app/zedelivery-clean/`
- [x] `php-bridge.js` integrado com push
- [x] `v1-itens.js` integrado com push
- [ ] Testar com pedido real

---

## Não é necessário alterar

1. **Edge Function `ze-sync-mysql`** - Formato já compatível
2. **Tabela `orders` no Supabase** - Recebe os mesmos campos
3. **Variáveis de ambiente** - Já configuradas

---

## Arquivos do Sistema

| Arquivo | Localização | Função |
|---------|-------------|--------|
| `supabase-push.js` | `/app/zedelivery-clean/` | Módulo de push imediato |
| `php-bridge.js` | `/app/zedelivery-clean/` | Bridge PHP + integração push |
| `v1.js` | `/app/zedelivery-clean/` | Scraper principal |
| `v1-itens.js` | `/app/zedelivery-clean/` | Scraper de detalhes |
| `sync-cron.js` | `/app/bridge/` | Sync periódico (backup) |
| `.env` | `/app/bridge/` | Configuração Supabase |
