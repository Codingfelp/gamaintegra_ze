/**
 * Phone Capture Module v2 - Captura telefone via fluxo de modal
 * 
 * FLUXO CORRETO (baseado nos HTMLs de 28/02/2026):
 * 
 * CENÁRIO 1: Na página de detalhes do pedido (/order/{id})
 * 1. Clicar no botão #phone-unavailable (hexa-v2-button "Ver telefone")
 * 2. Modal "Qual é o motivo para o contato?" aparece
 * 3. Clicar em "Problemas com a entrega" (expande accordion)
 * 4. Clicar em "O entregador não encontra o cliente"
 * 5. Clicar em "Confirmar"
 * 6. Modal "Dados para contato" aparece com telefone
 * 
 * CENÁRIO 2: Na página do Kanban (/poc-orders)
 * 1. Clicar no card do pedido via link-to-order-{id}
 * 2. Seguir passos 2-6 do cenário 1
 */

const fs = require('fs');

const sleep = (s) => new Promise(resolve => setTimeout(resolve, s * 1000));

/**
 * Clica em elemento dentro de Shadow DOM se necessário
 */
async function clickShadowElement(page, hostSelector, innerSelector, fallbackText) {
    return await page.evaluate(({ host, inner, text }) => {
        // Tenta encontrar elemento normalmente primeiro
        let el = document.querySelector(inner);
        if (el) {
            el.click();
            return { success: true, method: 'direct' };
        }

        // Buscar no host com shadow root
        const hostEl = document.querySelector(host);
        if (hostEl && hostEl.shadowRoot) {
            el = hostEl.shadowRoot.querySelector(inner) || 
                 hostEl.shadowRoot.querySelector('button');
            if (el) {
                el.click();
                return { success: true, method: 'shadow' };
            }
        }

        // Fallback: buscar por texto
        if (text) {
            const allButtons = document.querySelectorAll('button, hexa-v2-button, [role="button"]');
            for (const btn of allButtons) {
                const btnText = btn.textContent?.trim().toLowerCase() || '';
                if (btnText.includes(text.toLowerCase())) {
                    btn.click();
                    return { success: true, method: 'text_match' };
                }
                // Tentar no shadow root do botão
                if (btn.shadowRoot) {
                    const shadowBtn = btn.shadowRoot.querySelector('button');
                    const shadowText = shadowBtn?.textContent?.trim().toLowerCase() || '';
                    if (shadowText.includes(text.toLowerCase())) {
                        shadowBtn.click();
                        return { success: true, method: 'shadow_text' };
                    }
                }
            }
        }

        return { success: false };
    }, { host: hostSelector, inner: innerSelector, text: fallbackText });
}

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
        const currentUrl = await page.url();
        console.log(`📞 URL atual: ${currentUrl}`);
        
        // Determinar se estamos na página de detalhes ou no kanban
        const isOrderPage = currentUrl.includes('/order/');
        
        // ============================================
        // PASSO 1: Garantir que estamos na página correta
        // ============================================
        if (!isOrderPage) {
            console.log('📞 [PASSO 1] Navegando para página de detalhes do pedido...');
            
            // Tentar clicar no card do pedido
            const cardClicked = await page.evaluate((code) => {
                // Seletores específicos baseados no HTML atual
                const selectors = [
                    `#link-to-order-${code}`,
                    `[data-testid="link-to-order-${code}"]`,
                    `a[href*="${code}"]`,
                    `a[id*="${code}"]`
                ];
                
                for (const sel of selectors) {
                    const el = document.querySelector(sel);
                    if (el) {
                        el.click();
                        return { success: true, selector: sel };
                    }
                }
                
                // Fallback: buscar por texto
                const links = document.querySelectorAll('[data-testid^="link-to-order-"]');
                for (const link of links) {
                    if (link.textContent?.includes(code) || link.id?.includes(code)) {
                        link.click();
                        return { success: true, method: 'text_search' };
                    }
                }
                
                return { success: false, linksFound: links.length };
            }, orderCode);
            
            if (!cardClicked.success) {
                console.log(`📞 ❌ Card do pedido não encontrado`);
                return '';
            }
            
            console.log(`📞 ✓ Navegado para detalhes do pedido`);
            await sleep(3);
        }
        
        // Screenshot para debug
        try {
            await page.screenshot({ path: '/app/logs/phone-v2-step1.png', fullPage: false });
        } catch (e) {}
        
        // ============================================
        // PASSO 2: Clicar em "Ver telefone"
        // ============================================
        console.log('📞 [PASSO 2] Clicando em "Ver telefone"...');
        
        let phoneButtonClicked = false;
        
        // Estratégia 1: Buscar #phone-unavailable (hexa-v2-button com shadow DOM)
        const phoneButton = await clickShadowElement(
            page, 
            '#phone-unavailable', 
            'button', 
            'ver telefone'
        );
        
        if (phoneButton.success) {
            console.log(`📞 ✓ Clicou via ${phoneButton.method}`);
            phoneButtonClicked = true;
        } else {
            // Estratégia 2: Buscar por classe ou atributo
            const altClick = await page.evaluate(() => {
                // Buscar links com texto "Ver telefone"
                const links = document.querySelectorAll('a, button, span, div, hexa-v2-text-link');
                for (const link of links) {
                    const text = link.textContent?.toLowerCase().trim();
                    if (text === 'ver telefone' || text?.includes('ver telefone')) {
                        link.click();
                        return { success: true, tag: link.tagName };
                    }
                    // Verificar shadow DOM
                    if (link.shadowRoot) {
                        const inner = link.shadowRoot.querySelector('a, button, span');
                        const innerText = inner?.textContent?.toLowerCase().trim();
                        if (innerText === 'ver telefone' || innerText?.includes('ver telefone')) {
                            inner.click();
                            return { success: true, method: 'shadow' };
                        }
                    }
                }
                
                // Buscar na área de informações do cliente
                const customerInfo = document.querySelector('#user-info, [id*="customer"], [class*="customer"]');
                if (customerInfo) {
                    const buttons = customerInfo.querySelectorAll('button, a, hexa-v2-button');
                    for (const btn of buttons) {
                        if (btn.id?.includes('phone') || btn.className?.includes('phone')) {
                            btn.click();
                            return { success: true, method: 'customer_area' };
                        }
                    }
                }
                
                return { success: false };
            });
            
            if (altClick.success) {
                console.log(`📞 ✓ Clicou via estratégia alternativa: ${altClick.method || altClick.tag}`);
                phoneButtonClicked = true;
            }
        }
        
        if (!phoneButtonClicked) {
            console.log('📞 ❌ Botão "Ver telefone" não encontrado');
            try { await page.screenshot({ path: '/app/logs/phone-v2-no-button.png' }); } catch(e) {}
            return '';
        }
        
        await sleep(2);
        
        // Screenshot após clicar
        try {
            await page.screenshot({ path: '/app/logs/phone-v2-step2.png', fullPage: false });
        } catch (e) {}
        
        // ============================================
        // PASSO 3: Verificar se modal apareceu e clicar em "Problemas com a entrega"
        // ============================================
        console.log('📞 [PASSO 3] Aguardando modal de motivo...');
        
        // Aguardar modal
        await sleep(1);
        
        const modalState = await page.evaluate(() => {
            const bodyText = document.body.innerText.toLowerCase();
            return {
                hasMotivo: bodyText.includes('qual é o motivo') || bodyText.includes('motivo para o contato'),
                hasProblemas: bodyText.includes('problemas com a entrega'),
                hasEntregador: bodyText.includes('entregador não encontra'),
                hasTelefone: bodyText.includes('ligue para') || bodyText.match(/\(\d{2}\)\s*\d{4,5}[-\s]?\d{4}/)
            };
        });
        
        console.log(`📞 Modal state: ${JSON.stringify(modalState)}`);
        
        // Se telefone já está visível, capturar diretamente
        if (modalState.hasTelefone) {
            console.log('📞 ✓ Telefone já está visível!');
            const phone = await extractPhone(page);
            if (phone) {
                await closeModal(page);
                return phone;
            }
        }
        
        if (!modalState.hasMotivo && !modalState.hasProblemas) {
            console.log('📞 ⚠️ Modal de motivo não apareceu, aguardando...');
            await sleep(2);
        }
        
        // Clicar em "Problemas com a entrega"
        console.log('📞 Clicando em "Problemas com a entrega"...');
        
        const problemasClicked = await page.evaluate(() => {
            const targets = ['Problemas com a entrega', 'Problemas com entrega'];
            const elements = document.querySelectorAll('div, span, label, p, li, button, hexa-v2-text');
            
            for (const el of elements) {
                let text = el.textContent?.trim();
                
                // Verificar shadow DOM
                if (el.shadowRoot) {
                    const inner = el.shadowRoot.querySelector('span, div, p');
                    if (inner) text = inner.textContent?.trim();
                }
                
                if (targets.some(t => text === t)) {
                    const parent = el.parentElement;
                    const clickTarget = el.onclick ? el : (parent?.onclick ? parent : el);
                    clickTarget.click();
                    return { success: true, text: text };
                }
            }
            
            // Tentar por role="radio" ou checkbox
            const radios = document.querySelectorAll('[role="radio"], [role="checkbox"], input[type="radio"]');
            for (const radio of radios) {
                const label = radio.closest('label') || radio.parentElement;
                if (label?.textContent?.includes('Problemas')) {
                    radio.click();
                    return { success: true, method: 'radio' };
                }
            }
            
            return { success: false };
        });
        
        if (problemasClicked.success) {
            console.log(`📞 ✓ Clicou em "Problemas com a entrega"`);
        } else {
            console.log('📞 ⚠️ Opção "Problemas" não encontrada');
        }
        
        await sleep(1.5);
        
        // ============================================
        // PASSO 4: Clicar em "O entregador não encontra o cliente"
        // ============================================
        console.log('📞 [PASSO 4] Clicando em "O entregador não encontra o cliente"...');
        
        const entregadorClicked = await page.evaluate(() => {
            const targets = [
                'O entregador não encontra o cliente',
                'entregador não encontra o cliente',
                'Entregador não encontra'
            ];
            
            const elements = document.querySelectorAll('div, span, label, p, li');
            
            for (const el of elements) {
                const text = el.textContent?.trim().toLowerCase();
                if (targets.some(t => text?.includes(t.toLowerCase()))) {
                    el.click();
                    return { success: true };
                }
            }
            
            // Buscar em hexa-v2-text
            const hexaTexts = document.querySelectorAll('hexa-v2-text');
            for (const ht of hexaTexts) {
                let text = '';
                if (ht.shadowRoot) {
                    text = ht.shadowRoot.textContent?.toLowerCase() || '';
                } else {
                    text = ht.textContent?.toLowerCase() || '';
                }
                if (targets.some(t => text.includes(t.toLowerCase()))) {
                    ht.click();
                    return { success: true, method: 'hexa-text' };
                }
            }
            
            return { success: false };
        });
        
        if (!entregadorClicked.success) {
            console.log('📞 ⚠️ Opção "entregador não encontra" não clicada');
        } else {
            console.log('📞 ✓ Opção selecionada');
        }
        
        await sleep(1);
        
        // ============================================
        // PASSO 5: Clicar em "Confirmar"
        // ============================================
        console.log('📞 [PASSO 5] Clicando em "Confirmar"...');
        
        const confirmClicked = await page.evaluate(() => {
            // Buscar botão Confirmar
            const buttons = document.querySelectorAll('button, hexa-v2-button, [role="button"]');
            
            for (const btn of buttons) {
                let text = btn.textContent?.trim().toLowerCase() || '';
                
                // Shadow DOM
                if (btn.shadowRoot) {
                    const inner = btn.shadowRoot.querySelector('button, span');
                    text = inner?.textContent?.trim().toLowerCase() || text;
                    
                    if (text === 'confirmar' || text === 'confirm') {
                        inner?.click() || btn.click();
                        return { success: true, method: 'shadow' };
                    }
                }
                
                if (text === 'confirmar' || text === 'confirm') {
                    btn.click();
                    return { success: true };
                }
            }
            
            return { success: false };
        });
        
        if (!confirmClicked.success) {
            console.log('📞 ⚠️ Botão "Confirmar" não encontrado');
        } else {
            console.log('📞 ✓ Confirmado');
        }
        
        await sleep(3);
        
        // Screenshot após confirmar
        try {
            await page.screenshot({ path: '/app/logs/phone-v2-step5.png', fullPage: false });
        } catch (e) {}
        
        // ============================================
        // PASSO 6: Extrair telefone
        // ============================================
        console.log('📞 [PASSO 6] Extraindo telefone...');
        
        const phone = await extractPhone(page);
        
        // Fechar modal
        await closeModal(page);
        
        if (phone) {
            console.log(`📞 ✅ TELEFONE CAPTURADO: ${phone}`);
            return phone;
        }
        
        console.log('📞 ❌ Telefone não encontrado');
        return '';
        
    } catch (error) {
        console.error(`📞 ❌ Erro na captura: ${error.message}`);
        try {
            await page.screenshot({ path: '/app/logs/phone-v2-error.png' });
        } catch (e) {}
        return '';
    }
}

