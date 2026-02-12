# Instruções para Adicionar Descrição do Cupom

## Resumo das Alterações

O scraper (`v1-itens.js`) agora captura um novo campo: **`cupomDescricao`**

Este campo contém a descrição completa do cupom quando aplicado ao pedido, por exemplo:
- "Válido para compras acima de R$80, e desconto limitado a R$20. Limite de 1.500 usos do cupom."

---

## 1. Alterações no ze-sync-mysql (Sistema Externo)

### 1.1 Adicionar o campo ao objeto de pedido

No arquivo `ze-sync-mysql.ts` ou equivalente, localize a seção onde os campos do pedido são extraídos e adicione:

```typescript
// Após a linha com 'convenienceFee':
const convenienceFee = sanitizeNumber(pedido.convenience_fee ?? pedido.delivery_taxa_conveniencia);

// Adicionar esta linha:
const couponDescription = sanitizeText(pedido.coupon_description ?? pedido.cupomDescricao ?? pedido.delivery_cupom_descricao, 500) || null;
```

### 1.2 Incluir no INSERT/UPDATE do Supabase

No objeto de inserção ou atualização, adicione o novo campo:

```typescript
// No objeto de inserção:
const insertData = {
  // ... outros campos existentes
  discount: discount,
  coupon_description: couponDescription,  // NOVO CAMPO
  // ... resto dos campos
};
```

### 1.3 Verificar alterações para updates

Se você tiver lógica de detecção de mudanças, inclua o campo na verificação:

```typescript
// Adicionar na verificação de campos alterados:
if (existing.coupon_description !== couponDescription) {
  updateData.coupon_description = couponDescription;
}
```

---

## 2. Alterações no Banco de Dados Supabase

### 2.1 Adicionar coluna na tabela `orders`

Execute o seguinte SQL no Supabase SQL Editor:

```sql
-- Adicionar coluna coupon_description à tabela orders
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS coupon_description TEXT;

-- (Opcional) Adicionar comentário para documentação
COMMENT ON COLUMN orders.coupon_description IS 'Descrição do cupom aplicado ao pedido (ex: Válido para compras acima de R$80...)';
```

### 2.2 (Opcional) Criar índice para busca

Se você precisar buscar pedidos por cupom:

```sql
-- Índice para busca por texto (opcional)
CREATE INDEX IF NOT EXISTS idx_orders_coupon_description 
ON orders USING gin(to_tsvector('portuguese', coalesce(coupon_description, '')));
```

---

## 3. Alterações no MySQL Local (Railway)

Se você também salva no MySQL, execute:

```sql
-- Adicionar coluna na tabela delivery
ALTER TABLE delivery 
ADD COLUMN IF NOT EXISTS cupom_descricao TEXT 
AFTER delivery_desconto;

-- Ou se a tabela for orders:
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS coupon_description TEXT 
AFTER discount;
```

---

## 4. Verificação

Após fazer as alterações:

1. **Reinicie o sync**: `npm run sync` ou equivalente
2. **Verifique os logs**: Procure por `cupomDescricao` ou `coupon_description`
3. **Consulte o banco**: 
   ```sql
   SELECT external_id, discount, coupon_description 
   FROM orders 
   WHERE coupon_description IS NOT NULL 
   ORDER BY created_at DESC 
   LIMIT 10;
   ```

---

## 5. Formato do Campo

O scraper envia o campo como:
- **Nome no scraper**: `cupomDescricao`
- **Tipo**: String (texto)
- **Exemplo de valor**: `"Válido para compras acima de R$80, e desconto limitado a R$20. Limite de 1.500 usos do cupom."`
- **Quando vazio**: String vazia `""` ou `null`

---

## Resumo Rápido

| Local | Ação |
|-------|------|
| `ze-sync-mysql.ts` | Adicionar extração do campo `cupomDescricao` |
| Supabase | `ALTER TABLE orders ADD COLUMN coupon_description TEXT` |
| MySQL | `ALTER TABLE delivery ADD COLUMN cupom_descricao TEXT` |

Dúvidas? O campo já está sendo enviado pelo scraper - basta configurar o destino para recebê-lo!
