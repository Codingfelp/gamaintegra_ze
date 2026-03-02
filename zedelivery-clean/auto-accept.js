/**
 * =============================================================================
 * MÓDULO DE ACEITE AUTOMÁTICO DE PEDIDOS
 * =============================================================================
 * 
 * Este módulo é responsável por aceitar automaticamente pedidos que chegam
 * na coluna "Novos" do kanban do Zé Delivery.
 * 
 * FLUXO DE ACEITE:
 * 1. Pedido pendente chega na coluna "Novos" do kanban
 * 2. Clicar no card do pedido para abrir o modal de detalhes
 * 3. Modal aberto, procurar o botão "Aceitar" e clicar
 * 4. Verificar se o status mudou de "Pendente" para "Aceito"
 * 
 * SELETORES CSS UTILIZADOS:
 * - Coluna novos: #kanban-column-body-new-orders
 * - Botão aceitar: #accept-button, [data-testid="accept-button"]
 * - Cards de pedido: [id^="link-to-order-"]
 * 
 * IMPORTANTE: Os seletores podem mudar quando o Zé Delivery atualizar o site.
 * Se o aceite parar de funcionar, inspecione o HTML e atualize os seletores.
 * 
 * =============================================================================
 */

const fs = require('fs');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Busca pedidos pendentes na coluna de novos
 * @param {Page} page - Puppeteer page
 * @returns {Promise<Array>} - Lista de IDs de pedidos pendentes
 */
async function getPendingOrders(page) {
    console.log('🔍 [AUTO-ACCEPT] Buscando pedidos pendentes na coluna "Novos"...');
    
    try {
        const orders = await page.evaluate(() => {
            // Seletores da coluna de novos pedidos
            const columnSelectors = [
                '#kanban-column-body-new-orders',
                '[data-testid="kanban-column-body-new-orders"]',
                '[id*="new-orders"]'
            ];
            
            let column = null;
            for (const sel of columnSelectors) {
                column = document.querySelector(sel);
                if (column) break;
            }
            
            if (!column) {
                return { error: 'Coluna de novos pedidos não encontrada', selectors: columnSelectors };
            }
            
            // Buscar cards de pedido dentro da coluna
            const cardSelectors = [
                '[id^="link-to-order-"]',
                '.order-card',
                '[data-testid^="order-card"]',
                'a[href*="/order/"]'
            ];
            
            const orderCards = [];
            for (const sel of cardSelectors) {
                const cards = column.querySelectorAll(sel);
                cards.forEach(card => {
                    // Extrair ID do pedido
                    let orderId = null;
                    if (card.id && card.id.includes('link-to-order-')) {
                        orderId = card.id.replace('link-to-order-', '');
                    } else if (card.href) {
                        const match = card.href.match(/\/order\/(\d+)/);
                        if (match) orderId = match[1];
                    }
                    
                    if (orderId && !orderCards.find(o => o.id === orderId)) {
                        orderCards.push({
                            id: orderId,
                            selector: card.id ? `#${card.id}` : sel
                        });
                    }
                });
            }
            
            return { 
                orders: orderCards, 
                columnFound: true,
                totalCards: orderCards.length 
            };
        });
        
        if (orders.error) {
            console.log(`🔍 ⚠️ ${orders.error}`);
            return [];
        }
        
        console.log(`🔍 ✓ Encontrados ${orders.totalCards} pedidos pendentes`);
        return orders.orders;
        
    } catch (error) {
        console.error('🔍 ❌ Erro ao buscar pedidos:', error.message);
        return [];
    }
}

/**
 * Aceita um pedido específico
 * @param {Page} page - Puppeteer page
 * @param {string} orderId - ID do pedido
 * @returns {Promise<boolean>} - true se aceito com sucesso
 */
