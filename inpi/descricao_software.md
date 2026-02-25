# DESCRIÇÃO DO SOFTWARE PARA REGISTRO NO INPI

## 1. IDENTIFICAÇÃO DO SOFTWARE

**Nome do Software:** IntegraFH

**Versão:** 1.0.0

**Data de Criação:** Janeiro de 2026

**Titular:** FELIPE HUDSON CARVALHO ARAÚJO TIBÚRCIO

**Autor:** FELIPE HUDSON CARVALHO ARAÚJO TIBÚRCIO

---

## 2. OBJETIVO DO SOFTWARE

O **IntegraFH** é um sistema de automação e integração desenvolvido para estabelecimentos comerciais que utilizam plataformas de delivery de terceiros. O software automatiza processos críticos de gestão de pedidos, eliminando a necessidade de intervenção manual constante e reduzindo erros operacionais.

---

## 3. FUNCIONALIDADES PRINCIPAIS

### 3.1 Aceite Automático de Pedidos
- Monitoramento contínuo de plataformas de delivery
- Detecção automática de novos pedidos pendentes
- Aceite automatizado seguindo fluxo específico da plataforma
- Verificação de confirmação do aceite
- Estatísticas de pedidos aceitos em tempo real

### 3.2 Captura de Dados de Pedidos
- Extração automática de informações do cliente (nome, endereço, telefone)
- Captura de itens do pedido com quantidades e valores
- Extração de dados financeiros (subtotal, frete, descontos, cupons)
- Captura de código de entrega e informações do entregador
- Suporte a Shadow DOM e elementos dinâmicos da web

### 3.3 Sincronização com Sistemas Externos
- Integração bidirecional com banco de dados MySQL
- Sincronização com sistemas em nuvem
- Controle de atualizações com debounce e cache
- Prevenção de duplicatas e webhooks redundantes
- Payload incremental para otimização de recursos

### 3.4 Gestão de Sessão e Autenticação
- Persistência automática de sessão do navegador
- Restauração de cookies e dados de autenticação
- Integração com APIs de e-mail para códigos 2FA
- Recuperação automática em caso de expiração

### 3.5 Dashboard de Monitoramento
- Interface web responsiva para acompanhamento em tempo real
- Visualização de pedidos com filtros e busca
- Detalhes completos de cada pedido em modal
- Indicadores de status dos serviços
- Controle de serviços (iniciar, parar, reiniciar)

### 3.6 Confirmação de Retirada
- Botão dedicado para pedidos do tipo "Retirada"
- Automação do fluxo de confirmação na plataforma
- Webhook para integração com sistemas externos

### 3.7 Logs e Auditoria
- Registro de todas as operações em banco de dados
- Logs de integração enviados para sistema em nuvem
- Rate limiting e controle de frequência
- Histórico de erros e tentativas

---

## 4. TECNOLOGIAS UTILIZADAS

### 4.1 Backend
- **Node.js** - Runtime JavaScript para automação
- **Puppeteer** - Automação de navegador headless Chrome/Chromium
- **Python/FastAPI** - API REST para comunicação com frontend
- **PHP** - Scripts de integração com banco de dados legado

### 4.2 Frontend
- **React.js** - Biblioteca JavaScript para interface de usuário
- **Tailwind CSS** - Framework CSS utilitário
- **Shadcn/UI** - Componentes de interface

### 4.3 Banco de Dados
- **MySQL** - Banco de dados relacional principal
- **PostgreSQL** - Banco de dados em nuvem para logs

### 4.4 Infraestrutura
- **Supervisor** - Gerenciamento de processos
- **Nginx** - Servidor web e proxy reverso
- **Docker/Kubernetes** - Containerização e orquestração

### 4.5 Integrações
- **APIs de E-mail** - Leitura de códigos 2FA
- **APIs REST** - Sincronização de dados
- **Integração automatizada com interfaces web de plataformas de terceiros**

---

## 5. PÚBLICO-ALVO

