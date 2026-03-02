/**
 * =============================================================================
 * MÓDULO DE CAPTURA DE TELEFONE - VERSÃO 3
 * =============================================================================
 * 
 * Este módulo é responsável por extrair o telefone do cliente através do
 * fluxo de modal do Zé Delivery.
 * 
 * FLUXO DE CAPTURA:
 * 1. Pedido aceito presente na coluna "EM SEPARAÇÃO" no kanban
 * 2. Procurar elemento do botão de telefone (ícone de telefone + nome do cliente)
 * 3. Clicar no botão para abrir modal "Qual é o motivo para o contato?"
 * 4. Modal aberto, selecionar "Problemas com a entrega" para expandir opções
 * 5. Selecionar "O entregador não encontra o cliente" (primeira opção)
 * 6. Clicar no botão "Confirmar"
 * 7. Modal de "Dados para contato" abre com o telefone
 * 8. Capturar número abaixo de "Ligue para"
 * 
 * SELETORES CSS UTILIZADOS:
 * - Coluna Em Separação: #kanban-column-body-in-separation-orders
 * - Modal de telefone: #view-consumer-phone-modals
 * - Problemas com entrega: #REASON_CATEGORY_DELIVERY_PROBLEM
 * - Entregador não encontra: #REASON_ITEM_DELIVERY_DOES_NOT_FIND_THE_CUSTOMER
 * - Botão confirmar: hexa-v2-button com texto "Confirmar"
 * 
 * IMPORTANTE: Os seletores podem mudar quando o Zé Delivery atualizar o site.
 * Se a captura parar de funcionar, é necessário inspecionar o HTML do site
 * e atualizar os seletores neste arquivo.
 * 
 * =============================================================================
 */

const fs = require('fs');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Busca pedidos na coluna "Em Separação" que precisam de captura de telefone
 * @param {Page} page - Puppeteer page
 * @returns {Promise<Array>} - Lista de pedidos
 */
async function getOrdersInSeparation(page) {
    console.log(' [PHONE-V3] Buscando pedidos na coluna "Em Separação"...');
    
    try {
        const orders = await page.evaluate(() => {
            const column = document.querySelector('#kanban-column-body-in-separation-orders, [data-testid="kanban-column-body-in-separation-orders"]');
            
            if (!column) {
                return { error: 'Coluna "Em Separação" não encontrada' };
            }
            
            const cards = column.querySelectorAll('[id^="link-to-order-"]');
            const orderList = [];
            
            cards.forEach(card => {
                const orderId = card.id.replace('link-to-order-', '');
                // Tentar extrair nome do cliente do card
                const nameEl = card.querySelector('.customer-name, [class*="customer"]');
                const customerName = nameEl?.textContent?.trim() || '';
                
                orderList.push({ id: orderId, customerName });
            });
            
            return { orders: orderList, total: orderList.length };
        });
        
        if (orders.error) {
            console.log(`  ${orders.error}`);
            return [];
        }
        
        console.log(`  Encontrados ${orders.total} pedidos em separação`);
        return orders.orders;
        
    } catch (error) {
        console.error('  Erro ao buscar pedidos:', error.message);
        return [];
    }
}

/**
 * Captura telefone do cliente para um pedido específico
 * @param {Page} page - Puppeteer page
 * @param {string} orderId - ID do pedido
 * @param {string} customerName - Nome do cliente (opcional)
 * @returns {Promise<string>} - Telefone capturado ou string vazia
 */
