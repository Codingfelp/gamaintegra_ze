# Zé Delivery Integrador - PRD (Product Requirements Document)

## Visão Geral
Sistema de integração completo para o Zé Delivery, permitindo captura automática de pedidos, gerenciamento de lojas e monitoramento de serviços em tempo real.

## Problema Original
O usuário precisava de uma interface para monitorar e garantir que o integrador do Zé Delivery e a API rodem 24/7, incluindo:
- Dashboard administrativo para gerenciar pedidos
- Interface para integração de lojas
- Painel de pedidos para monitorar os pedidos
- Painel com logs do node rodando

## Arquitetura

### Stack Tecnológica
- **Frontend**: React.js + Tailwind CSS + shadcn/ui
- **Backend**: Python FastAPI
- **Banco de Dados**: MySQL/MariaDB
- **PHP**: Scripts do zeduplo para processamento de pedidos
- **Node.js**: Scripts do zedelivery-clean para captura automática via Puppeteer
- **Web Server**: Apache HTTP Server (porta 8088)

### Estrutura de Pastas
```
/app/
├── backend/server.py          # API FastAPI
├── frontend/src/App.js        # Dashboard React
├── integrador/
│   ├── database/schema.sql    # Schema MySQL
│   └── zeduplo/               # Scripts PHP
├── zedelivery-clean/          # Scripts Node.js/Puppeteer
│   ├── v1.js                  # Captura de pedidos
│   ├── v1-itens.js            # Captura de itens
│   └── configuracao.json      # Configuração
└── ze-api/                    # API Node.js (centralização)
```

## Funcionalidades Implementadas

### 1. Dashboard Principal
- [x] Cards de estatísticas em tempo real
  - Total de pedidos
  - Pendentes, Aceitos, A Caminho, Entregues, Cancelados
  - Faturamento total
- [x] Status dos serviços (MySQL, PHP, Node Integrador, Node Itens)
- [x] Lista de últimos pedidos

### 2. Gestão de Pedidos
- [x] Tabela de pedidos com filtros por status
- [x] Busca por código ou nome do cliente
- [x] Modal de detalhes do pedido com itens
- [x] Status visual com badges coloridos

### 3. Gestão de Lojas
- [x] Cadastro de novas lojas
- [x] Listagem de lojas com token
- [x] Exclusão de lojas

### 4. Catálogo de Produtos
- [x] Listagem de produtos cadastrados
- [x] Exibição de imagens e códigos do Zé

### 5. Controle de Serviços
- [x] Monitoramento de MySQL, PHP, Node
- [x] Botões para iniciar/parar integradores
- [x] Ações rápidas (Reiniciar, Iniciar Todos, Parar Todos)

### 6. Sistema de Logs
- [x] Visualização de logs em tempo real
- [x] Separação de logs de info e erro

### 7. Configuração
- [x] Exibição de configurações atuais
- [x] URLs configuradas do integrador

## APIs Disponíveis

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/api/health` | GET | Health check |
| `/api/pedidos` | GET | Listar pedidos |
| `/api/pedidos/stats/summary` | GET | Estatísticas |
| `/api/pedidos/{id}` | GET | Detalhes do pedido |
| `/api/pedidos/{id}/status` | PATCH | Atualizar status |
| `/api/lojas` | GET/POST | CRUD Lojas |
| `/api/lojas/{id}` | DELETE | Deletar loja |
| `/api/produtos` | GET | Listar produtos |
| `/api/services/status` | GET | Status serviços |
| `/api/services/logs` | GET | Logs |
| `/api/services/{service}/{action}` | POST | Controlar serviço |
| `/api/config` | GET/PUT | Configuração |
| `/api/duplo` | GET/POST | Código 2FA |

## Banco de Dados

### Tabelas Principais
- `hub_delivery` - Lojas/estabelecimentos
- `ze_pedido` - Pedidos brutos capturados
- `ze_itens_pedido` - Itens dos pedidos brutos
- `delivery` - Pedidos processados
- `delivery_itens` - Itens dos pedidos processados
- `produto` - Catálogo de produtos
- `ze_duplo` - Códigos de verificação 2FA

## Portas e Serviços

| Serviço | Porta | Status |
|---------|-------|--------|
| Frontend React | 3000 | Online |
| Backend FastAPI | 8001 | Online |
| MySQL/MariaDB | 3306 | Online |
| Apache/PHP | 8088 | Online |

## Próximos Passos (Backlog)

### P0 - Crítico
- [ ] Implementar PM2 ou similar para auto-restart dos integradores
- [ ] Configurar variáveis de ambiente para produção

### P1 - Alta Prioridade
- [ ] Adicionar autenticação no dashboard
- [ ] Implementar WebSocket para logs em tempo real
- [ ] Dashboard de performance dos integradores

### P2 - Média Prioridade
- [ ] Gráficos de vendas por período
- [ ] Exportação de relatórios em PDF/Excel
- [ ] Notificações de novos pedidos

### P3 - Baixa Prioridade
- [ ] Tema claro/escuro
- [ ] Multi-idioma
- [ ] App mobile

## Notas Técnicas
- O código original do zeduplo e zedelivery-clean NÃO foi modificado conforme solicitação do usuário
- O integrador Node.js requer Puppeteer com Chrome/Chromium instalado para funcionar
- Os scripts do zedelivery usam headless browser para capturar pedidos do painel Zé Delivery

---
*Última atualização: 28/01/2026*
