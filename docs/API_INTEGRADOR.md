# API do Integrador Zé Delivery

Esta documentação descreve como sistemas externos podem consumir os dados do integrador através das APIs PHP existentes.

## Arquitetura

```
┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│  Site Zé Delivery   │────▶│  SCRAPER (v1.js)    │────▶│    MySQL (Railway)  │
│  seu.ze.delivery    │     │  (Puppeteer)        │     │    Tabela: delivery │
└─────────────────────┘     └─────────────────────┘     └─────────────────────┘
                                                                   │
                                                                   ▼
                                                        ┌─────────────────────┐
                                                        │  API PHP (integrador)│
                                                        │  ze_pedido*.php     │
                                                        └─────────────────────┘
                                                                   │
                                                                   ▼
                                                        ┌─────────────────────┐
                                                        │  SEU SISTEMA        │
                                                        │  (Consome a API)    │
                                                        └─────────────────────┘
```

## Base URL do Integrador

O integrador PHP está hospedado no Railway. As URLs dos endpoints são:

```
Base: https://seu-integrador.railway.app/integrador/zeduplo/
```

Ou localmente:
```
Base: http://localhost:8080/integrador/zeduplo/
```

---

## Endpoints Disponíveis

### 1. Listar Pedidos (GET)

**Não há endpoint GET nativo nos arquivos PHP.** O integrador foi projetado para receber dados do scraper (POST).

**Solução:** Use a API FastAPI do backend principal:

```http
GET /api/pedidos?limit=50&status=0&search=termo
```

### 2. Enviar/Atualizar Pedido Básico

Recebe dados de um pedido do scraper e cria/atualiza no banco.

```http
POST /integrador/zeduplo/ze_pedido.php?ide=HUB_DELIVERY_IDE
Content-Type: application/x-www-form-urlencoded
```

**Parâmetros:**
| Campo | Tipo | Descrição |
|-------|------|-----------|
| `orderNumber` | string | Código do pedido (ex: "123456789") |
| `orderDateTime` | string | Data/hora no formato "DD/MM/YYYY - HH:MM" |
| `customerName` | string | Nome do cliente |
| `status` | string | Status texto: "Pendente", "Aceito", "A caminho", "Entregue", "Cancelado" |
| `deliveryType` | string | Tipo: "Comum", "Turbo", "Retirada" |
| `paymentType` | string | Forma de pagamento |
| `priceFormatted` | string | Valor total formatado "R$ 50,00" |
| `delivererEmail` | string | Email do entregador (opcional) |
| `customerPhone` | string | Telefone do cliente (opcional) |
| `aceiteConfirmado` | bool | Flag especial para aceite automático |

**Exemplo cURL:**
```bash
curl -X POST "https://seu-integrador.railway.app/integrador/zeduplo/ze_pedido.php?ide=abc123" \
  -d "orderNumber=123456789" \
  -d "orderDateTime=15/12/2025 - 14:30" \
  -d "customerName=João Silva" \
  -d "status=Pendente" \
  -d "deliveryType=Comum" \
  -d "paymentType=Cartão Crédito" \
  -d "priceFormatted=R$ 50,00"
```

**Resposta:**
```json
{
  "id_pedido": "123456789",
  "created": true,
  "status": "0"
}
```

---

### 3. Enviar Itens e Detalhes do Pedido

Processa itens, endereço e valores financeiros detalhados.

```http
POST /integrador/zeduplo/ze_pedido_view.php
Content-Type: application/json
```

**Corpo JSON (array de objetos):**
```json
[
  {
    "id": "123456789",
    "tags": {
      "id": "SKU123",
      "nome": "Cerveja Brahma 350ml",
      "imagem": "https://exemplo.com/imagem.jpg",
      "quantidade": "6",
      "preco": "3.99",
      "precoTotal": "23.94"
    },
    "desconto": "5.00",
    "frete": "7.99",
    "cpfCliente": "123.456.789-00",
    "telefoneCliente": "31999999999",
    "emailEntregador": "entregador@email.com",
    "entregador": "João Entregador",
    "enderecoRota": "Rua das Flores, 123",
    "enderecoComplemento": "Apt 101",
    "enderecoBairro": "Centro",
    "enderecoCidadeUF": "Belo Horizonte - MG",
    "enderecoCep": "30130-000",
    "troco": "0",
    "trocoCliente": "0",
    "taxaConveniencia": "2.00",
    "subTotal": "23.94",
    "codigoEntrega": "1234",
    "obsPedido": "Sem cebola",
    "statusPedido": "Pedido Comum - Entregue",
    "tipoDelivery": "Comum",
    "cupomDescricao": "DESCONTO10"
  }
]
```

