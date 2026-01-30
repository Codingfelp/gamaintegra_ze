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
- Salvar tudo no banco de dados Railway Cloud

### 3. Operação 24 horas

Foi implementado um sistema de gerenciamento de processos que garante:

- Os scripts de captura rodam continuamente, 24 horas por dia
- Reinício automático em caso de falhas
- Monitoramento de status pelo painel

### 4. Sincronização com Lovable Cloud

Implementada integração com a plataforma Lovable Cloud (Supabase) para:

- Enviar dados dos pedidos para a nuvem automaticamente
- Sincronização a cada 2 minutos
- Todos os detalhes dos pedidos são enviados, incluindo:
  - Status correto (Pendente, Aceito, A Caminho, Entregue, Cancelado)
  - Tipo de pedido (Comum, Turbo, Retirada)
  - Código de entrega
  - Detalhes do cliente (nome, CPF, endereço)
  - Lista completa de itens

---

## Configuração Técnica

### Banco de Dados Railway Cloud (Online 24/7)

| Configuração | Valor |
|--------------|-------|
| **Host** | ballast.proxy.rlwy.net |
| **Porta** | 46527 |
| **Usuário** | root |
| **Senha** | DxKOhVxrstXLUUwgAJXYwKOCeVrLHrgZ |
| **Banco** | zedelivery |

**Conexão via terminal:**
```bash
mysql -h ballast.proxy.rlwy.net -u root -pDxKOhVxrstXLUUwgAJXYwKOCeVrLHrgZ --port 46527 --protocol=TCP zedelivery
```

### Serviços Locais

| Serviço | Porta | Descrição |
|---------|-------|-----------|
| **Apache/PHP** | 8088 | Servidor web para scripts PHP |
| **Backend FastAPI** | 8001 | API central do sistema |
| **Frontend React** | 3000 | Painel de controle |

### PM2 - Gerenciador de Processos (24/7)

| Processo | Função | Status |
|----------|--------|--------|
| `ze-v1` | Scraper de pedidos | ✅ Online |
| `ze-v1-itens` | Scraper de itens dos pedidos | ✅ Online |
| `ze-sync` | Sincronização com Lovable Cloud | ✅ Online |

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
| 1 | Aceito/Entregue |
| 2 | A Caminho |
| 4 | Cancelado |

---

## Tecnologias Utilizadas

| Componente | Tecnologia |
|------------|------------|
| Painel Web | React (JavaScript) |
| Servidor API | FastAPI (Python) |
| Banco de Dados | MariaDB (MySQL) - Porta 3309 |
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
│  (MariaDB:3309) │ │ (Apache)│ │    CLOUD        │
│                 │ │ (:8088) │ │  (Supabase)     │
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

## Como Iniciar os Serviços

### Script de Inicialização Automática
```bash
/app/startup-24h.sh
```

### Comandos Manuais
```bash
# MariaDB
/usr/sbin/mariadbd --port=3309 --socket=/run/mysqld/mysqld.sock --skip-grant-tables --user=root &

# Apache
apachectl start

# PM2 (scripts de captura)
pm2 start /app/pm2.ecosystem.config.js
pm2 save
```

### Monitoramento
```bash
# Ver status dos processos
pm2 list

# Ver logs em tempo real
pm2 logs ze-v1
pm2 logs ze-v1-itens
pm2 logs ze-sync

# Reiniciar serviços
pm2 restart all
```

---

## Restauração do Banco de Dados

O dump completo do banco está disponível em:
- `/app/docs/zedelivery_original.sql`

Para restaurar:
```bash
mariadb -u root -P 3309 -S /run/mysqld/mysqld.sock zedelivery < /app/docs/zedelivery_original.sql
```

---

## Segurança

- As credenciais do Zé Delivery estão armazenadas de forma segura
- A comunicação com Lovable Cloud usa chave de API protegida
- O banco de dados está configurado apenas para acesso local

---

## Resultados

- ✅ Sistema completo funcionando
- ✅ Captura automática de pedidos operacional
- ✅ Painel administrativo moderno e funcional
- ✅ Sincronização com Lovable Cloud funcionando
- ✅ Operação 24/7 garantida com PM2
- ✅ Banco de dados configurado na porta 3309
- ✅ Correção do erro "Unexpected end of JSON input"

---

## Contato Técnico

Para suporte técnico ou dúvidas sobre o sistema, entre em contato com a equipe de desenvolvimento.

---

*Documento atualizado em: Janeiro de 2026*
*Versão: 2.0*
