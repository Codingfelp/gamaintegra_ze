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
            let orderLink = document.querySelector(`#link-to-order-${orderId}`);
            
            // Se não encontrar por ID, tentar buscar por texto do número do pedido
            if (!orderLink) {
                // Formatar número: 154368633 -> "154 368 633"
                const formattedNum = orderId.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3');
                const allLinks = document.querySelectorAll('a[href*="poc-orders"], [id*="link-to-order"]');
                for (const link of allLinks) {
                    const text = link.textContent || '';
                    if (text.includes(orderId) || text.includes(formattedNum)) {
                        orderLink = link;
                        break;
                    }
                }
            }
            
            // Se ainda não encontrou, buscar em toda a página
            if (!orderLink) {
                const allDivs = document.querySelectorAll('[class*="card"], [class*="order"]');
                for (const div of allDivs) {
                    if (div.textContent?.includes(orderId) || div.innerHTML?.includes(orderId)) {
                        orderLink = div;
                        break;
                    }
                }
            }
            
            if (!orderLink) {
                // Listar IDs de pedidos disponíveis para debug
                const availableOrders = [...document.querySelectorAll('[id*="link-to-order"]')]
                    .map(el => el.id.replace('link-to-order-', ''));
                return { success: false, reason: 'card_not_found', availableOrders };
            }
            
            // Dentro do card, buscar o div azul com ícone de telefone e nome do cliente
            // Seletor: div.css-ke2gsr.e1aa8wr60 que contém hexa-v2-icon
            let phoneButton = orderLink.querySelector('div.css-ke2gsr.e1aa8wr60');
            
            if (!phoneButton) {
                // Tentar seletores alternativos
                phoneButton = orderLink.querySelector('[class*="css-ke2gsr"]') ||
                              orderLink.querySelector('[class*="e1aa8wr60"]') ||
                              orderLink.querySelector('div[color*="blue"]');
            }
            
            if (!phoneButton) {
                // Buscar qualquer div que contenha hexa-v2-icon dentro do card
                const hexaIcons = orderLink.querySelectorAll('hexa-v2-icon');
                for (const icon of hexaIcons) {
                    const parentDiv = icon.closest('div');
                    if (parentDiv && parentDiv !== orderLink) {
                        phoneButton = parentDiv;
                        break;
                    }
                }
            }
            
            if (!phoneButton) {
                return { success: false, reason: 'phone_button_not_found', cardFound: true };
            }
            
            phoneButton.click();
            return { success: true, method: 'found_and_clicked' };
        }, orderIdClean);
        
        if (!phoneButtonClicked.success) {
            console.log(`📞 ❌ ${phoneButtonClicked.reason}`);
            if (phoneButtonClicked.availableOrders) {
                console.log(`📞 Pedidos disponíveis na página: ${phoneButtonClicked.availableOrders.join(', ')}`);
            }
            return '';
        }
        
        console.log(`📞 ✓ Botão de telefone clicado (${phoneButtonClicked.method})`);
        await sleep(2);
        
        // PASSO 2: Verificar se modal de motivo abriu e clicar em "Problemas com a entrega"
        console.log('📞 [PASSO 2] Buscando modal de motivo...');
        
        // Aguardar modal aparecer
        await sleep(2);
        
        const motivoClicked = await page.evaluate(() => {
            // Buscar por div/span que contém "Problemas com a entrega"
            const allElements = document.querySelectorAll('div, span, p, h4, label');
            for (const el of allElements) {
                const text = el.textContent?.trim();
                if (text === 'Problemas com a entrega') {
                    el.click();
                    return { success: true, tag: el.tagName };
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
        
        // Aguardar accordion expandir COMPLETAMENTE
        await sleep(2.5);
        
        // PASSO 3: Clicar em "O entregador não encontra o cliente"
        console.log('📞 [PASSO 3] Buscando opção "O entregador não encontra o cliente"...');
        
        const opcaoClicked = await page.evaluate(() => {
            // Buscar todos elementos de texto que contêm "entregador não encontra"
            const allElements = document.querySelectorAll('div, span, p, label, li');
            
            for (const el of allElements) {
                const text = el.textContent?.trim().toLowerCase();
                // Match exato ou parcial
                if (text === 'o entregador não encontra o cliente' || 
                    text === 'entregador não encontra o cliente' ||
                    (text && text.includes('entregador') && text.includes('não encontra'))) {
                    
                    console.log('Encontrado:', text);
                    el.click();
                    return { success: true, element: el.tagName, text: text.substring(0, 50) };
                }
            }
            
            // Fallback: buscar qualquer elemento clicável na área expandida
            const accordionContent = document.querySelector('[class*="accordion"]') || 
                                     document.querySelector('[class*="expandable"]') ||
                                     document.querySelector('[class*="collapse"]');
            if (accordionContent) {
                const items = accordionContent.querySelectorAll('div, span, label');
                for (const item of items) {
                    const t = item.textContent?.toLowerCase() || '';
                    if (t.includes('entregador')) {
                        item.click();
                        return { success: true, element: 'accordion_item' };
                    }
                }
            }
            
            return { success: false, availableTexts: [...document.querySelectorAll('*')].slice(0, 100).map(e => e.textContent?.trim()).filter(t => t && t.length > 5 && t.length < 60).slice(0, 20) };
        });
        
        if (!opcaoClicked.success) {
            console.log('📞 ❌ Opção "O entregador não encontra o cliente" não encontrada');
            if (opcaoClicked.availableTexts) {
                console.log('📞 Textos disponíveis:', opcaoClicked.availableTexts.slice(0, 10));
            }
            // Tirar screenshot para debug
            try {
                await page.screenshot({ path: '/app/logs/phone-debug-step3.png', fullPage: false });
                console.log('📞 Screenshot salvo em /app/logs/phone-debug-step3.png');
            } catch (e) {}
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
