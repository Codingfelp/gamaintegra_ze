# Guia Completo: Scraper Zé Delivery

Este guia documenta como o scraper do Zé Delivery funciona, incluindo login, aceite automático, captura de telefone e detalhes dos pedidos.

## Visão Geral da Arquitetura

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   seu.ze.delivery │────▶│  SCRAPER (v1.js) │────▶│   MySQL Local   │
│   (Website Zé)    │     │  (Puppeteer)     │     │   (Railway)     │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                                                        ▼
                                                ┌─────────────────┐
                                                │    Supabase     │
                                                │ (sync-cron.js)  │
                                                └─────────────────┘
```

## Fluxo Principal

```
1. LOGIN → 2. ACEITAR PEDIDO → 3. CAPTURAR TELEFONE → 4. CAPTURAR DETALHES
```

---

## 1. LOGIN NO ZÉ DELIVERY

### Código de Login (`fazerLogin`)

```javascript
const puppeteer = require('puppeteer');

// Configuração do navegador
async function iniciarNavegador() {
    const browser = await puppeteer.launch({
        headless: false, // true para produção, false para debug
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--window-size=1920,1080'
        ],
        userDataDir: './profile-ze' // Salvar sessão para não precisar logar toda vez
    });
    return browser;
}

// Função para digitar em campos com Shadow DOM
async function typeInShadowInput(page, selector, value, delay = 100) {
    const hostHandle = await page.$(selector);
    const inputHandle = await page.evaluateHandle((host) => {
        return host.shadowRoot.querySelector('input');
    }, hostHandle);

    await inputHandle.focus();
    await page.evaluate((input) => input.value = '', inputHandle);

    for (const char of value) {
        await page.keyboard.type(char, { delay });
    }

    await page.evaluate((input) => {
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
    }, inputHandle);
}

// Função principal de login
async function fazerLogin(page, email, senha) {
    console.log('Iniciando login...');
    
    // Navegar para página de login
    await page.goto("https://seu.ze.delivery/login", { 
        waitUntil: 'networkidle2', 
        timeout: 60000 
    });
    
    await sleep(3);

    // Preencher email
    await typeInShadowInput(page, 'hexa-v2-input-text[name="email"]', email, 100);
    
    // Preencher senha
    await typeInShadowInput(page, 'hexa-v2-input-text[name="password"]', senha, 100);

    // Marcar checkbox "Manter conectado"
    const checkboxHost = await page.$('hexa-v2-checkbox[name="test-checkbox"]');
    if (checkboxHost) {
        const shadowRoot = await checkboxHost.evaluateHandle(el => el.shadowRoot);
        const inputHandle = await shadowRoot.$('input[type="checkbox"]');
        if (inputHandle) {
            const checked = await (await inputHandle.getProperty('checked')).jsonValue();
            if (!checked) await inputHandle.click();
        }
    }

    // Clicar no botão de login
    const loginBtn = await page.$('hexa-v2-button');
    const shadowRoot = await loginBtn.evaluateHandle(el => el.shadowRoot);
    const buttonInsideShadow = await shadowRoot.$('button');
    await buttonInsideShadow.click();

    // Aguardar resposta
    await sleep(10);

    // Verificar se precisa de 2FA
    const btnSendEmail = await page.$("#send-email-button");
    if (btnSendEmail) {
        console.log('2FA necessário - código será enviado por email');
        await page.click("#send-email-button");
        
        // Aqui você precisa implementar a captura do código do email
        // (ver seção de integração com Gmail)
        const codigo2FA = await obterCodigo2FA(); // Implementar
        
        // Preencher código 2FA
        for (let i = 0; i < codigo2FA.length; i++) {
            await page.type(`#verification-code-input-${i}`, codigo2FA[i], { delay: 250 });
        }
        
        await page.click("#send-code-verification");
        await page.waitForNavigation({ timeout: 30000, waitUntil: 'networkidle2' });
    }

    // Salvar cookies para sessões futuras
    const cookies = await page.cookies();
    require('fs').writeFileSync('./cookies.json', JSON.stringify(cookies, null, 2));
    
    console.log('Login concluído!');
}
```

### Restaurar Sessão Salva

```javascript
async function restaurarSessao(page) {
    try {
        const cookiesFile = require('fs').readFileSync('./cookies.json', 'utf8');
        const cookies = JSON.parse(cookiesFile);
        await page.setCookie(...cookies);
        console.log('Sessão restaurada');
        return true;
    } catch (e) {
        console.log('Sem sessão salva, precisa fazer login');
        return false;
    }
}
```

---

## 2. ACEITAR PEDIDOS AUTOMATICAMENTE

### Página de Pedidos Novos

URL: `https://seu.ze.delivery/poc-orders`

