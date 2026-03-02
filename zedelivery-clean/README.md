# Scraper - Integrador Zé Delivery

Scripts de automação para o painel do Zé Delivery (seuze.ze.delivery).

## Tecnologias

- Node.js 18+
- Puppeteer (automação de navegador)
- Chromium (navegador headless)

## Instalação

```bash
# Instalar dependências
yarn install

# Instalar navegador do Puppeteer
npx puppeteer browsers install chrome
```

## Scripts Principais

### v1.js - Aceite Automático
Monitora a coluna "Novos" e aceita pedidos automaticamente.

```bash
node v1.js
```

### v1-itens.js - Captura de Detalhes
Captura detalhes dos pedidos: itens, telefone, código de entrega.

```bash
node v1-itens.js
```

## Módulos

| Arquivo | Descrição |
|---------|-----------|
| `auto-accept.js` | Lógica de aceite automático |
| `phone-capture-v3.js` | Captura de telefone do cliente |
| `confirm-pickup.js` | Confirmação de retirada com código |
| `php-bridge.js` | Comunicação com integrador PHP |
| `session-manager.js` | Gerenciamento de sessão do navegador |

## Configuração

### Cookies de Autenticação

O scraper precisa de cookies válidos do Zé Delivery. 

1. Faça login em seuze.ze.delivery no Chrome
2. Exporte os cookies usando extensão (EditThisCookie)
3. Salve em `cookies.json`

### Arquivo de Configuração

Editar `configuracao.json`:

```json
{
  "url_base": "https://seuze.ze.delivery",
  "intervalo_verificacao": 30000
}
```

## Logs

- Saída: `/app/logs/ze-v1-out.log`
- Erros: `/app/logs/ze-v1-error.log`
- Screenshots de debug: `/app/logs/*.png`

## Atualizando Seletores

Quando o site do Zé Delivery muda, os seletores CSS quebram. Para atualizar:

1. Acesse o site e inspecione o elemento (F12)
2. Encontre o novo seletor (id, data-testid, classe)
3. Atualize o arquivo correspondente:
   - `auto-accept.js` para aceite
   - `phone-capture-v3.js` para telefone
   - `confirm-pickup.js` para retirada

## Troubleshooting

### Scraper não consegue logar
- Verifique se os cookies estão válidos
- Tente fazer login manual e exportar novamente

### Telefone não é capturado
- O modal de motivo pode ter mudado
- Inspecione o HTML e atualize os seletores

### Aceite não funciona
- A estrutura do kanban pode ter mudado
- Verifique se os IDs das colunas ainda existem
