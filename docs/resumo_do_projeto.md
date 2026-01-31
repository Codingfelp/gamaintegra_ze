# Relatório do Projeto: Gamatauri Zé Integrador

## Resumo Executivo

Este documento apresenta o trabalho realizado no desenvolvimento do sistema **Gamatauri Zé**, uma solução completa para integração com a plataforma Zé Delivery. O sistema permite capturar pedidos automaticamente, gerenciá-los através de um painel administrativo moderno, e sincronizar os dados com a nuvem Lovable Cloud.

---

## O Que Foi Entregue

### 1. Painel de Controle (Dashboard)

Foi desenvolvida uma interface administrativa moderna e profissional com as seguintes funcionalidades:

- **Visão geral dos pedidos**: Total de pedidos, pendentes, aceitos, entregues e cancelados
- **Faturamento em tempo real**: Valor total dos pedidos entregues
- **Lista de pedidos**: Com filtros por status e busca por nome/código
- **Detalhes completos**: Ao clicar em um pedido, são exibidas todas as informações incluindo:
  - Dados do cliente (nome, CPF, endereço completo)
  - Lista de itens do pedido com quantidades e valores
  - Forma de pagamento e troco
  - Status do pedido

### 2. Captura Automática de Pedidos

O sistema utiliza tecnologia de automação (web scraping) para:

- Conectar automaticamente à plataforma Zé Delivery
- Capturar novos pedidos em tempo real
- Extrair informações completas dos pedidos e seus itens
- Salvar tudo no banco de dados Railway Cloud

### 3. Operação 24 Horas - SUPERVISOR

**IMPORTANTE**: Os scripts agora são gerenciados pelo **Supervisor** (não mais PM2).

Foi implementado um sistema de gerenciamento de processos que garante:

- Os scripts de captura rodam continuamente, 24 horas por dia
- Reinício automático em caso de falhas (até 999 tentativas)
- Instalação automática de dependências (Chromium, Node.js)
- Limpeza automática de locks do navegador
- Monitoramento de status pelo painel

### 4. Sincronização com Lovable Cloud

Implementada integração com a plataforma Lovable Cloud (Supabase) para:

- Enviar dados dos pedidos para a nuvem automaticamente
- **Sincronização a cada 10 segundos** (atualizado de 2 minutos)
- Todos os detalhes dos pedidos são enviados, incluindo:
  - Status correto (Pendente, Aceito, A Caminho, Entregue, Cancelado)
  - Tipo de pedido (Comum, Turbo, Retirada)
  - Código de entrega
  - Detalhes do cliente (nome, CPF, endereço)
  - **Lista completa de itens** (enviada em dois formatos para redundância)

---

## Configuração Técnica

### Banco de Dados Railway Cloud (Online 24/7)

| Configuração | Valor |
|--------------|-------|
| **Host** | mainline.proxy.rlwy.net |
| **Porta** | 52996 |
| **Usuário** | root |
| **Banco** | railway |

### Serviços Locais

| Serviço | Porta | Descrição |
|---------|-------|-----------|
| **Backend FastAPI** | 8001 | API central do sistema |
| **Frontend React** | 3000 | Painel de controle |

### Supervisor - Gerenciador de Processos (24/7)

**Substituiu o PM2** para maior estabilidade na plataforma de deploy.

| Processo | Função | Auto-restart |
|----------|--------|--------------|
| `ze-v1` | Scraper de pedidos | ✅ Sim (999 tentativas) |
| `ze-v1-itens` | Scraper de itens dos pedidos | ✅ Sim (999 tentativas) |
| `ze-sync` | Sincronização com Lovable Cloud | ✅ Sim (999 tentativas) |

**Comandos úteis:**
```bash
# Ver status dos processos
supervisorctl status ze-v1 ze-v1-itens ze-sync

# Ver logs em tempo real
tail -f /app/logs/ze-v1-out.log
tail -f /app/logs/ze-sync-out.log

# Reiniciar um serviço
supervisorctl restart ze-v1
```

---

## Tipos de Pedido Suportados

| Tipo | Campo |
|------|-------|
| **Comum** | `delivery_tipo_pedido = "Pedido Comum"` |
| **Turbo** | `delivery_tipo_pedido = "Pedido Turbo"` |
| **Retirada** | `delivery_tipo_pedido = "Retirada"` |

## Status dos Pedidos

| Código | Status |
|--------|--------|
| 0 | Pendente |
| 2 | Aceito |
| 3 | A Caminho |
| 1 | Entregue |
| 4 | Cancelado |
| 5 | Rejeitado |

---

## Tecnologias Utilizadas

| Componente | Tecnologia |
|------------|------------|
| Painel Web | React (JavaScript) |
| Servidor API | FastAPI (Python) |
| Banco de Dados | MariaDB (Railway Cloud) |
| Automação | Node.js + Puppeteer + Chromium |
| **Gerenciador de Processos** | **Supervisor** |
| Sincronização | Node.js + Supabase |

---

## Estrutura do Sistema

```
┌─────────────────────────────────────────────────────┐
│                   PAINEL WEB                         │
│              (Interface do Usuário)                  │
│                   porta 3000                         │
└────────────────────────┬────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────┐
│                    API CENTRAL                       │
│              (Servidor FastAPI)                      │
│                   porta 8001                         │
│    - Gerencia pedidos                                │
│    - Controla serviços                               │
│    - Fornece logs                                    │
└────────────────────────┬────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
┌────────▼────────┐ ┌────▼────────┐ ┌────▼────────────┐
│  BANCO DE DADOS │ │  SUPERVISOR │ │   LOVABLE       │
│  Railway Cloud  │ │  (Scripts)  │ │    CLOUD        │
│  (MariaDB)      │ │  24/7       │ │  (Supabase)     │
└─────────────────┘ └─────────────┘ └─────────────────┘
         ▲                │
         │                │
         └────────────────┘
           ze-v1, ze-v1-itens, ze-sync
```

---

## Inicialização Automática

O sistema agora **inicializa automaticamente** quando o backend inicia:

1. ✅ Verifica e instala Chromium (se necessário)
2. ✅ Limpa locks do navegador (evita travamentos)
3. ✅ Configura Supervisor com os scripts
4. ✅ Instala dependências Node.js
5. ✅ Inicia todos os processos

**Nenhuma ação manual necessária após o deploy!**

---

## Documentação Adicional

| Documento | Descrição |
|-----------|-----------|
| `/app/docs/plano_mapeamento_lovable.md` | Plano técnico para equipe Lovable Cloud |
| `/app/docs/zedelivery_full_dump.sql` | Dump completo do banco de dados |

---

## Resultados

- ✅ Sistema completo funcionando
- ✅ Captura automática de pedidos operacional
- ✅ Painel administrativo moderno e funcional
- ✅ Sincronização com Lovable Cloud a cada 10 segundos
- ✅ **Operação 24/7 garantida com Supervisor**
- ✅ Banco de dados Railway Cloud configurado
- ✅ Inicialização automática após deploy
- ✅ Todos os itens dos pedidos são enviados corretamente

---

## Contato Técnico

Para suporte técnico ou dúvidas sobre o sistema, entre em contato com a equipe de desenvolvimento.

---

*Documento atualizado em: 31 de Janeiro de 2026*
*Versão: 3.0*