Esta página mostra um Kanban com colunas:
- **Novos** (pedidos aguardando aceite)
- **Aceitos** (pedidos já aceitos)
- **Em Andamento** (pedidos com entregador)
- **Concluídos** (pedidos entregues)

### Código de Aceite Automático (`aceitaScript`)

```javascript
async function aceitarPedidosAutomaticamente(page) {
    console.log('Iniciando monitoramento de pedidos...');
    
    // Navegar para página de pedidos
    await page.goto("https://seu.ze.delivery/poc-orders", {
        waitUntil: "networkidle2",
        timeout: 60000
    });

    while (true) {
        try {
            // Verificar se há pedidos novos na coluna Kanban
            const pedidoNovo = await page.evaluate(() => {
                // Buscar coluna de pedidos novos
                const colunaNovos = document.querySelector('[data-testid="kanban-column-body-new-orders"]');
                if (!colunaNovos) return { found: false, reason: 'coluna_nao_encontrada' };
                
                // Verificar se tem mensagem de "sem pedidos"
                const semPedidos = colunaNovos.querySelector('#no-new-orders-message');
                if (semPedidos && semPedidos.offsetParent !== null) {
                    return { found: false, reason: 'sem_pedidos_novos' };
                }
                
                // Buscar cards de pedidos
                const cards = colunaNovos.querySelectorAll('[class*="card"], [data-testid*="card"]');
                for (let i = 0; i < cards.length; i++) {
                    const card = cards[i];
                    if (card.offsetParent && card.offsetHeight > 20) {
                        // Extrair ID do pedido
                        const texto = card.innerText || '';
                        const match = texto.match(/(\d{3}\s*\d{3}\s*\d{3})/);
                        const orderId = match ? match[1].replace(/\s+/g, '') : '';
                        
                        return { found: true, orderId, cardIndex: i };
                    }
                }
                
                return { found: false, reason: 'nenhum_card' };
            });

            if (!pedidoNovo.found) {
                console.log(`Aguardando pedidos... (${pedidoNovo.reason})`);
                await sleep(3);
                await page.reload({ waitUntil: "networkidle2" });
                continue;
            }

            console.log(`PEDIDO NOVO: ${pedidoNovo.orderId}`);

            // OPÇÃO 1: Clicar no card para abrir modal
            await clicarNoCard(page, pedidoNovo.cardIndex);
            await sleep(2);
            
            // Clicar no botão "Aceitar" no modal
            await clicarBotaoAceitar(page);
            
            console.log(`Pedido ${pedidoNovo.orderId} aceito!`);
            
            await sleep(2);
            
        } catch (error) {
            console.error('Erro no aceite:', error.message);
            await page.reload({ waitUntil: "networkidle2" });
        }
    }
}

// Clicar no card do pedido
async function clicarNoCard(page, cardIndex) {
    await page.evaluate((idx) => {
        const coluna = document.querySelector('[data-testid="kanban-column-body-new-orders"]');
        if (!coluna) return false;
        
        const cards = coluna.querySelectorAll('[class*="card"]');
        if (cards[idx]) {
            cards[idx].click();
            return true;
        }
        return false;
    }, cardIndex);
}

// Clicar no botão Aceitar
async function clicarBotaoAceitar(page) {
    const clicou = await page.evaluate(() => {
        // Buscar hexa-v2-button com texto "Aceitar"
        const hexaBtns = document.querySelectorAll('hexa-v2-button');
        for (const btn of hexaBtns) {
            const label = btn.getAttribute('label') || '';
            if (label.toLowerCase().includes('aceitar')) {
                if (btn.shadowRoot) {
                    const innerBtn = btn.shadowRoot.querySelector('button');
                    if (innerBtn && !innerBtn.disabled) {
                        innerBtn.click();
                        return true;
                    }
                }
            }
            // Verificar texto dentro do shadow
            if (btn.shadowRoot) {
                const innerBtn = btn.shadowRoot.querySelector('button');
                if (innerBtn && innerBtn.textContent?.toLowerCase().includes('aceitar')) {
                    innerBtn.click();
                    return true;
                }
            }
        }
        
        // Fallback: buscar botão normal
        const buttons = document.querySelectorAll('button');
        for (const btn of buttons) {
            if (btn.textContent?.toLowerCase().includes('aceitar') && !btn.disabled) {
                btn.click();
                return true;
            }
        }
        
        return false;
    });
    
    if (!clicou) {
        throw new Error('Botão Aceitar não encontrado');
    }
}
```