async function capturePhoneForOrder(page, orderId, customerName = '') {
    console.log(` [PHONE-V3] Iniciando captura para pedido #${orderId} (${customerName})`);
    
    try {
        // PASSO 1: Clicar no card do pedido na coluna Em Separação
        console.log(' [PASSO 1] Clicando no card do pedido...');
        
        const cardClicked = await page.evaluate((id) => {
            const card = document.querySelector(`#link-to-order-${id}`);
            if (card) {
                card.click();
                return { success: true };
            }
            return { success: false };
        }, orderId);
        
        if (!cardClicked.success) {
            console.log('  Card do pedido não encontrado');
            return '';
        }
        
        await sleep(2000);
        
        // PASSO 2: Procurar botão de telefone (ícone + nome do cliente)
        console.log(' [PASSO 2] Buscando botão de telefone...');
        
        const phoneButtonClicked = await page.evaluate(() => {
            // Estratégia 1: Buscar por ID específico
            const phoneIds = [
                '#phone-unavailable',
                '#customer-phone-button',
                '[id*="phone"]',
                '[data-testid*="phone"]'
            ];
            
            for (const sel of phoneIds) {
                const el = document.querySelector(sel);
                if (el) {
                    // Tentar clicar no shadow DOM se for hexa-v2-button
                    if (el.shadowRoot) {
                        const btn = el.shadowRoot.querySelector('button, a');
                        if (btn) {
                            btn.click();
                            return { success: true, method: 'shadow-' + sel };
                        }
                    }
                    el.click();
                    return { success: true, method: sel };
                }
            }
            
            // Estratégia 2: Buscar ícone de telefone seguido de texto
            const phoneIcons = document.querySelectorAll('[class*="phone"], svg[name*="phone"], hexa-v2-icon');
            for (const icon of phoneIcons) {
                const parent = icon.closest('button, a, div[role="button"], hexa-v2-button');
                if (parent) {
                    if (parent.shadowRoot) {
                        const btn = parent.shadowRoot.querySelector('button');
                        if (btn) btn.click();
                        else parent.click();
                    } else {
                        parent.click();
                    }
                    return { success: true, method: 'phone-icon' };
                }
            }
            
            // Estratégia 3: Buscar hexa-v2-text-link com texto "Ver telefone"
            const textLinks = document.querySelectorAll('hexa-v2-text-link, a');
            for (const link of textLinks) {
                let text = link.textContent?.toLowerCase() || '';
                if (link.shadowRoot) {
                    text = link.shadowRoot.textContent?.toLowerCase() || text;
                }
                if (text.includes('ver telefone') || text.includes('telefone')) {
                    link.click();
                    return { success: true, method: 'text-link' };
                }
            }
            
            return { success: false };
        });
        
        if (!phoneButtonClicked.success) {
            console.log('  Botão de telefone não encontrado');
            try { await page.screenshot({ path: `/app/logs/phone-v3-no-btn-${orderId}.png` }); } catch(e) {}
            return '';
        }
        
        console.log(`  Botão de telefone clicado via ${phoneButtonClicked.method}`);
        await sleep(2000);
        
        // Screenshot após clicar no botão
        try {
            await page.screenshot({ path: `/app/logs/phone-v3-step2-${orderId}.png` });
        } catch (e) {}
        
        // PASSO 3: Verificar se modal de motivo abriu e clicar em "Problemas com a entrega"
        console.log(' [PASSO 3] Procurando "Problemas com a entrega"...');
        
        // Primeiro verificar se o telefone já está visível (pode pular modal)
        let phoneFound = await extractPhone(page);
        if (phoneFound) {
            console.log(`  TELEFONE CAPTURADO DIRETAMENTE: ${phoneFound}`);
            await closeModal(page);
            return phoneFound;
        }
        
        const problemsClicked = await page.evaluate(() => {
            // Estratégia 1: Buscar por ID específico
            const problemsEl = document.querySelector('#REASON_CATEGORY_DELIVERY_PROBLEM');
            if (problemsEl) {
                problemsEl.click();
                return { success: true, method: 'id' };
            }
            
            // Estratégia 2: Buscar por texto
            const allElements = document.querySelectorAll('div, span, label, hexa-v2-text, hexa-v2-radio-button');
            for (const el of allElements) {
                let text = el.textContent?.trim() || '';
                if (el.shadowRoot) {
                    text = el.shadowRoot.textContent?.trim() || text;
                }
                
                if (text === 'Problemas com a entrega' || text.includes('Problemas com a entrega')) {
                    // Tentar clicar no elemento pai se for radio
                    const parent = el.closest('hexa-v2-radio-button, label, [role="radio"]');
                    if (parent) {
                        parent.click();
                        return { success: true, method: 'parent-radio' };
                    }
                    el.click();
                    return { success: true, method: 'text-match' };
                }
            }
            
            return { success: false };
        });
        
        if (!problemsClicked.success) {
            console.log('  "Problemas com a entrega" não encontrado');
        } else {
            console.log(`  "Problemas com a entrega" clicado via ${problemsClicked.method}`);
        }
        
        await sleep(1500);
        
        // PASSO 4: Clicar em "O entregador não encontra o cliente"
        console.log(' [PASSO 4] Procurando "O entregador não encontra o cliente"...');
        
        const deliveryClicked = await page.evaluate(() => {
            // Estratégia 1: Buscar por ID específico
            const deliveryEl = document.querySelector('#REASON_ITEM_DELIVERY_DOES_NOT_FIND_THE_CUSTOMER');
            if (deliveryEl) {
                deliveryEl.click();
                return { success: true, method: 'id' };
            }
            
            // Estratégia 2: Buscar hexa-v2-radio-button com for específico
            const radioBtn = document.querySelector('hexa-v2-radio-button[for="REASON_ITEM_DELIVERY_DOES_NOT_FIND_THE_CUSTOMER"]');
            if (radioBtn) {
                if (radioBtn.shadowRoot) {
                    const input = radioBtn.shadowRoot.querySelector('input, [role="radio"]');
                    if (input) input.click();
                    else radioBtn.click();
                } else {
                    radioBtn.click();
                }
                return { success: true, method: 'radio-for' };
            }
            
            // Estratégia 3: Buscar por texto
            const allElements = document.querySelectorAll('div, span, label, hexa-v2-radio-button');
            for (const el of allElements) {
                let text = el.textContent?.toLowerCase() || '';
                if (el.shadowRoot) {
                    text = el.shadowRoot.textContent?.toLowerCase() || text;
                }
                
                if (text.includes('entregador não encontra') || text.includes('entregador nao encontra')) {
                    const parent = el.closest('hexa-v2-radio-button, label, [role="radio"]');
                    if (parent) {
                        parent.click();
                        return { success: true, method: 'parent-text' };
                    }
                    el.click();
                    return { success: true, method: 'text-match' };
                }
            }
            
            return { success: false };
        });
        
        if (!deliveryClicked.success) {
            console.log('  "O entregador não encontra o cliente" não encontrado');
        } else {
            console.log(`  Opção selecionada via ${deliveryClicked.method}`);
        }
        
        await sleep(1000);
        
        // PASSO 5: Scroll leve e clicar em "Confirmar"
        console.log(' [PASSO 5] Clicando em "Confirmar"...');
        
        // Scroll leve para garantir que o botão está visível
        await page.evaluate(() => {
            const modal = document.querySelector('hexa-v2-dialog, .modal, [role="dialog"]');
            if (modal) modal.scrollTop += 100;
            else window.scrollBy(0, 100);
        });
        
        await sleep(500);
        
        const confirmClicked = await page.evaluate(() => {
            // Buscar botão Confirmar em hexa-v2-button
            const hexaButtons = document.querySelectorAll('hexa-v2-button');
            
            for (const btn of hexaButtons) {
                let text = btn.textContent?.trim().toLowerCase() || '';
                
                if (btn.shadowRoot) {
                    const innerBtn = btn.shadowRoot.querySelector('button');
                    const innerText = innerBtn?.textContent?.trim().toLowerCase() || '';
                    
                    if (innerText === 'confirmar') {
                        innerBtn.click();
                        return { success: true, method: 'hexa-shadow' };
                    }
                }
                
                if (text === 'confirmar') {
                    btn.click();
                    return { success: true, method: 'hexa-text' };
                }
            }
            
            // Buscar button normal
            const buttons = document.querySelectorAll('button');
            for (const btn of buttons) {
                if (btn.textContent?.trim().toLowerCase() === 'confirmar') {
                    btn.click();
                    return { success: true, method: 'button' };
                }
            }
            
            return { success: false };
        });
        
        if (!confirmClicked.success) {
            console.log('  Botão "Confirmar" não encontrado');
        } else {
            console.log(`  "Confirmar" clicado via ${confirmClicked.method}`);
        }
        
        await sleep(3000);
        
        // Screenshot após confirmar
        try {
            await page.screenshot({ path: `/app/logs/phone-v3-step5-${orderId}.png` });
        } catch (e) {}
        
        // PASSO 6: Verificar se modal "Dados para contato" abriu e extrair telefone
        console.log(' [PASSO 6] Extraindo telefone...');
        
        phoneFound = await extractPhone(page);
        
        // Fechar modal
        await closeModal(page);
        
        if (phoneFound) {
            console.log(`  TELEFONE CAPTURADO: ${phoneFound}`);
            return phoneFound;
        }
        
        console.log('  Telefone não encontrado');
        return '';
        
    } catch (error) {
        console.error(`  Erro na captura: ${error.message}`);
        try { await page.screenshot({ path: `/app/logs/phone-v3-error-${orderId}.png` }); } catch (e) {}
        return '';
    }
}

