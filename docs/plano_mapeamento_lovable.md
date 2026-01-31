# Plano de Mapeamento: Zé Delivery → Lovable Cloud

## Resumo Executivo

Este documento define como os dados do **Gamatauri Zé Integrador** devem ser mapeados para o sistema **Lovable Cloud** (Supabase). O objetivo é garantir que os pedidos do Zé Delivery apareçam corretamente no Kanban e nos relatórios.

---

## 1. Estrutura do Payload Enviado

A cada **10 segundos**, o sync envia um payload JSON para:
```
POST https://uylhfhbedjfhupvkrfrf.supabase.co/functions/v1/ze-sync-mysql
```

### Exemplo de Pedido:
```json
{
  "id_local": 160283,
  "external_id": "531988266",
  "ide": "68574bfcd23db02431da45861b60b35d",
  "customer_name": "Natalia",
  "customer_cpf": "12115017609",
  "address": "Rua Lincoln, 51",
  "address_complement": "Casa",
  "address_neighborhood": "Uniao",
  "address_city": "Belo Horizonte MG",
  "address_zip": "31170680",
  "status": 3,
  "status_text": "A Caminho",
  "created_at": "2026-01-30T20:45:14.000Z",
  "captured_at": "2026-01-30T23:46:14.000Z",
  "subtotal": 26.97,
  "discount": 1.00,
  "delivery_fee": 8.98,
  "total": 34.95,
  "convenience_fee": 0,
  "payment_method": "Cartão",
  "change_for": 0,
  "change": 0,
  "delivery_type": "Pedido Comum",
  "delivery_code": "EEN UB4 Q0Z Q",
  "courier_email": null,
  "notes": "Entregar na portaria",
  "items": [
    {
      "id": 309100,
      "nome": "Pepsi 2L",
      "quantidade": "1",
      "preco_unitario": 9.39,
      "preco_total": 9.39,
      "codigo_ze": "8885",
      "imagem": "https://..."
    }
  ],
  "items_json": "[...]",
  "items_count": 5,
  "source": "ze-delivery",
  "synced_at": "2026-01-31T00:35:15.081Z"
}
```

---

## 2. Mapeamento de Status

### Status do Zé Delivery (campo `status`):

| Código | Texto (`status_text`) | Descrição |
|--------|----------------------|-----------|
| 0 | Pendente | Pedido novo, aguardando aceitação |
| 2 | Aceito | Pedido aceito pela loja |
| 3 | A Caminho | Pedido em rota de entrega |
| 1 | Entregue | Pedido entregue ao cliente |
| 4 | Cancelado | Pedido cancelado |
| 5 | Rejeitado | Pedido rejeitado pela loja |

### Mapeamento para Lovable Cloud (CORRIGIDO):

```javascript
function mapZeStatusToLovable(pedido) {
  const status = pedido.status;
  const payment = pedido.payment_method?.toLowerCase() || '';
  const deliveryType = pedido.delivery_type?.toLowerCase() || '';
  const isRetirada = deliveryType.includes('retirada');
  const isPagamentoFisico = payment.includes('dinheiro') || payment.includes('maquininha');

  // Status 0: Pendente (novo pedido)
  if (status === 0) {
    return {
      lovable_status: 'pending',
      kanban_column: 'NOVOS PEDIDOS',
      action_needed: 'Aceitar ou rejeitar pedido'
    };
  }

  // Status 2: Aceito
  if (status === 2) {
    return {
      lovable_status: 'preparing',
      kanban_column: 'EM PREPARO',
      action_needed: 'Preparar pedido'
    };
  }

  // Status 3: A Caminho
  if (status === 3) {
    // RETIRADA NÃO VAI PARA "EM ROTA"!
    if (isRetirada) {
      return {
        lovable_status: 'ready_for_pickup',
        kanban_column: 'AGUARDANDO RETIRADA',
        action_needed: 'Aguardar cliente buscar'
      };
    }
    return {
      lovable_status: 'shipped',
      kanban_column: 'EM ROTA',
      action_needed: 'Aguardar entrega'
    };
  }

  // Status 1: Entregue
  if (status === 1) {
    // Se pagamento foi físico (dinheiro/maquininha), precisa acerto
    if (isPagamentoFisico) {
      return {
        lovable_status: 'awaiting_settlement',
        kanban_column: 'AGUARDANDO ACERTO',
        action_needed: 'Entregador deve acertar valores'
      };
    }
    // Pagamento online já foi fechado
    return {
      lovable_status: 'closed',
      kanban_column: 'FECHADOS',
      action_needed: null
    };
  }

  // Status 4 ou 5: Cancelado/Rejeitado
  if (status === 4 || status === 5) {
    return {
      lovable_status: 'cancelled',
      kanban_column: 'CANCELADOS',
      action_needed: null
    };
  }

  // Fallback
  return {
    lovable_status: 'unknown',
    kanban_column: 'OUTROS',
    action_needed: 'Verificar manualmente'
  };
}
```

---

## 3. Mapeamento de Tipo de Pedido

### Tipos do Zé Delivery (campo `delivery_type`):

| Valor | Descrição | Fluxo Especial |
|-------|-----------|----------------|
| `Pedido Comum` | Entrega normal | Fluxo padrão |
| `Pedido Turbo` | Entrega expressa | Mesma lógica, prioridade alta |
| `Retirada` | Cliente busca na loja | **NÃO vai para "Em Rota"** |

### Lógica para Tipo de Pedido:

