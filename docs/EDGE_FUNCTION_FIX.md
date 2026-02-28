# Alteração Necessária na Edge Function ze-sync-mysql

## Problema Identificado

Quando um pedido é reprocessado, a Edge Function **não atualiza os items** porque a condição atual só atualiza se `existing.items` estiver vazio.

Se o pedido foi criado anteriormente com `items: []` (array vazio) ou com items incompletos, a Edge Function não sobrescreve porque considera que "já tem items".

## Solução

Alterar a lógica de `shouldUpdateItems` para também atualizar quando os novos items têm mais dados que os existentes.

### Localização no código:
Procure por esta linha (aproximadamente linha 395):

```javascript
const existingItemsEmpty = !existing.items || !Array.isArray(existing.items) || existing.items.length === 0;
const newItemsAvailable = items.length > 0;
const shouldUpdateItems = existingItemsEmpty && newItemsAvailable;
```

### Substitua por:

```javascript
const existingItemsEmpty = !existing.items || !Array.isArray(existing.items) || existing.items.length === 0;
const newItemsAvailable = items.length > 0;

// CORREÇÃO: Atualizar items se:
// 1. Items existentes estão vazios E novos items disponíveis
// 2. OU novos items têm MAIS itens que os existentes (reprocessamento)
// 3. OU force_update está habilitado no payload
const existingItemsCount = existing.items?.length || 0;
const newItemsCount = items.length;
const shouldUpdateItems = newItemsAvailable && (
  existingItemsEmpty || 
  newItemsCount > existingItemsCount ||
  body.force_update === true
);

if (shouldUpdateItems && newItemsCount > 0) {
  console.log(` Pedido ${rawId}: atualizando items (existentes: ${existingItemsCount}, novos: ${newItemsCount})`);
}
```

### Também adicione lógica para forçar atualização de outros campos:

Procure pela seção de UPDATE (aproximadamente linha 430-470) e altere:

**DE:**
```javascript
if (customerPhone && !existing.customer_phone) {
  updateData.customer_phone = customerPhone;
}
```

**PARA:**
```javascript
// CORREÇÃO: Sempre atualizar telefone se vier no payload e for diferente
if (customerPhone && customerPhone !== existing.customer_phone) {
  updateData.customer_phone = customerPhone;
  console.log(` Pedido ${rawId}: atualizando telefone -> ${customerPhone}`);
}
```

**E para endereço:**

**DE:**
```javascript
if (deliveryAddress && !existing.delivery_address) {
  updateData.delivery_address = deliveryAddress;
}
```

**PARA:**
```javascript
// CORREÇÃO: Atualizar endereço se vier no payload e for mais completo
if (deliveryAddress && (!existing.delivery_address || deliveryAddress.length > (existing.delivery_address?.length || 0))) {
  updateData.delivery_address = deliveryAddress;
  console.log(` Pedido ${rawId}: atualizando endereço`);
}
```

## Resumo das Alterações

| Campo | Antes | Depois |
|-------|-------|--------|
| items | Só atualiza se vazio | Atualiza se novos > existentes ou force_update |
| customer_phone | Só atualiza se null | Atualiza se diferente |
| delivery_address | Só atualiza se null | Atualiza se mais completo |
| pickup_code | Só atualiza se null | Atualiza se diferente |

## Como Aplicar

1. Acesse **Supabase Dashboard**
2. Vá em **Edge Functions** → **ze-sync-mysql**
3. Clique em **Edit**
4. Faça as alterações acima
5. Clique em **Deploy**

## Teste

Após aplicar, reprocesse o pedido #601363761 novamente e verifique se os items são atualizados.