/**
 * Extrai telefone da página atual
 * @param {Page} page - Puppeteer page
 * @returns {Promise<string>} - Telefone ou null
 */
async function extractPhone(page) {
    return await page.evaluate(() => {
        const bodyText = document.body.innerText;
        
        // Verificar se "Ligue para" está presente
        if (bodyText.includes('Ligue para')) {
            // Buscar número após "Ligue para"
            const ligueMatch = bodyText.match(/Ligue para\s*\n?\s*(\+?\d[\d\s\(\)\-]+)/i);
            if (ligueMatch) {
                return ligueMatch[1].trim();
            }
        }
        
        // Padrões de telefone brasileiro
        const patterns = [
            /\+55\s*\(?\d{2}\)?\s*\d{4,5}[-\s]?\d{4}/g,
            /\(\d{2}\)\s*\d{4,5}[-\s]?\d{4}/g,
            /\d{2}\s*9?\d{4}[-\s]?\d{4}/g,
        ];
        
        for (const pattern of patterns) {
            const matches = bodyText.match(pattern);
            if (matches) {
                for (const match of matches) {
                    const digits = match.replace(/\D/g, '');
                    if (digits.length >= 10 && digits.length <= 13) {
                        return match.trim();
                    }
                }
            }
        }
        
        // Buscar links tel:
        const telLinks = document.querySelectorAll('a[href^="tel:"]');
        for (const link of telLinks) {
            const phone = link.getAttribute('href')?.replace('tel:', '').trim();
            if (phone && phone.length >= 10) return phone;
        }
        
        return null;
    });
}

