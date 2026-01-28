# Relatório do Projeto: Gamatauri Zé Integrador

## Resumo Executivo

Este documento apresenta o trabalho realizado no desenvolvimento do sistema **Gamatauri Zé**, uma solução completa para integração com a plataforma Zé Delivery. O sistema permite capturar pedidos automaticamente, gerenciá-los através de um painel administrativo moderno, e sincronizar os dados com a nuvem.

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
- Salvar tudo no banco de dados local

### 3. Operação 24 horas

Foi implementado um sistema de gerenciamento de processos que garante:

- Os scripts de captura rodam continuamente, 24 horas por dia
- Reinício automático em caso de falhas
- Monitoramento de status pelo painel

### 4. Sincronização com Lovable Cloud

Implementada integração com a plataforma Lovable Cloud (Supabase) para:

- Enviar dados dos pedidos para a nuvem automaticamente
- Sincronização a cada 2 minutos
- Todos os detalhes dos pedidos são enviados, incluindo itens

---

## Tecnologias Utilizadas

| Componente | Tecnologia |
|------------|------------|
| Painel Web | React (JavaScript) |
| Servidor API | FastAPI (Python) |
| Banco de Dados | MariaDB (MySQL) |
| Automação | Node.js + Puppeteer |
| Gerenciador de Processos | PM2 |
| Servidor Web | Apache + PHP |

---

## Estrutura do Sistema

```
┌─────────────────────────────────────────────────────┐
│                   PAINEL WEB                         │
│              (Interface do Usuário)                  │
└────────────────────────┬────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────┐
│                    API CENTRAL                       │
│              (Servidor FastAPI)                      │
│    - Gerencia pedidos                                │
│    - Controla serviços                               │
│    - Fornece logs                                    │
└────────────────────────┬────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
┌────────▼────────┐ ┌────▼────┐ ┌────────▼────────┐
│  BANCO DE DADOS │ │  PHP    │ │   LOVABLE       │
│    (MariaDB)    │ │ (Apache)│ │    CLOUD        │
│                 │ │         │ │  (Supabase)     │
└─────────────────┘ └─────────┘ └─────────────────┘
         ▲
         │
┌────────┴─────────────────────────────┐
│       SCRIPTS DE CAPTURA             │
│  (Node.js + Puppeteer rodando 24/7)  │
│                                       │
│  v1.js      → Captura pedidos        │
│  v1-itens.js → Captura itens         │
└──────────────────────────────────────┘
```

---

## Como Acessar

- **Painel Web**: Acesse pelo navegador no endereço configurado
- **Porta do Painel**: 3000
- **Porta da API**: 8001
- **Banco de Dados**: 3306

---

## Segurança

- As credenciais do Zé Delivery estão armazenadas de forma segura
- A comunicação com Lovable Cloud usa chave de API protegida
- O banco de dados está configurado apenas para acesso local

---

## Manutenção

### Verificar se os serviços estão rodando:
O próprio painel mostra o status de cada serviço (MySQL, PHP, Integrador, Itens)

### Visualizar logs:
O painel possui área dedicada para visualização dos logs em tempo real

### Reiniciar serviços:
Use os botões de controle no painel ou acesse o servidor e execute:
```bash
pm2 restart all
```

---

## Resultados

- ✅ Sistema completo funcionando
- ✅ Captura automática de pedidos operacional
- ✅ Painel administrativo moderno e funcional
- ✅ Sincronização com Lovable Cloud configurada
- ✅ Operação 24/7 garantida

---

## Contato Técnico

Para suporte técnico ou dúvidas sobre o sistema, entre em contato com a equipe de desenvolvimento.

---

*Documento gerado em: Janeiro de 2026*
*Versão: 1.0*
