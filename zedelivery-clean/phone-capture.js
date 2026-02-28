/**
 * Módulo de Captura de Telefone via Página poc-orders
 * 
 * Fluxo:
 * 1. Na página poc-orders, encontrar card do pedido em "Entregas em andamento"
 * 2. Clicar no botão azul com nome do cliente (div.css-ke2gsr com hexa-v2-icon de telefone)
 * 3. Modal abre: "Qual é o motivo para o contato com o cliente?"
 * 4. Clicar em "Problemas com a entrega" para expandir
 * 5. Clicar em "O entregador não encontra o cliente"
 * 6. Clicar no botão "Confirmar" (amarelo)
 * 7. Modal de "Dados para contato" abre
 * 8. Capturar número de telefone abaixo de "Ligue para"
 */

const fs = require('fs');

/**
 * Captura telefone de um pedido específico via página poc-orders
 * @param {Object} page - Instância do Puppeteer page
 * @param {string} orderId - ID do pedido (ex: "445052626")
 * @returns {Promise<string>} - Telefone capturado ou string vazia
 */
async function capturarTelefonePocOrders(page, orderId) {
    const orderIdClean = orderId.replace(/\s+/g, '');
    console.log(`📞 [TELEFONE-POC] Iniciando captura para pedido #${orderIdClean}`);
    
    try {
        // Garantir que estamos na página poc-orders
        const currentUrl = page.url();
        if (!currentUrl.includes('/poc-orders')) {
            console.log('📞 Navegando para poc-orders...');
            await page.goto('https://seu.ze.delivery/poc-orders', {
                waitUntil: 'networkidle2',
                timeout: 30000
            });
            await sleep(2);
        }
        
        // PASSO 1: Encontrar o card do pedido e clicar no botão de telefone
        console.log('📞 [PASSO 1] Buscando botão de telefone no card do pedido...');
        
        const phoneButtonClicked = await page.evaluate((orderId) => {
            // Buscar o link do pedido pelo ID
            // Formato: #link-to-order-{orderId}
            const orderLink = document.querySelector(`#link-to-order-${orderId}`);
            if (!orderLink) {
                console.log('Card do pedido não encontrado');
                return { success: false, reason: 'card_not_found' };
            }
            
            // Dentro do card, buscar o div azul com ícone de telefone e nome do cliente
            // Seletor: div.css-ke2gsr.e1aa8wr60 que contém hexa-v2-icon
            const phoneButton = orderLink.querySelector('div.css-ke2gsr.e1aa8wr60');
            if (!phoneButton) {
                // Tentar seletor alternativo
                const altButton = orderLink.querySelector('[class*="css-ke2gsr"]');
                if (altButton) {
                    altButton.click();
                    return { success: true, method: 'alt_selector' };
                }
                return { success: false, reason: 'phone_button_not_found' };
            }
            
            phoneButton.click();
            return { success: true, method: 'primary_selector' };
        }, orderIdClean);
        
        if (!phoneButtonClicked.success) {
            console.log(`📞 ❌ Botão de telefone não encontrado: ${phoneButtonClicked.reason}`);
            return '';
        }
        
        console.log(`📞 ✓ Botão de telefone clicado (${phoneButtonClicked.method})`);
        await sleep(2);
        
        // PASSO 2: Verificar se modal de motivo abriu e clicar em "Problemas com a entrega"
        console.log('📞 [PASSO 2] Buscando modal de motivo...');
        
        const motivoClicked = await page.evaluate(() => {
            // Buscar texto "Problemas com a entrega" no modal
            const allElements = document.querySelectorAll('*');
            for (const el of allElements) {
                const text = el.textContent?.trim();
                if (text === 'Problemas com a entrega') {
                    // Clicar no elemento pai que expande o accordion
                    const clickable = el.closest('[class*="accordion"]') || el.closest('[class*="clickable"]') || el.parentElement || el;
                    clickable.click();
                    return { success: true };
                }
            }
            
            // Tentar por span/p/div diretamente
            for (const tag of ['span', 'p', 'div', 'h4', 'h5']) {
                const elements = document.querySelectorAll(tag);
                for (const el of elements) {
                    if (el.textContent?.trim() === 'Problemas com a entrega') {
                        el.click();
                        return { success: true, tag };
                    }
                }
            }
            
            return { success: false, reason: 'motivo_not_found' };
        });
        
        if (!motivoClicked.success) {
            console.log(`📞 ❌ Opção "Problemas com a entrega" não encontrada`);
            await fecharModal(page);
            return '';
        }
        
        console.log('📞 ✓ "Problemas com a entrega" clicado');
        await sleep(1.5);
        
        // PASSO 3: Clicar em "O entregador não encontra o cliente"
        console.log('📞 [PASSO 3] Buscando opção "O entregador não encontra o cliente"...');
        
        const opcaoClicked = await page.evaluate(() => {
            const textos = [
                'O entregador não encontra o cliente',
                'entregador não encontra o cliente',
                'não encontra o cliente'
            ];
            
            for (const texto of textos) {
                const elements = document.querySelectorAll('*');
                for (const el of elements) {
                    const content = el.textContent?.trim().toLowerCase();
                    if (content && content.includes(texto.toLowerCase())) {
                        // Verificar se é um elemento clicável
                        if (el.tagName === 'INPUT' || el.tagName === 'LABEL' || el.tagName === 'BUTTON') {
                            el.click();
                            return { success: true, element: el.tagName };
                        }
                        // Buscar input ou label dentro
                        const input = el.querySelector('input');
                        if (input) {
                            input.click();
                            return { success: true, element: 'input_inside' };
                        }
                        const label = el.querySelector('label');
                        if (label) {
                            label.click();
                            return { success: true, element: 'label_inside' };
                        }
                        // Clicar no próprio elemento
                        el.click();
                        return { success: true, element: el.tagName };
                    }
                }
            }
            
            // Tentar por data-testid ou ID específico
            const radioEntregador = document.querySelector('#REASON_ITEM_DELIVERY_DOES_NOT_FIND_THE_CUSTOMER');
            if (radioEntregador) {
                radioEntregador.click();
                return { success: true, element: 'radio_by_id' };
            }
            
            return { success: false };
        });
        
        if (!opcaoClicked.success) {
            console.log('📞 ❌ Opção "O entregador não encontra o cliente" não encontrada');
            await fecharModal(page);
            return '';
        }
        
        console.log(`📞 ✓ Opção selecionada (${opcaoClicked.element})`);
        await sleep(1);
        
        // PASSO 4: Clicar no botão "Confirmar"
        console.log('📞 [PASSO 4] Buscando botão "Confirmar"...');
        
        const confirmarClicked = await page.evaluate(() => {
            // Buscar botão com texto "Confirmar"
            const buttons = document.querySelectorAll('button');
            for (const btn of buttons) {
                const text = btn.textContent?.trim().toLowerCase();
                if (text === 'confirmar' && !btn.disabled) {
                    btn.click();
                    return { success: true, method: 'button' };
                }
            }
            
            // Buscar hexa-v2-button com label="Confirmar"
            const hexaButtons = document.querySelectorAll('hexa-v2-button');
            for (const btn of hexaButtons) {
                const label = btn.getAttribute('label')?.toLowerCase();
                if (label === 'confirmar') {
                    if (btn.shadowRoot) {
                        const innerBtn = btn.shadowRoot.querySelector('button');
                        if (innerBtn && !innerBtn.disabled) {
                            innerBtn.click();
                            return { success: true, method: 'hexa_shadow' };
                        }
                    }
                    btn.click();
                    return { success: true, method: 'hexa_direct' };
                }
            }
            
            return { success: false };
        });
        
        if (!confirmarClicked.success) {
            console.log('📞 ❌ Botão "Confirmar" não encontrado ou desabilitado');
            await fecharModal(page);
            return '';
        }
        
        console.log(`📞 ✓ Botão "Confirmar" clicado (${confirmarClicked.method})`);
        await sleep(3);
        
        // PASSO 5: Capturar telefone do modal "Dados para contato"
        console.log('📞 [PASSO 5] Capturando telefone do modal "Dados para contato"...');
        
        const telefone = await page.evaluate(() => {
            // Buscar texto "Ligue para" e pegar o número abaixo
            const allText = document.body.innerText || '';
            
            // Padrão 1: Buscar após "Ligue para"
            const ligueMatch = allText.match(/Ligue para\s*[\n\r]+\s*(\+?\d[\d\s\(\)\-]+)/i);
            if (ligueMatch) {
                return ligueMatch[1].replace(/\D/g, '');
            }
            
            // Padrão 2: Buscar número formatado +55 (XX) XXXXX-XXXX
            const phoneMatch = allText.match(/\+55\s*\(\d{2}\)\s*\d{4,5}[-\s]?\d{4}/);
            if (phoneMatch) {
                return phoneMatch[0].replace(/\D/g, '');
            }
            
            // Padrão 3: Buscar qualquer número de telefone
            const genericMatch = allText.match(/\(?\d{2}\)?\s*\d{4,5}[-\s]?\d{4}/);
            if (genericMatch) {
                return genericMatch[0].replace(/\D/g, '');
            }
            
            // Padrão 4: Buscar por elementos específicos
            const h4Elements = document.querySelectorAll('h4');
            for (const h4 of h4Elements) {
                if (h4.textContent?.includes('Ligue para')) {
                    // Pegar próximo elemento
                    let next = h4.nextElementSibling;
                    while (next) {
                        const text = next.textContent?.trim();
                        if (text) {
                            const nums = text.replace(/\D/g, '');
                            if (nums.length >= 10) {
                                return nums;
                            }
                        }
                        next = next.nextElementSibling;
                    }
                }
            }
            
            return '';
        });
        
        // Fechar modal
        await fecharModal(page);
        
        if (telefone && telefone.length >= 10) {
            console.log(`📞 ✅ TELEFONE CAPTURADO: ${telefone}`);
            return telefone;
        }
        
        console.log('📞 ❌ Telefone não encontrado no modal');
        return '';
        
    } catch (error) {
        console.error('📞 ❌ Erro na captura de telefone:', error.message);
        await fecharModal(page);
        return '';
    }
}

