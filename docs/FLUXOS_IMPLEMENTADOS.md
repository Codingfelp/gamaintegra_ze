# Arquitetura e Fluxos do Sistema - Integrador Ze Delivery

Esta documentacao explica em detalhes como o sistema funciona internamente.

---

## Indice

1. [Visao Geral da Arquitetura](#visao-geral-da-arquitetura)
2. [Fluxo de Captura de Pedidos](#fluxo-de-captura-de-pedidos)
3. [Fluxo de Aceite Automatico](#fluxo-de-aceite-automatico)
4. [Fluxo de Captura de Detalhes](#fluxo-de-captura-de-detalhes)
5. [Fluxo de Captura de Telefone](#fluxo-de-captura-de-telefone)
6. [Fluxo de Confirmacao de Retirada](#fluxo-de-confirmacao-de-retirada)
7. [Fluxo de Atualizacao de Status](#fluxo-de-atualizacao-de-status)
8. [Persistencia no Banco MySQL](#persistencia-no-banco-mysql)
9. [Comunicacao com Sistema Externo](#comunicacao-com-sistema-externo)

---

## Visao Geral da Arquitetura

### Componentes Principais

```
+-------------------------------------------------------------------+
|                        INTEGRADOR ZE DELIVERY                      |
+-------------------------------------------------------------------+
|                                                                    |
|  +----------------+     +----------------+     +----------------+  |
|  |    SCRAPER     |     |   INTEGRADOR   |     |    BACKEND     |  |
|  |   (Node.js)    |---->|     (PHP)      |---->|   (FastAPI)    |  |
|  +----------------+     +----------------+     +----------------+  |
|         |                      |                      |           |
|         v                      v                      v           |
|  +----------------+     +----------------+     +----------------+  |
|  | Ze Delivery    |     |    MySQL       |     |   Dashboard    |  |
|  | (Puppeteer)    |     |   (Railway)    |     |    (React)     |  |
|  +----------------+     +----------------+     +----------------+  |
|                                                       |           |
+-------------------------------------------------------|----------+
                                                        v
                                              +----------------+
                                              | SISTEMA EXTERNO|
                                              | (Webhooks/API) |
                                              +----------------+
```

### Responsabilidades de Cada Componente

| Componente | Arquivo(s) | Funcao |
|------------|------------|--------|
| Scraper Principal | `v1.js` | Monitora kanban, aceita pedidos |
| Scraper de Detalhes | `v1-itens.js` | Captura itens, telefone, endereco |
| Integrador | `ze_pedido*.php` | Processa dados, salva no MySQL |
| Backend | `server.py` | API REST, webhooks, dashboard |
| Dashboard | `frontend/` | Interface visual para gerenciar pedidos |

---

## Fluxo de Captura de Pedidos

Este e o fluxo principal que captura pedidos do Ze Delivery.

### Passo a Passo

```
1. Scraper (v1.js) inicia e abre navegador Puppeteer
                    |
                    v
2. Carrega cookies de sessao (cookies.json) para autenticar
                    |
                    v
3. Navega para seuze.ze.delivery/poc-orders (pagina do kanban)
                    |
                    v
4. Loop infinito a cada 30 segundos:
   |
   +---> Busca todos os cards de pedido nas colunas
   |
   +---> Para cada pedido encontrado:
         |
         +---> Extrai dados basicos (numero, nome, status, valor)
         |
         +---> Envia para Integrador PHP via HTTP POST
         |
         +---> Integrador salva/atualiza no MySQL
```

### Codigo Relevante

**v1.js** - Loop principal:
```javascript
// Loop principal de monitoramento
async function monitorarPedidos(page) {
    while (true) {
        // Buscar cards de pedido
        const pedidos = await page.evaluate(() => {
            const cards = document.querySelectorAll('[id^="link-to-order-"]');
            // ... extrai dados de cada card
        });
        
        // Enviar cada pedido para o integrador
        for (const pedido of pedidos) {
            await enviarParaIntegrador(pedido);
        }
        
        // Aguardar antes da proxima verificacao
        await sleep(30000);
    }
}
```

**php-bridge.js** - Comunicacao com integrador:
```javascript
// Envia dados para o integrador PHP
function enviarParaIntegrador(pedido) {
    return new Promise((resolve, reject) => {
        request.post({
            url: 'http://localhost/integrador/zeduplo/ze_pedido.php',
            form: {
                orderNumber: pedido.codigo,
                customerName: pedido.cliente,
                status: pedido.status,
                priceFormatted: pedido.valor
            }
        }, (err, resp, body) => {
            if (err) reject(err);
            else resolve(body);
        });
    });
}
```

**ze_pedido.php** - Salva no banco:
```php
// Recebe dados do scraper e salva no MySQL
$orderNumber = $_POST['orderNumber'];
$customerName = $_POST['customerName'];
$status = converterStatus($_POST['status']);

// Verifica se pedido existe
$existing = $db->query("SELECT * FROM delivery WHERE delivery_code = '$orderNumber'");

if ($existing->num_rows > 0) {
    // Atualiza pedido existente
    $db->query("UPDATE delivery SET delivery_name_cliente = '$customerName' WHERE delivery_code = '$orderNumber'");
} else {
    // Cria novo pedido
    $db->query("INSERT INTO delivery (delivery_code, delivery_name_cliente, delivery_status) VALUES (...)");
}
```
---
## Fluxo de Aceite Automatico

Aceita automaticamente pedidos que chegam na coluna "Novos".

### Passo a Passo

```
1. Scraper detecta pedido na coluna "Novos" (#kanban-column-body-new-orders)
                    |
                    v
2. Clica no card do pedido para abrir modal de detalhes
                    |
                    v
3. Modal abre, scraper busca botao "Aceitar" (#accept-button)
                    |
                    v
4. Clica no botao "Aceitar"
                    |
                    v
5. Verifica se pedido saiu da coluna "Novos"
                    |
                    v
6. Envia atualizacao de status para o integrador
```

### Seletores CSS Utilizados

| Elemento | Seletor |
|----------|---------|
| Coluna Novos | `#kanban-column-body-new-orders` |
| Card do Pedido | `#link-to-order-{codigo}` |
| Botao Aceitar | `#accept-button`, `[data-testid="accept-button"]` |

### Arquivo Responsavel

`/app/zedelivery-clean/auto-accept.js`

---

## Fluxo de Captura de Detalhes

O scraper v1-itens.js captura informacoes adicionais dos pedidos.

### O Que E Capturado

- Itens do pedido (produtos, quantidades, precos)
- Endereco completo (rua, bairro, cidade, CEP)
- Valores detalhados (subtotal, frete, taxa, desconto)
- Codigo de entrega
- Observacoes do cliente
- CPF do cliente

### Passo a Passo

```
1. Scraper (v1-itens.js) busca pedidos que precisam de detalhes
                    |
                    v
2. Para cada pedido, navega para pagina de detalhes (/order/{codigo})
                    |
                    v
3. Extrai dados da pagina:
   - Tabela de itens
   - Bloco de endereco
   - Valores financeiros
   - Codigo de entrega
                    |
                    v
4. Envia para Integrador PHP (ze_pedido_view.php)
                    |
                    v
5. Integrador salva detalhes nas tabelas:
   - delivery (dados principais)
   - delivery_itens (lista de produtos)
```

### Arquivo Responsavel

`/app/zedelivery-clean/v1-itens.js` - funcao `capturarDetalhes()`

---

## Fluxo de Captura de Telefone

A captura de telefone exige um fluxo especial pois o Ze Delivery oculta essa informacao.

### Por Que E Especial?

O Ze Delivery nao mostra o telefone diretamente. E necessario:
1. Clicar em "Ver telefone"
2. Informar um motivo para o contato
3. Confirmar o motivo
4. Ai sim o telefone aparece

### Passo a Passo Detalhado

```
1. Pedido esta na coluna "Em Separacao"
                    |
                    v
2. Scraper clica no card para abrir detalhes
                    |
                    v
3. Busca botao "Ver telefone" (#phone-unavailable)
                    |
                    v
4. Clica no botao - Modal "Qual e o motivo?" aparece
                    |
                    v
5. Seleciona "Problemas com a entrega" (#REASON_CATEGORY_DELIVERY_PROBLEM)
                    |
                    v
6. Opcoes expandem, seleciona "O entregador nao encontra o cliente"
   (#REASON_ITEM_DELIVERY_DOES_NOT_FIND_THE_CUSTOMER)
                    |
                    v
7. Clica em "Confirmar"
                    |
                    v
8. Modal "Dados para contato" aparece com telefone
                    |
                    v
9. Extrai numero abaixo de "Ligue para"
   Exemplo: "+55 (31) 99225-8713"
                    |
                    v
10. Salva telefone no banco (delivery.delivery_telefone)
```

### Seletores CSS Utilizados

| Elemento | Seletor |
|----------|---------|
| Botao Ver Telefone | `#phone-unavailable` |
| Problemas com Entrega | `#REASON_CATEGORY_DELIVERY_PROBLEM` |
| Entregador nao Encontra | `#REASON_ITEM_DELIVERY_DOES_NOT_FIND_THE_CUSTOMER` |
| Botao Confirmar | `hexa-v2-button` com texto "Confirmar" |

### Arquivo Responsavel

`/app/zedelivery-clean/phone-capture-v3.js`

### Problemas Comuns

**Telefone nao e capturado:**
- Os seletores CSS podem ter mudado (site atualizado)
- Inspecione o HTML do site e atualize os seletores no arquivo

---

## Fluxo de Confirmacao de Retirada

Para pedidos de retirada, o cliente pega o pedido na loja e fornece um codigo de 4 digitos.

### Passo a Passo

```
1. Sistema externo envia webhook com codigo:
   POST /api/webhook/confirmar-retirada
   {"order_id": "123456", "code": "1234"}
                    |
                    v
2. Backend recebe e dispara script Node.js
                    |
                    v
3. Script abre navegador e vai para o kanban
                    |
                    v
4. Encontra pedido na coluna "Em Separacao"
                    |
                    v
5. Clica no card do pedido - Modal abre com botoes:
   [Cancelar] [Imprimir] [Confirmar]
                    |
                    v
6. Clica em "Confirmar" - Novo modal abre com 4 inputs
                    |
                    v
7. Insere cada digito do codigo nos inputs:
   [1] [2] [3] [4]
                    |
                    v
8. Clica em "Confirmar" final
                    |
                    v
9. Pedido confirmado - Status muda para "Entregue"
```

### Arquivo Responsavel

- `/app/zedelivery-clean/confirm-pickup.js` - Logica de confirmacao
- `/app/zedelivery-clean/confirmar-retirada-cli.js` - CLI chamado pelo webhook

---

## Fluxo de Atualizacao de Status

### Como o Status E Atualizado

**Via Scraper (automatico):**
```
Scraper detecta mudanca no kanban
         |
         v
Envia para ze_pedido_view_status.php
         |
         v
PHP atualiza delivery.delivery_status
         |
         v
Webhook notifica sistema externo (se configurado)
```

**Via API (manual):**
```
Sistema externo chama:
POST /api/pedido/{id}/status
{"status": 3}
         |
         v
Backend atualiza MySQL diretamente
         |
         v
Webhook notifica (se configurado)
```

### Regra de Progressao

O sistema tem uma regra para NAO regredir status:
- Se pedido esta "Entregue", nao volta para "Aceito"
- Isso evita inconsistencias por delays do scraper

---

## Persistencia no Banco MySQL

### Tabela Principal: delivery

```sql
CREATE TABLE delivery (
    delivery_id INT PRIMARY KEY AUTO_INCREMENT,
    delivery_code VARCHAR(255),          -- Numero do pedido no Ze
    delivery_status INT,                  -- 0-6 (ver mapa de status)
    delivery_name_cliente VARCHAR(255),
    delivery_cpf_cliente VARCHAR(255),
    delivery_telefone VARCHAR(50),        -- Capturado pelo fluxo especial
    delivery_email_entregador VARCHAR(255),
    delivery_endereco_rota VARCHAR(255),
    delivery_endereco_complemento VARCHAR(255),
    delivery_endereco_bairro VARCHAR(255),
    delivery_endereco_cidade_uf VARCHAR(255),
    delivery_endereco_cep VARCHAR(20),
    delivery_codigo_entrega VARCHAR(60),  -- Codigo 4 digitos para retirada
    delivery_tipo_pedido VARCHAR(50),     -- "Pedido Comum" ou "Pedido Retirada"
    delivery_subtotal DOUBLE,
    delivery_frete DOUBLE,
    delivery_taxa_conveniencia DOUBLE,
    delivery_troco DOUBLE,
    delivery_desconto DOUBLE,
    delivery_desconto_descricao TEXT,
    delivery_total DOUBLE,
    delivery_forma_pagamento VARCHAR(255),
    delivery_obs TEXT,
    delivery_date_time DATETIME,
    delivery_data_hora_captura DATETIME,
    delivery_tem_itens INT,
    delivery_trash INT DEFAULT 0          -- 1 = deletado
);
```

### Tabela de Itens: delivery_itens

```sql
CREATE TABLE delivery_itens (
    delivery_itens_id INT PRIMARY KEY AUTO_INCREMENT,
    delivery_itens_id_delivery INT,       -- FK para delivery.delivery_id
    delivery_itens_descricao VARCHAR(255),
    delivery_itens_qtd VARCHAR(255),
    delivery_itens_valor_unitario DOUBLE,
    delivery_itens_valor_total DOUBLE
);
```

---

## Comunicacao com Sistema Externo

### Opcao 1: Webhooks (Recomendado)

O sistema pode enviar notificacoes automaticas quando algo muda.

**Configurar:**
```bash
curl -X POST "http://localhost:8001/api/webhooks/configurar" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://seu-sistema.com/webhook",
    "secret": "chave-secreta",
    "eventos": ["pedido.novo", "pedido.status"]
  }'
```

**Eventos enviados:**
- `pedido.novo` - Pedido novo capturado
- `pedido.status` - Status mudou
- `pedido.detalhes` - Telefone ou itens capturados
- `pedido.retirada_pendente` - Aguardando codigo

### Opcao 2: Polling (API)

Sistema externo consulta periodicamente:

```bash
# A cada 30 segundos, buscar pedidos novos
curl "http://localhost:8001/api/sync?desde=$(date -Iseconds -d '30 seconds ago')"
```

### Opcao 3: Acesso Direto ao MySQL

Se seu sistema externo tem acesso ao MySQL, pode consultar diretamente:

```sql
SELECT * FROM delivery 
WHERE delivery_data_hora_captura > NOW() - INTERVAL 5 MINUTE
ORDER BY delivery_id DESC;
```
---
## Manutencao do Sistema

### Quando os Seletores Quebram

O site do Ze Delivery atualiza frequentemente, quebrando seletores.

**Sintomas:**
- Aceite automatico para de funcionar
- Telefone nao e capturado
- Detalhes ficam vazios

**Como resolver:**
1. Acesse seuze.ze.delivery e faca login
2. Abra DevTools (F12)
3. Inspecione o elemento que parou de funcionar
4. Encontre o novo seletor (id, data-testid, classe)
5. Atualize o arquivo correspondente:
   - `auto-accept.js` - Aceite
   - `phone-capture-v3.js` - Telefone
   - `v1-itens.js` - Detalhes

### Logs Importantes

| Log | Localizacao |
|-----|-------------|
| Scraper v1 | `/app/logs/ze-v1-out.log` |
| Scraper v1-itens | `/app/logs/ze-v1-itens-out.log` |
| Backend | `/var/log/supervisor/backend.err.log` |
| Screenshots debug | `/app/logs/*.png` |

### Reiniciar Servicos

```bash
# Ver status
sudo supervisorctl status

# Reiniciar tudo
sudo supervisorctl restart all

# Reiniciar especifico
sudo supervisorctl restart ze-v1 ze-v1-itens
```
