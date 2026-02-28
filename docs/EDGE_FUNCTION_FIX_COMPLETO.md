# Correção Completa da Edge Function ze-sync-mysql

## Problema Atual

Quando o integrador captura/reprocessa detalhes de um pedido e envia para o Supabase, os seguintes dados **NÃO estão sendo atualizados** no registro existente:

1. **items** - Itens do pedido
2. **customer_phone** - Telefone do cliente
3. **delivery_address** - Endereço
4. **status** - Status do pedido
5. **pickup_code** - Código de entrega

A Edge Function atual só atualiza campos se estiverem vazios/nulos, mas deveria **sobrescrever** quando os novos dados são mais completos.

---

## CORREÇÃO NECESSÁRIA

### Localização no código da Edge Function

Procure pela seção de **UPDATE** (onde existe `existing` e `updateData`).

### ANTES (código atual problemático):

```javascript
// Verificar se deve atualizar items
const existingItemsEmpty = !existing.items || !Array.isArray(existing.items) || existing.items.length === 0;
const newItemsAvailable = items.length > 0;
const shouldUpdateItems = existingItemsEmpty && newItemsAvailable;

// Só atualiza se campo estiver vazio
if (customerPhone && !existing.customer_phone) {
  updateData.customer_phone = customerPhone;
}

if (deliveryAddress && !existing.delivery_address) {
  updateData.delivery_address = deliveryAddress;
}

if (pickupCode && !existing.pickup_code) {
  updateData.pickup_code = pickupCode;
}

// Status não é atualizado ou só atualiza se for "progressão"
```

### DEPOIS (código corrigido):

```javascript
// ============================================
// CORREÇÃO: SEMPRE ATUALIZAR QUANDO DADOS NOVOS SÃO MELHORES
// ============================================

// 1. ITEMS - Atualizar se novos items têm mais dados
const existingItemsCount = existing.items?.length || 0;
const newItemsCount = items.length;
const shouldUpdateItems = newItemsCount > 0 && (
  existingItemsCount === 0 ||           // Não tinha items
  newItemsCount > existingItemsCount || // Novos têm mais items
  body.force_update === true            // Forçar atualização
);

if (shouldUpdateItems) {
  updateData.items = items;
  console.log(`Pedido ${rawId}: atualizando items (${existingItemsCount} -> ${newItemsCount})`);
}

// 2. TELEFONE - Atualizar se vier no payload e for diferente/melhor
if (customerPhone && customerPhone !== existing.customer_phone) {
  updateData.customer_phone = customerPhone;
  console.log(`Pedido ${rawId}: atualizando telefone`);
}

// 3. ENDEREÇO - Atualizar se vier no payload e for mais completo
if (deliveryAddress && (!existing.delivery_address || 
    deliveryAddress.length > (existing.delivery_address?.length || 0))) {
  updateData.delivery_address = deliveryAddress;
  console.log(`Pedido ${rawId}: atualizando endereço`);
}

// 4. PICKUP_CODE - Atualizar se vier no payload e for diferente
if (pickupCode && pickupCode !== existing.pickup_code) {
  updateData.pickup_code = pickupCode;
  console.log(`Pedido ${rawId}: atualizando código entrega`);
}

// 5. STATUS - SEMPRE ATUALIZAR (crítico!)
const newStatus = parseInt(body.status || body.delivery_status) || 0;
const existingStatus = parseInt(existing.status) || 0;

// Atualizar status se:
// - Status novo é diferente do atual
// - OU force_update está habilitado
if (newStatus !== existingStatus || body.force_update) {
  updateData.status = newStatus;
  console.log(`Pedido ${rawId}: atualizando status (${existingStatus} -> ${newStatus})`);
}

// 6. OUTROS CAMPOS - Sempre atualizar se vierem no payload
if (body.delivery_subtotal !== undefined) {
  updateData.subtotal = parseFloat(body.delivery_subtotal) || existing.subtotal;
}
if (body.delivery_total !== undefined) {
  updateData.total = parseFloat(body.delivery_total) || existing.total;
}
if (body.delivery_email_entregador) {
  updateData.courier_email = body.delivery_email_entregador;
}
if (body.delivery_obs) {
  updateData.notes = body.delivery_obs;
}
```

---

## Resumo das Mudanças

| Campo | Antes | Depois |
|-------|-------|--------|
| **items** | Só atualiza se vazio | Atualiza se novos > existentes |
| **customer_phone** | Só atualiza se null | Atualiza se diferente |
| **delivery_address** | Só atualiza se null | Atualiza se mais completo |
| **pickup_code** | Só atualiza se null | Atualiza se diferente |
| **status** | Não atualiza ou só progressão | **SEMPRE atualiza** |
| **subtotal/total** | Não atualiza | Atualiza se vier no payload |
| **courier_email** | Não atualiza | Atualiza se vier no payload |

---

## Como Aplicar

1. Acesse **Supabase Dashboard** → seu projeto
2. Vá em **Edge Functions** → **ze-sync-mysql**
3. Clique em **Edit** ou abra no editor
4. Encontre a seção de UPDATE (onde `existing` e `updateData` são usados)
5. Substitua a lógica de verificação conforme mostrado acima
6. Clique em **Deploy**

---

## Teste Após Aplicar

1. No sistema local, reprocesse um pedido que está no Supabase
2. Verifique no Supabase se:
   - Items foram atualizados
   - Telefone foi atualizado (se capturado)
   - Status foi atualizado
3. Verifique os logs da Edge Function para ver as mensagens de "atualizando"

---

## Importante

O payload enviado pelo sistema local inclui `force_update: true`, então a Edge Function DEVE respeitar esse flag e atualizar os campos mesmo que já existam dados.

O campo `status` é **CRÍTICO** - se o pedido muda de "Aceito" (2) para "A Caminho" (3) no Zé Delivery, essa mudança DEVE refletir no Supabase.