---

## 3. CAPTURAR TELEFONE DO CLIENTE

### Fluxo para Revelar Telefone

O Zé Delivery esconde o telefone do cliente por padrão. Para revelá-lo:

1. Clicar em "Ver telefone"
2. Selecionar motivo: "Problemas com a entrega"
3. Selecionar sub-motivo: "O entregador não encontra o cliente"
4. Clicar em "Confirmar"
5. Telefone aparece no elemento `#customer-phone`

### Código de Captura de Telefone

```javascript
async function capturarTelefone(page) {
    console.log('Iniciando captura de telefone...');

    // PASSO 1: Verificar se telefone já está visível
    const telefoneJaVisivel = await page.evaluate(() => {
        const el = document.querySelector('#customer-phone');
        if (!el) return '';
        
        if (el.shadowRoot) {
            const p = el.shadowRoot.querySelector('p, span');
            const txt = p ? p.textContent.trim() : '';
            const nums = txt.replace(/\D/g, '');
            if (nums.length >= 10) return nums;
        }
        
        const nums = el.textContent.replace(/\D/g, '');
        return nums.length >= 10 ? nums : '';
    });

    if (telefoneJaVisivel) {
        console.log('Telefone já visível:', telefoneJaVisivel);
        return telefoneJaVisivel;
    }

    // PASSO 2: Clicar em "Ver telefone"
    const clicouVerTelefone = await page.evaluate(() => {
        // Buscar link ou botão
        for (const a of document.querySelectorAll('a')) {
            if (a.textContent.trim().toLowerCase().includes('ver telefone')) {
                a.click();
                return true;
            }
        }
        for (const el of document.querySelectorAll('button, span, div')) {
            if (el.textContent.trim().toLowerCase() === 'ver telefone') {
                el.click();
                return true;
            }
        }
        // hexa-v2-button
        for (const btn of document.querySelectorAll('hexa-v2-button')) {
            if (btn.getAttribute('label')?.toLowerCase().includes('ver telefone')) {
                if (btn.shadowRoot) {
                    btn.shadowRoot.querySelector('button')?.click();
                    return true;
                }
            }
        }
        return false;
    });

    if (!clicouVerTelefone) {
        console.log('Botão "Ver telefone" não encontrado');
        return '';
    }

    console.log('Clicou em "Ver telefone"');
    await sleep(2);

    // PASSO 3: Selecionar "Problemas com a entrega"
    const clicouProblemas = await page.evaluate(() => {
        const el = document.querySelector('#REASON_CATEGORY_DELIVERY_PROBLEM > div');
        if (el) { el.click(); return true; }
        
        for (const div of document.querySelectorAll('div, label')) {
            if (div.textContent.toLowerCase().includes('problemas com a entrega')) {
                div.click();
                return true;
            }
        }
        return false;
    });

    if (!clicouProblemas) {
        console.log('Opção "Problemas com a entrega" não encontrada');
        await page.keyboard.press('Escape');
        return '';
    }

    console.log('Selecionou "Problemas com a entrega"');
    await sleep(2);

    // PASSO 4: Selecionar "O entregador não encontra o cliente"
    const clicouEntregador = await page.evaluate(() => {
        const radio = document.querySelector('#REASON_ITEM_DELIVERY_DOES_NOT_FIND_THE_CUSTOMER');
        if (radio) { radio.click(); return true; }
        
        const label = document.querySelector('label[for="REASON_ITEM_DELIVERY_DOES_NOT_FIND_THE_CUSTOMER"]');
        if (label) { label.click(); return true; }
        
        for (const el of document.querySelectorAll('label, div, span')) {
            if (el.textContent.toLowerCase().includes('não encontra o cliente')) {
                el.click();
                return true;
            }
        }
        return false;
    });

    if (!clicouEntregador) {
        console.log('Radio não encontrado');
        await page.keyboard.press('Escape');
        return '';
    }

    console.log('Selecionou "Entregador não encontra cliente"');
    await sleep(1);

    // PASSO 5: Clicar em "Confirmar"
    const clicouConfirmar = await page.evaluate(() => {
        for (const btn of document.querySelectorAll('button')) {
            if (btn.textContent.trim().toLowerCase() === 'confirmar' && !btn.disabled) {
                btn.click();
                return true;
            }
        }
        for (const btn of document.querySelectorAll('hexa-v2-button')) {
            if (btn.getAttribute('label')?.toLowerCase() === 'confirmar') {
                if (btn.shadowRoot) {
                    const inner = btn.shadowRoot.querySelector('button');
                    if (inner && !inner.disabled) { inner.click(); return true; }
                }
            }
        }
        return false;
    });

    if (!clicouConfirmar) {
        console.log('Botão "Confirmar" não encontrado');
        await page.keyboard.press('Escape');
        return '';
    }

    console.log('Clicou em "Confirmar"');
    await sleep(4);

    // PASSO 6: Capturar o telefone revelado
    const telefone = await page.evaluate(() => {
        const el = document.querySelector('#customer-phone');
        if (el) {
            if (el.shadowRoot) {
                const inner = el.shadowRoot.querySelector('p, span');
                const nums = (inner?.textContent || '').replace(/\D/g, '');
                if (nums.length >= 10) return nums;
            }
            const nums = el.textContent.replace(/\D/g, '');
            if (nums.length >= 10) return nums;
        }

        // Buscar na página inteira
        const texto = document.body.innerText || '';
        const match = texto.match(/\(?\d{2}\)?\s*\d{4,5}[-\s]?\d{4}/);
        if (match) return match[0].replace(/\D/g, '');
        
        return '';
    });

    if (telefone && telefone.length >= 10) {
        console.log('Telefone capturado:', telefone);
        return telefone;
    }

    console.log('Telefone não encontrado após fluxo');
    return '';
}
```

