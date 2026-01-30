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
- [x] Conexão MySQL banco `zedelivery` (porta 3309)
- [x] Logs separados por serviço (/api/services/logs)
- [x] Leitura de arquivos de log (/api/services/logs/files)
- [x] API de sincronização (/api/sync)

### Infraestrutura
- [x] MySQL/MariaDB funcionando (porta 3309 - configuração personalizada)
- [x] PHP-FPM + IMAP configurado
- [x] Apache na porta 8088
- [x] Chromium para Puppeteer
- [x] Wrapper --no-sandbox para ambiente root
- [x] ze_pedido_view.php corrigido para retornar JSON

### PM2 e API Bridge
- [x] pm2.ecosystem.config.js configurado
- [x] API Bridge em /app/bridge/ para Lovable Cloud
- [x] Sincronização a cada 2 minutos funcionando

## Dados do Banco (Importados do Dump Original)
- 42 pedidos
- 81 itens
- 58 produtos

## Arquivos Principais
```
/app/frontend/src/App.js          # Dashboard React
/app/backend/server.py            # API FastAPI  
/app/zedelivery-clean/puppeteer-wrapper.js  # Wrapper Puppeteer
/app/pm2.ecosystem.config.js      # Config PM2
/app/bridge/sync-cron.js          # Sync Lovable Cloud
/app/bridge/.env                  # Variáveis do Bridge
/app/integrador/zeduplo/          # Scripts PHP do legado
/app/startup-24h.sh               # Script de inicialização
/app/docs/resumo_do_projeto.md    # Documentação para gestão
/app/docs/zedelivery_original.sql # Dump completo do banco
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
