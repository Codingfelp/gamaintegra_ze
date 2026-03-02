# Guia de Contribuição

Este documento explica como contribuir com o desenvolvimento do Integrador Zé Delivery.

---

## Estrutura do Código

```
/app
├── backend/           # API REST (Python/FastAPI)
├── frontend/          # Dashboard (React)
├── zedelivery-clean/  # Scraper (Node.js/Puppeteer)
├── integrador/        # Processamento de pedidos (PHP)
└── docs/              # Documentação
```

---

## Fluxo de Desenvolvimento

### 1. Clone o repositório
```bash
git clone https://github.com/SEU_USUARIO/integrador-ze-delivery.git
cd integrador-ze-delivery
```

### 2. Crie uma branch para sua feature
```bash
git checkout -b feature/nome-da-feature
```

### 3. Faça suas alterações

### 4. Teste localmente
Siga as instruções em `/docs/SETUP_LOCAL.md`

### 5. Commit suas alterações
```bash
git add .
git commit -m "Descrição clara do que foi feito"
```

### 6. Push para o repositório
```bash
git push origin feature/nome-da-feature
```

### 7. Abra um Pull Request

---

## Convenções de Código

### JavaScript (Scraper)
- Use `const` e `let`, nunca `var`
- Funções assíncronas com `async/await`
- Comentários em português explicando a lógica
- Console.log com emojis para facilitar leitura dos logs:
  -  para telefone
  -  para sucesso
  -  para erro
  -  para busca

### Python (Backend)
- Siga PEP 8
- Type hints são bem-vindos
- Docstrings em português

### React (Frontend)
- Componentes funcionais com hooks
- Tailwind CSS para estilização

---

## Atualizando Seletores

O site do Zé Delivery (seuze.ze.delivery) muda frequentemente, quebrando os seletores CSS.

### Como descobrir novos seletores:

1. Acesse o site e faça login
2. Abra o DevTools (F12)
3. Use a ferramenta de inspeção para encontrar elementos
4. Procure por `id`, `data-testid` ou classes únicas

### Arquivos que precisam ser atualizados:

| Arquivo | O que contém |
|---------|--------------|
| `auto-accept.js` | Seletores para aceite automático |
| `phone-capture-v3.js` | Seletores para captura de telefone |
| `confirm-pickup.js` | Seletores para confirmação de retirada |

### Dica: Salvar HTML para debug

Adicione este código para salvar o HTML quando algo não funcionar:
```javascript
const html = await page.content();
require('fs').writeFileSync('/app/logs/debug.html', html);
```

---

## Adicionando Novos Endpoints na API

1. Edite `/app/backend/server.py`
2. Adicione o endpoint com decorador `@app.get()` ou `@app.post()`
3. Use Pydantic para validação de dados
4. Documente o endpoint com docstring
5. Atualize `/docs/API_SISTEMA_EXTERNO.md`

Exemplo:
```python
class MeuRequest(BaseModel):
    campo1: str
    campo2: Optional[int] = None

@app.post("/api/meu-endpoint")
async def meu_endpoint(request: MeuRequest):
    """
    Descrição do que o endpoint faz
    """
    # Sua lógica aqui
    return {"success": True}
```

---

## Troubleshooting Comum

### Scraper não funciona
1. Verifique se os cookies estão válidos
2. Verifique se os seletores mudaram
3. Olhe os logs em `/app/logs/`

### Telefone não é capturado
1. O fluxo de modal pode ter mudado
2. Inspecione o HTML do site
3. Atualize os seletores em `phone-capture-v3.js`

### API retorna erro 500
1. Verifique conexão com MySQL
2. Olhe os logs do backend
3. Verifique se todas as dependências estão instaladas

---

## Contato

Para dúvidas, entre em contato com a equipe de TI.
