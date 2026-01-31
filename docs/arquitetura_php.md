# Arquitetura PHP do Sistema Zé Delivery

## Visão Geral

O PHP serve como **camada intermediária** entre os scrapers Node.js e o banco de dados MySQL (Railway). Ele roda em um servidor web (Apache no preview, PHP built-in em produção) na porta **8088**.

---

## Fluxo de Dados

```
┌─────────────────────┐      ┌───────────────────┐      ┌───────────────────┐
│  Scraper v1.js      │──────│  PHP (porta 8088) │──────│  MySQL (Railway)  │
│  (Puppeteer)        │ POST │  ze_pedido.php    │ SQL  │  Tabela: delivery │
└─────────────────────┘      └───────────────────┘      └───────────────────┘
        │
        │ 2FA Login
        ▼
┌─────────────────────┐
│  ze_pedido_mail.php │ ──── IMAP ──── Gmail (2FA code)
│  (PHP-IMAP)         │
└─────────────────────┘
```

---

## Endpoints PHP Críticos

### 1. `/zeduplo/ze_pedido.php` - Inserção de Pedidos
**Função:** Recebe dados do scraper e insere na tabela `ze_pedido`

**Parâmetros POST:**
- `orderNumber` - Código do pedido (ex: "736356187")
- `orderDateTime` - Data/hora (ex: "31/01/2026 - 19:29:31")
- `customerName` - Nome do cliente
- `status` - Status do pedido ("Aceito", "Entregue", "A caminho", etc)
- `deliveryType` - Tipo ("Comum", "Turbo", "Retirada")
- `paymentType` - Forma de pagamento
- `priceFormatted` - Valor total

**Fluxo interno:**
1. Processa pedidos pendentes em `ze_pedido` (pedido_st = 0)
2. Move para tabela `delivery` (tabela final)
3. Insere novo pedido recebido no POST

### 2. `/zeduplo/ze_pedido_mail.php` - Leitura 2FA (CRÍTICO!)
**Função:** Lê código de verificação do Gmail para login automático no Zé Delivery

**Dependência:** Extensão `php-imap`

**Resposta:**
```json
{"codigo":"302184"}  // Código 2FA encontrado
{"codigo":0}         // Nenhum código novo
```

**Por que é crítico?**
- Sem IMAP funcionando → Scraper não consegue fazer login
- Scraper fica em loop tentando login → "SEM PEDIDOS DISPONIVEIS"

### 3. `/zeduplo/ze_pedido_view.php` - Atualização de Pedidos
**Função:** Atualiza dados de pedidos existentes (status, endereço, CPF, itens)

---

## Tabelas do Banco de Dados

### `ze_pedido` (Tabela temporária)
- Recebe dados brutos do scraper
- `pedido_st = 0` → Pendente de processamento
- `pedido_st = 1` → Já processado para `delivery`

### `delivery` (Tabela final)
- Dados limpos e formatados
- Usada pelo dashboard e sync para Lovable Cloud

### `hub_delivery` (Configuração)
- Armazena token de autenticação (`e8194a871a0e6d26fe620d13f7baad86`)

---

## Por que PHP fica OFFLINE em Produção?

### Problema 1: Apache não funciona
O ambiente de produção Emergent **não suporta Apache** como serviço permanente. O Apache precisa de systemd/init que não existem no container.

**Solução:** Usar PHP built-in server (`php -S 0.0.0.0:8088`)

### Problema 2: php-imap não instalado
O container de produção é **limpo** a cada deploy. Dependências como `php-imap` não persistem.

**Solução:** Instalar no startup via `server.py`:
```bash
apt-get install -y php php-imap php-mysql
```

### Problema 3: Instalação assíncrona
O código antigo instalava dependências em **background** enquanto os scrapers já tentavam iniciar.

**Solução:** Em produção, instalar **síncronamente** ANTES de iniciar scrapers.

---

## Como Testar PHP

```bash
# Verificar se IMAP funciona
curl http://localhost:8088/zeduplo/ze_pedido_mail.php
# Esperado: {"codigo":"XXXXXX"} ou {"codigo":0}

# Verificar se ze_pedido.php responde
curl "http://localhost:8088/zeduplo/ze_pedido.php?ide=e8194a871a0e6d26fe620d13f7baad86" -X POST
# Esperado: resposta vazia (processa pedidos pendentes)

# Verificar módulo IMAP
php -m | grep imap
# Esperado: imap
```

---

## Bugs Corrigidos Nesta Sessão

1. **php-imap não instalado** → Instalado manualmente e adicionado ao startup
2. **delivery_id duplicado** → Removido assignment manual (é auto-incremento)
3. **Duplicatas no banco** → Adicionada verificação antes de inserir + limpeza

---

## Arquivos PHP Principais

```
/app/integrador/zeduplo/
├── ze_pedido.php          # Inserção de pedidos
├── ze_pedido_mail.php     # Leitura 2FA (IMAP)
├── ze_pedido_view.php     # Atualização de pedidos
├── ze_pedido_id.php       # Busca próximo pedido para processar
├── ze_pedido_status.php   # Busca pedido para atualizar status
├── _class/
│   ├── AutoLoad.php       # Carrega classes
│   └── _conn/
│       └── Database.class.php  # Conexão MySQL
```

---

## Credenciais Hardcoded (Database.class.php)

```php
$Host = 'mainline.proxy.rlwy.net';
$User = 'root';
$Pass = 'eHeoVCebYyaJVBEBtCLfYNHgRCrxWVXU';
$Dbsa = 'railway';
$Port = '52996';
```