---

## 4. CAPTURAR DETALHES DO PEDIDO

### Página de Detalhes

URL: `https://seu.ze.delivery/order/{ORDER_ID}`

### Código de Captura de Detalhes

```javascript
async function capturarDetalhesPedido(page, orderId) {
    console.log(`Capturando detalhes do pedido ${orderId}...`);
    
    await page.goto(`https://seu.ze.delivery/order/${encodeURIComponent(orderId)}`, {
        waitUntil: "networkidle2"
    });
    
    await sleep(3);
    
    // Capturar dados da área de impressão (texto plano, sem Shadow DOM)
    const dados = await page.evaluate(() => {
        const resultado = {
            codigoColeta: '',
            tipoPedido: '',
            bairro: '',
            endereco: '',
            complemento: '',
            cidadeUF: '',
            cep: '',
            cliente: '',
            cpf: '',
            itens: [],
            subtotal: '',
            frete: '',
            desconto: '',
            taxaConveniencia: '',
            troco: '',
            total: ''
        };
        
        // CÓDIGO DE COLETA
        const paragrafos = document.querySelectorAll('#print-content p');
        for (const p of paragrafos) {
            if (p.textContent.includes('Código de coleta:')) {
                const span = p.querySelector('span');
                if (span) resultado.codigoColeta = span.textContent.trim();
                break;
            }
        }
        
        // TIPO DO PEDIDO
        const tipoEl = document.querySelector('[data-testid="delivery-type-label"]');
        if (tipoEl) {
            const texto = tipoEl.textContent.trim().toLowerCase();
            if (texto.includes('turbo')) resultado.tipoPedido = 'Pedido Turbo';
            else if (texto.includes('retirada')) resultado.tipoPedido = 'Pedido Retirada';
            else resultado.tipoPedido = 'Pedido Comum';
        }
        
        // BAIRRO
        const bairroEl = document.querySelector('#neighborhood-info, #address-neighborhood');
        if (bairroEl) resultado.bairro = bairroEl.textContent.trim();
        
        // ENDEREÇO
        const ruaEl = document.querySelector('#main-street');
        if (ruaEl) resultado.endereco = ruaEl.textContent.trim();
        
        // CIDADE/UF
        const cidadeEl = document.querySelector('#address-city-province');
        if (cidadeEl) resultado.cidadeUF = cidadeEl.textContent.trim();
        
        // CLIENTE
        const clienteEl = document.querySelector('#print-customer-name');
        if (clienteEl) resultado.cliente = clienteEl.textContent.trim();
        
        // CPF
        const textoGeral = document.body.innerText || '';
        const cpfMatch = textoGeral.match(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/);
        if (cpfMatch) resultado.cpf = cpfMatch[0];
        
        // ITENS DO PEDIDO
        const itensContainer = document.querySelectorAll('#bought-items [data-testid="bought-items"]');
        itensContainer.forEach(item => {
            const qtdEl = item.querySelector('#item-quantity');
            const nomeEl = item.querySelector('#item-name');
            const precoEl = item.querySelector('#item-price span');
            
            const quantidade = qtdEl ? qtdEl.textContent.trim() : '1';
            const nome = nomeEl ? nomeEl.textContent.trim() : '';
            let preco = precoEl ? precoEl.textContent.trim() : '';
            preco = preco.replace('R$', '').replace(/\s/g, '').replace(',', '.').trim();
            
            if (nome) {
                resultado.itens.push({ nome, quantidade, preco });
            }
        });
        
        // VALORES FINANCEIROS
        const extrairValor = (seletor) => {
            const el = document.querySelector(seletor);
            if (el) {
                const spans = el.querySelectorAll('span');
                if (spans.length >= 2) {
                    return spans[spans.length - 1].textContent
                        .replace('R$', '').replace(/\s/g, '').replace(',', '.').trim();
                }
            }
            return '';
        };
        
        resultado.subtotal = extrairValor('#payment-details-subtotal');
        resultado.frete = extrairValor('#payment-details-freight');
        resultado.desconto = extrairValor('#payment-details-discount');
        resultado.taxaConveniencia = extrairValor('#payment-details-convenience-fee');
        
        const totalEl = document.querySelector('#payment-details-total strong span');
        if (totalEl) {
            resultado.total = totalEl.textContent.replace('R$', '').replace(',', '.').trim();
        }
        
        return resultado;
    });
    
    // Capturar telefone
    dados.telefone = await capturarTelefone(page);
    
    console.log('Dados capturados:', dados);
    return dados;
}
```

---

## 5. SCRIPT COMPLETO INTEGRADO

```javascript
const puppeteer = require('puppeteer');
const fs = require('fs');