async function acceptOrder(page, orderId) {
    console.log(`✅ [AUTO-ACCEPT] Iniciando aceite do pedido #${orderId}...`);
    
    try {
        // PASSO 1: Clicar no card do pedido para abrir modal
        console.log('✅ [PASSO 1] Clicando no card do pedido...');
        
        const cardClicked = await page.evaluate((id) => {
            const selectors = [
                `#link-to-order-${id}`,
                `[data-testid="link-to-order-${id}"]`,
                `a[href*="/order/${id}"]`,
                `[id*="${id}"]`
            ];
            
            for (const sel of selectors) {
                const card = document.querySelector(sel);
                if (card) {
                    card.click();
                    return { success: true, selector: sel };
                }
            }
            
            return { success: false };
        }, orderId);
        
        if (!cardClicked.success) {
            console.log('✅ ❌ Card do pedido não encontrado');
            return false;
        }
        
        console.log(`✅ ✓ Card clicado via ${cardClicked.selector}`);
        await sleep(2000); // Aguardar modal abrir
        
        // Screenshot para debug
        try {
            await page.screenshot({ path: `/app/logs/accept-step1-${orderId}.png`, fullPage: false });
        } catch (e) {}
        
        // PASSO 2: Verificar se modal abriu
        console.log('✅ [PASSO 2] Verificando se modal abriu...');
        
        const modalState = await page.evaluate(() => {
            const modalSelectors = [
                '#order-details-modal',
                '[data-testid="order-details-modal"]',
                '.order-modal',
                'hexa-v2-dialog'
            ];
            
            for (const sel of modalSelectors) {
                const modal = document.querySelector(sel);
                if (modal) {
                    return { 
                        modalOpen: true, 
                        selector: sel,
                        hasAcceptButton: !!document.querySelector('#accept-button, [data-testid="accept-button"]')
                    };
                }
            }
            
            // Verificar pelo texto na página
            const bodyText = document.body.innerText;
            return {
                modalOpen: bodyText.includes('Aceitar') || bodyText.includes('detalhes'),
                hasAcceptButton: bodyText.includes('Aceitar')
            };
        });
        
        if (!modalState.modalOpen) {
            console.log('✅ ⚠️ Modal não detectado, tentando continuar...');
        }
        
        // PASSO 3: Clicar no botão "Aceitar"
        console.log('✅ [PASSO 3] Clicando no botão "Aceitar"...');
        
        const acceptClicked = await page.evaluate(() => {
            // Estratégia 1: Buscar por ID/data-testid
            const buttonSelectors = [
                '#accept-button',
                '[data-testid="accept-button"]',
                'button[id*="accept"]',
                '[id*="accept-order"]'
            ];
            
            for (const sel of buttonSelectors) {
                const btn = document.querySelector(sel);
                if (btn) {
                    btn.click();
                    return { success: true, method: 'selector', selector: sel };
                }
            }
            
            // Estratégia 2: Buscar hexa-v2-button com texto "Aceitar"
            const hexaButtons = document.querySelectorAll('hexa-v2-button');
            for (const btn of hexaButtons) {
                let text = btn.textContent?.trim().toLowerCase() || '';
                
                // Verificar shadow DOM
                if (btn.shadowRoot) {
                    const innerBtn = btn.shadowRoot.querySelector('button');
                    text = innerBtn?.textContent?.trim().toLowerCase() || text;
                    
                    if (text === 'aceitar') {
                        innerBtn?.click() || btn.click();
                        return { success: true, method: 'hexa-shadow' };
                    }
                }
                
                if (text === 'aceitar') {
                    btn.click();
                    return { success: true, method: 'hexa-text' };
                }
            }
            
            // Estratégia 3: Buscar qualquer botão com texto "Aceitar"
            const allButtons = document.querySelectorAll('button, [role="button"]');
            for (const btn of allButtons) {
                const text = btn.textContent?.trim().toLowerCase();
                if (text === 'aceitar') {
                    btn.click();
                    return { success: true, method: 'button-text' };
                }
            }
            
            return { success: false };
        });
        
        if (!acceptClicked.success) {
            console.log('✅ ❌ Botão "Aceitar" não encontrado');
            try {
                await page.screenshot({ path: `/app/logs/accept-no-button-${orderId}.png`, fullPage: false });
            } catch (e) {}
            return false;
        }
        
        console.log(`✅ ✓ Botão "Aceitar" clicado via ${acceptClicked.method}`);
        await sleep(3000); // Aguardar processamento
        
        // Screenshot após aceite
        try {
            await page.screenshot({ path: `/app/logs/accept-after-${Date.now()}.png`, fullPage: false });
        } catch (e) {}
        
        // PASSO 4: Verificar se pedido foi aceito (não está mais na coluna de novos)
        console.log('✅ [PASSO 4] Verificando se pedido foi aceito...');
        
        const verifyResult = await page.evaluate((id) => {
            // Verificar se o card ainda está na coluna de novos
            const cardInNewColumn = document.querySelector(`#kanban-column-body-new-orders #link-to-order-${id}`);
            
            // Verificar se o card está na coluna de separação
            const cardInSeparation = document.querySelector(`#kanban-column-body-in-separation-orders #link-to-order-${id}`);
            
            // Verificar mensagem de sucesso
            const bodyText = document.body.innerText.toLowerCase();
            const hasSuccessMessage = bodyText.includes('aceito') || bodyText.includes('sucesso');
            
            return {
                stillInNewColumn: !!cardInNewColumn,
                inSeparationColumn: !!cardInSeparation,
                hasSuccessMessage
            };
        }, orderId);
        
        if (verifyResult.inSeparationColumn || !verifyResult.stillInNewColumn) {
            console.log(`✅ ✅ PEDIDO #${orderId} ACEITO COM SUCESSO!`);
            return true;
        }
        
        if (verifyResult.hasSuccessMessage) {
            console.log(`✅ ✅ PEDIDO #${orderId} provavelmente aceito (mensagem de sucesso)`);
            return true;
        }
        
        console.log(`✅ ⚠️ Status do pedido #${orderId} não confirmado`);
        return false;
        
    } catch (error) {
        console.error(`✅ ❌ Erro ao aceitar pedido #${orderId}:`, error.message);
        return false;
    }
}

