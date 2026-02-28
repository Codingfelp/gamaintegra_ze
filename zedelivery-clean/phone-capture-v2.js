/**
 * Phone Capture Module v2 - Captura telefone via fluxo de modal
 * 
 * FLUXO CORRETO (baseado nos HTMLs de 28/02/2026):
 * 1. Clicar no card do cliente (na coluna "Entregas em andamento")
 * 2. Modal "Qual é o motivo para o contato?" aparece
 * 3. Clicar em "Problemas com a entrega" (expande accordion)
 * 4. Clicar em "O entregador não encontra o cliente"
 * 5. Clicar em "Confirmar"
 * 6. Modal "Dados para contato" aparece com:
 *    - "Ligue para" + número de telefone
 *    - Botão WhatsApp
 * 7. Extrair o número de telefone do texto
 */

const fs = require('fs');

const sleep = (s) => new Promise(resolve => setTimeout(resolve, s * 1000));

/**
 * Captura telefone do cliente através do fluxo de modal
 * @param {Page} page - Puppeteer page
 * @param {string} orderCode - Código do pedido (ex: "814169760")
 * @param {string} customerName - Nome do cliente (para identificar o card)
 * @returns {Promise<string>} - Telefone capturado ou string vazia
 */
async function capturePhoneViaModal(page, orderCode, customerName) {
    console.log(`📞 [PHONE-V2] Iniciando captura para pedido #${orderCode} (${customerName})`);
    
    try {
        // ============================================
        // PASSO 1: Clicar no card do pedido
        // ============================================
        console.log('📞 [PASSO 1] Buscando card do pedido...');
        
        const cardClicked = await page.evaluate((code, name) => {
            // Buscar na coluna "Em separação" (kanban-column-body-accepted-orders ou similar)
            // Também buscar em outras colunas de pedidos em andamento
            const columns = document.querySelectorAll('[class*="kanban-column"], [class*="column-body"], [data-testid*="column"]');
            
            // Primeiro, tentar encontrar na coluna específica "Em separação"
            for (const col of columns) {
                const colText = col.textContent || '';
                // Verificar se é a coluna de "Em separação" ou "Aceitos"
                if (colText.includes('Em separação') || colText.includes('Aceito') || colText.includes('separação')) {
                    // Buscar o card do pedido dentro desta coluna
                    const cards = col.querySelectorAll('a[href*="order"], div[class*="card"], div[class*="Card"]');
                    for (const card of cards) {
                        const cardText = card.textContent || '';
                        if (cardText.includes(code) || (name && cardText.toLowerCase().includes(name.toLowerCase()))) {
                            // Clicar no nome do cliente para abrir o modal
                            const clickTarget = card.querySelector('h5, h4, [class*="name"], [class*="customer"], span, p') || card;
                            clickTarget.click();
                            return { success: true, method: 'column_card', column: 'Em separação', found: cardText.substring(0, 50) };
                        }
                    }
                }
            }
            
            // Fallback: buscar em todas as colunas/cards
            const allCards = document.querySelectorAll('a[href*="poc-orders"], a[href*="order"], div[class*="order-card"], div[class*="OrderCard"]');
            
            for (const card of allCards) {
                const text = card.textContent || '';
                if (text.includes(code) || (name && text.toLowerCase().includes(name.toLowerCase()))) {
                    const clickable = card.querySelector('[class*="customer"], [class*="name"], h5, h4, span, p') || card;
                    clickable.click();
                    return { success: true, method: 'fallback_card', found: text.substring(0, 50) };
                }
            }
            
            // Último fallback: buscar por texto do número do pedido em qualquer elemento
            const allElements = document.querySelectorAll('h5, h4, span, p, div');
            for (const el of allElements) {
                const elText = el.textContent?.trim() || '';
                if (elText.includes(`Nº ${code}`) || elText === code || elText.includes(code)) {
                    el.click();
                    return { success: true, method: 'text_match' };
                }
            }
            
            // Retornar info para debug
            return { 
                success: false, 
                columnsFound: columns.length,
                cardsFound: allCards.length 
            };
        }, orderCode, customerName);
        
        if (!cardClicked.success) {
            console.log(`📞 ❌ Card do pedido não encontrado (cards: ${cardClicked.cardsFound})`);
            return '';
        }
        
        console.log(`📞 ✓ Card clicado (${cardClicked.method})`);
        await sleep(2);
        
        // ============================================
        // PASSO 2: Verificar se modal de motivo apareceu
        // ============================================
        console.log('📞 [PASSO 2] Aguardando modal de motivo...');
        
        const modalAppeared = await page.evaluate(() => {
            const bodyText = document.body.innerText;
            return bodyText.includes('Qual é o motivo') || 
                   bodyText.includes('motivo para o contato') ||
                   bodyText.includes('Alterar o pedido') ||
                   bodyText.includes('Problemas com a entrega');
        });
        
        if (!modalAppeared) {
            console.log('📞 ⚠️ Modal de motivo não apareceu, aguardando mais...');
            await sleep(2);
        }
        
        // Screenshot para debug
        try {
            await page.screenshot({ path: '/app/logs/phone-v2-step2.png', fullPage: false });
        } catch (e) {}
        
        // ============================================
        // PASSO 3: Clicar em "Problemas com a entrega"
        // ============================================
        console.log('📞 [PASSO 3] Clicando em "Problemas com a entrega"...');
        
        let accordionExpanded = false;
        
        for (let attempt = 1; attempt <= 3 && !accordionExpanded; attempt++) {
            console.log(`📞 Tentativa ${attempt}/3...`);
            
            const clicked = await page.evaluate(() => {
                // Buscar o texto exato "Problemas com a entrega"
                const elements = document.querySelectorAll('div, span, label, p, li, button');
                
                for (const el of elements) {
                    const text = el.textContent?.trim();
                    
                    // Match exato (não queremos pegar sub-elementos)
                    if (text === 'Problemas com a entrega') {
                        // Verificar se é o elemento principal ou um filho
                        const parent = el.parentElement;
                        
                        // Clicar no elemento ou no pai se for clicável
                        const target = el.onclick ? el : (parent?.onclick ? parent : el);
                        target.click();
                        
                        return { success: true, tag: target.tagName };
                    }
                }
                
                // Fallback: buscar por ID específico se existir
                const byId = document.querySelector('#REASON_CATEGORY_DELIVERY_PROBLEM');
                if (byId) {
                    byId.click();
                    return { success: true, method: 'by_id' };
                }
                
                return { success: false };
            });
            
            if (!clicked.success) {
                console.log('📞 ⚠️ Opção não encontrada');
                await sleep(1);
                continue;
            }
            
            console.log(`📞 ✓ Clicou em "Problemas com a entrega"`);
            await sleep(2);
            
            // Verificar se expandiu (sub-opções visíveis)
            const expanded = await page.evaluate(() => {
                const text = document.body.innerText.toLowerCase();
                return text.includes('entregador não encontra') || 
                       text.includes('endereço está incorreto') ||
                       text.includes('pedido não foi entregue');
            });
            
            if (expanded) {
                console.log('📞 ✓ Accordion expandiu!');
                accordionExpanded = true;
            } else {
                console.log('📞 ⚠️ Accordion não expandiu, tentando novamente...');
            }
        }
        
        if (!accordionExpanded) {
            console.log('📞 ❌ Não foi possível expandir accordion');
            await closeModal(page);
            return '';
        }
        
        // ============================================
        // PASSO 4: Clicar em "O entregador não encontra o cliente"
        // ============================================
        console.log('📞 [PASSO 4] Clicando em "O entregador não encontra o cliente"...');
        
        const optionClicked = await page.evaluate(() => {
            const elements = document.querySelectorAll('div, span, label, p, li');
            
            for (const el of elements) {
                const text = el.textContent?.trim().toLowerCase();
                
                if (text === 'o entregador não encontra o cliente' ||
                    text === 'entregador não encontra o cliente') {
                    el.click();
                    return { success: true, text: text };
                }
            }
            
            // Fallback por ID
            const byId = document.querySelector('#REASON_ITEM_DELIVERY_DOES_NOT_FIND_THE_CUSTOMER');
            if (byId) {
                byId.click();
                return { success: true, method: 'by_id' };
            }
            
            return { success: false };
        });
        
        if (!optionClicked.success) {
            console.log('📞 ❌ Opção "entregador não encontra" não encontrada');
            // Screenshot para debug
            try {
                await page.screenshot({ path: '/app/logs/phone-v2-step4-fail.png' });
            } catch (e) {}
            await closeModal(page);
            return '';
        }
        
        console.log('📞 ✓ Opção selecionada');
        await sleep(1);
        
        // ============================================
        // PASSO 5: Clicar em "Confirmar"
        // ============================================
        console.log('📞 [PASSO 5] Clicando em "Confirmar"...');
        
        const confirmed = await page.evaluate(() => {
            // Buscar botão "Confirmar"
            const buttons = document.querySelectorAll('button, [role="button"], a');
            
            for (const btn of buttons) {
                const text = btn.textContent?.trim().toLowerCase();
                if (text === 'confirmar' || text === 'confirm') {
                    btn.click();
                    return { success: true };
                }
            }
            
            return { success: false };
        });
        
        if (!confirmed.success) {
            console.log('📞 ❌ Botão "Confirmar" não encontrado');
            await closeModal(page);
            return '';
        }
        
        console.log('📞 ✓ Confirmado');
        await sleep(3); // Aguardar modal de dados aparecer
        
        // ============================================
        // PASSO 6: Extrair telefone do modal de dados
        // ============================================
        console.log('📞 [PASSO 6] Extraindo telefone...');
        
        // Screenshot do modal de dados
        try {
            await page.screenshot({ path: '/app/logs/phone-v2-step6.png', fullPage: false });
        } catch (e) {}
        
        const phoneData = await page.evaluate(() => {
            const bodyText = document.body.innerText;
            
            // Padrão brasileiro: +55 (XX) XXXXX-XXXX ou (XX) XXXXX-XXXX
            const phonePatterns = [
                /\+55\s*\(\d{2}\)\s*\d{4,5}-?\d{4}/g,  // +55 (31) 99116-5226
                /\(\d{2}\)\s*\d{4,5}-?\d{4}/g,         // (31) 99116-5226
                /\d{2}\s*\d{4,5}-?\d{4}/g,             // 31 99116-5226
            ];
            
            for (const pattern of phonePatterns) {
                const matches = bodyText.match(pattern);
                if (matches && matches.length > 0) {
                    // Limpar e retornar o primeiro número encontrado
                    let phone = matches[0];
                    // Remover espaços extras e formatar
                    phone = phone.replace(/\s+/g, ' ').trim();
                    return { success: true, phone: phone, raw: matches };
                }
            }
            
            // Fallback: buscar elemento específico
            const phoneElements = document.querySelectorAll('h4, p, span, div');
            for (const el of phoneElements) {
                const text = el.textContent?.trim();
                if (text && /^\+?55?\s*\(?\d{2}\)?/.test(text)) {
                    return { success: true, phone: text, method: 'element_search' };
                }
            }
            
            // Verificar se modal de dados apareceu
            const hasContactModal = bodyText.includes('Ligue para') || 
                                   bodyText.includes('Whatsapp') ||
                                   bodyText.includes('Dados para contato');
            
            return { 
                success: false, 
                hasContactModal: hasContactModal,
                bodyPreview: bodyText.substring(0, 500)
            };
        });
        
        // Fechar modal
        await closeModal(page);
        
        if (phoneData.success) {
            console.log(`📞 ✅ TELEFONE CAPTURADO: ${phoneData.phone}`);
            return phoneData.phone;
        } else {
            console.log('📞 ❌ Telefone não encontrado no modal');
            if (phoneData.hasContactModal) {
                console.log('📞 Modal de contato apareceu mas telefone não extraído');
            }
            return '';
        }
        
    } catch (error) {
        console.error(`📞 ❌ Erro na captura: ${error.message}`);
        try {
            await page.screenshot({ path: '/app/logs/phone-v2-error.png' });
        } catch (e) {}
        return '';
    }
}

