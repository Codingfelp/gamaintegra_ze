# Documentacao Completa da API - Integrador Ze Delivery

Esta documentacao unifica todas as APIs disponiveis no sistema e explica como utiliza-las.

---

## Indice

1. [Visao Geral](#visao-geral)
2. [API REST (FastAPI)](#api-rest-fastapi)
3. [API do Integrador PHP](#api-do-integrador-php)
4. [Webhooks](#webhooks)
5. [Exemplos de Integracao](#exemplos-de-integracao)

---

## Visao Geral

O sistema possui **duas APIs** que trabalham juntas:

| API | Tecnologia | Funcao |
|-----|------------|--------|
| **API REST** | FastAPI (Python) | Consultas, acoes, webhooks |
| **API Integrador** | PHP | Recebe dados do scraper, salva no banco |

### Arquitetura

```
                                    SCRAPER
                                       |
                                       v
+------------------+          +------------------+          +------------------+
|  Site Ze Delivery |  -----> |   v1.js          |  -----> |  Integrador PHP  |
|  seuze.ze.delivery|         |   v1-itens.js    |         |  ze_pedido.php   |
+------------------+          +------------------+          +------------------+
                                                                    |
                                                                    v
                                                           +------------------+
                                                           |  MySQL (Railway) |
                                                           |  Tabela: delivery|
                                                           +------------------+
                                                                    |
                              +-------------------------------------+
                              |
                              v
+------------------+          +------------------+          +------------------+
|  SEU SISTEMA     | <------> |  API REST        | <------> |  Dashboard       |
|  (Supabase, ERP) |          |  FastAPI         |          |  React           |
+------------------+          +------------------+          +------------------+
```

---

## API REST (FastAPI)

Base URL: `http://localhost:8001` (desenvolvimento) ou sua URL de producao.

### Endpoints de Consulta

#### Listar Pedidos
```http
GET /api/pedidos
```

**Parametros de query:**
| Parametro | Tipo | Descricao |
|-----------|------|-----------|
| `limit` | int | Maximo de resultados (padrao: 50) |
| `offset` | int | Pular N resultados (paginacao) |
| `status` | int | Filtrar por status (0-6) |
| `search` | string | Buscar por codigo, nome ou telefone |

**Exemplo:**
```bash
curl "http://localhost:8001/api/pedidos?limit=10&status=2"
```

**Resposta:**
```json
{
  "success": true,
  "data": [
    {
      "delivery_id": 162580,
      "delivery_code": "472230265",
      "delivery_name_cliente": "Joao Silva",
      "delivery_status": 2,
      "delivery_total": 45.99
    }
  ]
}
```

---

#### Buscar Pedido Completo
```http
GET /api/pedido/{numero_pedido}
```

Retorna TODOS os dados de um pedido especifico.

**Exemplo:**
```bash
curl "http://localhost:8001/api/pedido/472230265"
```

**Resposta:**
```json
{
  "success": true,
  "pedido": {
    "numero_pedido": "472230265",
    "id_interno": 162580,
    "status": {
      "codigo": 2,
      "descricao": "Aceito"
    },
    "cliente": {
      "nome": "Joao Silva",
      "cpf": "12345678900",
      "telefone": "+55 (31) 99225-8713"
    },
    "entregador": {
      "email": "entregador@email.com"
    },
    "endereco": {
      "logradouro": "Rua das Flores, 123",
      "complemento": "Apto 101",
      "bairro": "Centro",
      "cidade_uf": "Belo Horizonte MG",
      "cep": "30130-000"
    },
    "codigo_entrega": "1234",
    "tipo_pedido": "Pedido Comum",
    "itens": [
      {
        "descricao": "Cerveja Brahma 350ml",
        "quantidade": "12",
        "valor_unitario": 3.50,
        "valor_total": 42.00
      }
    ],
    "valores": {
      "subtotal": 42.00,
      "frete": 8.99,
      "taxa_conveniencia": 0.00,
      "troco": 0.00,
      "troco_para": 0.00,
      "desconto": 5.00,
      "desconto_descricao": "Cupom PROMO10",
      "total": 45.99
    },
    "forma_pagamento": "Cartao",
    "observacoes": "Deixar na portaria",
    "data_pedido": "2026-03-02T15:25:00",
    "data_captura": "2026-03-02T15:30:00",
    "tem_itens": true
  }
}
```

---

#### Sincronizar Pedidos (para sistemas externos)
```http
GET /api/sync
```

Endpoint otimizado para sistemas externos buscarem pedidos.

**Parametros:**
| Parametro | Descricao | Exemplo |
|-----------|-----------|---------|
| `desde` | Buscar pedidos desde timestamp | `?desde=2026-03-02T10:00:00` |
| `status` | Filtrar por status | `?status=2` |
| `limit` | Maximo de resultados | `?limit=50` |

**Exemplos:**
```bash
# Buscar ultimos 100 pedidos
curl "http://localhost:8001/api/sync?limit=100"

# Buscar pedidos desde uma data
curl "http://localhost:8001/api/sync?desde=2026-03-02T10:00:00"

# Buscar apenas pedidos aceitos
curl "http://localhost:8001/api/sync?status=2"
```

---

#### Mapa de Status
```http
GET /api/status-map
```

Retorna a tabela de codigos de status.

**Resposta:**
```json
{
  "success": true,
  "status_map": {
    "0": "Pendente",
    "1": "Entregue",
    "2": "Aceito",
    "3": "A caminho",
    "4": "Cancelado",
    "5": "Rejeitado",
    "6": "Expirado"
  }
}
```

---

### Endpoints de Acao

#### Atualizar Status do Pedido
```http
POST /api/pedido/{numero_pedido}/status
```

**Body:**
```json
{
  "status": 3,
  "observacao": "Saiu para entrega"
}
```

**Exemplo:**
```bash
curl -X POST "http://localhost:8001/api/pedido/472230265/status" \
  -H "Content-Type: application/json" \
  -d '{"status": 3, "observacao": "Saiu para entrega"}'
```

---

#### Confirmar Retirada (com codigo)
```http
POST /api/webhook/confirmar-retirada
```

Usado para confirmar pedidos de retirada com codigo de 4 digitos.

**Body:**
```json
{
  "order_id": "472230265",
  "code": "1234"
}
```

**Exemplo:**
```bash
curl -X POST "http://localhost:8001/api/webhook/confirmar-retirada" \
  -H "Content-Type: application/json" \
  -d '{"order_id": "472230265", "code": "1234"}'
```

---

#### Reprocessar Pedido
```http
POST /api/pedido/{numero_pedido}/reprocessar
```

Forca o scraper a capturar novamente os detalhes do pedido (telefone, itens, etc).

**Exemplo:**
```bash
curl -X POST "http://localhost:8001/api/pedido/472230265/reprocessar"
```

---

## API do Integrador PHP

O integrador PHP e chamado internamente pelo scraper. Voce normalmente nao precisa chamar esses endpoints diretamente, mas esta aqui a documentacao caso precise.

Base URL: `http://localhost:8080/integrador/zeduplo/`

### Criar/Atualizar Pedido Basico
```http
POST /integrador/zeduplo/ze_pedido.php?ide={hub_id}
Content-Type: application/x-www-form-urlencoded
```

**Parametros:**
| Campo | Tipo | Descricao |
|-------|------|-----------|
| `orderNumber` | string | Codigo do pedido |
| `orderDateTime` | string | Data/hora "DD/MM/YYYY - HH:MM" |
| `customerName` | string | Nome do cliente |
| `status` | string | "Pendente", "Aceito", "A caminho", "Entregue", "Cancelado" |
| `deliveryType` | string | "Comum", "Turbo", "Retirada" |
| `paymentType` | string | Forma de pagamento |
| `priceFormatted` | string | Valor "R$ 50,00" |

---

### Enviar Itens e Detalhes
```http
POST /integrador/zeduplo/ze_pedido_view.php
Content-Type: application/x-www-form-urlencoded
```

Processa itens, endereco e valores detalhados do pedido.

**Parametros principais:**
- `codeOrder`: Codigo do pedido
- `items[]`: Array de itens
- `address_*`: Campos de endereco
- `subtotal`, `delivery_fee`, `total`: Valores

---

### Atualizar Status
```http
POST /integrador/zeduplo/ze_pedido_view_status.php
Content-Type: application/x-www-form-urlencoded
```

**Parametros:**
- `codeOrder`: Codigo do pedido
- `status`: Novo status

---

## Webhooks

Configure webhooks para receber notificacoes em tempo real quando algo mudar.

### Configurar Webhook
```http
POST /api/webhooks/configurar
```

**Body:**
```json
{
  "url": "https://seu-sistema.com/webhook/ze-delivery",
  "secret": "sua-chave-secreta",
  "eventos": ["pedido.novo", "pedido.status", "pedido.detalhes", "pedido.retirada_pendente"]
}
```

**Eventos disponiveis:**
| Evento | Quando dispara |
|--------|----------------|
| `pedido.novo` | Pedido capturado pela primeira vez |
| `pedido.status` | Status do pedido mudou |
| `pedido.detalhes` | Telefone, itens ou outros detalhes atualizados |
| `pedido.retirada_pendente` | Pedido de retirada aguardando codigo |

### Outros endpoints de webhook
```http
GET  /api/webhooks/config     # Ver configuracao atual
POST /api/webhooks/desativar  # Desativar webhook
POST /api/webhooks/testar     # Enviar webhook de teste
```

### Payload Recebido

Quando um evento ocorre, seu sistema recebera um POST com:

```json
{
  "evento": "pedido.novo",
  "timestamp": "2026-03-02T15:30:00.000000",
  "pedido": {
    "numero_pedido": "472230265",
    "status": {"codigo": 2, "descricao": "Aceito"},
    "cliente": {"nome": "Joao", "cpf": "123", "telefone": "+55..."},
    "endereco": {...},
    "itens": [...],
    "valores": {...},
    "forma_pagamento": "Cartao",
    "data_pedido": "2026-03-02T15:25:00"
  },
  "extras": {
    "status_anterior": {"codigo": 0, "descricao": "Pendente"},
    "status_novo": {"codigo": 2, "descricao": "Aceito"}
  }
}
```

**Headers enviados:**
```
Content-Type: application/json
X-Webhook-Event: pedido.novo
X-Webhook-Timestamp: 2026-03-02T15:30:00.000000
X-Webhook-Secret: sua-chave-secreta
```

---

## Exemplos de Integracao

### PHP - Receber Webhook
```php
<?php
$payload = json_decode(file_get_contents('php://input'), true);
$evento = $payload['evento'];
$pedido = $payload['pedido'];

// Verificar secret
$secret_recebido = $_SERVER['HTTP_X_WEBHOOK_SECRET'] ?? '';
if ($secret_recebido !== 'sua-chave-secreta') {
    http_response_code(401);
    exit('Unauthorized');
}

switch ($evento) {
    case 'pedido.novo':
        salvar_pedido($pedido);
        break;
    case 'pedido.status':
        $status_novo = $payload['extras']['status_novo']['codigo'];
        atualizar_status($pedido['numero_pedido'], $status_novo);
        break;
    case 'pedido.retirada_pendente':
        notificar_codigo_retirada($pedido);
        break;
}

http_response_code(200);
echo json_encode(['success' => true]);
```

### Node.js - Receber Webhook
```javascript
const express = require('express');
const app = express();
app.use(express.json());

app.post('/webhook/ze', (req, res) => {
    const { evento, pedido, extras } = req.body;
    const secret = req.headers['x-webhook-secret'];
    
    if (secret !== 'sua-chave-secreta') {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    
    switch (evento) {
        case 'pedido.novo':
            console.log('Novo pedido:', pedido.numero_pedido);
            break;
        case 'pedido.status':
            console.log('Status mudou:', extras.status_novo.descricao);
            break;
    }
    
    res.json({ success: true });
});

app.listen(3000);
```

### Python - Buscar Pedidos
```python
import requests

API_URL = 'http://localhost:8001'

# Buscar pedidos aceitos
response = requests.get(f'{API_URL}/api/sync?status=2&limit=50')
data = response.json()

for pedido in data['pedidos']:
    print(f"Pedido #{pedido['numero_pedido']} - {pedido['cliente']['nome']}")
```

### cURL - Confirmar Retirada
```bash
curl -X POST "http://localhost:8001/api/webhook/confirmar-retirada" \
  -H "Content-Type: application/json" \
  -d '{"order_id": "472230265", "code": "1234"}'
```

---

## Codigos de Status

| Codigo | Status | Descricao |
|--------|--------|-----------|
| 0 | Pendente | Pedido recebido, aguardando aceite |
| 1 | Entregue | Pedido entregue ao cliente |
| 2 | Aceito | Pedido aceito, em preparacao |
| 3 | A caminho | Pedido saiu para entrega |
| 4 | Cancelado | Pedido cancelado |
| 5 | Rejeitado | Pedido rejeitado pela loja |
| 6 | Expirado | Pedido expirou sem aceite |