**Resposta:**
```json
{
  "success": true,
  "message": "Dados processados com sucesso",
  "timestamp": "2025-12-15 14:35:00"
}
```

---

### 4. Atualizar Status do Pedido

Atualiza apenas o status de pedidos existentes.

```http
POST /integrador/zeduplo/ze_pedido_view_status.php
Content-Type: application/json
```

**Corpo JSON:**
```json
[
  {
    "id": "123456789",
    "tags": {
      "id": "SKU123",
      "nome": "Cerveja Brahma 350ml",
      "quantidade": "6",
      "preco": "3.99"
    },
    "statusPedido": "Pedido Comum - Entregue"
  }
]
```

**Status aceitos:**
| Texto | Código |
|-------|--------|
| Pendente | 0 |
| Aceito | 2 |
| A caminho / Retirou | 3 |
| Entregue | 1 |
| Cancelado | 4 |
| Desconsiderado / Expirado | 5 |

**Resposta:**
```json
{
  "pedido": "123456789",
  "updated": true,
  "from": "2",
  "to": "1"
}
```

---

### 5. Processar Pedido por ID (Prioridade Telefone)

Processa pedidos específicos com prioridade para captura de telefone.

```http
POST /integrador/zeduplo/ze_pedido_id.php
Content-Type: application/json
```

Este endpoint é usado internamente pelo scraper `v1-itens.js` para buscar pedidos que precisam de processamento adicional.

---

## API REST Principal (Recomendada)

Para consumir dados de forma mais simples, use a API FastAPI do backend:

### Listar Pedidos

```http
GET /api/pedidos?limit=50&status=0&search=termo
```

**Parâmetros:**
| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `limit` | int | Quantidade máxima (default: 50) |
| `status` | int | Filtrar por status (0-5) |
| `search` | string | Buscar por código, nome ou telefone |

**Resposta:**
```json
{
  "success": true,
  "data": [
    {
      "delivery_id": 1,
      "delivery_code": "123456789",
      "delivery_name_cliente": "João Silva",
      "delivery_telefone": "31999999999",
      "delivery_status": 2,
      "delivery_total": 50.00,
      "delivery_date_time": "2025-12-15T14:30:00"
    }
  ]
}
```

### Buscar Pedido por ID

```http
GET /api/pedidos/{delivery_id}
```

### Reprocessar Pedido

```http
POST /api/pedidos/{delivery_code}/reprocessar
```

---

## Consumindo a API (Exemplos)

### Python

```python
import requests
import json

# URL do integrador
INTEGRADOR_URL = "https://seu-integrador.railway.app/integrador/zeduplo"

# 1. Enviar novo pedido
def criar_pedido(order_data):
    response = requests.post(
        f"{INTEGRADOR_URL}/ze_pedido.php?ide=HUB123",
        data=order_data
    )
    return response.json()

# 2. Enviar itens do pedido
def enviar_itens(items_data):
    response = requests.post(
        f"{INTEGRADOR_URL}/ze_pedido_view.php",
        json=items_data,
        headers={"Content-Type": "application/json"}
    )
    return response.json()

# 3. Atualizar status
def atualizar_status(order_id, novo_status):
    data = [{
        "id": order_id,
        "tags": {"id": "", "nome": "", "quantidade": "1", "preco": "0"},
        "statusPedido": novo_status
    }]
    response = requests.post(
        f"{INTEGRADOR_URL}/ze_pedido_view_status.php",
        json=data
    )
    return response.json()

# Exemplo de uso
pedido = {
    "orderNumber": "987654321",
    "orderDateTime": "15/12/2025 - 15:00",
    "customerName": "Maria Santos",
    "status": "Pendente",
    "deliveryType": "Turbo",
    "paymentType": "PIX",
    "priceFormatted": "R$ 75,50"
}
print(criar_pedido(pedido))

# Atualizar para "Entregue"
print(atualizar_status("987654321", "Pedido Turbo - Entregue"))
```

### JavaScript/Node.js

