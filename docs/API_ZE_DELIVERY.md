# API Zé Delivery - Documentação

Esta documentação descreve os endpoints de API para integração com o sistema Zé Delivery.

## Base URL

```
https://seu-dominio.com/api/ze
```

## Autenticação

Atualmente, os endpoints não requerem autenticação. Para adicionar segurança, configure um header `X-API-Key` no nginx ou adicione middleware no FastAPI.

---

## Endpoints

### 1. Webhook para Receber Pedidos

Recebe notificações de eventos de pedidos do Zé Delivery.

```http
POST /api/ze/webhook
Content-Type: application/json
```

**Corpo da Requisição:**
```json
{
  "orderNumber": "123456789",
  "status": "CREATED",
  "eventType": "ORDER_CREATED",
  "customer": {
    "name": "João Silva",
    "phone": "31999999999",
    "document": "12345678900"
  },
  "items": [
    {
      "name": "Cerveja Brahma 350ml",
      "quantity": 6,
      "unitPrice": { "amount": 3.99 },
      "totalPrice": { "amount": 23.94 },
      "imageUrl": "https://..."
    }
  ],
  "total": { "amount": 31.93 },
  "subtotal": { "amount": 23.94 },
  "deliveryFee": { "amount": 7.99 },
  "discount": { "amount": 0 },
  "payment": { "method": "CREDIT_CARD" },
  "deliveryType": "delivery",
  "deliveryAddress": {
    "street": "Rua das Flores, 123",
    "complement": "Apt 101",
    "neighborhood": "Centro",
    "city": "Belo Horizonte",
    "state": "MG",
    "zipCode": "30130-000"
  },
  "pickupCode": "1234",
  "observations": "Sem cebola"
}
```

**Eventos Suportados:**
| Evento | Descrição | Status no Sistema |
|--------|-----------|-------------------|
| `ORDER_CREATED` / `CREATED` | Novo pedido | 0 (Pendente) |
| `ORDER_CONFIRMED` / `CONFIRMED` | Pedido aceito | 2 (Aceito) |
| `ORDER_DISPATCHED` / `DISPATCHED` | Em entrega | 3 (A Caminho) |
| `ORDER_DELIVERED` / `DELIVERED` | Entregue | 1 (Entregue) |
| `ORDER_CANCELLED` / `CANCELLED` | Cancelado | 4 (Cancelado) |

**Resposta:**
```json
{
  "success": true,
  "action": "created",
  "order_number": "123456789",
  "status": 0,
  "message": "Pedido #123456789 processado via webhook"
}
```

---

### 2. Criar/Atualizar Pedido via API

Cria ou atualiza um pedido diretamente via API REST.

```http
POST /api/ze/orders
Content-Type: application/json
```

**Corpo da Requisição:**
```json
{
  "order_number": "123456789",
  "customer_name": "João Silva",
  "customer_phone": "31999999999",
  "customer_document": "12345678900",
  "status": 0,
  "total": 31.93,
  "subtotal": 23.94,
  "delivery_fee": 7.99,
  "discount": 0,
  "payment_method": "CREDIT_CARD",
  "delivery_type": "delivery",
  "address_street": "Rua das Flores, 123",
  "address_complement": "Apt 101",
  "address_neighborhood": "Centro",
  "address_city": "Belo Horizonte - MG",
  "address_zipcode": "30130-000",
  "pickup_code": "1234",
  "observations": "Sem cebola",
  "courier_email": "entregador@email.com",
  "items": [
    {
      "name": "Cerveja Brahma 350ml",
      "quantity": 6,
      "unit_price": 3.99,
      "total_price": 23.94,
      "image_url": "https://..."
    }
  ]
}
```

**Resposta:**
```json
{
  "success": true,
  "action": "created",
  "order_number": "123456789",
  "delivery_id": 1234
}
```

---

### 3. Listar Pedidos

Lista pedidos com filtros opcionais.

```http
GET /api/ze/orders?status=0&limit=50
```

**Parâmetros:**
| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `status` | int | Filtrar por status (0-5) |
| `limit` | int | Limite de resultados (default: 50) |

**Códigos de Status:**
| Código | Status |
|--------|--------|
| 0 | Pendente (CREATED) |
| 1 | Entregue (DELIVERED) |
| 2 | Aceito (CONFIRMED) |
| 3 | A Caminho (DISPATCHED) |
| 4 | Cancelado (CANCELLED) |
| 5 | Rejeitado (REJECTED) |

**Resposta:**
```json
{
  "success": true,
  "total": 2,
  "orders": [
    {
      "orderNumber": "123456789",
      "customerName": "João Silva",
      "customerPhone": "31999999999",
      "status": "CREATED",
      "statusCode": 0,
      "total": 31.93,
      "deliveryType": "delivery",
      "createdAt": "2025-12-15T10:30:00"
    }
  ]
}
```

---

### 4. Buscar Pedido por Número

Retorna detalhes completos de um pedido específico.

