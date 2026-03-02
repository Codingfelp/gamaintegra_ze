# API para Sistema Externo - Integrador Zé Delivery

## Visão Geral

Esta API permite que seu sistema externo:
1. **Receba notificações** via webhook quando há novidades
2. **Busque dados** completos dos pedidos
3. **Atualize status** e execute ações nos pedidos

---

## 1. CONFIGURAÇÃO DO WEBHOOK

### Configurar URL do Webhook
```
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

**Eventos disponíveis:**
| Evento | Quando dispara |
|--------|----------------|
| `pedido.novo` | Pedido capturado pela primeira vez |
| `pedido.status` | Status do pedido mudou |
| `pedido.detalhes` | Telefone, itens ou outros detalhes atualizados |
| `pedido.retirada_pendente` | Pedido de retirada aguardando código de 4 dígitos |

### Ver Configuração Atual
```
GET /api/webhooks/config
```

### Desativar Webhook
```
POST /api/webhooks/desativar
```

### Testar Webhook
```
POST /api/webhooks/testar
```

---

## 2. PAYLOAD DO WEBHOOK

Quando um evento ocorre, seu sistema receberá:

```json
{
  "evento": "pedido.novo",
  "timestamp": "2026-03-02T15:30:00.000000",
  "pedido": {
    "numero_pedido": "472230265",
    "id_interno": 162580,
    "status": {
      "codigo": 2,
      "descricao": "Aceito"
    },
    "cliente": {
      "nome": "João Silva",
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
    "forma_pagamento": "Cartão",
    "observacoes": "Deixar na portaria",
    "data_pedido": "2026-03-02T15:25:00",
    "data_captura": "2026-03-02T15:30:00",
    "tem_itens": true
  },
  "extras": {
    "status_anterior": {"codigo": 0, "descricao": "Pendente"},
    "status_novo": {"codigo": 2, "descricao": "Aceito"}
  }
}
```

### Headers do Webhook
```
Content-Type: application/json
X-Webhook-Event: pedido.novo
X-Webhook-Timestamp: 2026-03-02T15:30:00.000000
X-Webhook-Secret: sua-chave-secreta
```

---

## 3. ENDPOINTS DE CONSULTA

### Buscar Pedido Completo
```
GET /api/pedido/{numero_pedido}
```

**Exemplo:** `GET /api/pedido/472230265`

### Sincronizar Pedidos (Catch-up)
```
GET /api/sync
```

**Parâmetros:**
| Parâmetro | Descrição | Exemplo |
|-----------|-----------|---------|
| `desde` | Buscar pedidos desde timestamp | `?desde=2026-03-02T10:00:00` |
| `status` | Filtrar por status | `?status=2` |
| `limit` | Máximo de resultados | `?limit=50` |

**Exemplos:**
```
GET /api/sync?limit=100
GET /api/sync?desde=2026-03-02T10:00:00
GET /api/sync?status=2&limit=20
```

### Mapa de Status
```
GET /api/status-map
```

**Resposta:**
```json
{
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

## 4. ENDPOINTS DE AÇÃO

### Atualizar Status do Pedido
```
POST /api/pedido/{numero_pedido}/status
```

**Body:**
```json
{
  "status": 3,
  "observacao": "Saiu para entrega"
}
```

### Confirmar Retirada (com código)
```
POST /api/webhook/confirmar-retirada
```

**Body:**
```json
{
  "order_id": "472230265",
  "code": "1234"
}
```

### Reprocessar Pedido
```
POST /api/pedido/{numero_pedido}/reprocessar
```

Força nova captura de detalhes (telefone, itens, código de entrega).

---

## 5. EXEMPLOS DE INTEGRAÇÃO

### cURL - Configurar Webhook
```bash
curl -X POST "https://seu-integrador.com/api/webhooks/configurar" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://meu-sistema.com/webhook/ze",
    "secret": "minha-chave-123"
  }'
```

### cURL - Buscar Pedidos Aceitos
```bash
curl "https://seu-integrador.com/api/sync?status=2&limit=50"
```

### cURL - Confirmar Retirada
```bash
curl -X POST "https://seu-integrador.com/api/webhook/confirmar-retirada" \
  -H "Content-Type: application/json" \
  -d '{"order_id": "472230265", "code": "1234"}'
```

### PHP - Receber Webhook
```php
<?php
// webhook-handler.php

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
        // Novo pedido chegou
        salvar_pedido($pedido);
        break;
        
    case 'pedido.status':
        // Status mudou
        $status_novo = $payload['extras']['status_novo']['codigo'];
        atualizar_status($pedido['numero_pedido'], $status_novo);
        break;
        
    case 'pedido.detalhes':
        // Detalhes atualizados (telefone, itens, etc)
        atualizar_detalhes($pedido);
        break;
        
    case 'pedido.retirada_pendente':
        // Pedido de retirada aguardando código
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
            console.log(`Novo pedido: #${pedido.numero_pedido}`);
            // Processar novo pedido
            break;
            
        case 'pedido.status':
            console.log(`Status mudou: ${extras.status_anterior.descricao} -> ${extras.status_novo.descricao}`);
            break;
            
        case 'pedido.retirada_pendente':
            console.log(`Retirada pendente: #${pedido.numero_pedido}`);
            // Enviar código de confirmação
            break;
    }
    
    res.json({ success: true });
});

app.listen(3000);
```

### Python - Polling de Sincronização
```python
import requests
import time

API_URL = 'https://seu-integrador.com'
ultimo_sync = '2026-03-02T00:00:00'

while True:
    response = requests.get(f'{API_URL}/api/sync?desde={ultimo_sync}&limit=100')
    data = response.json()
    
    for pedido in data['pedidos']:
        print(f"Pedido #{pedido['numero_pedido']} - {pedido['status']['descricao']}")
        processar_pedido(pedido)
    
    ultimo_sync = data['timestamp']
    time.sleep(30)  # Polling a cada 30 segundos
```

---

## 6. FLUXO RECOMENDADO

### Para receber pedidos em tempo real:
1. Configure o webhook com sua URL
2. Seu sistema recebe `pedido.novo` quando chega pedido
3. Seu sistema recebe `pedido.status` quando status muda
4. Seu sistema recebe `pedido.detalhes` quando telefone/itens são capturados

### Para sincronização inicial ou recuperação:
1. Use `GET /api/sync?limit=1000` para buscar todos os pedidos
2. Armazene o `timestamp` da resposta
3. Nas próximas chamadas, use `GET /api/sync?desde={timestamp}`

### Para confirmar retirada:
1. Seu sistema recebe `pedido.retirada_pendente`
2. Obtenha o código de 4 dígitos do cliente
3. Chame `POST /api/webhook/confirmar-retirada` com o código

---

## 7. CÓDIGOS DE STATUS

| Código | Status | Descrição |
|--------|--------|-----------|
| 0 | Pendente | Pedido recebido, aguardando aceite |
| 1 | Entregue | Pedido entregue ao cliente |
| 2 | Aceito | Pedido aceito, em preparação |
| 3 | A caminho | Pedido saiu para entrega |
| 4 | Cancelado | Pedido cancelado |
| 5 | Rejeitado | Pedido rejeitado pela loja |
| 6 | Expirado | Pedido expirou sem aceite |
