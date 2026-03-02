# Guia de Setup Local - Integrador Zé Delivery

Este guia detalha como configurar o ambiente de desenvolvimento local.

---

## Pré-requisitos

Antes de começar, certifique-se de ter instalado:

- Git
- Node.js 18+
- Python 3.11+
- PHP 8.1+
- MySQL Client (para testar conexão)

---

## Passo 1: Clonar o Repositório

```bash
git clone https://github.com/SEU_USUARIO/integrador-ze-delivery.git
cd integrador-ze-delivery
```
## Passo 2: Configurar Banco de Dados

O banco MySQL está hospedado no Railway (nuvem). Não é necessário instalar MySQL localmente.

### Credenciais de Acesso:

```
Host: mainline.proxy.rlwy.net
Porta: 52996
Usuário: root
Senha: eHeoVCebYyaJVBEBtCLfYNHgRCrxWVXU
Database: railway
```
### Testar Conexão:

```bash
mysql -h mainline.proxy.rlwy.net -P 52996 -u root -peHeoVCebYyaJVBEBtCLfYNHgRCrxWVXU railway
```
Se conectar, você verá o prompt `mysql>`. Digite `exit` para sair
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

# Instalar dependências
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

# Instalar dependências
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

# Instalar dependências
yarn install
# ou: npm install

# Instalar navegador do Puppeteer
npx puppeteer browsers install chrome
```

### Configurar Sessão do Zé Delivery:

O scraper precisa de cookies de uma sessão autenticada no Zé Delivery.

**Como obter os cookies:**

1. Abra o Chrome e acesse https://seuze.ze.delivery
2. Faça login com sua conta
3. Abra o DevTools (F12) > Application > Cookies
4. Copie todos os cookies do domínio `.ze.delivery`
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

Ou use a extensão "EditThisCookie" para exportar em JSON.

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

### Testar conexão do PHP:

```bash
cd integrador
php db-test.php
```

Se mostrar "Conexão OK", está funcionando.

---

## Passo 7: Executar Todos os Serviços

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

### Terminal 3 - Scraper v1 (aceite automático):
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

- `ze-v1-out.log` - Saída do scraper principal
- `ze-v1-error.log` - Erros do scraper principal
- `ze-v1-itens-out.log` - Saída do scraper de itens
- `ze-v1-itens-error.log` - Erros do scraper de itens

Screenshots de debug são salvos em `/app/logs/*.png`

---

## Dicas de Desenvolvimento

### Modificando o Scraper

Os seletores CSS do site Zé Delivery mudam frequentemente. Arquivos principais:

- `zedelivery-clean/auto-accept.js` - Seletores para aceite automático
- `zedelivery-clean/phone-capture-v3.js` - Seletores para captura de telefone
- `zedelivery-clean/confirm-pickup.js` - Seletores para confirmação de retirada

Para debugar, adicione screenshots:
```javascript
await page.screenshot({ path: '/app/logs/debug.png' });
```

### Modificando a API

O arquivo principal é `backend/server.py`. Após modificar, o servidor reinicia automaticamente (--reload).

### Modificando o Frontend

Os componentes estão em `frontend/src/components/`. O hot reload atualiza automaticamente.

---

## Comandos Úteis

```bash
# Ver pedidos no banco
mysql -h mainline.proxy.rlwy.net -P 52996 -u root -peHeoVCebYyaJVBEBtCLfYNHgRCrxWVXU railway -e "SELECT delivery_code, delivery_name_cliente, delivery_status FROM delivery ORDER BY delivery_id DESC LIMIT 10;"

# Testar API
curl http://localhost:8001/api/pedidos?limit=5 | python3 -m json.tool

# Matar processo em porta específica
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
Verifique sua conexão de internet. O banco está na nuvem (Railway).

### "Permission denied" ao executar scripts
```bash
chmod +x zedelivery-clean/*.sh
```

### Frontend mostra tela branca
Verifique o console do navegador (F12). Provavelmente o backend não está rodando.

---

## Próximos Passos

Após configurar o ambiente:

1. Leia a documentação da API em `/docs/API_SISTEMA_EXTERNO.md`
2. Entenda os fluxos em `/docs/FLUXOS_IMPLEMENTADOS.md`
3. Verifique o schema do banco em `/docs/zedelivery_full_dump.sql`