```javascript
function getOrderType(deliveryType) {
  const type = (deliveryType || '').toLowerCase();
  
  if (type.includes('retirada')) {
    return {
      type: 'pickup',
      icon: '🏃',
      flow: 'Pendente → Aceito → Aguardando Retirada → Fechado'
    };
  }
  
  if (type.includes('turbo')) {
    return {
      type: 'express',
      icon: '⚡',
      flow: 'Pendente → Aceito → Em Preparo → Em Rota → Fechado/Acerto'
    };
  }
  
  return {
    type: 'standard',
    icon: '📦',
    flow: 'Pendente → Aceito → Em Preparo → Em Rota → Fechado/Acerto'
  };
}
```

---

## 4. Tratamento de Itens

### Problema Identificado:
Alguns pedidos chegavam com `items: []` vazio.

### Solução Implementada:
O sync agora envia os itens de **duas formas**:
1. `items` - Array de objetos (para uso direto)
2. `items_json` - String JSON (backup)
3. `items_count` - Número de itens (validação)

### Lógica de Fallback:

```javascript
function getOrderItems(pedido) {
  // Tentar array primeiro
  if (pedido.items && Array.isArray(pedido.items) && pedido.items.length > 0) {
    return pedido.items;
  }
  
  // Fallback para JSON string
  if (pedido.items_json) {
    try {
      const parsed = JSON.parse(pedido.items_json);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch (e) {
      console.error('Erro ao parsear items_json:', e);
    }
  }
  
  // Se ainda vazio, logar aviso
  console.warn(`Pedido ${pedido.external_id} sem itens! items_count: ${pedido.items_count}`);
  return [];
}
```

---

## 5. Colunas do Kanban Sugeridas

| Coluna | Status Lovable | Descrição |
|--------|---------------|-----------|
| **NOVOS** | `pending` | Pedidos aguardando aceitação |
| **PREPARO** | `preparing` | Pedidos sendo preparados |
| **RETIRADA** | `ready_for_pickup` | Retiradas aguardando cliente |
| **EM ROTA** | `shipped` | Entregas em andamento |
| **ACERTO** | `awaiting_settlement` | Aguardando acerto de dinheiro |
| **FECHADOS** | `closed` | Pedidos finalizados |
| **CANCELADOS** | `cancelled` | Pedidos cancelados |

---

## 6. Campos Importantes

### Identificação:
- `external_id` - Código do pedido no Zé Delivery (use como chave única)
- `ide` - Hash interno
- `id_local` - ID no banco MySQL local

### Cliente:
- `customer_name` - Nome
- `customer_cpf` - CPF (para notas fiscais)

### Endereço:
- `address` - Rua e número
- `address_complement` - Complemento
- `address_neighborhood` - Bairro
- `address_city` - Cidade/UF
- `address_zip` - CEP

### Valores:
- `subtotal` - Valor dos produtos
- `discount` - Desconto aplicado
- `delivery_fee` - Taxa de entrega
- `convenience_fee` - Taxa de conveniência
- `total` - Valor total

### Pagamento:
- `payment_method` - Forma: "Cartão", "Dinheiro", "Pix", "Maquininha"
- `change_for` - Troco para (se dinheiro)
- `change` - Valor do troco

### Entrega:
- `delivery_type` - Tipo: "Pedido Comum", "Pedido Turbo", "Retirada"
- `delivery_code` - Código de rastreio
- `courier_email` - Email do entregador (se disponível)

---

## 7. Exemplo de Edge Function (Supabase)

```typescript
// supabase/functions/ze-sync-mysql/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { pedidos } = await req.json()
  
  const results = { synced: 0, updated: 0, errors: [] }
  
  for (const pedido of pedidos) {
    try {
      // Mapear status
      const statusMap = mapZeStatusToLovable(pedido)
      
      // Obter itens com fallback
      const items = getOrderItems(pedido)
      
      // Preparar dados para upsert
      const orderData = {
        external_id: pedido.external_id,
        customer_name: pedido.customer_name,
        customer_cpf: pedido.customer_cpf,
        address: `${pedido.address}, ${pedido.address_complement} - ${pedido.address_neighborhood}`,
        city: pedido.address_city,
        zip: pedido.address_zip,
        status: statusMap.lovable_status,
        order_type: getOrderType(pedido.delivery_type).type,
        payment_method: pedido.payment_method,
        subtotal: pedido.subtotal,
        discount: pedido.discount,
        delivery_fee: pedido.delivery_fee,
        total: pedido.total,
        items: items,
        delivery_code: pedido.delivery_code,
        notes: pedido.notes,
        created_at: pedido.created_at,
        synced_at: new Date().toISOString()
      }
      
      // Upsert no banco
      const { error } = await supabase
        .from('orders')
        .upsert(orderData, { 
          onConflict: 'external_id',
          ignoreDuplicates: false 
        })
      
      if (error) throw error
      results.synced++
      
    } catch (err) {
      results.errors.push(`${pedido.external_id}: ${err.message}`)
    }
  }
  
  return new Response(JSON.stringify(results), {
    headers: { 'Content-Type': 'application/json' }
  })
})
```

---

## 8. Checklist de Implementação

- [ ] Criar tabela `orders` no Supabase com todos os campos
- [ ] Implementar Edge Function `ze-sync-mysql`
- [ ] Adicionar mapeamento de status correto
- [ ] Tratar fallback de itens (`items` → `items_json`)
- [ ] **RETIRADA não vai para "Em Rota"** - vai para "Aguardando Retirada"
- [ ] **ENTREGUE com dinheiro** vai para "Aguardando Acerto"
- [ ] Configurar Kanban com as colunas corretas
- [ ] Testar com pedidos reais

---

## 9. Contato

Para dúvidas técnicas sobre o payload enviado, verificar:
- Logs: `/app/logs/ze-sync-out.log`
- Payload de debug: `/app/logs/sync-payload.json`

---

*Documento criado em: 31 de Janeiro de 2026*
*Versão: 1.0*