/**
 * Fecha modal aberto (clica no X ou pressiona Escape)
 */
async function fecharModal(page) {
    try {
        // Tentar clicar no X do modal
        await page.evaluate(() => {
            const closeButtons = document.querySelectorAll('[aria-label="close"], [aria-label="fechar"], .close-button, [class*="close"]');
            for (const btn of closeButtons) {
                if (btn.offsetParent !== null) { // visível
                    btn.click();
                    return;
                }
            }
        });
        await sleep(0.5);
        
        // Pressionar Escape como fallback
        await page.keyboard.press('Escape');
        await sleep(0.5);
    } catch (e) {
        // Ignorar erros ao fechar modal
    }
}

/**
 * Sleep helper
 */
function sleep(seconds) {
    return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

/**
 * Verifica se pedido precisa de telefone e tenta capturar
 * @param {Object} page - Instância do Puppeteer page
 * @param {string} orderId - ID do pedido
 * @param {string} currentPhone - Telefone atual (se existir)
 * @returns {Promise<string>} - Telefone capturado ou telefone atual
 */
async function tentarCapturarTelefone(page, orderId, currentPhone = '') {
    // Se já tem telefone válido, não precisa capturar
    if (currentPhone && currentPhone.length >= 10) {
        console.log(`📞 Pedido #${orderId} já tem telefone: ${currentPhone}`);
        return currentPhone;
    }
    
    // Tentar capturar via poc-orders
    const novoTelefone = await capturarTelefonePocOrders(page, orderId);
    
    if (novoTelefone && novoTelefone.length >= 10) {
        console.log(`📞 ✅ Telefone capturado para #${orderId}: ${novoTelefone}`);
        return novoTelefone;
    }
    
    console.log(`📞 ⚠️ Não foi possível capturar telefone para #${orderId}`);
    return currentPhone || '';
}

module.exports = {
    capturarTelefonePocOrders,
    tentarCapturarTelefone,
    fecharModal
};
