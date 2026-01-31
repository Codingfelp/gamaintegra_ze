# Gamatauri Zé Integrador - PRD

## Status: ✅ FUNCIONAL E SINCRONIZANDO COM LOVABLE CLOUD

## O Que Foi Implementado (Atualizado 31/01/2026)

### Frontend (React)
- [x] Dashboard com estatísticas em tempo real
- [x] 124 pedidos, R$ 8.361,23 faturamento
- [x] Status de serviços online (MySQL, PHP, Integrador, Itens)
- [x] Lista de últimos pedidos com valores

### Backend (FastAPI)
- [x] Conexão MySQL Railway Cloud (mainline.proxy.rlwy.net:52996)
- [x] API de status dos serviços
- [x] Inicialização automática de Apache + PHP + Chromium + Supervisor

### Infraestrutura - SUPERVISOR + APACHE
- [x] Apache na porta 8088 (necessário para scrapers)
- [x] Scripts gerenciados pelo **Supervisor**
- [x] Chromium instalado automaticamente
- [x] Auto-restart com 999 tentativas

### Sync com Lovable Cloud
- [x] Sincronização a cada 10 segundos
- [x] Query SQL corrigida para evitar duplicatas (prioriza registros COM itens)
- [x] Campo `delivery_tipo_pedido` com valores exatos: "Pedido Comum", "Pedido Turbo", "Pedido de Retirada"
- [x] 122 pedidos TODOS com itens sendo enviados

## Dados do Banco (Railway Cloud)
- 124 pedidos
- 97 Pedido Comum
- 16 Pedido de Retirada  
- 9 Pedido Turbo

## Arquivos Principais
```
/app/backend/server.py                # API FastAPI + inicialização automática
/app/bridge/sync-cron.js              # Sync Lovable Cloud (10 seg)
/app/bridge/force-resync.js           # Script para forçar reenvio de todos
/app/ze-scripts.supervisor.conf       # Config Supervisor
/app/docs/correcoes_lovable_cloud.md  # Correções para equipe Lovable
/app/docs/resumo_do_projeto.md        # Documentação para gestão
/app/docs/plano_mapeamento_lovable.md # Plano técnico de mapeamento
```

## Portas e Serviços
| Serviço | Porta | Status |
|---------|-------|--------|
| Frontend React | 3000 | ✅ |
| Backend FastAPI | 8001 | ✅ |
| Apache/PHP | 8088 | ✅ |
| MySQL Railway | 52996 | ✅ |

## Problemas Resolvidos Nesta Sessão

1. **Scrapers não captavam novos pedidos**
   - Causa: Apache não estava rodando
   - Solução: Instalação automática de Apache + PHP no startup

2. **Pedidos com items: [] vazios**
   - Causa: Registros duplicados no banco - sync pegava o sem itens
   - Solução: Query SQL corrigida para priorizar registros com `delivery_tem_itens = 1`

3. **delivery_tipo_pedido não enviado**
   - Causa: Campo não estava no payload
   - Solução: Adicionado campo `delivery_tipo_pedido` com valor exato do banco

## Comandos Úteis

```bash
# Ver status dos processos
supervisorctl status

# Ver logs em tempo real
tail -f /app/logs/ze-v1-out.log
tail -f /app/logs/ze-sync-out.log

# Forçar reenvio de todos os pedidos
cd /app/bridge && node force-resync.js

# Reiniciar serviços
supervisorctl restart ze-v1 ze-v1-itens ze-sync
```

## Pendências

### Para o Lovable Cloud (responsabilidade deles)
- [ ] Usar `delivery_tipo_pedido` em vez de `delivery_type` para valores exatos
- [ ] Adicionar fallback para `items_json` caso `items` esteja vazio
- [ ] Ver documento `/app/docs/correcoes_lovable_cloud.md`

### Para Deploy em Produção
- [x] Apache instalado automaticamente
- [x] Chromium instalado automaticamente
- [x] Supervisor configurado automaticamente
- [ ] Usuário precisa fazer **DEPLOY** para testar

---

## Changelog

### 31/01/2026 (Sessão Atual)
- Instalação automática de Apache + PHP no startup do backend
- Query SQL corrigida para evitar duplicatas de pedidos
- Campo `delivery_tipo_pedido` adicionado ao payload de sync
- Script `force-resync.js` criado para reenvio completo
- Documentação de correções para equipe Lovable criada
- 122 pedidos reenviados com todos os itens

### 30/01/2026
- Migração completa para Railway Cloud
- Supervisor substituiu PM2
- Sync atualizado para cada 10 segundos

---

*Atualizado: 31/01/2026 09:01*
