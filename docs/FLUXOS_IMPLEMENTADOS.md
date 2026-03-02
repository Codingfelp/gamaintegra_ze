# Documentação dos Fluxos Implementados

## 1. ACEITE AUTOMÁTICO DE PEDIDOS

### Fluxo
1. Pedido pendente chega na coluna "Novos" do kanban
2. O sistema clica no card do pedido para abrir o modal
3. Modal aberto, clica no botão "Aceitar"
4. Verifica se status mudou de "Pendente" para "Aceito"

### Seletores Utilizados
- Coluna Novos: `#kanban-column-body-new-orders`
- Botão Aceitar: `#accept-button`, `[data-testid="accept-button"]`
- Cards: `[id^="link-to-order-"]`

### Arquivo
`/app/zedelivery-clean/auto-accept.js`

---

## 2. CAPTURA DE TELEFONE DO CLIENTE

### Fluxo
1. Pedido aceito na coluna "EM SEPARAÇÃO" no kanban
2. Procurar elemento do botão de telefone (ícone + nome do cliente)
3. Clicar no botão para abrir modal "Qual é o motivo para o contato com o cliente?"
4. Selecionar "Problemas com a entrega" para expandir opções
5. Selecionar "O entregador não encontra o cliente"
6. Clicar em "Confirmar"
7. Capturar número abaixo de "Ligue para"

### Seletores Utilizados
- Coluna Em Separação: `#kanban-column-body-in-separation-orders`
- Problemas com entrega: `#REASON_CATEGORY_DELIVERY_PROBLEM`
- Entregador não encontra: `#REASON_ITEM_DELIVERY_DOES_NOT_FIND_THE_CUSTOMER`
- Botão confirmar: `hexa-v2-button` com texto "Confirmar"

### Arquivo
`/app/zedelivery-clean/phone-capture-v3.js`

---

## 3. CONFIRMAR RETIRADA

### Fluxo
1. Sistema externo envia webhook com `order_id` e `code` (4 dígitos)
2. Integrador clica no card do pedido de retirada na coluna "EM SEPARAÇÃO"
3. Abre modal do pedido com botões "Cancelar", "Imprimir", "Confirmar"
4. Clica em "Confirmar"
5. Abre modal com 4 inputs para o código
6. Insere cada dígito do código nos inputs
7. Clica em "Confirmar" novamente
8. Verifica se pedido foi confirmado (status: "Entregue")

### Arquivo
`/app/zedelivery-clean/confirm-pickup.js`

---

## ENDPOINT DE WEBHOOK

### URL
```
POST /api/webhook/confirmar-retirada
```

### Headers
```
Content-Type: application/json
```

### Body
```json
{
    "order_id": "472230265",
    "code": "1234",
    "webhook_secret": "opcional-para-seguranca"
}
```

### Resposta de Sucesso
```json
{
    "success": true,
    "message": "Confirmação de retirada do pedido #472230265 com código 1234 iniciada",
    "order_id": "472230265",
    "code_received": true
}
```

### Resposta de Erro
```json
{
    "success": false,
    "error": "code deve ter exatamente 4 dígitos numéricos"
}
```

---

## COMO INTEGRAR COM SISTEMA EXTERNO

### Exemplo em cURL
```bash
curl -X POST "https://seu-dominio.com/api/webhook/confirmar-retirada" \
  -H "Content-Type: application/json" \
  -d '{"order_id": "472230265", "code": "1234"}'
```

### Exemplo em PHP
```php
<?php
$payload = json_encode([
    'order_id' => '472230265',
    'code' => '1234'
]);

$ch = curl_init('https://seu-dominio.com/api/webhook/confirmar-retirada');
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);

$response = curl_exec($ch);
curl_close($ch);

echo $response;
```

### Exemplo em JavaScript (Node.js)
```javascript
const axios = require('axios');

async function confirmarRetirada(orderId, code) {
    try {
        const response = await axios.post(
            'https://seu-dominio.com/api/webhook/confirmar-retirada',
            { order_id: orderId, code: code }
        );
        console.log('Sucesso:', response.data);
    } catch (error) {
        console.error('Erro:', error.response?.data || error.message);
    }
}

confirmarRetirada('472230265', '1234');
```

### Exemplo em Python
```python
import requests

def confirmar_retirada(order_id, code):
    url = 'https://seu-dominio.com/api/webhook/confirmar-retirada'
    payload = {'order_id': order_id, 'code': code}
    
    response = requests.post(url, json=payload)
    return response.json()

result = confirmar_retirada('472230265', '1234')
print(result)
```
---
## NOTAS IMPORTANTES

1. **O código de 4 dígitos é OBRIGATÓRIO** - O webhook só funciona se você enviar o código junto com o order_id

2. **O scraper precisa estar logado** - O navegador do Zé Delivery precisa ter uma sessão ativa para executar as ações

3. **Tempo de processamento** - O webhook responde imediatamente, mas a confirmação acontece em background e pode levar alguns segundos

4. **Logs** - Verifique `/app/logs/ze-v1-itens-out.log` para acompanhar o processamento

5. **Screenshots de debug** - Screenshots são salvos em `/app/logs/pickup-step*.png` para debug
---
## ARQUITETURA DOS ARQUIVOS

```
/app/zedelivery-clean/
├── auto-accept.js           # Módulo de aceite automático
├── phone-capture-v3.js      # Módulo de captura de telefone (V3)
├── confirm-pickup.js        # Módulo de confirmação de retirada
├── confirmar-retirada-cli.js # CLI para webhook
├── v1.js                    # Script principal (usa auto-accept)
└── v1-itens.js              # Script de itens (usa phone-capture-v3)

/app/backend/
└── server.py                # API com endpoint de webhook
```