/**
 * Fecha modal atual
 * @param {Page} page - Puppeteer page
 */
async function closeModal(page) {
    try {
        // Tentar Escape
        await page.keyboard.press('Escape');
        await sleep(500);
        
        // Tentar botões de fechar
        await page.evaluate(() => {
            const closeSelectors = [
                '[aria-label*="close"]',
                '[aria-label*="fechar"]',
                'button[class*="close"]',
                '.close-button'
            ];
            
            for (const sel of closeSelectors) {
                const btn = document.querySelector(sel);
                if (btn) {
                    btn.click();
                    return;
                }
            }
            
            // Buscar botão "Cancelar"
            const buttons = document.querySelectorAll('button, hexa-v2-button');
            for (const btn of buttons) {
                if (btn.textContent?.toLowerCase().includes('cancelar')) {
                    btn.click();
                    return;
                }
            }
        });
        
        await sleep(500);
        await page.keyboard.press('Escape');
    } catch (e) {}
}

/**
 * Formata número de telefone
 * @param {string} phone - Telefone bruto
 * @returns {string} - Telefone formatado
 */
function formatPhone(phone) {
    if (!phone) return '';
    
    let digits = phone.replace(/\D/g, '');
    
    if (!digits.startsWith('55') && digits.length === 11) {
        digits = '55' + digits;
    }
    
    if (digits.length === 13) {
        return `+${digits.slice(0,2)} (${digits.slice(2,4)}) ${digits.slice(4,9)}-${digits.slice(9)}`;
    } else if (digits.length === 12) {
        return `+${digits.slice(0,2)} (${digits.slice(2,4)}) ${digits.slice(4,8)}-${digits.slice(8)}`;
    } else if (digits.length === 11) {
        return `(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7)}`;
    }
    
    return phone;
}

module.exports = {
    getOrdersInSeparation,
    capturePhoneForOrder,
    extractPhone,
    closeModal,
    formatPhone
};
