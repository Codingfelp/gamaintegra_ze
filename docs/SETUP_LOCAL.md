# Guia de Setup Local - Integrador Ze Delivery

Este guia detalha como configurar o ambiente de desenvolvimento local.

---

## Pre-requisitos

Antes de comecar, certifique-se de ter instalado:

- Git
- Node.js 18+
- Python 3.11+
- PHP 8.1+
- MySQL Client (para testar conexao)

---

## Passo 1: Clonar o Repositorio

```bash
git clone https://github.com/Codingfelp/gamaintegra_ze.git
cd gamaintegra_ze
```

---

## Passo 2: Configurar Banco de Dados

O banco MySQL esta hospedado no Railway (nuvem). Nao e necessario instalar MySQL localmente.

### Credenciais de Acesso:

```
Host: mainline.proxy.rlwy.net
Porta: 52996
Usuario: root
Senha: eHeoVCebYyaJVBEBtCLfYNHgRCrxWVXU
Database: railway
```

### Testar Conexao:

```bash
mysql -h mainline.proxy.rlwy.net -P 52996 -u root -peHeoVCebYyaJVBEBtCLfYNHgRCrxWVXU railway
```

Se conectar, voce vera o prompt `mysql>`. Digite `exit` para sair.

---

## Passo 3: Configurar Backend (Python/FastAPI)

```bash
# Entrar na pasta do backend
cd backend

# Criar ambiente virtual
python3 -m venv venv

# Ativar ambiente virtual
# Linux/Mac:
source venv/bin/activate
# Windows:
# venv\Scripts\activate

# Instalar dependencias
pip install -r requirements.txt
```

### Criar arquivo .env:

```bash
cat > .env << 'EOF'
MYSQL_HOST=mainline.proxy.rlwy.net
MYSQL_PORT=52996
MYSQL_USER=root
MYSQL_PASSWORD=eHeoVCebYyaJVBEBtCLfYNHgRCrxWVXU
MYSQL_DATABASE=railway
EOF
```

### Testar Backend:

```bash
# Iniciar servidor
uvicorn server:app --host 0.0.0.0 --port 8001 --reload

# Em outro terminal, testar:
curl http://localhost:8001/api/health
# Deve retornar: {"status":"healthy"}
```

---

## Passo 4: Configurar Frontend (React)

```bash
# Entrar na pasta do frontend
cd frontend

# Instalar dependencias
yarn install
# ou: npm install
```

### Criar arquivo .env:

```bash
cat > .env << 'EOF'
REACT_APP_BACKEND_URL=http://localhost:8001
EOF
```

### Testar Frontend:

```bash
yarn start
# ou: npm start

# Acessar http://localhost:3000 no navegador
```

---

## Passo 5: Configurar Scraper (Node.js/Puppeteer)

```bash
# Entrar na pasta do scraper
cd zedelivery-clean

# Instalar dependencias
yarn install
# ou: npm install

# Instalar navegador do Puppeteer
npx puppeteer browsers install chrome
```

### Configurar Sessao do Ze Delivery:

O scraper precisa de cookies de uma sessao autenticada no Ze Delivery.

**Como obter os cookies:**

1. Abra o Chrome e acesse https://seuze.ze.delivery
2. Faca login com sua conta
3. Abra o DevTools (F12) > Application > Cookies
4. Copie todos os cookies do dominio `.ze.delivery`
5. Crie o arquivo `cookies.json` no formato:

```json
[
  {
    "name": "nome_do_cookie",
    "value": "valor_do_cookie",
    "domain": ".ze.delivery",
    "path": "/",
    "expires": -1,
    "httpOnly": false,
    "secure": true
  }
]
```

Ou use a extensao "EditThisCookie" para exportar em JSON.

### Testar Scraper:

```bash
# Testar se o Puppeteer funciona
node -e "const puppeteer = require('puppeteer'); puppeteer.launch({headless: 'new'}).then(b => { console.log('Puppeteer OK'); b.close(); })"
```

---

## Passo 6: Configurar Integrador PHP

O integrador PHP processa os dados capturados pelo scraper e salva no banco.

### Verificar PHP:

```bash
php -v
# Deve mostrar PHP 8.1+
```

### Testar conexao do PHP:

```bash
cd integrador
php db-test.php
```

Se mostrar "Conexao OK", esta funcionando.

---

## Passo 7: Executar Todos os Servicos

Abra 4 terminais:

