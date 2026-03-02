# Dashboard - Integrador Zé Delivery

Interface web para gerenciamento de pedidos do Zé Delivery.

## Tecnologias

- React 18
- Tailwind CSS
- Shadcn/UI (componentes)
- Axios (requisições HTTP)

## Instalação

```bash
# Instalar dependências
yarn install

# Iniciar em modo desenvolvimento
yarn start

# Build para produção
yarn build
```

## Configuração

Criar arquivo `.env`:

```env
REACT_APP_BACKEND_URL=http://localhost:8001
```

## Estrutura

```
src/
├── App.js              # Componente principal
├── components/
│   ├── ui/            # Componentes Shadcn/UI
│   └── Pedidos/       # Componentes de pedidos
└── index.js           # Entrada da aplicação
```

## Funcionalidades

- Listagem de pedidos com filtros
- Visualização de detalhes do pedido
- Atualização de status
- Busca por código, nome ou telefone