// Configurações
const CONFIG = {
    email: 'seu@email.com',
    senha: 'sua_senha',
    profileDir: './chrome-profile'
};

function sleep(sec) {
    return new Promise(resolve => setTimeout(resolve, sec * 1000));
}

async function main() {
    console.log('=== INICIANDO SCRAPER ZÉ DELIVERY ===');
    
    // 1. Iniciar navegador
    const browser = await puppeteer.launch({
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        userDataDir: CONFIG.profileDir
    });
    
    const page = await browser.newPage();
    
    // 2. Restaurar sessão ou fazer login
    const sessaoRestaurada = await restaurarSessao(page);
    
    if (!sessaoRestaurada) {
        await fazerLogin(page, CONFIG.email, CONFIG.senha);
    }
    
    // 3. Verificar se login funcionou
    await page.goto('https://seu.ze.delivery/home', { waitUntil: 'networkidle2' });
    
    if (page.url().includes('login')) {
        console.log('Sessão expirada, fazendo login...');
        await fazerLogin(page, CONFIG.email, CONFIG.senha);
    }
    
    console.log('Logado com sucesso!');
    
    // 4. Loop principal
    while (true) {
        try {
            // Navegar para página de pedidos novos
            await page.goto('https://seu.ze.delivery/poc-orders', { waitUntil: 'networkidle2' });
            
            // Verificar se há pedidos novos
            const pedidoNovo = await verificarPedidosNovos(page);
            
            if (pedidoNovo) {
                console.log(`\n>>> NOVO PEDIDO: ${pedidoNovo.orderId} <<<\n`);
                
                // Aceitar pedido
                await aceitarPedido(page, pedidoNovo);
                
                // Navegar para detalhes
                const detalhes = await capturarDetalhesPedido(page, pedidoNovo.orderId);
                
                // Salvar em arquivo ou enviar para API
                fs.appendFileSync('./pedidos.json', JSON.stringify({
                    timestamp: new Date().toISOString(),
                    orderId: pedidoNovo.orderId,
                    ...detalhes
                }) + '\n');
                
                console.log(`Pedido ${pedidoNovo.orderId} processado e salvo!`);
            } else {
                console.log('Aguardando pedidos novos...');
            }
            
            await sleep(5); // Verificar a cada 5 segundos
            
        } catch (error) {
            console.error('Erro:', error.message);
            await sleep(10);
        }
    }
}