### Terminal 1 - Backend:
```bash
cd backend
source venv/bin/activate
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

### Terminal 2 - Frontend:
```bash
cd frontend
yarn start
```

### Terminal 3 - Scraper v1 (aceite automatico):
```bash
cd zedelivery-clean
node v1.js
```

### Terminal 4 - Scraper v1-itens (detalhes):
```bash
cd zedelivery-clean
node v1-itens.js
```

---

## Estrutura de Logs

Os scrapers salvam logs em `/app/logs/`:

- `ze-v1-out.log` - Saida do scraper principal
- `ze-v1-error.log` - Erros do scraper principal
- `ze-v1-itens-out.log` - Saida do scraper de itens
- `ze-v1-itens-error.log` - Erros do scraper de itens

Screenshots de debug sao salvos em `/app/logs/*.png`

---

## Dicas de Desenvolvimento

### Modificando o Scraper

Os seletores CSS do site Ze Delivery mudam frequentemente. Arquivos principais:

- `zedelivery-clean/auto-accept.js` - Seletores para aceite automatico
- `zedelivery-clean/phone-capture-v3.js` - Seletores para captura de telefone
- `zedelivery-clean/confirm-pickup.js` - Seletores para confirmacao de retirada

Para debugar, adicione screenshots:
```javascript
await page.screenshot({ path: '/app/logs/debug.png' });
```

### Modificando a API

O arquivo principal e `backend/server.py`. Apos modificar, o servidor reinicia automaticamente (--reload).

### Modificando o Frontend

Os componentes estao em `frontend/src/components/`. O hot reload atualiza automaticamente.

---

## Comandos Uteis

```bash
# Ver pedidos no banco
mysql -h mainline.proxy.rlwy.net -P 52996 -u root -peHeoVCebYyaJVBEBtCLfYNHgRCrxWVXU railway -e "SELECT delivery_code, delivery_name_cliente, delivery_status FROM delivery ORDER BY delivery_id DESC LIMIT 10;"

# Testar API
curl http://localhost:8001/api/pedidos?limit=5 | python3 -m json.tool

# Matar processo em porta especifica
lsof -ti:8001 | xargs kill -9

# Ver logs em tempo real
tail -f /app/logs/ze-v1-itens-out.log
```

---

## Problemas Comuns

### "Cannot find module 'puppeteer'"
```bash
cd zedelivery-clean
yarn install
```

### "ECONNREFUSED" no MySQL
Verifique sua conexao de internet. O banco esta na nuvem (Railway).

### "Permission denied" ao executar scripts
```bash
chmod +x zedelivery-clean/*.sh
```

### Frontend mostra tela branca
Verifique o console do navegador (F12). Provavelmente o backend nao esta rodando.

---

## Proximos Passos

Apos configurar o ambiente:

1. Leia a documentacao da API em `/docs/API.md`
2. Entenda os fluxos em `/docs/FLUXOS_IMPLEMENTADOS.md`
3. Verifique o schema do banco em `/docs/zedelivery_full_dump.sql`

---

## Deploy no Railway

O projeto esta configurado para deploy automatico no Railway.

### Como Funciona

1. Voce faz alteracoes no codigo local
2. Commita as alteracoes
3. Faz push para o GitHub
4. Railway detecta o push e faz deploy automaticamente

### Passo a Passo

#### 1. Commitar Alteracoes

```bash
# Ver arquivos modificados
git status

# Adicionar todos os arquivos
git add .

# Criar commit com mensagem descritiva
git commit -m "Descricao do que foi alterado"
```

#### 2. Enviar para o GitHub

```bash
git push origin main
```

#### 3. Acompanhar Deploy no Railway

1. Acesse https://railway.app
2. Faca login com sua conta
3. Selecione o projeto
4. Na aba "Deployments", vera o deploy em andamento
5. Clique no deploy para ver os logs em tempo real

### Configurar Variaveis de Ambiente no Railway

Se precisar alterar variaveis de ambiente:

1. Acesse o projeto no Railway
2. Clique no servico (ex: "web", "backend")
3. Va em "Variables"
4. Adicione ou edite as variaveis:

```
SUPABASE_URL=https://seu-projeto.supabase.co
ZE_SYNC_KEY=sua-chave-aqui
MYSQL_HOST=mainline.proxy.rlwy.net
MYSQL_PORT=52996
MYSQL_USER=root
MYSQL_PASSWORD=sua-senha
MYSQL_DATABASE=railway
```

### Logs de Producao

Para ver logs no Railway:

1. Selecione o servico
2. Va em "Logs"
3. Os logs aparecem em tempo real

### Rollback

Se um deploy der problema:

1. Va em "Deployments"
2. Encontre o deploy anterior que funcionava
3. Clique nos 3 pontos > "Rollback"

### Dicas

- Sempre teste localmente antes de fazer push
- Faca commits pequenos e frequentes
- Use mensagens de commit descritivas
- Verifique os logs do Railway apos cada deploy