/**
 * Extrai telefone da página atual
 */
async function extractPhone(page) {
    return await page.evaluate(() => {
        const bodyText = document.body.innerText;
        
        // Padrões de telefone brasileiro
        const patterns = [
            /\+55\s*\(?\d{2}\)?\s*\d{4,5}[-\s]?\d{4}/g,  // +55 (31) 99116-5226
            /\(\d{2}\)\s*\d{4,5}[-\s]?\d{4}/g,           // (31) 99116-5226
            /\d{2}\s*9?\d{4}[-\s]?\d{4}/g,               // 31 99116-5226 ou 31999165226
        ];
        
        for (const pattern of patterns) {
            const matches = bodyText.match(pattern);
            if (matches && matches.length > 0) {
                // Pegar primeiro match válido
                for (const match of matches) {
                    // Filtrar números muito curtos ou que parecem outros dados
                    const digits = match.replace(/\D/g, '');
                    if (digits.length >= 10 && digits.length <= 13) {
                        return match.replace(/\s+/g, ' ').trim();
                    }
                }
            }
        }
        
        // Fallback: buscar elemento específico #customer-phone
        const customerPhone = document.querySelector('#customer-phone');
        if (customerPhone) {
            let text = customerPhone.textContent?.trim();
            if (customerPhone.shadowRoot) {
                text = customerPhone.shadowRoot.textContent?.trim();
            }
            if (text && text.match(/\d{10,}/)) {
                return text;
            }
        }
        
        // Buscar em links tel:
        const telLinks = document.querySelectorAll('a[href^="tel:"]');
        for (const link of telLinks) {
            const href = link.getAttribute('href');
            const phone = href?.replace('tel:', '').trim();
            if (phone && phone.length >= 10) {
                return phone;
            }
        }
        
        return null;
    });
}

