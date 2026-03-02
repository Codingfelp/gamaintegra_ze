# Arquitetura PHP do Sistema Zé Delivery

## ARQUITETURA REFATORADA - PHP É CLI + GMAIL API

**Data da última atualização:** 03/02/2026

---

## MIGRAÇÃO IMAP → GMAIL API CONCLUÍDA

### Problema Anterior (IMAP)
- `php-imap` é extensão problemática em containers
- IMAP é bloqueante e travava em produção
- Requer instalação manual (`apt-get install php-imap`)
- Instável em ambientes cloud/serverless

### Solução Implementada (Gmail API OAuth 2.0)
- **Gmail API REST** via cURL (extensão nativa do PHP)
- **OAuth 2.0** com refresh_token permanente
- Zero dependência de `php-imap`
- Funciona em qualquer ambiente com cURL

---

## Fluxo de Dados (Arquitetura Atual)

```
┌─────────────────────┐      ┌───────────────────┐      ┌───────────────────┐
│  Scraper v1.js      │──────│  php-bridge.js    │──────│  PHP CLI          │
│  (Puppeteer)        │ exec │  (Node.js)        │ cli  │  ze_pedido.php    │
└─────────────────────┘      └───────────────────┘      └───────────────────┘
                                                               │
                                                               │ SQL
                                                               ▼
                                                     ┌───────────────────┐
                                                     │  MySQL (Railway)  │
                                                     │  Tabela: delivery │
                                                     └───────────────────┘
```

### 2FA via Gmail API (OAuth 2.0)

```
┌─────────────────────┐      ┌───────────────────┐      ┌───────────────────┐
│  v1.js precisa      │──────│  php-bridge.js    │──────│  ze_pedido_mail   │
│  código 2FA         │      │  pegarCodigo2FA() │      │  .php (Gmail API) │
└─────────────────────┘      └───────────────────┘      └───────────────────┘
                                                               │
                                                               │ HTTPS
                                                               ▼
                                                     ┌───────────────────┐
                                                     │ Gmail API REST    │
                                                     │ oauth2.googleapis │
                                                     └───────────────────┘
```

---

## Scripts PHP (Executados via CLI)

### 1. `ze_pedido_mail.php` - Leitura 2FA (GMAIL API)
- **Usa:** PHP cURL + OAuth 2.0
- **Função:** Lê código de verificação do Gmail via API REST
- **Chamado por:** `phpBridge.pegarCodigo2FA()`
- **Timeout:** 30 segundos

### 2. `ze_pedido.php` - Inserção de Pedidos
- **Função:** Insere pedido no banco
- **Chamado por:** `phpBridge.inserirPedido()`

### 3. `ze_pedido_view.php` - Atualização de Pedidos
- **Função:** Atualiza dados (CPF, endereço, itens)
- **Chamado por:** `phpBridge.atualizarPedido()`

---

## Credenciais Gmail API (OAuth 2.0)

```php
// Armazenadas em ze_pedido_mail.php
$GMAIL_CONFIG = [
    'client_id'     => '187165168994-bn629eu6t7rb601v54i5j4q258hpcacm.apps.googleusercontent.com',
    'client_secret' => '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',
    'refresh_token' => '1//04cbFI2AH2EsKCgYIARAAGA...',  // Token permanente
];
```

** O refresh_token não expira** - uma vez obtido, funciona indefinidamente.

---

## Por que isso funciona em produção?

| Antes (IMAP)                      | Depois (Gmail API)                 |
|-----------------------------------|-------------------------------------|
| php-imap precisa instalação       | cURL é nativo no PHP                |
| IMAP trava em alguns containers   | REST API sempre funciona            |
| Senha de app pode ser revogada    | OAuth 2.0 com refresh automático    |
| Timeout de 60+ segundos           | Resposta em < 5 segundos            |
| Preview OK, Produção falha        | Ambos funcionam igual               
---

## Arquivos Principais

```
/app/zedelivery-clean/
├── php-bridge.js         # Bridge Node→PHP via CLI
├── v1.js                 # Scraper principal
├── v1-itens.js           # Scraper de itens
└── configuracao.json     # Configurações

/app/integrador/zeduplo/
├── ze_pedido.php         # Inserção (CLI)
├── ze_pedido_mail.php    # 2FA GMAIL API (CLI)
├── ze_pedido_view.php    # Atualização (CLI)
└── _class/Database.class.php  # Conexão MySQL
```

---

## Verificação de Funcionamento

```bash
# Verificar se PHP CLI funciona
php -r 'echo "OK";'

# Verificar cURL disponível (necessário para Gmail API)
php -m | grep -i curl

# Testar 2FA via Gmail API
cd /app/integrador/zeduplo && php ze_pedido_mail.php
# Esperado: {"codigo":"XXXXXX"} ou {"codigo":0}

# Verificar status via API
curl http://localhost:8001/api/services/status
# PHP deve aparecer como "gmail_api": true
```

---

## Credenciais MySQL (Database.class.php)

```php
$Host = 'mainline.proxy.rlwy.net';
$User = 'root';
$Pass = 'eHeoVCebYyaJVBEBtCLfYNHgRCrxWVXU';
$Dbsa = 'railway';
$Port = '52996';
```
