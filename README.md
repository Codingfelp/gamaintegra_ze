# Zé Delivery Integrador

Sistema de integração para captura automática de pedidos do Zé Delivery e sincronização com Lovable Cloud.

## Funcionalidades

- ✅ Captura automática de novos pedidos
- ✅ Aceite automático de pedidos
- ✅ Atualização de status em tempo real
- ✅ Captura do nome do entregador
- ✅ Captura do telefone do cliente
- ✅ Sincronização com Lovable Cloud a cada 3 segundos
- ✅ Extração de itens dos pedidos

## Deploy no Railway

### 1. Conectar repositório GitHub

1. Acesse [Railway](https://railway.app)
2. Crie um novo projeto
3. Selecione "Deploy from GitHub repo"
4. Escolha este repositório
5. Railway fará deploy automático a cada push

### 2. Configurar variáveis de ambiente

No painel do Railway, adicione as seguintes variáveis:

```
# MySQL (Railway - já configurado no projeto existente)
MYSQL_HOST=mainline.proxy.rlwy.net
MYSQL_PORT=52996
MYSQL_USER=root
MYSQL_PASSWORD=sua_senha
MYSQL_DATABASE=railway

# Lovable Cloud
LOVABLE_SUPABASE_URL=https://seu-projeto.supabase.co
LOVABLE_ZE_SYNC_KEY=sua_chave

# Zé Delivery
ZE_LOGIN=seu_login
ZE_PASSWORD=sua_senha

# Gmail API (para 2FA)
GMAIL_CLIENT_ID=seu_client_id
GMAIL_CLIENT_SECRET=seu_client_secret
GMAIL_REFRESH_TOKEN=seu_refresh_token
GMAIL_USER=seu_email@gmail.com
```

### 3. Deploy automático

Após configurar:
- Qualquer push para o GitHub dispara deploy automático
- Use o botão "Save to GitHub" no Emergent para sincronizar

## Estrutura do Projeto

```
/app
├── zedelivery-clean/
│   ├── v1.js              # Scraper principal (pedidos, status, aceite)
│   └── v1-itens.js        # Scraper de itens
├── bridge/
│   └── sync-cron.js       # Sincronização com Lovable Cloud
├── integrador/
│   └── zeduplo/
│       └── ze_pedido.php  # Processamento de pedidos
├── docker/
│   └── supervisord.conf   # Configuração do supervisor
├── Dockerfile             # Build para produção
├── railway.toml           # Configuração Railway
└── package.json           # Dependências Node.js
```

## Logs

No Railway, acesse os logs em tempo real:
- `ze-v1-out.log` - Logs do scraper principal
- `ze-sync-out.log` - Logs de sincronização
- `ze-v1-itens-out.log` - Logs de captura de itens

## Monitoramento

```bash
# Ver sync
grep "success" logs/ze-sync-out.log | tail -3

# Ver entregas em andamento
strings logs/ze-v1-out.log | grep "ENTREGAS" | tail -10

# Ver aceite automático
strings logs/ze-v1-out.log | grep "ACEITA" | tail -10
```