/**
 * Fecha modal atual
 */
async function closeModal(page) {
    try {
        // Tentar Escape primeiro
        await page.keyboard.press('Escape');
        await sleep(0.5);
        
        // Tentar clicar em botões de fechar
        await page.evaluate(() => {
            // Buscar botões de cancelar/fechar
            const closeSelectors = [
                'button[aria-label*="close"]',
                'button[aria-label*="fechar"]',
                'button[class*="close"]',
                '[data-testid*="close"]',
                '.close-button',
                '[aria-label="Cancelar"]'
            ];
            
            for (const sel of closeSelectors) {
                const btn = document.querySelector(sel);
                if (btn) {
                    btn.click();
                    return;
                }
            }
            
            // Buscar por texto
            const buttons = document.querySelectorAll('button, hexa-v2-button');
            for (const btn of buttons) {
                const text = btn.textContent?.toLowerCase().trim();
                if (text === 'cancelar' || text === 'fechar' || text === 'x') {
                    btn.click();
                    return;
                }
            }
        });
        
        await sleep(0.5);
        
        // Tentar Escape novamente
        await page.keyboard.press('Escape');
    } catch (e) {
        console.log('📞 Erro ao fechar modal:', e.message);
    }
}

/**
 * Limpa e formata número de telefone
 */
function formatPhone(phone) {
    if (!phone) return '';
    
    // Remover tudo exceto números
    let digits = phone.replace(/\D/g, '');
    
    // Se não começar com 55, adicionar
    if (!digits.startsWith('55') && digits.length === 11) {
        digits = '55' + digits;
    }
    
    // Formatar: +55 (XX) XXXXX-XXXX
    if (digits.length === 13) {
        return `+${digits.slice(0,2)} (${digits.slice(2,4)}) ${digits.slice(4,9)}-${digits.slice(9)}`;
    } else if (digits.length === 12) {
        return `+${digits.slice(0,2)} (${digits.slice(2,4)}) ${digits.slice(4,8)}-${digits.slice(8)}`;
    } else if (digits.length === 11) {
        return `(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7)}`;
    } else if (digits.length === 10) {
        return `(${digits.slice(0,2)}) ${digits.slice(2,6)}-${digits.slice(6)}`;
    }
    
    return phone; // Retornar original se não conseguir formatar
}

module.exports = {
    capturePhoneViaModal,
    closeModal,
    formatPhone,
    extractPhone,
    clickShadowElement
};
