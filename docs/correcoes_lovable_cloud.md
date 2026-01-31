# Correções Necessárias no Código ze-sync-mysql do Lovable Cloud

## 📋 Resumo

O VPS está enviando os dados corretamente. Porém, o código da Edge Function do Lovable precisa de ajustes para:
1. Usar o campo `delivery_tipo_pedido` em vez de `delivery_type` para mapear o tipo exato
2. Corrigir o mapeamento de status para "Retirada"
3. Garantir que os itens sejam salvos corretamente

---

## ✅ Dados que o VPS Envia (Corretos)

O VPS envia os seguintes campos relevantes:

```json
{
  "delivery_tipo_pedido": "Pedido Comum" | "Pedido Turbo" | "Pedido de Retirada",
  "delivery_type": "Pedido Comum" | "Pedido Turbo" | "Pedido de Retirada",
  "status": 0 | 1 | 2 | 3 | 4 | 5,
  "status_text": "Pendente" | "Entregue" | "Aceito" | "A Caminho" | "Cancelado" | "Rejeitado",
  "payment_method": "Online Pix" | "Cartão" | "Dinheiro" | "Maquininha" | "Online",
  "items": [...array de itens...],
  "items_count": 8,
  "has_items": true
}
```

---

## 🔧 Correção 1: Mapeamento de Tipo de Pedido

### Problema Atual:
A função `mapZeDeliveryType` espera "retirada" mas o VPS envia "Pedido de Retirada":

```javascript
// CÓDIGO ATUAL (errado)
if (lower.includes('retirada') || lower.includes('pickup')) {
```

### Solução:
O código já funciona porque `"pedido de retirada".includes('retirada')` é true. **Está correto!**

---

## 🔧 Correção 2: Usar `delivery_tipo_pedido` como Fonte Principal

### Código Atual:
```javascript
const deliveryTypeRaw = pedido.delivery_type || pedido.delivery_tipo_pedido || '';
```

### Correção Sugerida:
```javascript
// Priorizar delivery_tipo_pedido que tem o valor exato do banco
const deliveryTypeRaw = pedido.delivery_tipo_pedido || pedido.delivery_type || '';
```

---

## 🔧 Correção 3: Mapeamento de Status para Retirada

### Problema Atual:
Quando `isPickup = true` e status = 3 (A Caminho), o código retorna "preparing":

```javascript
case 3: // A Caminho
  return isPickup ? "preparing" : "shipped";
```

### Análise:
- Para **entrega comum**: A Caminho → "shipped" (Em Rota) ✅
- Para **retirada**: A Caminho → "preparing" (Em Separação) ✅ 

**Está correto!** Porque retirada nunca deve ir para "Em Rota" - o cliente é quem busca.

### Porém, falta um status "Aguardando Retirada":
Se vocês tiverem um status `ready_for_pickup` no Lovable, ajustar para:

```javascript
case 3: // A Caminho
  if (isPickup) {
    return "ready_for_pickup"; // Aguardando cliente buscar
  }
  return "shipped";
```

---

## 🔧 Correção 4: Itens Vazios

### Problema:
Alguns pedidos chegam com `items: []` mesmo tendo dados.

### Causa Identificada:
O VPS tinha registros duplicados no banco - um com itens e outro sem. Isso foi corrigido na query SQL do VPS.

### Validação no Lovable:
Adicionar fallback para `items_json`:

```javascript
// Obter itens com fallback
const rawItems = pedido.items || [];
let items = convertItems(rawItems, String(rawId));

// Fallback: se items está vazio mas items_json existe
if (items.length === 0 && pedido.items_json) {
  try {
    const parsed = JSON.parse(pedido.items_json);
    items = convertItems(parsed, String(rawId));
    console.log(`🔄 Pedido ${rawId}: itens recuperados do items_json (${items.length})`);
  } catch (e) {
    console.warn(`⚠️ Pedido ${rawId}: falha ao parsear items_json`);
  }
}

// Log se ainda vazio
if (items.length === 0) {
  console.warn(`⚠️ Pedido ${rawId}: SEM ITENS! has_items=${pedido.has_items} items_count=${pedido.items_count}`);
}
```

---

## 🔧 Correção 5: Pagamento Online vs Físico

### Código Atual:
```javascript
const isOnlinePayment = 
  paymentLower.includes('online') ||
  paymentLower.includes('online nubank') ||
  paymentLower.includes('online pix') ||
  paymentLower === 'nubank';
```

### Valores Reais que o VPS Envia:
- `"Online Pix"` → Pagamento online (já pago) → `closed`
- `"Online"` → Pagamento online → `closed`
- `"Cartão"` → Maquininha física → `awaiting_closure`
- `"Dinheiro"` → Físico → `awaiting_closure`
- `"Maquininha"` → Físico → `awaiting_closure`

### O código atual está quase correto, mas:
- `"Cartão"` não entra como online (correto!)
- `"Online Pix"` entra como online (correto!)

**✅ Está funcionando corretamente!**

---

## 📊 Resumo das Correções Necessárias

| Item | Status | Ação |
|------|--------|------|
| Tipo de pedido | ✅ Funciona | Opcional: priorizar `delivery_tipo_pedido` |
| Status Retirada | ✅ Funciona | Opcional: usar `ready_for_pickup` se disponível |
| Itens vazios | ⚠️ Precisa | Adicionar fallback para `items_json` |
| Pagamento | ✅ Funciona | Nenhuma ação |

---

## 🚀 Código Atualizado Sugerido

### Função de mapeamento de tipo:
```javascript
const mapZeDeliveryType = (deliveryType: string | undefined | null): { deliveryTypeDb: string, isTurbo: boolean, isPickup: boolean } => {
  if (!deliveryType) return { deliveryTypeDb: 'delivery', isTurbo: false, isPickup: false };
  
  const lower = deliveryType.toLowerCase();
  
  // "Pedido de Retirada" ou "Retirada"
  if (lower.includes('retirada') || lower.includes('pickup')) {
    return { deliveryTypeDb: 'pickup', isTurbo: false, isPickup: true };
  }
  
  // "Pedido Turbo"
  if (lower.includes('turbo')) {
    return { deliveryTypeDb: 'delivery', isTurbo: true, isPickup: false };
  }
  
  // "Pedido Comum" (padrão)
  return { deliveryTypeDb: 'delivery', isTurbo: false, isPickup: false };
};
```

### Processamento de pedido:
```javascript
for (const pedido of pedidos) {
  // Usar delivery_tipo_pedido como fonte principal
  const deliveryTypeRaw = pedido.delivery_tipo_pedido || pedido.delivery_type || '';
  const { deliveryTypeDb, isTurbo, isPickup } = mapZeDeliveryType(deliveryTypeRaw);
  
  console.log(`📦 Pedido ${rawId}: tipo_pedido="${deliveryTypeRaw}" -> db="${deliveryTypeDb}" isPickup=${isPickup}`);
  
  // ... resto do código
}
```

---

## 📝 Dados de Teste

Para verificar o mapeamento, use estes pedidos de exemplo do VPS:

| external_id | delivery_tipo_pedido | status | payment_method | items_count |
|-------------|---------------------|--------|----------------|-------------|
| 843004193 | Pedido Comum | 1 (Entregue) | Cartão | 8 |
| 959816360 | Pedido de Retirada | 1 (Entregue) | Online Pix | 2 |
| 660482531 | Pedido Turbo | 1 (Entregue) | Online Pix | 4 |

---

*Documento atualizado em: 31 de Janeiro de 2026*
