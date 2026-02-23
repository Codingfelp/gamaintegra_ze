/**
 * Script para confirmar retirada de pedidos
 * Pode ser chamado via webhook ou diretamente
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(__dirname, 'configuracao.json');
const COOKIES_FILE = path.join(__dirname, 'cookies.json');

function sleep(s) {
    return new Promise(resolve => setTimeout(resolve, s * 1000));
}

/**
 * Confirma a retirada de um pedido específico
 * @param {string} orderId - ID do pedido (ex: "472230265")
 * @returns {Promise<{success: boolean, message: string}>}
 */
async function confirmarRetirada(orderId) {
    let browser = null;
    
    try {
        console.log(`🚚 [RETIRADA] Iniciando confirmação do pedido #${orderId}...`);
        
        // Carregar cookies
        if (!fs.existsSync(COOKIES_FILE)) {
            return { success: false, message: 'Arquivo de cookies não encontrado' };
        }
        
        const cookies = JSON.parse(fs.readFileSync(COOKIES_FILE, 'utf8'));
        
        // Iniciar browser
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
        
        // Navegar para a página do pedido
        const orderUrl = `https://seu.ze.delivery/order/${orderId}`;
        console.log(`🌐 [RETIRADA] Navegando para ${orderUrl}...`);
        
        await page.goto(orderUrl, { waitUntil: 'networkidle2', timeout: 30000 });
        
        // Verificar se está logado
        if (page.url().includes('login')) {
            await browser.close();
            return { success: false, message: 'Sessão expirada - faça login novamente' };
        }
        
        await sleep(2);
        
        // ===============================================
        // PASSO 1: Clicar no botão "Confirmar Retirada"
        // Seletor: #confirm-pickup-button
        // ===============================================
        console.log('🔍 [RETIRADA] Buscando botão "Confirmar Retirada"...');
        
        const btnConfirmarRetirada = await page.$('#confirm-pickup-button');
        
        if (!btnConfirmarRetirada) {
            // Fallback: buscar por texto
            const encontrado = await page.evaluate(() => {
                const buttons = document.querySelectorAll('button, hexa-v2-button');
                for (const btn of buttons) {
                    let texto = '';
                    if (btn.shadowRoot) {
                        const inner = btn.shadowRoot.querySelector('button, span');
                        texto = inner?.textContent.trim() || '';
                    }
                    if (!texto) texto = btn.textContent.trim();
                    
                    if (texto.toLowerCase().includes('confirmar retirada')) {
                        if (btn.shadowRoot) {
                            btn.shadowRoot.querySelector('button')?.click();
                        } else {
                            btn.click();
                        }
                        return true;
                    }
                }
                return false;
            });
            
            if (!encontrado) {
                await browser.close();
                return { success: false, message: 'Botão "Confirmar Retirada" não encontrado - pedido pode não ser de retirada' };
            }
        } else {
            // Clicar no botão
            await page.evaluate(el => {
                if (el.shadowRoot) {
                    el.shadowRoot.querySelector('button')?.click();
                } else {
                    el.click();
                }
            }, btnConfirmarRetirada);
        }
        
        console.log('✓ [RETIRADA] Clicou em "Confirmar Retirada"');
        await sleep(2);
        
        // ===============================================
        // PASSO 2: Clicar no botão "Sim" no modal de confirmação
        // Seletor: button.primary com texto "Sim"
        // ===============================================
        console.log('🔍 [RETIRADA] Buscando botão "Sim" no modal...');
        
        const clicouSim = await page.evaluate(() => {
            // Buscar botão com classe "primary" e texto "Sim"
            const buttons = document.querySelectorAll('button.primary, button[class*="primary"]');
            for (const btn of buttons) {
                const texto = btn.textContent.trim().toLowerCase();
                if (texto === 'sim') {
                    btn.click();
                    return true;
                }
            }
            
            // Fallback: hexa-v2-button
            const hexaButtons = document.querySelectorAll('hexa-v2-button');
            for (const btn of hexaButtons) {
                if (btn.shadowRoot) {
                    const inner = btn.shadowRoot.querySelector('button.primary');
                    if (inner && inner.textContent.trim().toLowerCase() === 'sim') {
                        inner.click();
                        return true;
                    }
                }
            }
            
            return false;
        });
        
        if (!clicouSim) {
            await browser.close();
            return { success: false, message: 'Botão "Sim" não encontrado no modal de confirmação' };
        }
        
        console.log('✓ [RETIRADA] Clicou em "Sim"');
        await sleep(2);
        
        // Verificar se a retirada foi confirmada
        const sucesso = await page.evaluate(() => {
            // Verificar se há mensagem de sucesso ou se o status mudou
            const body = document.body.innerText.toLowerCase();
            return body.includes('retirada confirmada') || 
                   body.includes('pedido entregue') ||
                   body.includes('sucesso');
        });
        
        await browser.close();
        
        if (sucesso) {
            console.log(`✅ [RETIRADA] Pedido #${orderId} confirmado com sucesso!`);
            return { success: true, message: `Retirada do pedido #${orderId} confirmada com sucesso` };
        } else {
            console.log(`✅ [RETIRADA] Pedido #${orderId} processado (verificar manualmente)`);
            return { success: true, message: `Pedido #${orderId} processado - verificar status` };
        }
        
    } catch (error) {
        console.error(`❌ [RETIRADA] Erro:`, error.message);
        if (browser) await browser.close();
        return { success: false, message: error.message };
    }
}

// Se executado diretamente com argumento
if (require.main === module) {
    const orderId = process.argv[2];
    
    if (!orderId) {
        console.log('Uso: node confirmar-retirada.js <orderId>');
        console.log('Exemplo: node confirmar-retirada.js 472230265');
        process.exit(1);
    }
    
    confirmarRetirada(orderId)
        .then(result => {
            console.log(JSON.stringify(result, null, 2));
            process.exit(result.success ? 0 : 1);
        })
        .catch(err => {
            console.error('Erro:', err);
            process.exit(1);
        });
}

module.exports = { confirmarRetirada };
