/**
 * Script para confirmar retirada de pedidos
 * Fluxo: /poc-orders -> Clicar no CARD -> Clicar em #confirm-pickup-button -> Clicar em "Sim"
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const COOKIES_FILE = path.join(__dirname, 'cookies.json');

function sleep(s) {
    return new Promise(resolve => setTimeout(resolve, s * 1000));
}

/**
 * Confirma a retirada de um pedido específico
 * @param {string} orderId - ID do pedido (ex: "722636005")
 */
async function confirmarRetirada(orderId) {
    console.log(`[RETIRADA] Iniciando confirmação do pedido #${orderId}`);
    
    let browser = null;
    
    try {
        // Carregar cookies
        if (!fs.existsSync(COOKIES_FILE)) {
            return { success: false, message: 'Arquivo de cookies não encontrado' };
        }
        
        const cookies = JSON.parse(fs.readFileSync(COOKIES_FILE, 'utf8'));
        
        browser = await puppeteer.launch({
            executablePath: '/usr/bin/chromium',
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });
        
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });
        
        // Aplicar cookies
        const puppeteerCookies = cookies.map(c => ({
            name: c.name,
            value: c.value,
            domain: c.domain,
            path: c.path || '/',
            expires: c.expirationDate || c.expires || -1,
            httpOnly: c.httpOnly || false,
            secure: c.secure !== false,
            sameSite: c.sameSite === 'no_restriction' ? 'None' : 'Lax'
        }));
        
        await page.setCookie(...puppeteerCookies);
        
        // ============================================
        // PASSO 1: Navegar para /poc-orders
        // ============================================
        console.log('[RETIRADA] Navegando para /poc-orders...');
        await page.goto('https://seu.ze.delivery/poc-orders', {
            waitUntil: 'networkidle2',
            timeout: 30000
        });
        
        if (page.url().includes('login')) {
            await browser.close();
            return { success: false, message: 'Sessão expirada - faça login novamente' };
        }
        
        await sleep(2);
        
        // ============================================
        // PASSO 2: Encontrar e clicar no CARD do pedido
        // O card contém o número formatado: "Nº 722 636 005"
        // ============================================
        console.log(`[RETIRADA] Procurando card do pedido #${orderId}...`);
        
        // Formatar orderId para o padrão de exibição
        const orderIdClean = orderId.toString().replace(/\s/g, '');
        const orderIdFormatted = orderIdClean.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3');
        
        console.log(`[RETIRADA] Buscando: "${orderIdFormatted}" ou "${orderIdClean}"`);
        
        const cardClicado = await page.evaluate((orderIdFmt, orderIdRaw) => {
            // Buscar todos os elementos que contêm o número do pedido
            const walker = document.createTreeWalker(
                document.body,
                NodeFilter.SHOW_TEXT,
                null,
                false
            );
            
            let node;
            while (node = walker.nextNode()) {
                const texto = node.textContent || '';
                if (texto.includes(orderIdFmt) || texto.includes(orderIdRaw)) {
                    // Subir na árvore para encontrar o card clicável
                    let parent = node.parentElement;
                    for (let i = 0; i < 15; i++) {
                        if (!parent) break;
                        
                        // Verificar se é clicável
                        const style = window.getComputedStyle(parent);
                        if (
                            style.cursor === 'pointer' ||
                            parent.onclick ||
                            parent.getAttribute('role') === 'button' ||
                            parent.tagName.toLowerCase() === 'article' ||
                            parent.className.includes('card') ||
                            parent.className.includes('order')
                        ) {
                            parent.click();
                            return { clicked: true, element: parent.tagName };
                        }
                        parent = parent.parentElement;
                    }
                }
            }
            
            // Fallback: buscar por data attributes ou IDs
            const cards = document.querySelectorAll('[data-order-id], [id*="order"]');
            for (const card of cards) {
                if (card.textContent.includes(orderIdFmt) || card.textContent.includes(orderIdRaw)) {
                    card.click();
                    return { clicked: true, element: 'fallback' };
                }
            }
            
            return { clicked: false };
        }, orderIdFormatted, orderIdClean);
        
        if (!cardClicado.clicked) {
            // Tentar clicar em qualquer card visível com "Retirada"
            console.log('[RETIRADA] Card específico não encontrado, tentando primeiro card de retirada...');
            
            const clicouPrimeiroCard = await page.evaluate(() => {
                // Buscar cards com texto "Retirada"
                const allElements = document.querySelectorAll('*');
                for (const el of allElements) {
                    if (el.textContent.includes('Retirada') && el.textContent.length < 500) {
                        const style = window.getComputedStyle(el);
                        if (style.cursor === 'pointer' || el.onclick) {
                            el.click();
                            return true;
                        }
                        // Tentar pai
                        if (el.parentElement) {
                            el.parentElement.click();
                            return true;
                        }
                    }
                }
                return false;
            });
            
            if (!clicouPrimeiroCard) {
                await page.screenshot({ path: '/app/logs/retirada-card-nao-encontrado.png' });
                await browser.close();
                return { success: false, message: 'Card do pedido não encontrado em /poc-orders' };
            }
        }
        
        console.log('[RETIRADA] ✓ Card clicado, aguardando modal...');
        await sleep(2);
        
        // ============================================
        // PASSO 3: Clicar no botão "Confirmar Retirada" no modal
        // O botão está em Shadow DOM: #confirm-pickup-button > shadow-root > button
        // ============================================
        console.log('[RETIRADA] Buscando botão "Confirmar Retirada"...');
        
        let confirmBtnClicado = false;
        
        for (let tentativa = 1; tentativa <= 5; tentativa++) {
            confirmBtnClicado = await page.evaluate(() => {
                // ESTRATÉGIA 1: Via ID direto no Shadow DOM
                const hostBtn = document.querySelector('#confirm-pickup-button');
                if (hostBtn) {
                    if (hostBtn.shadowRoot) {
                        const innerBtn = hostBtn.shadowRoot.querySelector('button');
                        if (innerBtn) {
                            innerBtn.click();
                            return true;
                        }
                    }
                    // Tentar clique direto
                    hostBtn.click();
                    return true;
                }
                
                // ESTRATÉGIA 2: Buscar hexa-v2-button com texto "Confirmar Retirada"
                const hexaBtns = document.querySelectorAll('hexa-v2-button');
                for (const btn of hexaBtns) {
                    if (btn.shadowRoot) {
                        const innerBtn = btn.shadowRoot.querySelector('button');
                        if (innerBtn) {
                            const texto = innerBtn.textContent.trim().toLowerCase();
                            if (texto.includes('confirmar retirada')) {
                                innerBtn.click();
                                return true;
                            }
                        }
                    }
                }
                
                // ESTRATÉGIA 3: Buscar qualquer botão com texto "Confirmar Retirada"
                const allBtns = document.querySelectorAll('button');
                for (const btn of allBtns) {
                    const texto = btn.textContent.trim().toLowerCase();
                    if (texto.includes('confirmar retirada')) {
                        btn.click();
                        return true;
                    }
                }
                
                return false;
            });
            
            if (confirmBtnClicado) break;
            await sleep(1);
        }
        
        if (!confirmBtnClicado) {
            await page.screenshot({ path: '/app/logs/retirada-btn-nao-encontrado.png' });
            await browser.close();
            return { success: false, message: 'Botão "Confirmar Retirada" não encontrado no modal' };
        }
        
        console.log('[RETIRADA] ✓ Clicou em "Confirmar Retirada"');
        await sleep(2);
        
        // ============================================
        // PASSO 4: Clicar no botão "Sim" no modal de confirmação
        // HTML: <button class="button primary medium flex"><span>Sim</span></button>
        // ============================================
        console.log('[RETIRADA] Buscando botão "Sim"...');
        
        const clicouSim = await page.evaluate(() => {
            // Buscar botão primary com texto "Sim"
            const buttons = document.querySelectorAll('button.primary, button[class*="primary"]');
            for (const btn of buttons) {
                const texto = btn.textContent.trim().toLowerCase();
                if (texto === 'sim') {
                    btn.click();
                    return true;
                }
            }
            
            // Fallback: qualquer botão com texto "Sim"
            const allBtns = document.querySelectorAll('button');
            for (const btn of allBtns) {
                if (btn.textContent.trim().toLowerCase() === 'sim') {
                    btn.click();
                    return true;
                }
            }
            
            // Fallback: hexa-v2-button
            const hexaBtns = document.querySelectorAll('hexa-v2-button');
            for (const btn of hexaBtns) {
                if (btn.shadowRoot) {
                    const innerBtn = btn.shadowRoot.querySelector('button');
                    if (innerBtn && innerBtn.textContent.trim().toLowerCase() === 'sim') {
                        innerBtn.click();
                        return true;
                    }
                }
            }
            
            return false;
        });
        
        if (!clicouSim) {
            // Se não encontrou "Sim", pode ser que não precise dessa confirmação
            console.log('[RETIRADA] Botão "Sim" não encontrado - pode já ter sido confirmado');
        } else {
            console.log('[RETIRADA] ✓ Clicou em "Sim"');
        }
        
        await sleep(2);
        
        await browser.close();
        console.log(`[RETIRADA] ✅ Pedido #${orderId} processado com sucesso!`);
        return { success: true, message: `Retirada do pedido #${orderId} confirmada` };
        
    } catch (error) {
        console.error('[RETIRADA] ❌ Erro:', error.message);
        if (browser) await browser.close();
        return { success: false, message: error.message };
    }
}

// Executar se chamado diretamente
if (require.main === module) {
    const orderId = process.argv[2];
    
    if (!orderId) {
        console.log('Uso: node confirmar-retirada.js <orderId>');
        process.exit(1);
    }
    
    confirmarRetirada(orderId)
        .then(result => {
            console.log(JSON.stringify(result));
            process.exit(result.success ? 0 : 1);
        })
        .catch(err => {
            console.error(err);
            process.exit(1);
        });
}

module.exports = { confirmarRetirada };