/**
 * Executa o fluxo de aceite automático para todos os pedidos pendentes
 * @param {Page} page - Puppeteer page
 * @returns {Promise<Object>} - Resultado com pedidos aceitos e falhas
 */
async function runAutoAccept(page) {
    console.log('🚀 [AUTO-ACCEPT] Iniciando fluxo de aceite automático...');
    
    const results = {
        accepted: [],
        failed: [],
        skipped: []
    };
    
    try {
        // Garantir que estamos na página do kanban
        const currentUrl = await page.url();
        if (!currentUrl.includes('/poc-orders')) {
            console.log('🚀 Navegando para página do kanban...');
            await page.goto('https://seuze.ze.delivery/poc-orders', { waitUntil: 'networkidle2', timeout: 30000 });
            await sleep(3000);
        }
        
        // Buscar pedidos pendentes
        const pendingOrders = await getPendingOrders(page);
        
        if (pendingOrders.length === 0) {
            console.log('🚀 ℹ️ Nenhum pedido pendente encontrado');
            return results;
        }
        
        console.log(`🚀 Processando ${pendingOrders.length} pedidos pendentes...`);
        
        // Aceitar cada pedido
        for (const order of pendingOrders) {
            console.log(`\n--- Processando pedido #${order.id} ---`);
            
            const accepted = await acceptOrder(page, order.id);
            
            if (accepted) {
                results.accepted.push(order.id);
            } else {
                results.failed.push(order.id);
            }
            
            // Aguardar entre pedidos
            await sleep(2000);
            
            // Voltar para o kanban se necessário
            const url = await page.url();
            if (!url.includes('/poc-orders')) {
                await page.goto('https://seuze.ze.delivery/poc-orders', { waitUntil: 'networkidle2', timeout: 30000 });
                await sleep(2000);
            }
        }
        
        console.log('\n🚀 [AUTO-ACCEPT] Resumo:');
        console.log(`   ✅ Aceitos: ${results.accepted.length}`);
        console.log(`   ❌ Falhas: ${results.failed.length}`);
        
        return results;
        
    } catch (error) {
        console.error('🚀 ❌ Erro no fluxo de aceite automático:', error.message);
        return results;
    }
}

/**
 * Fecha modal atual se estiver aberto
 * @param {Page} page - Puppeteer page
 */
async function closeModal(page) {
    try {
        await page.keyboard.press('Escape');
        await sleep(500);
        
        await page.evaluate(() => {
            const closeButtons = document.querySelectorAll('[aria-label*="close"], [aria-label*="fechar"], .close-button');
            closeButtons.forEach(btn => btn.click());
        });
    } catch (e) {}
}

module.exports = {
    getPendingOrders,
    acceptOrder,
    runAutoAccept,
    closeModal
};
