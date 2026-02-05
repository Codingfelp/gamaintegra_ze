# 📊 RELATÓRIO COMPLETO: Correção de Campos Faltantes - Zé Delivery

## 🎯 Resumo Executivo

Analisei os três componentes do sistema:
1. **CSV de Export** - Dados atuais no banco (problemas identificados)
2. **ze-sync-mysql.ts** - Edge Function que sincroniza dados
3. **order-details.tsx** - Frontend que exibe os dados

---

## 🔴 PROBLEMAS IDENTIFICADOS

### 1. Taxa de Conveniência (`convenience_fee`)
| Componente | Status | Problema |
|------------|--------|----------|
| CSV/Supabase | ❌ | Coluna provavelmente NÃO EXISTE |
| ze-sync-mysql | ❌ | Campo NÃO ERA mapeado (CORRIGIDO) |
| order-details | ❌ | Campo NÃO É exibido |

### 2. Número do Pedido (`order_number`)
| Componente | Status | Problema |
|------------|--------|----------|
| CSV/Supabase | ⚠️ | Muitos pedidos com valor "0" |
| ze-sync-mysql | ⚠️ | Usava `delivery_code` errado (CORRIGIDO) |
| order-details | ✅ | Exibe corretamente |

### 3. Nome do Entregador (`deliverer_name`)
| Componente | Status | Problema |
|------------|--------|----------|
| CSV/Supabase | ❌ | Campo VAZIO em quase todos |
| ze-sync-mysql | ⚠️ | Email era usado como nome (CORRIGIDO) |
| order-details | ✅ | Exibe corretamente quando há dados |

### 4. Endereço (`delivery_address`)
| Componente | Status | Problema |
|------------|--------|----------|
| CSV/Supabase | ⚠️ | Muitos com valor "0" |
| ze-sync-mysql | ⚠️ | Função buildFullAddress (CORRIGIDA) |
| order-details | ✅ | Exibe corretamente |

---

## ✅ CORREÇÕES JÁ APLICADAS

### Arquivo: `/app/ze-sync-mysql.ts`
```diff
+ // Taxa de conveniência - NOVO
+ const convenienceFee = sanitizeNumber(pedido.convenience_fee ?? pedido.delivery_taxa_conveniencia);

+ // Corrigido order_number para usar external_id
+ const orderNumber = sanitizeText(pedido.order_number || pedido.external_id || pedido.delivery_code, 50);

+ // Adicionado convenience_fee no insert
+ convenience_fee: convenienceFee,

+ // Função buildFullAddress refatorada para não retornar "0"
```

### Arquivo: `/app/bridge/sync-cron.js`
```diff
- deliverer_name: pedido.delivery_email_entregador || null,  // Email como nome
+ deliverer_name: null,  // Será preenchido via vinculação com deliverers
```

---

## 📋 AÇÕES NECESSÁRIAS

### 1. SUPABASE - Alterações na Tabela `orders`

Execute no SQL Editor do Supabase:

```sql
-- 1. Adicionar coluna convenience_fee se não existir
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS convenience_fee NUMERIC DEFAULT 0;

-- 2. Verificar estrutura atual
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'orders' 
AND column_name IN ('convenience_fee', 'order_number', 'deliverer_name', 'delivery_address', 'discount', 'delivery_fee');

-- 3. (Opcional) Corrigir pedidos antigos com order_number = "0"
-- Este UPDATE pega o código do external_order_id e coloca no order_number
UPDATE orders 
SET order_number = REPLACE(external_order_id, 'ze-', '')
WHERE order_number = '0' 
AND external_order_id LIKE 'ze-%';

-- 4. (Opcional) Corrigir endereços com valor "0"
UPDATE orders 
SET delivery_address = NULL 
WHERE delivery_address = '0';
```

### 2. SUPABASE - Deploy da Edge Function

1. Acesse: **Supabase Dashboard > Edge Functions > ze-sync-mysql**
2. Substitua o código pelo conteúdo de `/app/ze-sync-mysql.ts`
3. Clique em **Deploy**

### 3. FRONTEND - Adicionar exibição de `convenience_fee`

No arquivo `order-details.tsx`, adicione a exibição da taxa de conveniência.

**Localização sugerida**: Próximo ao `delivery_fee` (taxa de entrega)

```tsx
// Adicionar no estado inicial (linha ~150)
const [convenienceFee, setConvenienceFee] = useState('0');

// Adicionar na inicialização (dentro do useEffect que define estados)
setConvenienceFee(orderDataAny.convenience_fee?.toString() || '0');

// Adicionar na renderização (próximo à taxa de entrega)
{parseFloat(convenienceFee) > 0 && (
  <div className="flex justify-between text-sm">
    <span className="text-muted-foreground">Taxa de Conveniência:</span>
    <span>R$ {parseFloat(convenienceFee).toFixed(2)}</span>
  </div>
)}
```

