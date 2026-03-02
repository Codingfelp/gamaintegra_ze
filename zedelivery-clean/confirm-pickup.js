/**
 * =============================================================================
 * MÓDULO DE CONFIRMAÇÃO DE RETIRADA
 * =============================================================================
 * 
 * Este módulo é responsável por confirmar pedidos de retirada usando o
 * código de 4 dígitos fornecido pelo cliente.
 * 
 * FLUXO DE CONFIRMAÇÃO:
 * 1. Sistema externo envia webhook com order_id e código de 4 dígitos
 * 2. Este módulo acessa o kanban e encontra o pedido na coluna "Em Separação"
 * 3. Clica no card do pedido para abrir o modal
 * 4. Modal mostra botões: "Cancelar", "Imprimir", "Confirmar"
 * 5. Clica em "Confirmar"
 * 6. Novo modal abre com 4 inputs para o código
 * 7. Insere cada dígito do código nos inputs
 * 8. Clica em "Confirmar" novamente
 * 9. Verifica se o pedido foi confirmado (status muda para "Entregue")
 * 
 * SELETORES CSS UTILIZADOS:
 * - Coluna Em Separação: #kanban-column-body-in-separation-orders
 * - Cards de pedido: [id^="link-to-order-"]
 * - Botões do modal: hexa-v2-button com texto "Confirmar"
 * - Inputs de código: input[type="text"] ou input[maxlength="1"]
 * 
 * COMO USAR:
 * - Via API: POST /api/webhook/confirmar-retirada {"order_id": "123", "code": "1234"}
 * - Via CLI: node confirmar-retirada-cli.js 123456789 1234
 * 
 * =============================================================================
 */

const fs = require('fs');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Busca pedidos de retirada na coluna "Em Separação"
 * @param {Page} page - Puppeteer page
 * @returns {Promise<Array>} - Lista de pedidos de retirada
 */
async function getPickupOrdersInSeparation(page) {
    console.log('[PICKUP] Buscando pedidos de retirada na coluna "Em Separação"...');
    
    try {
        const orders = await page.evaluate(() => {
            const column = document.querySelector('#kanban-column-body-in-separation-orders');
            
            if (!column) {
                return { error: 'Coluna "Em Separação" não encontrada' };
            }
            
            const cards = column.querySelectorAll('[id^="link-to-order-"]');
            const pickupOrders = [];
            
            cards.forEach(card => {
                // Verificar se é pedido de retirada (buscar ícone ou texto)
                const cardText = card.textContent?.toLowerCase() || '';
                const hasPickupIcon = card.querySelector('[class*="pickup"], [class*="retirada"]');
                
                // Identificar como retirada se tiver o ícone ou texto "retirada"
                const isPickup = hasPickupIcon || cardText.includes('retirada') || cardText.includes('pickup');
                
                const orderId = card.id.replace('link-to-order-', '');
                
                pickupOrders.push({
                    id: orderId,
                    isPickup: isPickup
                });
            });
            
            return { 
                orders: pickupOrders.filter(o => o.isPickup),
                total: pickupOrders.filter(o => o.isPickup).length 
            };
        });
        
        if (orders.error) {
            console.log(` ${orders.error}`);
            return [];
        }
        
        console.log(` Encontrados ${orders.total} pedidos de retirada`);
        return orders.orders;
        
    } catch (error) {
        console.error('  Erro ao buscar pedidos:', error.message);
        return [];
    }
}

/**
 * Confirma retirada de um pedido com código de 4 dígitos
 * @param {Page} page - Puppeteer page
 * @param {string} orderId - ID do pedido
 * @param {string} code - Código de 4 dígitos
 * @returns {Promise<boolean>} - true se confirmado com sucesso
 */
