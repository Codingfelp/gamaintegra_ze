# Gamatauri Zé Integrador - PRD

## Status: ✅ FUNCIONAL COM SUPORTE A PRODUÇÃO

## Atualização 31/01/2026 - Suporte a Produção

### Problema Resolvido
Os scripts não rodavam em produção porque o Supervisor do Emergent só aceita scripts definidos no arquivo principal (`supervisord.conf`), que é **readonly**. Scripts adicionados em `/etc/supervisor/conf.d/` são ignorados em produção.

### Solução Implementada
O backend agora tem **duas formas** de iniciar os scripts:

1. **Modo Supervisor** (preview): Usa `supervisorctl` 
2. **Modo Manual** (produção): Usa `nohup` diretamente

**Detecção automática:** O código detecta qual modo usar testando se `supervisorctl status ze-sync` funciona.

**Watchdog:** Um thread verifica a cada 60 segundos se os scripts estão rodando e os reinicia se caírem.

## Arquitetura de Inicialização

```
Backend Inicia
     │
     ▼
ensure_services_running()
     │
     ├─► Instala Apache + PHP (se necessário)
     ├─► Instala Chromium (se necessário)
     ├─► Limpa locks do Chromium
     ├─► Instala dependências Node.js
     │
     ▼
Testa: supervisorctl status ze-sync
     │
     ├─► "RUNNING/STOPPED" → Modo Supervisor
     │        └─► supervisorctl start ze-v1 ze-v1-itens ze-sync
     │
     └─► "ERROR" → Modo Manual (Produção)
              └─► nohup node puppeteer-wrapper.js v1.js &
              └─► nohup node puppeteer-wrapper.js v1-itens.js &
              └─► nohup node sync-cron.js &
     │
     ▼
Watchdog (a cada 60s)
     └─► Verifica se scripts estão vivos
     └─► Reinicia se caíram
```

## Dados do Banco (Railway Cloud)
- 124 pedidos
- 97 Pedido Comum | 16 Pedido de Retirada | 9 Pedido Turbo
- 122 pedidos com itens

## Arquivos Principais
```
/app/backend/server.py                # API + inicialização automática + watchdog
/app/bridge/sync-cron.js              # Sync Lovable Cloud (10 seg)
/app/bridge/force-resync.js           # Script para reenvio completo
/app/ze-scripts.supervisor.conf       # Config Supervisor (preview)
/app/docs/verificacao_producao.md     # Guia de verificação em produção
/app/docs/correcoes_lovable_cloud.md  # Correções para equipe Lovable
```

## Portas e Serviços
| Serviço | Porta | Status |
|---------|-------|--------|
| Frontend React | 3000 | ✅ |
| Backend FastAPI | 8001 | ✅ |
| Apache/PHP | 8088 | ✅ |
| MySQL Railway | 52996 | ✅ |

## Sync com Lovable Cloud
- ✅ Intervalo: 10 segundos
- ✅ Campo `delivery_tipo_pedido` com valores exatos
- ✅ Itens em formato correto (nome, quantidade, preco_unitario, preco_total)
- ✅ Fallback `items_json` disponível
- ✅ 122 pedidos TODOS com itens

## Comandos Úteis

```bash
# Ver status
supervisorctl status
ps aux | grep -E "v1.js|sync-cron.js" | grep -v grep

# Ver logs
tail -f /app/logs/ze-sync-out.log
tail -f /var/log/supervisor/backend.out.log

# Forçar reenvio
cd /app/bridge && node force-resync.js

# Reiniciar tudo
supervisorctl restart backend
```

## Pendências

### Para Usuário
- [ ] **Fazer DEPLOY** e verificar logs com comandos acima
- [ ] Confirmar se itens aparecem corretamente no Lovable Cloud

### Para Equipe Lovable (já feito, apenas verificar)
- [x] Usar `delivery_tipo_pedido` para tipo exato
- [x] Fallback para `items_json`
- [x] employee_id padrão

---

## Changelog

### 31/01/2026 (Sessão Atual)
- **NOVO:** Modo manual de inicialização para produção (nohup)
- **NOVO:** Watchdog que reinicia scripts automaticamente
- **NOVO:** Detecção automática de ambiente (preview vs produção)
- Instalação automática de Apache + PHP + Chromium
- Query SQL corrigida para evitar duplicatas
- Campo `delivery_tipo_pedido` com valores exatos
- Documentação de verificação em produção criada

### 30/01/2026
- Migração para Railway Cloud
- Supervisor substituiu PM2
- Sync atualizado para cada 10 segundos

---

*Atualizado: 31/01/2026 09:25*