/**
 * Fecha modal atual
 */
async function closeModal(page) {
    try {
        // Tentar Escape primeiro
        await page.keyboard.press('Escape');
        await sleep(0.5);
        
        // Tentar clicar em "Cancelar" ou "X"
        await page.evaluate(() => {
            const cancelBtn = Array.from(document.querySelectorAll('button'))
                .find(btn => btn.textContent?.toLowerCase().includes('cancelar'));
            if (cancelBtn) cancelBtn.click();
            
            const closeBtn = document.querySelector('[aria-label="close"], [class*="close"], button[class*="Close"]');
            if (closeBtn) closeBtn.click();
        });
    } catch (e) {}
}

/**
 * Limpa e formata número de telefone
 */
function formatPhone(phone) {
    if (!phone) return '';
    
    // Remover tudo exceto números
    let digits = phone.replace(/\D/g, '');
    
    // Se começar com 55, manter
    // Se não, adicionar 55
    if (!digits.startsWith('55') && digits.length === 11) {
        digits = '55' + digits;
    }
    
    // Formatar: +55 (XX) XXXXX-XXXX
    if (digits.length === 13) {
        return `+${digits.slice(0,2)} (${digits.slice(2,4)}) ${digits.slice(4,9)}-${digits.slice(9)}`;
    } else if (digits.length === 12) {
        return `+${digits.slice(0,2)} (${digits.slice(2,4)}) ${digits.slice(4,8)}-${digits.slice(8)}`;
    }
    
    return phone; // Retornar original se não conseguir formatar
}

module.exports = {
    capturePhoneViaModal,
    closeModal,
    formatPhone
};