main().catch(console.error);
```

---

## Seletores Importantes

| Elemento | Seletor |
|----------|---------|
| Campo Email | `hexa-v2-input-text[name="email"]` |
| Campo Senha | `hexa-v2-input-text[name="password"]` |
| Botão Login | `hexa-v2-button` (primeiro da página) |
| Botão 2FA | `#send-email-button` |
| Inputs 2FA | `#verification-code-input-0` até `#verification-code-input-5` |
| Confirmar 2FA | `#send-code-verification` |
| Coluna Novos (Kanban) | `[data-testid="kanban-column-body-new-orders"]` |
| Sem Pedidos Novos | `#no-new-orders-message` |
| Botão Ver Telefone | Texto "Ver telefone" em `<a>` ou `<button>` |
| Problemas Entrega | `#REASON_CATEGORY_DELIVERY_PROBLEM` |
| Entregador Não Encontra | `#REASON_ITEM_DELIVERY_DOES_NOT_FIND_THE_CUSTOMER` |
| Telefone Cliente | `#customer-phone` |
| Código Coleta | `#print-content p` com "Código de coleta:" |
| Itens Pedido | `#bought-items [data-testid="bought-items"]` |

---

## Notas sobre Shadow DOM

O site do Zé Delivery usa Web Components com Shadow DOM. Para acessar elementos dentro:

```javascript
// Elemento com shadow root
const hostElement = await page.$('hexa-v2-input-text');

// Acessar input dentro do shadow
const input = await page.evaluateHandle((host) => {
    return host.shadowRoot.querySelector('input');
}, hostElement);

// Digitar no input
await input.type('texto');
```

---

## Dicas de Debug

1. **Screenshots em cada etapa:**
```javascript
await page.screenshot({ path: `debug-${Date.now()}.png` });
```

2. **Listar todos data-testid da página:**
```javascript
const testIds = await page.evaluate(() => {
    return [...document.querySelectorAll('[data-testid]')]
        .map(el => el.getAttribute('data-testid'));
});
console.log(testIds);
```

3. **Salvar HTML para análise:**
```javascript
const html = await page.content();
fs.writeFileSync('page.html', html);
```

---

## Problemas Comuns

| Problema | Solução |
|----------|---------|
| Login expira rápido | Marcar checkbox "Manter conectado" |
| 2FA toda vez | Salvar cookies após login bem-sucedido |
| Elementos não encontrados | Usar Shadow DOM corretamente |
| Timeout na navegação | Aumentar timeout e usar `networkidle2` |
| Pedido entregue antes de capturar telefone | Executar captura imediatamente após aceitar |

---

## Integração com Gmail (para 2FA)

Para capturar o código 2FA automaticamente, você precisa:

1. Configurar OAuth2 com Gmail API
2. Buscar emails do remetente do Zé Delivery
3. Extrair o código de 6 dígitos do corpo do email

Veja o arquivo `/app/integrador/gmail-oauth-setup.js` para exemplo de implementação.
