# Integrador Zé Delivery

Sistema de integração automatizada com a plataforma Zé Delivery (seuze.ze.delivery).

Desenvolvido para capturar pedidos, aceitar automaticamente, extrair informações de clientes e sincronizar dados com sistemas externos.

---

## Índice

1. [Visão Geral](#visão-geral)
2. [Tecnologias](#tecnologias)
3. [Estrutura do Projeto](#estrutura-do-projeto)
4. [Configuração do Ambiente](#configuração-do-ambiente)
5. [Instalação](#instalação)
6. [Configuração](#configuração)
7. [Executando o Sistema](#executando-o-sistema)
8. [API REST](#api-rest)
9. [Banco de Dados](#banco-de-dados)
10. [Troubleshooting](#troubleshooting)

---

## Visão Geral

### O que o sistema faz:

1. **Scraper Automatizado**: Acessa o painel do Zé Delivery via Puppeteer e monitora pedidos
2. **Aceite Automático**: Aceita pedidos pendentes automaticamente
3. **Captura de Dados**: Extrai telefone do cliente, itens do pedido, endereço, etc.
4. **Confirmação de Retirada**: Confirma pedidos de retirada com código de 4 dígitos
5. **API REST**: Expõe endpoints para sistemas externos consumirem os dados
6. **Webhooks**: Notifica sistemas externos quando há novos pedidos ou atualizações
7. **Dashboard**: Interface web para visualizar e gerenciar pedidos

### Fluxo de Dados:

```
┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│  Site Zé Delivery   │────▶│  SCRAPER (Node.js)  │────▶│    MySQL (Railway)  │
│  seuze.ze.delivery  │     │  Puppeteer          │     │    Banco Principal  │
└─────────────────────┘     └─────────────────────┘     └─────────────────────┘
                                                                  │
                                   WEBHOOK                        │
                            ┌──────────────────┐                  │
                            │  Sistema Externo │◀─────────────────┤
                            │  (Supabase, ERP) │     API REST     │
                            └──────────────────┘                  │
                                    │                             │
                                    │         ┌───────────────────┘
                                    ▼         ▼
                            ┌──────────────────────┐
                            │  FastAPI Backend     │
                            │  - API REST          │
                            │  - Webhooks          │
                            │  - Dashboard         │
                            └──────────────────────┘
```

---

## Tecnologias

### Backend
- **Python 3.11+** - API REST com FastAPI
- **Node.js 18+** - Scraper com Puppeteer
- **PHP 8.1+** - Integrador de processamento de pedidos

### Frontend
- **React 18** - Dashboard de pedidos
- **Tailwind CSS** - Estilização
- **Shadcn/UI** - Componentes

### Banco de Dados
- **MySQL 8** - Banco principal (hospedado no Railway)

### Infraestrutura
- **Supervisor** - Gerenciamento de processos
- **Chromium** - Navegador para o scraper

---

## Estrutura do Projeto

```
/app
├── backend/                    # API REST (FastAPI/Python)
│   ├── server.py              # Servidor principal da API
│   ├── webhook_module.py      # Módulo de webhooks
│   └── requirements.txt       # Dependências Python
│
├── frontend/                   # Dashboard (React)
│   ├── src/
│   │   ├── App.js            # Componente principal
│   │   └── components/       # Componentes React
│   └── package.json          # Dependências Node
│
├── zedelivery-clean/          # Scraper (Node.js/Puppeteer)
│   ├── v1.js                 # Scraper principal - aceite automático
│   ├── v1-itens.js           # Scraper de detalhes - itens, telefone
│   ├── auto-accept.js        # Módulo de aceite automático
│   ├── phone-capture-v3.js   # Módulo de captura de telefone
│   ├── confirm-pickup.js     # Módulo de confirmação de retirada
│   ├── php-bridge.js         # Ponte para integrador PHP
│   └── package.json          # Dependências Node
│
├── integrador/                 # Processador de pedidos (PHP)
│   └── zeduplo/
│       ├── ze_pedido.php           # Criar/atualizar pedidos
│       ├── ze_pedido_view.php      # Processar itens e detalhes
│       ├── ze_pedido_view_status.php # Atualizar status
│       └── ze_pedido_id.php        # Processar por ID
│
├── bridge/                     # Scripts auxiliares
│   └── sync-cron.js          # [DEPRECATED] Sync com Supabase
│
├── docs/                       # Documentação
│   ├── API_INTEGRADOR.md     # Doc da API do integrador PHP
│   ├── API_SISTEMA_GAMATAURI.md # Doc da API para sistemas externos
│   └── FLUXOS_IMPLEMENTADOS.md # Doc dos fluxos automatizados
│
└── docker/
    └── supervisord.conf       # Configuração do supervisor
```

---

## Configuração do Ambiente

### Requisitos

- **Sistema Operacional**: Linux (Ubuntu 20.04+ recomendado) ou macOS
- **Node.js**: 18.x ou superior
- **Python**: 3.11 ou superior
- **PHP**: 8.1 ou superior
- **Chromium**: Para o Puppeteer

### Instalando Dependências do Sistema (Ubuntu/Debian)

```bash
# Atualizar sistema
sudo apt update && sudo apt upgrade -y

# Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Python 3.11
sudo apt install -y python3.11 python3.11-venv python3-pip

# PHP 8.1
sudo apt install -y php8.1 php8.1-cli php8.1-mysql php8.1-curl php8.1-json

# Chromium e dependências
sudo apt install -y chromium-browser fonts-liberation libappindicator3-1 libasound2 \
    libatk-bridge2.0-0 libatk1.0-0 libcups2 libdbus-1-3 libdrm2 libgbm1 \
    libgtk-3-0 libnspr4 libnss3 libx11-xcb1 libxcomposite1 libxdamage1 \
    libxrandr2 xdg-utils

# Supervisor
sudo apt install -y supervisor

# Yarn
npm install -g yarn
```

---

## Instalação

### 1. Clonar o Repositório

```bash
git clone https://github.com/SEU_USUARIO/integrador-ze-delivery.git
cd integrador-ze-delivery
```

### 2. Instalar Dependências do Backend (Python)

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 3. Instalar Dependências do Frontend (React)

```bash
cd frontend
yarn install
```

### 4. Instalar Dependências do Scraper (Node.js)

```bash
cd zedelivery-clean
yarn install

# Instalar Puppeteer com Chromium
npx puppeteer browsers install chrome
```

### 5. Instalar Dependências do Bridge

```bash
cd bridge
yarn install
```

---

## Configuração

### 1. Banco de Dados MySQL (Railway)

O banco de dados está hospedado no Railway. Credenciais:

```
Host: mainline.proxy.rlwy.net
Porta: 52996
Usuário: root
Senha: eHeoVCebYyaJVBEBtCLfYNHgRCrxWVXU
Database: railway
```

### 2. Configurar Backend (.env)

Criar arquivo `/backend/.env`:

```env
# Banco de Dados MySQL
MYSQL_HOST=mainline.proxy.rlwy.net
MYSQL_PORT=52996
MYSQL_USER=root
MYSQL_PASSWORD=eHeoVCebYyaJVBEBtCLfYNHgRCrxWVXU
MYSQL_DATABASE=railway

# URL do Backend (ajustar conforme ambiente)
REACT_APP_BACKEND_URL=http://localhost:8001
```

### 3. Configurar Frontend (.env)

Criar arquivo `/frontend/.env`:

```env
REACT_APP_BACKEND_URL=http://localhost:8001
```

### 4. Configurar Integrador PHP

Editar `/integrador/zeduplo/config.php`:

```php
<?php
define('DB_HOST', 'mainline.proxy.rlwy.net');
define('DB_PORT', '52996');
define('DB_USER', 'root');
define('DB_PASS', 'eHeoVCebYyaJVBEBtCLfYNHgRCrxWVXU');
define('DB_NAME', 'railway');
```

### 5. Configurar Credenciais do Zé Delivery

O scraper precisa de uma sessão autenticada no Zé Delivery. 

**Opção 1 - Cookies manuais:**

1. Faça login manualmente em seuze.ze.delivery no Chrome
2. Exporte os cookies usando extensão (EditThisCookie)
3. Salve em `/zedelivery-clean/cookies.json`

**Opção 2 - Login via Gmail OAuth (recomendado):**

1. Configure credenciais OAuth do Google em `/integrador/gmail-oauth-setup.js`
2. Execute `node gmail-oauth-setup.js` para autenticar
3. O sistema vai manter a sessão automaticamente

---

## Executando o Sistema

### Modo Desenvolvimento (processos separados)

```bash
# Terminal 1 - Backend (API)
cd backend
source venv/bin/activate
uvicorn server:app --host 0.0.0.0 --port 8001 --reload

# Terminal 2 - Frontend (Dashboard)
cd frontend
yarn start

# Terminal 3 - Scraper Principal (aceite automático)
cd zedelivery-clean
node v1.js

# Terminal 4 - Scraper de Itens (detalhes, telefone)
cd zedelivery-clean
node v1-itens.js
```

### Modo Produção (Supervisor)

Copiar configuração do supervisor:

```bash
sudo cp /app/docker/supervisord.conf /etc/supervisor/conf.d/integrador-ze.conf
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl start all
```

Comandos úteis:

```bash
# Ver status de todos os processos
sudo supervisorctl status

# Reiniciar um processo específico
sudo supervisorctl restart ze-v1

# Ver logs
tail -f /var/log/supervisor/ze-v1.out.log
tail -f /var/log/supervisor/backend.err.log
```

---

## API REST

### Endpoints Principais

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| GET | `/api/pedidos` | Lista pedidos com filtros |
| GET | `/api/pedido/{id}` | Dados completos de um pedido |
| GET | `/api/sync` | Sincronização para sistemas externos |
| POST | `/api/pedido/{id}/status` | Atualizar status |
| POST | `/api/webhook/confirmar-retirada` | Confirmar retirada com código |
| POST | `/api/webhooks/configurar` | Configurar URL de callback |

### Exemplos

```bash
# Buscar pedidos
curl http://localhost:8001/api/pedidos?limit=10

# Buscar pedido específico
curl http://localhost:8001/api/pedido/472230265

# Sincronizar pedidos desde uma data
curl "http://localhost:8001/api/sync?desde=2026-03-01T00:00:00"

# Confirmar retirada com código
curl -X POST http://localhost:8001/api/webhook/confirmar-retirada \
  -H "Content-Type: application/json" \
  -d '{"order_id": "472230265", "code": "1234"}'
```

**Documentação completa**: `/docs/API_SISTEMA_EXTERNO.md`

---

## Banco de Dados

### Tabelas Principais

**delivery** - Pedidos
```sql
delivery_id              INT PRIMARY KEY
delivery_code            VARCHAR(255)    -- Número do pedido no Zé
delivery_name_cliente    VARCHAR(255)    -- Nome do cliente
delivery_cpf_cliente     VARCHAR(255)    -- CPF
delivery_telefone        VARCHAR(50)     -- Telefone (capturado pelo scraper)
delivery_status          INT             -- 0=Pendente, 1=Entregue, 2=Aceito, 3=A caminho, 4=Cancelado, 5=Rejeitado
delivery_total           DOUBLE          -- Valor total
delivery_endereco_rota   VARCHAR(255)    -- Endereço
delivery_tipo_pedido     VARCHAR(50)     -- "Pedido Comum" ou "Pedido Retirada"
delivery_codigo_entrega  VARCHAR(60)     -- Código de entrega (4 dígitos para retirada)
-- ... outros campos
```

**delivery_itens** - Itens dos pedidos
```sql
delivery_itens_id           INT PRIMARY KEY
delivery_itens_id_delivery  INT             -- FK para delivery
delivery_itens_descricao    VARCHAR(255)    -- Nome do produto
delivery_itens_qtd          VARCHAR(255)    -- Quantidade
delivery_itens_valor_total  DOUBLE          -- Valor total do item
```

### Códigos de Status

| Código | Status | Descrição |
|--------|--------|-----------|
| 0 | Pendente | Pedido recebido, aguardando aceite |
| 1 | Entregue | Pedido entregue ao cliente |
| 2 | Aceito | Pedido aceito, em preparação |
| 3 | A caminho | Pedido saiu para entrega |
| 4 | Cancelado | Pedido cancelado |
| 5 | Rejeitado | Pedido rejeitado pela loja |
| 6 | Expirado | Pedido expirou sem aceite |

---

## Troubleshooting

### Scraper não consegue logar

1. Verifique se os cookies estão válidos em `/zedelivery-clean/cookies.json`
2. Tente fazer login manual e exportar cookies novamente
3. Verifique logs: `tail -f /var/log/supervisor/ze-v1.err.log`

### Telefone não está sendo capturado

1. Os seletores do site podem ter mudado
2. Verifique `/zedelivery-clean/phone-capture-v3.js`
3. Capture o HTML da página e atualize os seletores

### Backend não inicia

1. Verifique se o MySQL está acessível: `mysql -h mainline.proxy.rlwy.net -P 52996 -u root -p`
2. Verifique logs: `tail -f /var/log/supervisor/backend.err.log`
3. Verifique se a porta 8001 está livre

### Frontend não conecta ao backend

1. Verifique se `REACT_APP_BACKEND_URL` está correto no `.env`
2. Verifique se o backend está rodando na porta correta
3. Verifique CORS no `server.py`

---

## Contato

Para dúvidas sobre o sistema, consulte a documentação em `/docs/` ou entre em contato com a equipe de TI.

---

## Changelog

- **2026-03-02**: API para sistema externo, webhooks, confirmação de retirada
- **2026-02-28**: Captura de telefone v3, aceite automático melhorado
- **2026-02-27**: Sincronização com Supabase via webhooks
- **2026-02-01**: Versão inicial do integrador