O software é destinado a:

1. **Estabelecimentos comerciais** que utilizam plataformas de delivery como canal de vendas
2. **Operadores de delivery** que precisam gerenciar múltiplos pedidos simultaneamente
3. **Empresas de logística** que integram com plataformas de delivery
4. **Desenvolvedores** que necessitam integrar sistemas com plataformas de delivery

---

## 6. DIFERENCIAIS TÉCNICOS

### 6.1 Automação Inteligente
- Detecção automática de estrutura de página (Kanban, tabelas, modais)
- Suporte a Shadow DOM e componentes web customizados
- Múltiplas estratégias de fallback para cada operação

### 6.2 Otimização de Recursos
- Sistema de cache com hash para detectar mudanças reais
- Debounce configurável para evitar sobrecarga
- Rate limiting para APIs externas
- Sincronização incremental

### 6.3 Resiliência
- Recuperação automática de falhas
- Reinício preventivo para evitar memory leaks
- Persistência de sessão entre reinicializações
- Tratamento de erros em múltiplas camadas

### 6.4 Segurança
- Autenticação via tokens
- Sessões criptografadas
- Logs de auditoria completos
- Controle de acesso por estabelecimento

---

## 7. ARQUITETURA DO SISTEMA

```
┌─────────────────────────────────────────────────────────────────┐
│                         INTEGRAFH                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │  Frontend   │    │   Backend   │    │  Adapter    │         │
│  │   React     │◄──►│   FastAPI   │◄──►│   Node.js   │         │
│  │             │    │   Python    │    │  Puppeteer  │         │
│  └─────────────┘    └──────┬──────┘    └──────┬──────┘         │
│                            │                   │                │
│                            ▼                   ▼                │
│                    ┌───────────────────────────────┐            │
│                    │         MySQL Database        │            │
│                    │    (Pedidos, Itens, Config)   │            │
│                    └───────────────────────────────┘            │
│                                                                 │
│                            │                   │                │
│                            ▼                   ▼                │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │   Cloud     │    │    Email    │    │  Delivery   │         │
│  │   (Logs)    │    │    API      │    │  Platform   │         │
│  └─────────────┘    └─────────────┘    └─────────────┘         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 8. MÓDULOS DO SISTEMA

| Módulo | Arquivo Principal | Função |
|--------|-------------------|--------|
| Aceite Automático | auto-accept.js | Aceita pedidos automaticamente |
| Captura de Itens | capture-items.js | Captura detalhes dos pedidos |
| Sincronização | sync-cron.js | Sincroniza com sistema externo |
| Gestão de Sessão | session-manager.js | Gerencia autenticação |
| Logger | integration-logger.js | Registra operações |
| Controle de Updates | update-controller.js | Controla frequência de atualizações |
| Confirmação Retirada | confirm-pickup.js | Confirma pedidos de retirada |
| Bridge PHP | php-bridge.js | Comunicação com scripts PHP |
| API Backend | server.py | API REST para frontend |
| Interface Web | App.js | Dashboard de monitoramento |

---

## 9. REQUISITOS DE SISTEMA

### Hardware Mínimo
- Processador: 2 cores
- Memória RAM: 2 GB
- Armazenamento: 10 GB

### Software
- Sistema Operacional: Linux (Ubuntu 20.04+) ou Windows Server
- Node.js: v18+
- Python: 3.9+
- PHP: 8.0+
- MySQL: 8.0+
- Chrome/Chromium: Versão atual

---

## 10. LICENÇA E PROPRIEDADE INTELECTUAL

Este software é de propriedade exclusiva de FELIPE HUDSON CARVALHO ARAÚJO TIBÚRCIO, titular registrado no INPI.

Todos os direitos reservados.

A reprodução, distribuição ou modificação não autorizada deste software é proibida por lei.

---

**Documento gerado em:** 25 de Fevereiro de 2026

**Autor:** FELIPE HUDSON CARVALHO ARAÚJO TIBÚRCIO