---

## 📝 MELHORIAS RECOMENDADAS

### A. ze-sync-mysql.ts (Edge Function)

| Prioridade | Melhoria | Motivo |
|------------|----------|--------|
| 🔴 Alta | Adicionar logs para campos vazios | Debug de problemas futuros |
| 🟡 Média | Validar schema antes do insert | Evitar erros silenciosos |
| 🟢 Baixa | Adicionar retry em caso de falha | Resiliência |

### B. order-details.tsx (Frontend)

| Prioridade | Melhoria | Motivo |
|------------|----------|--------|
| 🔴 Alta | Exibir `convenience_fee` | Campo não aparece na UI |
| 🔴 Alta | Mostrar código de entrega separado | `pickup_code` vs `order_number` são diferentes |
| 🟡 Média | Validar campos obrigatórios | UX melhor ao salvar |
| 🟢 Baixa | Adicionar loading state nos campos | Feedback visual |

### C. Tabela orders (Supabase)

| Prioridade | Melhoria | Motivo |
|------------|----------|--------|
| 🔴 Alta | Criar índice em `external_order_id` | Performance de busca |
| 🟡 Média | Adicionar constraint NOT NULL em campos críticos | Integridade de dados |
| 🟢 Baixa | Criar view para pedidos Zé Delivery | Queries simplificadas |

```sql
-- Índice recomendado
CREATE INDEX IF NOT EXISTS idx_orders_external_order_id 
ON orders(external_order_id);

-- View recomendada
CREATE OR REPLACE VIEW ze_delivery_orders AS
SELECT 
  id,
  order_number,
  external_order_id,
  customer_name,
  delivery_address,
  delivery_fee,
  convenience_fee,
  discount,
  total,
  deliverer_name,
  status,
  created_at
FROM orders
WHERE source = 'ze-delivery';
```

---

## 🔄 FLUXO DE DADOS CORRIGIDO

```
┌─────────────────────────────────────────────────────────────────┐
│                    ZÉ DELIVERY (Website)                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  SCRAPER (v1.js) - Puppeteer                                    │
│  Campos capturados:                                             │
│  - delivery_code (número pedido)                                │
│  - delivery_codigo_entrega (código entrega)                     │
│  - delivery_taxa_conveniencia ✅                                │
│  - delivery_email_entregador                                    │
│  - delivery_frete, delivery_desconto                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  MYSQL (Railway) - Tabela delivery                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  BRIDGE (sync-cron.js) - A cada 3 segundos                      │
│  Payload enviado:                                               │
│  - order_number: delivery_code                                  │
│  - pickup_code: delivery_codigo_entrega                         │
│  - convenience_fee: delivery_taxa_conveniencia ✅               │
│  - courier_email: delivery_email_entregador                     │
│  - deliverer_name: null (não mais email) ✅                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  EDGE FUNCTION (ze-sync-mysql.ts) - Supabase                    │
│  Mapeamento CORRIGIDO:                                          │
│  - order_number ← order_number || external_id ✅                │
│  - convenience_fee ← convenience_fee ✅ (NOVO)                  │
│  - deliverer_name ← via email → deliverers table ✅             │
│  - delivery_address ← buildFullAddress() ✅ (CORRIGIDO)         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  POSTGRESQL (Supabase) - Tabela orders                          │
│  Campos:                                                        │
│  ✅ order_number                                                │
│  ✅ delivery_fee                                                │
│  ✅ discount                                                    │
│  ⚠️ convenience_fee (VERIFICAR SE EXISTE)                       │
│  ⚠️ deliverer_name (preenchido via vinculação)                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  FRONTEND (order-details.tsx)                                   │
│  Exibição:                                                      │
│  ✅ order_number                                                │
│  ✅ delivery_fee                                                │
│  ✅ discount                                                    │
│  ❌ convenience_fee (PRECISA ADICIONAR NA UI)                   │
│  ✅ deliverer_name                                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📌 CHECKLIST FINAL

- [ ] Executar SQL no Supabase para criar coluna `convenience_fee`
- [ ] Fazer deploy do `ze-sync-mysql.ts` corrigido
- [ ] Adicionar exibição de `convenience_fee` no `order-details.tsx`
- [ ] Testar com um novo pedido do Zé Delivery
- [ ] Verificar se campos aparecem corretamente no frontend

---

## 🔗 Arquivos de Referência

| Arquivo | Localização | Status |
|---------|-------------|--------|
| ze-sync-mysql.ts | `/app/ze-sync-mysql.ts` | ✅ CORRIGIDO |
| sync-cron.js | `/app/bridge/sync-cron.js` | ✅ CORRIGIDO |
| order-details.tsx | Lovable Cloud | ⚠️ PRECISA ATUALIZAR |
| PRD.md | `/app/memory/PRD.md` | ✅ ATUALIZADO |

---

*Relatório gerado em: 2026-02-05*