async function confirmPickup(page, orderId, code) {
    console.log(`[PICKUP] Confirmando retirada do pedido #${orderId} com código ${code}`);
    
    // Validar código
    if (!code || code.length !== 4 || !/^\d{4}$/.test(code)) {
        console.log('Código inválido. Deve ter exatamente 4 dígitos numéricos.');
        return false;
    }
    
    const codeDigits = code.split('');
    
    try {
        // PASSO 1: Clicar no card do pedido
        console.log('[PASSO 1] Clicando no card do pedido...');
        
        const cardClicked = await page.evaluate((id) => {
            const card = document.querySelector(`#link-to-order-${id}`);
            if (card) {
                card.click();
                return { success: true };
            }
            return { success: false };
        }, orderId);
        
        if (!cardClicked.success) {
            console.log('Card do pedido não encontrado');
            return false;
        }
        
        await sleep(2000);
        
        // Screenshot
        try {
            await page.screenshot({ path: `/app/logs/pickup-step1-${orderId}.png` });
        } catch (e) {}
        
        // PASSO 2: Encontrar e clicar no botão "Confirmar" (primeiro modal)
        console.log('[PASSO 2] Clicando no botão "Confirmar"...');
        
        const firstConfirmClicked = await page.evaluate(() => {
            // Buscar entre os 3 botões: Cancelar, Imprimir, Confirmar
            const buttons = document.querySelectorAll('hexa-v2-button, button');
            
            for (const btn of buttons) {
                let text = btn.textContent?.trim().toLowerCase() || '';
                
                if (btn.shadowRoot) {
                    const innerBtn = btn.shadowRoot.querySelector('button');
                    text = innerBtn?.textContent?.trim().toLowerCase() || text;
                    
                    if (text === 'confirmar') {
                        innerBtn?.click() || btn.click();
                        return { success: true, method: 'shadow' };
                    }
                }
                
                if (text === 'confirmar') {
                    btn.click();
                    return { success: true, method: 'direct' };
                }
            }
            
            return { success: false };
        });
        
        if (!firstConfirmClicked.success) {
            console.log('Botão "Confirmar" não encontrado no modal do pedido');
            return false;
        }
        
        console.log(` Botão "Confirmar" clicado via ${firstConfirmClicked.method}`);
        await sleep(2000);
        
        // Screenshot após primeiro confirmar
        try {
            await page.screenshot({ path: `/app/logs/pickup-step2-${orderId}.png` });
        } catch (e) {}
        
        // PASSO 3: Identificar os 4 inputs do código e inserir cada dígito
        console.log('[PASSO 3] Inserindo código de confirmação...');
        
        const codeInserted = await page.evaluate((digits) => {
            // Buscar inputs de código (geralmente são 4 inputs type="text" ou type="tel")
            const inputSelectors = [
                'input[type="text"]',
                'input[type="tel"]',
                'input[type="number"]',
                'input[inputmode="numeric"]',
                'input[maxlength="1"]'
            ];
            
            let inputs = [];
            
            // Tentar encontrar inputs dentro de um container de código
            const codeContainer = document.querySelector('[class*="code"], [class*="pin"], [class*="otp"], [class*="digit"]');
            if (codeContainer) {
                inputs = Array.from(codeContainer.querySelectorAll('input'));
            }
            
            // Se não encontrou no container, buscar globalmente
            if (inputs.length < 4) {
                for (const sel of inputSelectors) {
                    const found = document.querySelectorAll(sel);
                    if (found.length >= 4) {
                        // Filtrar apenas inputs que parecem ser de código (maxlength 1 ou pequenos)
                        inputs = Array.from(found).filter(input => {
                            const maxLength = input.getAttribute('maxlength');
                            return maxLength === '1' || maxLength === null;
                        });
                        
                        if (inputs.length >= 4) break;
                        inputs = Array.from(found).slice(0, 4);
                        break;
                    }
                }
            }
            
            if (inputs.length < 4) {
                return { success: false, error: `Apenas ${inputs.length} inputs encontrados` };
            }
            
            // Inserir cada dígito
            for (let i = 0; i < 4; i++) {
                const input = inputs[i];
                input.focus();
                input.value = digits[i];
                
                // Disparar eventos para React/Vue
                const inputEvent = new Event('input', { bubbles: true });
                const changeEvent = new Event('change', { bubbles: true });
                input.dispatchEvent(inputEvent);
                input.dispatchEvent(changeEvent);
            }
            
            return { success: true, inputsFound: inputs.length };
            
        }, codeDigits);
        
        if (!codeInserted.success) {
            console.log(` Erro ao inserir código: ${codeInserted.error}`);
            return false;
        }
        
        console.log(` Código inserido (${codeInserted.inputsFound} inputs)`);
        await sleep(1000);
        
        // Screenshot após inserir código
        try {
            await page.screenshot({ path: `/app/logs/pickup-step3-${orderId}.png` });
        } catch (e) {}
        
        // PASSO 4: Clicar no botão "Confirmar" final
        console.log('[PASSO 4] Clicando no botão "Confirmar" final...');
        
        const finalConfirmClicked = await page.evaluate(() => {
            const buttons = document.querySelectorAll('hexa-v2-button, button');
            
            for (const btn of buttons) {
                let text = btn.textContent?.trim().toLowerCase() || '';
                
                if (btn.shadowRoot) {
                    const innerBtn = btn.shadowRoot.querySelector('button');
                    text = innerBtn?.textContent?.trim().toLowerCase() || text;
                    
                    if (text === 'confirmar') {
                        innerBtn?.click() || btn.click();
                        return { success: true };
                    }
                }
                
                if (text === 'confirmar') {
                    btn.click();
                    return { success: true };
                }
            }
            
            return { success: false };
        });
        
        if (!finalConfirmClicked.success) {
            console.log('Botão "Confirmar" final não encontrado');
        } else {
            console.log('Confirmação final enviada');
        }
        
        await sleep(3000);
        
        // Screenshot final
        try {
            await page.screenshot({ path: `/app/logs/pickup-step4-${orderId}.png` });
        } catch (e) {}
        
        // PASSO 5: Verificar se pedido foi confirmado
        console.log('[PASSO 5] Verificando status do pedido...');
        
        const verified = await page.evaluate((id) => {
            // Verificar se pedido saiu da coluna Em Separação
            const stillInSeparation = document.querySelector(`#kanban-column-body-in-separation-orders #link-to-order-${id}`);
            
            // Verificar mensagem de sucesso
            const bodyText = document.body.innerText.toLowerCase();
            const hasSuccess = bodyText.includes('sucesso') || 
                              bodyText.includes('confirmado') || 
                              bodyText.includes('entregue');
            
            return {
                stillInSeparation: !!stillInSeparation,
                hasSuccessMessage: hasSuccess
            };
        }, orderId);
        
        if (!verified.stillInSeparation || verified.hasSuccessMessage) {
            console.log(` PEDIDO #${orderId} CONFIRMADO COM SUCESSO!`);
            return true;
        }
        
        console.log(` Status do pedido #${orderId} não confirmado`);
        return false;
        
    } catch (error) {
        console.error(`Erro ao confirmar pedido #${orderId}:`, error.message);
        try {
            await page.screenshot({ path: `/app/logs/pickup-error-${orderId}.png` });
        } catch (e) {}
        return false;
    }
}

/**
 * Fecha modal atual
 * @param {Page} page - Puppeteer page
 */
async function closeModal(page) {
    try {
        await page.keyboard.press('Escape');
        await sleep(500);
        
        await page.evaluate(() => {
            const cancelButtons = document.querySelectorAll('button, hexa-v2-button');
            for (const btn of cancelButtons) {
                if (btn.textContent?.toLowerCase().includes('cancelar')) {
                    btn.click();
                    return;
                }
            }
        });
    } catch (e) {}
}

module.exports = {
    getPickupOrdersInSeparation,
    confirmPickup,
    closeModal
};
