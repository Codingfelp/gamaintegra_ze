# Gamatauri Zé Integrador - PRD

## Status: ✅ FUNCIONAL E CAPTURANDO PEDIDOS REAIS

## O Que Foi Implementado

### Frontend (React)
- [x] Header "Gamatauri Zé" (sem ícone Z)
- [x] Interface limpa, fundo claro, paleta amarela
- [x] Logs separados (v1.js e v1-itens.js) com visual de terminal escuro
- [x] Detalhes completos dos pedidos (inclui email do entregador se disponível)
- [x] Controles de serviços funcionando

### Backend (FastAPI)
- [x] Conexão MySQL banco `zedelivery`
- [x] Logs separados por serviço (/api/services/logs)
- [x] Leitura de arquivos de log (/api/services/logs/files)
- [x] API de sincronização (/api/sync)

### Infraestrutura
- [x] MySQL/MariaDB funcionando
- [x] PHP-FPM + IMAP configurado
- [x] Apache na porta 8088
- [x] Chromium 144 para Puppeteer
- [x] Wrapper --no-sandbox para ambiente root

### PM2 e API Bridge
- [x] pm2.ecosystem.config.js configurado
- [x] API Bridge em /app/bridge/ para Lovable Cloud

## Pedidos Capturados (Teste Real)
O integrador capturou pedidos reais da loja:
- Ana - R$33.53 - Nubank
- selma - R$41.86 - Dinheiro  
- Janete - R$53.95 - Cartão

## Arquivos Principais
```
/app/frontend/src/App.js          # Dashboard React
/app/backend/server.py            # API FastAPI  
/app/zedelivery-clean/puppeteer-wrapper.js  # Wrapper Puppeteer
/app/pm2.ecosystem.config.js      # Config PM2
/app/bridge/index.js              # API Bridge Lovable
/app/bridge/.env                  # Variáveis do Bridge
```

## Portas
| Serviço | Porta |
|---------|-------|
| Frontend | 3000 |
| Backend | 8001 |
| MySQL | 3306 |
| Apache/PHP | 8088 |
| Bridge | 3333 |

## Para VPS (Rodar 24/7)

```bash
# 1. Instalar PM2
npm install -g pm2

# 2. Iniciar todos os serviços
cd /app && pm2 start pm2.ecosystem.config.js

# 3. Configurar auto-start
pm2 startup && pm2 save

# 4. Ver logs em tempo real
pm2 logs ze-v1
pm2 logs ze-v1-itens
```

## Configurar Lovable Cloud

1. Edite `/app/bridge/.env`:
```env
LOVABLE_ZE_SYNC_KEY=<sua_chave_do_supabase>
```

2. Reinicie o bridge:
```bash
pm2 restart ze-bridge
```

3. Teste a sincronização:
```bash
curl -X POST http://localhost:3333/sync
```

---
*Atualizado: 28/01/2026*
