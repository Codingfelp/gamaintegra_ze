# Gamatauri Zé Integrador - PRD

## Status: ✅ FUNCIONAL E SINCRONIZANDO COM LOVABLE CLOUD

## O Que Foi Implementado

### Frontend (React)
- [x] Header "Gamatauri Zé" 
- [x] Interface limpa, fundo claro, paleta amarela
- [x] Logs separados (v1.js e v1-itens.js) com visual de terminal escuro
- [x] Detalhes completos dos pedidos (inclui email do entregador se disponível)
- [x] Controles de serviços funcionando
- [x] Status em tempo real dos serviços

### Backend (FastAPI)
- [x] Conexão MySQL Railway Cloud (mainline.proxy.rlwy.net:52996)
- [x] Logs separados por serviço (/api/services/logs)
- [x] Leitura de arquivos de log (/api/services/logs/files)
- [x] API de sincronização (/api/sync)
- [x] Inicialização automática de serviços na startup

### Infraestrutura - SUPERVISOR (não PM2!)
- [x] Scripts gerenciados pelo **Supervisor** (substituiu PM2)
- [x] Chromium instalado e configurado automaticamente
- [x] Limpeza automática de locks do navegador
- [x] Auto-restart com 999 tentativas
- [x] Configuração copiada automaticamente para /etc/supervisor/conf.d/

### Sync com Lovable Cloud
- [x] Sincronização a cada 10 segundos
- [x] Itens enviados em dois formatos (array + JSON string)
- [x] Todos os campos necessários incluídos
- [x] Plano de mapeamento documentado

## Dados do Banco (Railway Cloud)
- 115+ pedidos
- 300+ itens
- 50+ produtos

## Arquivos Principais
```
/app/frontend/src/App.js              # Dashboard React
/app/backend/server.py                # API FastAPI  
/app/backend/startup_services.py      # Inicialização automática
/app/zedelivery-clean/puppeteer-wrapper.js  # Wrapper Puppeteer
/app/ze-scripts.supervisor.conf       # Config Supervisor
/app/bridge/sync-cron.js              # Sync Lovable Cloud (10 seg)
/app/bridge/.env                      # Variáveis do Bridge
/app/docs/plano_mapeamento_lovable.md # Plano para equipe Lovable
/app/docs/resumo_do_projeto.md        # Documentação para gestão
```

## Portas e Banco de Dados
| Serviço | Porta/Host |
|---------|------------|
| Frontend | 3000 |
| Backend | 8001 |
| MySQL Railway | mainline.proxy.rlwy.net:52996 |

## Credenciais Railway MySQL
```env
DB_HOST=mainline.proxy.rlwy.net
DB_PORT=52996
DB_USER=root
DB_PASS=eHeoVCebYyaJVBEBtCLfYNHgRCrxWVXU
DB_NAME=railway
```

## Para Produção (Rodar 24/7 com Supervisor)

```bash
# Os scripts são iniciados automaticamente pelo backend!
# Mas se precisar verificar:

# Ver status dos processos
supervisorctl status ze-v1 ze-v1-itens ze-sync

# Ver logs em tempo real
tail -f /app/logs/ze-v1-out.log
tail -f /app/logs/ze-sync-out.log

# Reiniciar um serviço
supervisorctl restart ze-v1
supervisorctl restart ze-sync
```

## Configurar Lovable Cloud

1. A chave já está em `/app/bridge/.env`:
```env
LOVABLE_SUPABASE_URL=https://uylhfhbedjfhupvkrfrf.supabase.co
LOVABLE_ZE_SYNC_KEY=9c908fa589c8346f6372e24d8fb8e9eb
```

2. Para verificar o sync:
```bash
tail -f /app/logs/ze-sync-out.log
cat /app/logs/sync-payload.json
```

---

## Pendências

### P0 - Crítico
- [ ] Verificar se o problema de `items: []` persiste no Lovable Cloud (do nosso lado está funcionando)
- [ ] Usuário precisa fazer **deploy** para testar os scripts em produção

### P1 - Importante
- [ ] Validar mapeamento de status no lado do Lovable Cloud
- [ ] Testar scripts automaticamente após deploy

### P2 - Baixa Prioridade
- [x] Documentação para o chefe (/app/docs/resumo_do_projeto.md) ✅
- [x] Plano de mapeamento para Lovable (/app/docs/plano_mapeamento_lovable.md) ✅

---

## Changelog

### 31/01/2026
- Migrado de PM2 para **Supervisor** para estabilidade em produção
- Atualizado startup_services.py para inicialização automática
- Instalação automática de Chromium se não existir
- Limpeza automática de locks do navegador
- Sync atualizado para cada 10 segundos
- Documentação completa criada

### 30/01/2026
- Migração completa para Railway Cloud
- Sync para Lovable Cloud funcionando
- Correção do erro 401 no sync

---

*Atualizado: 31/01/2026*