```javascript
const axios = require('axios');

const INTEGRADOR_URL = 'https://seu-integrador.railway.app/integrador/zeduplo';

// 1. Criar pedido
async function criarPedido(orderData) {
    const params = new URLSearchParams(orderData);
    const response = await axios.post(
        `${INTEGRADOR_URL}/ze_pedido.php?ide=HUB123`,
        params.toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    return response.data;
}

// 2. Enviar itens
async function enviarItens(itemsData) {
    const response = await axios.post(
        `${INTEGRADOR_URL}/ze_pedido_view.php`,
        itemsData
    );
    return response.data;
}

// 3. Atualizar status
async function atualizarStatus(orderId, novoStatus) {
    const data = [{
        id: orderId,
        tags: { id: '', nome: '', quantidade: '1', preco: '0' },
        statusPedido: novoStatus
    }];
    const response = await axios.post(
        `${INTEGRADOR_URL}/ze_pedido_view_status.php`,
        data
    );
    return response.data;
}

// Exemplo
(async () => {
    const pedido = {
        orderNumber: '111222333',
        orderDateTime: '15/12/2025 - 16:00',
        customerName: 'Pedro Costa',
        status: 'Aceito',
        deliveryType: 'Comum',
        paymentType: 'Dinheiro',
        priceFormatted: 'R$ 42,00'
    };
    
    console.log(await criarPedido(pedido));
    console.log(await atualizarStatus('111222333', 'Pedido Comum - A caminho'));
})();
```

### cURL

```bash
# Criar pedido
curl -X POST "https://seu-integrador.railway.app/integrador/zeduplo/ze_pedido.php?ide=HUB123" \
  -d "orderNumber=444555666" \
  -d "orderDateTime=15/12/2025 - 17:00" \
  -d "customerName=Ana Lima" \
  -d "status=Pendente" \
  -d "paymentType=Cartão" \
  -d "priceFormatted=R$ 30,00"

# Enviar itens (JSON)
curl -X POST "https://seu-integrador.railway.app/integrador/zeduplo/ze_pedido_view.php" \
  -H "Content-Type: application/json" \
  -d '[{"id":"444555666","tags":{"id":"P001","nome":"Skol 350ml","quantidade":"12","preco":"2.50","precoTotal":"30.00"},"frete":"0","desconto":"0","statusPedido":"Comum - Entregue"}]'

# Atualizar status
curl -X POST "https://seu-integrador.railway.app/integrador/zeduplo/ze_pedido_view_status.php" \
  -H "Content-Type: application/json" \
  -d '[{"id":"444555666","tags":{"id":"","nome":"","quantidade":"1","preco":"0"},"statusPedido":"Comum - Entregue"}]'
```

---

## Tabelas do Banco de Dados

### delivery (Pedidos)

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `delivery_id` | INT | ID único (auto-increment) |
| `delivery_code` | VARCHAR | Código do pedido do Zé |
| `delivery_name_cliente` | VARCHAR | Nome do cliente |
| `delivery_telefone` | VARCHAR | Telefone do cliente |
| `delivery_cpf_cliente` | VARCHAR | CPF do cliente |
| `delivery_status` | INT | 0=Pendente, 1=Entregue, 2=Aceito, 3=A Caminho, 4=Cancelado, 5=Rejeitado |
| `delivery_total` | DECIMAL | Valor total |
| `delivery_subtotal` | DECIMAL | Subtotal |
| `delivery_frete` | DECIMAL | Valor do frete |
| `delivery_desconto` | DECIMAL | Valor do desconto |
| `delivery_forma_pagamento` | VARCHAR | Método de pagamento |
| `delivery_tipo_pedido` | VARCHAR | Comum, Turbo, Retirada |
| `delivery_endereco_*` | VARCHAR | Campos de endereço |
| `delivery_email_entregador` | VARCHAR | Email/nome do entregador |
| `delivery_date_time` | DATETIME | Data/hora do pedido |

### delivery_itens (Itens dos Pedidos)

| Coluna | Tipo | Descrição |
|--------|------|-----------|
| `delivery_itens_id` | INT | ID único |
| `delivery_itens_delivery` | INT | FK para delivery |
| `delivery_itens_descricao` | VARCHAR | Nome do produto |
| `delivery_itens_qtd` | INT | Quantidade |
| `delivery_itens_valor_unitario` | DECIMAL | Preço unitário |
| `delivery_itens_valor_total` | DECIMAL | Preço total da linha |
| `delivery_itens_link_imagem` | VARCHAR | URL da imagem |

---

## Fluxo de Dados Recomendado

1. **Seu sistema faz polling** na API `/api/pedidos` a cada X segundos
2. **Compara** com pedidos já processados localmente
3. **Novos pedidos** são salvos no seu sistema
4. **Atualizações de status** são sincronizadas

Ou usando a abordagem de push:

1. **Configure um script** no seu servidor que chame os endpoints PHP
2. **Scraper envia dados** diretamente para o seu endpoint
3. **Seu sistema processa** os dados em tempo real

---

## Credenciais de Acesso ao Banco

```
Host: mainline.proxy.rlwy.net
Port: 52996
User: root
Password: eHeoVCebYyaJVBEBtCLfYNHgRCrxWVXU
Database: railway
```

**⚠️ ATENÇÃO:** Estas credenciais são de produção. Use com cuidado e não exponha publicamente.