```http
GET /api/ze/orders/{order_number}
```

**Resposta:**
```json
{
  "success": true,
  "order": {
    "orderNumber": "123456789",
    "customerName": "João Silva",
    "customerPhone": "31999999999",
    "status": "CREATED",
    "total": 31.93,
    "items": [
      {
        "name": "Cerveja Brahma 350ml",
        "quantity": 6,
        "unitPrice": 3.99,
        "totalPrice": 23.94
      }
    ]
  }
}
```

---

### 5. Aceitar Pedido

Marca o pedido como aceito.

```http
POST /api/ze/orders/{order_number}/accept
Content-Type: application/json
```

**Corpo (opcional):**
```json
{
  "order_number": "123456789",
  "preparation_time": 30,
  "reason": "AUTO_ACCEPT"
}
```

**Resposta:**
```json
{
  "success": true,
  "order_number": "123456789",
  "status": 2,
  "message": "Pedido #123456789 aceito"
}
```

---

### 6. Despachar Pedido

Marca o pedido como "A Caminho".

```http
POST /api/ze/orders/{order_number}/dispatch?courier_email=entregador@email.com
```

**Resposta:**
```json
{
  "success": true,
  "order_number": "123456789",
  "status": 3,
  "message": "Pedido #123456789 despachado"
}
```

---

### 7. Marcar como Entregue

```http
POST /api/ze/orders/{order_number}/deliver
```

**Resposta:**
```json
{
  "success": true,
  "order_number": "123456789",
  "status": 1,
  "message": "Pedido #123456789 entregue"
}
```

---

### 8. Cancelar Pedido

```http
POST /api/ze/orders/{order_number}/cancel?reason=cliente_solicitou
```

**Resposta:**
```json
{
  "success": true,
  "order_number": "123456789",
  "status": 4,
  "message": "Pedido #123456789 cancelado"
}
```

---

## Exemplos de Uso

### cURL - Criar Pedido

```bash
curl -X POST "https://seu-dominio.com/api/ze/orders" \
  -H "Content-Type: application/json" \
  -d '{
    "order_number": "123456789",
    "customer_name": "João Silva",
    "customer_phone": "31999999999",
    "total": 50.00,
    "status": 0,
    "items": [
      {"name": "Cerveja Brahma", "quantity": 12, "unit_price": 3.50, "total_price": 42.00}
    ]
  }'
```

### cURL - Aceitar Pedido

```bash
curl -X POST "https://seu-dominio.com/api/ze/orders/123456789/accept"
```

### cURL - Listar Pedidos Pendentes

```bash
curl "https://seu-dominio.com/api/ze/orders?status=0&limit=10"
```

### Python

```python
import requests

API_URL = "https://seu-dominio.com/api/ze"

# Criar pedido
pedido = {
    "order_number": "123456789",
    "customer_name": "João Silva",
    "customer_phone": "31999999999",
    "total": 50.00,
    "status": 0
}
response = requests.post(f"{API_URL}/orders", json=pedido)
print(response.json())

# Aceitar pedido
response = requests.post(f"{API_URL}/orders/123456789/accept")
print(response.json())

# Listar pedidos
response = requests.get(f"{API_URL}/orders?status=0")
print(response.json())
```

### JavaScript

```javascript
const API_URL = 'https://seu-dominio.com/api/ze';

// Criar pedido
async function criarPedido(pedido) {
    const response = await fetch(`${API_URL}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pedido)
    });
    return response.json();
}

// Aceitar pedido
async function aceitarPedido(orderNumber) {
    const response = await fetch(`${API_URL}/orders/${orderNumber}/accept`, {
        method: 'POST'
    });
    return response.json();
}

// Listar pedidos
async function listarPedidos(status = null) {
    const url = status !== null 
        ? `${API_URL}/orders?status=${status}` 
        : `${API_URL}/orders`;
    const response = await fetch(url);
    return response.json();
}
```

---

## Configurando Webhook

Para receber notificações automáticas do Zé Delivery:

1. Acesse o painel de parceiros do Zé Delivery
2. Configure a URL do webhook: `https://seu-dominio.com/api/ze/webhook`
3. Selecione os eventos que deseja receber

Se o Zé Delivery não suportar webhooks nativos, use o serviço de polling:

```bash
# Iniciar serviço de polling
cd /app/ze-api
node polling-service.js
```

---

## Integração com Zé Delivery API Oficial

Se você tem acesso à API oficial do Zé Delivery:

1. Configure as credenciais em `/app/ze-api/ze-api-config.json`:
```json
{
  "client_id": "seu_client_id",
  "client_secret": "seu_client_secret",
  "merchant_id": "seu_merchant_id",
  "auto_accept": true,
  "polling_interval": 10
}
```

2. Inicie o serviço de polling para buscar pedidos automaticamente

---

## Suporte

Para dúvidas ou problemas, consulte:
- Documentação oficial Zé Delivery: https://seller-public-api.ze.delivery/docs
- Logs do sistema: `/app/logs/`
