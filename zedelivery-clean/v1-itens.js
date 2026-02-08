const puppeteer = require('puppeteer');
const fs = require('fs');
const request = require('request');
const { performance } = require('perf_hooks');
const phpBridge = require('./php-bridge');
const sessionManager = require('./session-manager');

// Funções utilitárias compartilhadas
function readConfig() {
    const data = fs.readFileSync('configuracao.json', 'utf8');
    return JSON.parse(data);
}
const configRobo = readConfig();

// Configuração de renovação de sessão
const SESSION_SAVE_INTERVAL = 10 * 60 * 1000; // 10 minutos

async function sleep(sec) {
    return new Promise(resolve => setTimeout(resolve, sec * 1000));
}

async function marcarCheckbox(page) {
    const hostHandle = await page.$('hexa-v2-checkbox[name="test-checkbox"]');
    if (!hostHandle) {
        console.log("❌ Checkbox não encontrado!");
        return;
    }

    // pega o shadowRoot
    const shadowRoot = await hostHandle.evaluateHandle(el => el.shadowRoot);

    // pega o input real dentro do shadowRoot
    const inputHandle = await shadowRoot.$('input[type="checkbox"]');

    if (inputHandle) {
        const checked = await (await inputHandle.getProperty('checked')).jsonValue();

        if (!checked) {
            await inputHandle.click(); // marca se ainda não estiver marcado
            console.log("✅ Checkbox 'Manter conectado' marcado!");
        } else {
            console.log("ℹ️ Checkbox já estava marcado.");
        }
    }

    await shadowRoot.dispose();
    await hostHandle.dispose();
}

async function curl(options) {
    return new Promise((resolve, reject) => {
        request(options, (err, res, body) => {
            if (err) return reject(err);
            resolve(body);
        });
    });
}

async function insert_pedido(idOrder) {
    // Usar PHP Bridge via CLI em vez de HTTP
    try {
        const result = await phpBridge.inserirPedido(idOrder);
        console.log('Pedido inserido:', result);
        return result;
    } catch (error) {
        console.error('Erro ao inserir pedido:', error.message);
        return null;
    }
}

async function pegarDupla() {
    const maxTentativas = 20; // Aumentado de 10 para 20
    
    console.log('📧 Iniciando busca por código 2FA...');
    console.log('⏳ Aguardando 15 segundos para email chegar...');
    await sleep(15); // Aguardar email chegar antes de começar a buscar
    
    for (let tentativa = 1; tentativa <= maxTentativas; tentativa++) {
        try {
            console.log(`📧 Tentativa ${tentativa}/${maxTentativas} - Buscando código 2FA...`);
            const codigo = await phpBridge.pegarCodigo2FA(30000);
            
            if (codigo && codigo.length === 6) {
                console.log(`✅ Código 2FA encontrado: ${codigo}`);
                return codigo;
            }
            
            if (codigo === null || codigo === 0 || codigo === '0') {
                console.log('⏳ Nenhum email de 2FA encontrado ainda...');
            } else {
                console.log(`⚠️ Resposta inesperada do Gmail: ${JSON.stringify(codigo)}`);
            }
        } catch (error) {
            console.error("❌ Erro ao buscar código 2FA:", error.message);
        }
        
        console.log(`⏳ Aguardando 8 segundos antes da próxima tentativa...`);
        await sleep(8);
    }
    
    throw new Error("Não foi possível obter código 2FA após múltiplas tentativas");
}

async function removerBOM(str) {
    return str.replace(/^\uFEFF/, ""); // Remove BOM do início da string
}

async function view_pedido(idOrder) {
    // Usar PHP Bridge via CLI em vez de HTTP
    try {
        const result = await phpBridge.atualizarPedido(idOrder);
        console.log('Pedido atualizado:', result ? result.substring(0, 100) : 'OK');
        return result;
    } catch (error) {
        console.error('Erro ao atualizar pedido:', error.message);
        return null;
    }
}

async function pegar_id_pedido() {
    try {
        const result = await phpBridge.pegarProximoPedido();
        console.log('Próximo pedido:', result);
        return result || 0;
    } catch (error) {
        console.error("Erro ao pegar ID do pedido:", error.message);
        return 0;
    }
}

async function pegar_id_pedido_status() {
    try {
        const result = await phpBridge.pegarProximoPedidoStatus();
        console.log('Próximo pedido status:', result);
        return result || 0;
    } catch (error) {
        console.error("Erro ao pegar ID do pedido:", error.message);
        return 0;
    }
}

function getStatusByRow(rowNumber) {
    // Monta o seletor dinamicamente
    const selector = `hexa-v2-custom-table-row:nth-child(${rowNumber}) hexa-v2-custom-table-item:nth-child(3) hexa-v2-badge-status`;

    const badgeStatus = document.querySelector(selector);
    if (!badgeStatus) {
        console.error(`Status da linha ${rowNumber} não encontrado`);
        return null;
    }

    // Acessa o Shadow DOM
    const statusSpan = badgeStatus.shadowRoot?.querySelector('div > span');
    return statusSpan?.textContent.trim() || null;
}

async function getTextFromShadowOrNormal(page, selector, innerSelector = null) {
    const element = await page.$(selector);
    if (!element) return "";

    return await page.evaluate((el, innerSel) => {
        // Se o elemento tem shadow root
        if (el.shadowRoot) {
            if (innerSel) {
                const innerEl = el.shadowRoot.querySelector(innerSel);
                return innerEl ? innerEl.textContent.trim() : "";
            }
            // Se não passou innerSelector, pega o texto direto do shadowRoot (pode ajustar se necessário)
            return el.shadowRoot.textContent.trim();
        }
        // Se não tem shadow root, pega texto normal
        return el.textContent.trim();
    }, element, innerSelector);
}

/**
 * Captura o telefone do cliente via fluxo de "Ver telefone"
 * Fluxo: Clicar "Ver telefone" -> Selecionar "Problemas com a entrega" -> 
 *        Selecionar "Entregador não encontra cliente" -> Confirmar -> Capturar telefone
 */
async function capturarTelefoneViaFluxo(page) {
    try {
        console.log('📞 [TELEFONE] Iniciando captura de telefone via fluxo modal...');
        
        // Salvar screenshot para debug
        try {
            await page.screenshot({ path: '/app/logs/telefone-antes.png', fullPage: false });
        } catch (e) {}
        
        // ===============================================
        // PASSO 1: Encontrar e clicar no botão "Ver telefone"
        // ===============================================
        
        // O botão tem ID #phone-unavailable e é um hexa-v2-button
        const btnSelector = '#phone-unavailable';
        
        // Verificar se o botão existe
        const btnExists = await page.$(btnSelector);
        if (!btnExists) {
            console.log('📞 [TELEFONE] Botão #phone-unavailable não encontrado');
            return '';
        }
        
        // Verificar o texto atual - se já for um telefone, retorna
        const textoAtual = await page.evaluate((sel) => {
            const el = document.querySelector(sel);
            if (!el) return '';
            
            // Tentar pegar texto do shadow DOM
            if (el.shadowRoot) {
                const btn = el.shadowRoot.querySelector('button');
                if (btn) return btn.textContent.trim();
            }
            return el.textContent.trim();
        }, btnSelector);
        
        console.log('📞 [TELEFONE] Texto atual do botão:', textoAtual);
        
        // Se já é um telefone (contém números suficientes), retorna
        const numerosNoTexto = textoAtual.replace(/\D/g, '');
        if (numerosNoTexto.length >= 10) {
            console.log('📞 [TELEFONE] Telefone já está visível:', numerosNoTexto);
            return numerosNoTexto;
        }
        
        // Clicar no botão Ver telefone
        console.log('📞 [TELEFONE] Clicando no botão Ver telefone...');
        await page.evaluate((sel) => {
            const el = document.querySelector(sel);
            if (el && el.shadowRoot) {
                const btn = el.shadowRoot.querySelector('button');
                if (btn) {
                    btn.click();
                    return;
                }
            }
            if (el) el.click();
        }, btnSelector);
        
        await sleep(2.5);
        
        // Salvar screenshot do modal
        try {
            await page.screenshot({ path: '/app/logs/telefone-modal1.png', fullPage: false });
        } catch (e) {}
        
        // ===============================================
        // PASSO 2: Selecionar "Problemas com a entrega"
        // ===============================================
        console.log('📞 [TELEFONE] Buscando opção "Problemas com a entrega"...');
        
        // Listar todas as opções de radio disponíveis para debug
        const opcoesDisponiveis = await page.evaluate(() => {
            const opcoes = [];
            const radios = document.querySelectorAll('hexa-v2-radio-button');
            radios.forEach((radio, i) => {
                let texto = radio.getAttribute('label') || '';
                if (!texto && radio.shadowRoot) {
                    const label = radio.shadowRoot.querySelector('label, span');
                    texto = label ? label.textContent.trim() : '';
                }
                opcoes.push(`[${i}] ${texto}`);
            });
            return opcoes;
        });
        console.log('📞 [TELEFONE] Opções encontradas:', opcoesDisponiveis.join(' | '));
        
        // Clicar na opção "Problemas com a entrega"
        const clicouProblemas = await page.evaluate(() => {
            const radios = document.querySelectorAll('hexa-v2-radio-button');
            for (const radio of radios) {
                let texto = radio.getAttribute('label') || '';
                if (!texto && radio.shadowRoot) {
                    const label = radio.shadowRoot.querySelector('label, span');
                    texto = label ? label.textContent.trim() : '';
                }
                
                if (texto.toLowerCase().includes('problemas com a entrega') || 
                    texto.toLowerCase().includes('problema') && texto.toLowerCase().includes('entrega')) {
                    // Clicar no radio
                    if (radio.shadowRoot) {
                        const input = radio.shadowRoot.querySelector('input');
                        if (input) { input.click(); return true; }
                    }
                    radio.click();
                    return true;
                }
            }
            return false;
        });
        
        if (!clicouProblemas) {
            console.log('📞 [TELEFONE] Não encontrou "Problemas com a entrega", fechando modal');
            await page.keyboard.press('Escape');
            return '';
        }
        
        console.log('📞 [TELEFONE] ✓ Clicou em "Problemas com a entrega"');
        await sleep(2);
        
        // Salvar screenshot
        try {
            await page.screenshot({ path: '/app/logs/telefone-modal2.png', fullPage: false });
        } catch (e) {}
        
        // ===============================================
        // PASSO 3: Selecionar "O entregador não encontra o cliente"
        // ===============================================
        console.log('📞 [TELEFONE] Buscando opção "O entregador não encontra o cliente"...');
        
        // Listar opções novamente
        const opcoesSubMenu = await page.evaluate(() => {
            const opcoes = [];
            const radios = document.querySelectorAll('hexa-v2-radio-button');
            radios.forEach((radio, i) => {
                let texto = radio.getAttribute('label') || '';
                if (!texto && radio.shadowRoot) {
                    const label = radio.shadowRoot.querySelector('label, span');
                    texto = label ? label.textContent.trim() : '';
                }
                opcoes.push(`[${i}] ${texto}`);
            });
            return opcoes;
        });
        console.log('📞 [TELEFONE] Opções do submenu:', opcoesSubMenu.join(' | '));
        
        const clicouEntregador = await page.evaluate(() => {
            const radios = document.querySelectorAll('hexa-v2-radio-button');
            for (const radio of radios) {
                let texto = radio.getAttribute('label') || '';
                if (!texto && radio.shadowRoot) {
                    const label = radio.shadowRoot.querySelector('label, span');
                    texto = label ? label.textContent.trim() : '';
                }
                
                if (texto.toLowerCase().includes('entregador não encontra') || 
                    texto.toLowerCase().includes('não encontra o cliente') ||
                    texto.toLowerCase().includes('entregador') && texto.toLowerCase().includes('encontra')) {
                    if (radio.shadowRoot) {
                        const input = radio.shadowRoot.querySelector('input');
                        if (input) { input.click(); return true; }
                    }
                    radio.click();
                    return true;
                }
            }
            return false;
        });
        
        if (!clicouEntregador) {
            console.log('📞 [TELEFONE] Não encontrou "O entregador não encontra", fechando modal');
            await page.keyboard.press('Escape');
            return '';
        }
        
        console.log('📞 [TELEFONE] ✓ Clicou em "O entregador não encontra o cliente"');
        await sleep(2);
        
        // Salvar screenshot
        try {
            await page.screenshot({ path: '/app/logs/telefone-modal3.png', fullPage: false });
        } catch (e) {}
        
        // ===============================================
        // PASSO 4: Clicar no botão "Confirmar"
        // ===============================================
        console.log('📞 [TELEFONE] Buscando botão "Confirmar"...');
        
        const clicouConfirmar = await page.evaluate(() => {
            const buttons = document.querySelectorAll('hexa-v2-button');
            for (const btn of buttons) {
                let texto = '';
                if (btn.shadowRoot) {
                    const innerBtn = btn.shadowRoot.querySelector('button');
                    texto = innerBtn ? innerBtn.textContent.trim() : '';
                }
                if (!texto) texto = btn.textContent.trim();
                
                console.log('Botão encontrado:', texto);
                
                if (texto.toLowerCase() === 'confirmar') {
                    if (btn.shadowRoot) {
                        const innerBtn = btn.shadowRoot.querySelector('button');
                        if (innerBtn) { innerBtn.click(); return true; }
                    }
                    btn.click();
                    return true;
                }
            }
            return false;
        });
        
        if (!clicouConfirmar) {
            console.log('📞 [TELEFONE] Botão Confirmar não encontrado, fechando modal');
            await page.keyboard.press('Escape');
            return '';
        }
        
        console.log('📞 [TELEFONE] ✓ Clicou em "Confirmar"');
        await sleep(4);
        
        // Salvar screenshot após confirmar
        try {
            await page.screenshot({ path: '/app/logs/telefone-depois.png', fullPage: false });
        } catch (e) {}
        
        // ===============================================
        // PASSO 5: Capturar o telefone que agora deve estar visível
        // ===============================================
        console.log('📞 [TELEFONE] Capturando telefone após modal...');
        
        // O botão #phone-unavailable agora deve mostrar o telefone ao invés de "Ver telefone"
        const telefone = await page.evaluate((sel) => {
            const el = document.querySelector(sel);
            if (!el) return '';
            
            let texto = '';
            if (el.shadowRoot) {
                const btn = el.shadowRoot.querySelector('button, span, a');
                texto = btn ? btn.textContent.trim() : '';
            }
            if (!texto) texto = el.textContent.trim();
            
            // Extrair apenas números
            const nums = texto.replace(/\D/g, '');
            if (nums.length >= 10 && nums.length <= 13) {
                return nums;
            }
            
            return '';
        }, btnSelector);
        
        if (telefone) {
            console.log('📞 [TELEFONE] ✓ Telefone capturado com sucesso:', telefone);
            return telefone;
        }
        
        // Tentar buscar link tel:
        const telLink = await page.$eval('a[href^="tel:"]', el => el.href).catch(() => '');
        if (telLink) {
            const tel = telLink.replace('tel:', '').replace(/\D/g, '');
            if (tel.length >= 10) {
                console.log('📞 [TELEFONE] ✓ Telefone via link tel:', tel);
                return tel;
            }
        }
        
        // Buscar na seção #user-info por padrão de telefone
        const telefoneFromUserInfo = await page.evaluate(() => {
            const userInfo = document.querySelector('#user-info');
            if (!userInfo) return '';
            
            const texto = userInfo.innerText || '';
            // Buscar padrão +55XXXXXXXXXXX ou (XX) XXXXX-XXXX
            const match = texto.match(/\+?55?\s*\(?(\d{2})\)?\s*(\d{4,5})[-\s]?(\d{4})/);
            if (match) {
                return match[0].replace(/\D/g, '');
            }
            return '';
        });
        
        if (telefoneFromUserInfo) {
            console.log('📞 [TELEFONE] ✓ Telefone encontrado em #user-info:', telefoneFromUserInfo);
            return telefoneFromUserInfo;
        }
        
        console.log('📞 [TELEFONE] ✗ Não foi possível capturar o telefone após o fluxo');
        return '';
        
    } catch (error) {
        console.log('📞 [TELEFONE] Erro no fluxo:', error.message);
        try {
            await page.screenshot({ path: '/app/logs/telefone-erro.png', fullPage: false });
        } catch (e) {}
        return '';
    }
}

/**
 * Captura o nome do entregador do card do pedido
 * O nome aparece junto com status "A Caminho" ou "Retirou"
 */
async function capturarEntregador(page) {
    try {
        // Procurar em cards ou alertas o nome do entregador
        // Normalmente aparece como "NomeEntregador a caminho" ou "NomeEntregador retirou"
        
        // Buscar no alerta de status
        const alertas = await page.$$('hexa-v2-alert');
        for (const alerta of alertas) {
            const texto = await page.evaluate(el => {
                if (el.shadowRoot) {
                    const msgEl = el.shadowRoot.querySelector('span.message, .message, span');
                    return msgEl ? msgEl.textContent.trim() : '';
                }
                return el.textContent.trim();
            }, alerta);
            
            // Padrões: "Nome a caminho", "Nome retirou o pedido"
            const matchACaminho = texto.match(/^(.+?)\s+(a caminho|está a caminho)/i);
            const matchRetirou = texto.match(/^(.+?)\s+(retirou|está retirando)/i);
            
            if (matchACaminho) {
                console.log('Entregador encontrado:', matchACaminho[1]);
                return matchACaminho[1].trim();
            }
            if (matchRetirou) {
                console.log('Entregador encontrado:', matchRetirou[1]);
                return matchRetirou[1].trim();
            }
        }

        // Tentar buscar em outros elementos que podem conter info do entregador
        // Procurar por seletores específicos de entregador
        const deliveryInfo = await page.$('#delivery-info, #courier-info, #driver-info, [data-testid*="courier"], [data-testid*="driver"]');
        if (deliveryInfo) {
            const texto = await page.evaluate(el => el.textContent.trim(), deliveryInfo);
            console.log('Info entregador:', texto);
            return texto;
        }

        return '';
    } catch (error) {
        console.log('Erro ao capturar entregador:', error.message);
        return '';
    }
}

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

// Função de login
async function fazerLogin(page) {
    console.log('🔐 [fazerLogin] Iniciando processo de login...');
    await page.goto("https://seu.ze.delivery/login", { waitUntil: 'networkidle2', timeout: 60000 });
    await sleep(3);

    console.log('📧 [fazerLogin] Preenchendo credenciais...');
    await typeInShadowInput(page, 'hexa-v2-input-text[name="email"]', configRobo.login, 100);
    await typeInShadowInput(page, 'hexa-v2-input-text[name="password"]', configRobo.senha, 100);

    await marcarCheckbox(page);

    const shadowHost = await page.$('hexa-v2-button');
    const shadowRoot = await shadowHost.evaluateHandle(el => el.shadowRoot);
    const buttonInsideShadow = await shadowRoot.$('button');
    
    console.log('🖱️ [fazerLogin] Clicando em login...');
    await buttonInsideShadow.click();

    // Aguardar resposta do servidor
    await sleep(10);

    const btnSendEmail = await page.$("#send-email-button");
    if (btnSendEmail) {
        console.log('📧 [fazerLogin] 2FA necessário, solicitando código por email...');
        await page.click("#send-email-button");
        await sleep(8);

        const TIMEOUT_VERIFICACAO = 60000;

        let verificationCode;
        try {
            console.log('📧 [fazerLogin] Aguardando código 2FA do Gmail...');
            verificationCode = await Promise.race([
                pegarDupla(),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error("Timeout ao esperar o código de verificação")), TIMEOUT_VERIFICACAO)
                )
            ]);
        } catch (err) {
            console.error("❌ [fazerLogin] Erro ao obter código de verificação:", err.message);
            throw err;
        }

        if (!verificationCode || verificationCode.length !== 6) {
            console.error("❌ [fazerLogin] Código de verificação inválido ou não recebido.");
            throw new Error("Código 2FA inválido");
        }

        console.log(`✅ [fazerLogin] Código 2FA recebido: ${verificationCode}`);

        for (let index = 0; index < verificationCode.length; index++) {
            const inputSelector = `#verification-code-input-${index}`;
            await page.type(inputSelector, verificationCode[index], { delay: 250 });
        }

        await page.waitForTimeout(1500);
        await page.waitForSelector("#send-code-verification", { visible: true });
        await page.click("#send-code-verification");

        try {
            console.log('⏳ [fazerLogin] Aguardando navegação após 2FA...');
            await page.waitForNavigation({ timeout: 30000, waitUntil: 'networkidle2' });
        } catch (e) {
            console.error("❌ [fazerLogin] Falha ao navegar após envio do código.");
            throw e;
        }

        await sleep(5);
    } else {
        console.log("⏳ [fazerLogin] Verificando se login foi bem sucedido...");
        
        await sleep(5);
        
        const currentUrl = page.url();
        console.log(`📍 [fazerLogin] URL atual: ${currentUrl}`);
        
        if (currentUrl.includes('login')) {
            console.log('⚠️ [fazerLogin] Ainda na página de login, verificando novamente...');
            
            await sleep(10);
            
            const newUrl = page.url();
            if (newUrl.includes('login')) {
                const late2FA = await page.$("#send-email-button");
                if (late2FA) {
                    console.log('📧 [fazerLogin] Botão 2FA apareceu, reiniciando login...');
                    throw new Error("2FA necessário - reiniciando");
                }
                
                console.error('❌ [fazerLogin] Login falhou');
                throw new Error("Login falhou");
            }
        }
        
        console.log("✅ [fazerLogin] Login concluído sem necessidade de 2FA!");
    }
    
    const finalUrl = page.url();
    console.log(`📍 [fazerLogin] URL final: ${finalUrl}`);
    
    if (finalUrl.includes('login')) {
        throw new Error("Login não completou - ainda na página de login");
    }
    
    console.log('✅ [fazerLogin] Login verificado com sucesso!');
}

// Funções principais de cada script. Você pode expandir conforme queira mais detalhes de cada um.
async function pedidoScript(page) {
    await page.goto("https://seu.ze.delivery/history", {
        waitUntil: "networkidle2",
    });

    while (true) {
        try {
            // 🔹 Aguarda até 10 segundos pelo seletor da tabela
            const ready = await waitForSafe(page, "#order-history-table-body", 10000);
            if (!ready) {
                console.log("❌ Timeout esperando a tabela, recarregando...");
                await page.reload({ waitUntil: "networkidle2" });
                continue;
            }

            const tableData = await page.evaluate(() => {
                const rows = document.querySelectorAll(
                    "#order-history-table-body > hexa-v2-custom-table-row"
                );
                const data = [];

                rows.forEach((row) => {
                    const orderNumber = row
                        .querySelector('[id^="order-number"]')
                        ?.innerText.trim();
                    /*const orderDateTime = row
                        .querySelector(".css-1qohcwk span")
                        ?.innerText.trim();*/
                    const dateRegex = /\d{2}\/\d{2}\/\d{4} - \d{2}:\d{2}/;

                    const orderDateTime = (() => {
                        const spans = row.querySelectorAll("span");
                        for (const span of spans) {
                            const text = span.innerText.trim();
                            if (dateRegex.test(text)) {
                                return text.match(dateRegex)[0]; // retorna apenas a parte da data
                            }
                        }
                        return null; // se não encontrar
                    })();
                    const customerName = row
                        .querySelector('[id^="customer-name"]')
                        ?.innerText.trim();
                    //const status = row.querySelector('[id^="status"]')?.innerText.trim();
                    const status = 'Aceito';
                    const deliveryType = row
                        .querySelector('[id^="delivery-type"]')
                        ?.innerText.trim();
                    const paymentType = row
                        .querySelector('[id^="payment-type"]')
                        ?.innerText.trim();
                    const totalPrice = row
                        .querySelector('[id^="total-price"]')
                        ?.innerText.trim();
                    const priceFormatted = totalPrice
                        ? totalPrice.replace("R$", "").trim().replace(",", ".")
                        : "";

                    data.push({
                        orderNumber,
                        orderDateTime,
                        customerName,
                        status,
                        deliveryType,
                        paymentType,
                        priceFormatted,
                    });
                });

                return data;
            });

            // 🔹 Se não encontrar pedidos, recarrega a página
            if (tableData.length === 0) {
                console.log("⚠️ Nenhum pedido encontrado. Atualizando a página...");
                await page.reload({ waitUntil: "networkidle2" });
                await sleep(5);
                continue;
            }

            console.log(tableData);
            const startTime = performance.now();

            for (const order of tableData.slice(0, 5)) {
                console.log(order);
                await insert_pedido(order);
                await sleep(1);
            }

            const endTime = performance.now();
            console.log(`Tempo de execução: ${(endTime - startTime).toFixed(2)} ms`);

            await sleep(2);
            await page.goto("https://seu.ze.delivery/history", {
                waitUntil: "networkidle2",
            });
            await sleep(5);
        } catch (error) {
            console.log(error);
            // 🔴 Se o seletor não for encontrado, recarrega a página e tenta de novo
            console.log(
                "❌ Erro ao encontrar a tabela de pedidos. Recarregando a página..."
            );
            await page.reload({ waitUntil: "networkidle2" });
            await sleep(5);
            continue;
        }
    }
}
async function itensScript(page) {
    await page.goto("https://seu.ze.delivery/home", {
        waitUntil: "networkidle2",
    });
    while (true) {
        let id_pedido_info = await pegar_id_pedido();

        if (id_pedido_info == 0) {
            console.log("SEM PEDIDOS DISPONIVEIS");
        } else {
            try {
                /**ABRIR TODOS OS PEDIDOS */
                await page.goto(
                    "https://seu.ze.delivery/order/" + encodeURIComponent(id_pedido_info)
                );

                console.log("PEDIDO ENCONTRADO: " + encodeURIComponent(id_pedido_info));

                // Aguardar carregamento da página - múltiplas estratégias
                await sleep(3);
                
                // Tentar aguardar produtos - mas não falhar se não existirem
                let temProdutos = false;
                try {
                    await page.waitForSelector('[data-testid="product"]', { timeout: 8000 });
                    temProdutos = true;
                } catch (e) {
                    console.log('⚠️ Produtos não encontrados via data-testid, tentando alternativas...');
                }

                // =====================================================
                // CAPTURA DO TIPO DE DELIVERY (COMUM, TURBO, RETIRADA)
                // =====================================================
                console.log('🚚 [DELIVERY] Capturando tipo de delivery...');
                
                let tipoDelivery = await page.evaluate(() => {
                    // Estratégia 1: Procurar no elemento #delivery-type
                    const deliveryTypeEl = document.querySelector('#delivery-type');
                    if (deliveryTypeEl) {
                        // Tentar shadow DOM
                        if (deliveryTypeEl.shadowRoot) {
                            const span = deliveryTypeEl.shadowRoot.querySelector('span');
                            if (span && span.textContent.trim()) {
                                return span.textContent.trim();
                            }
                        }
                        if (deliveryTypeEl.textContent.trim()) {
                            return deliveryTypeEl.textContent.trim();
                        }
                    }
                    
                    // Estratégia 2: Procurar por badges ou labels de tipo
                    const badges = document.querySelectorAll('hexa-v2-badge, hexa-v2-badge-status, [class*="badge"]');
                    for (const badge of badges) {
                        let texto = '';
                        if (badge.shadowRoot) {
                            const span = badge.shadowRoot.querySelector('span');
                            texto = span ? span.textContent.trim() : '';
                        }
                        if (!texto) texto = badge.textContent.trim();
                        
                        const textoLower = texto.toLowerCase();
                        if (textoLower.includes('turbo')) return 'Pedido Turbo';
                        if (textoLower.includes('retirada') || textoLower.includes('pickup')) return 'Pedido Retirada';
                        if (textoLower.includes('comum') || textoLower.includes('delivery') || textoLower.includes('entrega')) return 'Pedido Comum';
                    }
                    
                    // Estratégia 3: Procurar em hexa-v2-text por padrões
                    const textos = document.querySelectorAll('hexa-v2-text');
                    for (const el of textos) {
                        let texto = '';
                        if (el.shadowRoot) {
                            const span = el.shadowRoot.querySelector('span');
                            texto = span ? span.textContent.trim() : '';
                        }
                        if (!texto) texto = el.textContent.trim();
                        
                        const textoLower = texto.toLowerCase();
                        if (textoLower === 'turbo' || textoLower === 'pedido turbo') return 'Pedido Turbo';
                        if (textoLower === 'retirada' || textoLower === 'pedido retirada' || textoLower === 'pickup') return 'Pedido Retirada';
                        if (textoLower === 'comum' || textoLower === 'pedido comum') return 'Pedido Comum';
                    }
                    
                    // Estratégia 4: Procurar na seção de informações do pedido
                    const orderInfo = document.querySelector('#order-info, .order-info, [class*="order-info"]');
                    if (orderInfo) {
                        const texto = orderInfo.innerText.toLowerCase();
                        if (texto.includes('turbo')) return 'Pedido Turbo';
                        if (texto.includes('retirada') || texto.includes('pickup')) return 'Pedido Retirada';
                    }
                    
                    // Estratégia 5: Verificar se tem código de entrega (indica delivery, não retirada)
                    const codigoEntrega = document.querySelector('#delivery-code, [id*="delivery-code"]');
                    if (codigoEntrega) {
                        const texto = codigoEntrega.textContent.trim();
                        // Se tem código de entrega no formato "XXX XXX XXX X", provavelmente é delivery
                        if (/[A-Z0-9]{3}\s[A-Z0-9]{3}\s[A-Z0-9]{3}\s[A-Z0-9]/.test(texto)) {
                            return 'Pedido Comum';
                        }
                    }
                    
                    // Estratégia 6: Verificar endereço (se não tem endereço, pode ser retirada)
                    const enderecoEl = document.querySelector('#route, #address, #main-street');
                    if (enderecoEl) {
                        const endereco = enderecoEl.textContent.trim();
                        if (!endereco || endereco === '-' || endereco.length < 5) {
                            return 'Pedido Retirada';
                        }
                    }
                    
                    return ''; // Não conseguiu determinar
                });
                
                console.log('🚚 [DELIVERY] Tipo detectado:', tipoDelivery || '(não detectado)');

                // =====================================================
                // CAPTURA DOS PRODUTOS/ITENS
                // =====================================================
                let produtos = [];
                
                if (temProdutos) {
                    produtos = await page.$$eval('[data-testid="product"]', (produtos) => {
                        return produtos.map(produto => {
                            const nomeEl = produto.querySelector('[id^="info-title"]');
                            const quantComp = produto.querySelector('[id^="info-quantity"]');
                            const precoEl = produto.querySelector('[id^="info-cost"]');
                            const imagemEl = produto.querySelector('img');

                            const idMatch = nomeEl?.id?.match(/info-title-(\d+)/);
                            const idProduto = idMatch ? idMatch[1] : '';

                            const nomeSpan = nomeEl?.shadowRoot?.querySelector('span');
                            const precoSpan = precoEl?.shadowRoot?.querySelector('span');

                            let quantSpan = quantComp?.querySelector('hexa-v2-text')?.shadowRoot?.querySelector('span');
                            const quantidadeTexto = quantSpan?.textContent.trim() || '';
                            const quantidade = quantidadeTexto.replace(/^Qtd:\s*/, '');

                            return {
                                id: idProduto,
                                nome: nomeSpan?.textContent.trim() || '',
                                quantidade: quantidade,
                                preco: precoSpan?.textContent.replace('R$', '').replace('.', '').replace(',', '.').trim() || '',
                                imagem: imagemEl?.src || ''
                            };
                        });
                    });
                }
                
                // Se não encontrou produtos via data-testid, tentar outras estratégias
                if (produtos.length === 0) {
                    console.log('📦 [ITENS] Tentando capturar itens via estratégia alternativa...');
                    
                    produtos = await page.evaluate(() => {
                        const items = [];
                        
                        // Estratégia: Procurar containers de produto genéricos
                        const productContainers = document.querySelectorAll('[class*="product"], [class*="item"], [id*="product"], [id*="item"]');
                        
                        for (const container of productContainers) {
                            // Procurar nome do produto
                            const nomeEl = container.querySelector('[class*="title"], [class*="name"], h3, h4, span');
                            const nome = nomeEl ? nomeEl.textContent.trim() : '';
                            
                            // Procurar quantidade
                            const qtdEl = container.querySelector('[class*="quantity"], [class*="qtd"]');
                            const quantidade = qtdEl ? qtdEl.textContent.replace(/\D/g, '') || '1' : '1';
                            
                            // Procurar preço
                            const precoEl = container.querySelector('[class*="price"], [class*="preco"]');
                            const preco = precoEl ? precoEl.textContent.replace(/[^\d,\.]/g, '').replace(',', '.') : '';
                            
                            // Procurar imagem
                            const imgEl = container.querySelector('img');
                            const imagem = imgEl ? imgEl.src : '';
                            
                            if (nome && nome.length > 2) {
                                items.push({ id: '', nome, quantidade, preco, imagem });
                            }
                        }
                        
                        return items;
                    });
                }
                
                console.log(`📦 [ITENS] ${produtos.length} produto(s) capturado(s)`);

                // DEBUG: Salvar HTML da página para análise
                const pageHTML = await page.content();
                const fs = require('fs');
                fs.writeFileSync('/app/logs/page-debug.html', pageHTML);
                console.log('HTML salvo em /app/logs/page-debug.html');

                // CPF - tentar múltiplos seletores
                let cpfCliente = await getTextFromShadowOrNormal(page, "#customer-document", "p[data-testid='hexa-v2-text']");
                cpfCliente = cpfCliente.replace(/\./g, "").replace(/-/g, "").trim();

                // Endereço - tentar seletores da página principal E da área de impressão
                let enderecoRota = await getTextFromShadowOrNormal(page, "#route");
                if (!enderecoRota || enderecoRota === "-" || enderecoRota.length < 3) {
                    // Tentar pegar da seção de impressão
                    enderecoRota = await page.$eval('#main-street', el => el.textContent.trim()).catch(() => '');
                }
                enderecoRota = enderecoRota.replace(/-+/g, " ").replace(/\s+/g, " ").trim();

                let enderecoComplemento = await getTextFromShadowOrNormal(page, "#address-plus");
                enderecoComplemento = enderecoComplemento.replace(/-+/g, "").trim();

                let enderecoCidadeUF = await getTextFromShadowOrNormal(page, "#address-city-province");
                enderecoCidadeUF = enderecoCidadeUF.replace(/-+/g, "").trim();

                let enderecoCep = await getTextFromShadowOrNormal(page, "#address-zip-code");
                enderecoCep = enderecoCep.replace(/-+/g, "").trim();

                // Bairro - tentar múltiplos seletores
                let enderecoBairro = await getTextFromShadowOrNormal(page, "#address-neighborhood");
                if (!enderecoBairro || enderecoBairro === "-" || enderecoBairro.length < 2) {
                    // Tentar pegar da seção de impressão
                    enderecoBairro = await page.$eval('#neighborhood-info', el => el.textContent.trim()).catch(() => '');
                }
                enderecoBairro = enderecoBairro.replace(/-+/g, "").trim();

                let desconto = await getTextFromShadowOrNormal(page, "#total-discount");
                desconto = desconto.replace("R$", "").replace(",", ".").trim();

                let frete = await getTextFromShadowOrNormal(page, "#freight");
                frete = frete.replace("R$", "").replace(",", ".").trim();

                // =====================================================
                // CAPTURA DE TELEFONE DO CLIENTE
                // O telefone só aparece após seguir o fluxo do modal
                // =====================================================
                console.log('📞 [TELEFONE] Iniciando captura de telefone...');
                
                let customerPhone = '';
                
                // Primeiro, verificar se o telefone já está visível (raro, mas possível)
                customerPhone = await page.evaluate(() => {
                    // Verificar se existe um link tel: (indicaria telefone já revelado)
                    const telLink = document.querySelector('a[href^="tel:"]');
                    if (telLink) {
                        return telLink.href.replace('tel:', '').replace(/\D/g, '');
                    }
                    
                    // Verificar na seção #user-info se há um número de telefone
                    const userInfo = document.querySelector('#user-info');
                    if (userInfo) {
                        const text = userInfo.innerText || '';
                        const phoneMatch = text.match(/\+55\d{10,11}|\(\d{2}\)\s*\d{4,5}[-\s]?\d{4}/);
                        if (phoneMatch) {
                            return phoneMatch[0].replace(/\D/g, '');
                        }
                    }
                    
                    // Verificar se #phone-unavailable já mostra um telefone
                    const phoneBtn = document.querySelector('#phone-unavailable');
                    if (phoneBtn) {
                        let texto = '';
                        if (phoneBtn.shadowRoot) {
                            const btn = phoneBtn.shadowRoot.querySelector('button, span');
                            texto = btn ? btn.textContent.trim() : '';
                        } else {
                            texto = phoneBtn.textContent.trim();
                        }
                        
                        const nums = texto.replace(/\D/g, '');
                        if (nums.length >= 10 && nums.length <= 13) {
                            return nums;
                        }
                    }
                    
                    return '';
                });
                
                // Se não encontrou telefone visível, usar o fluxo do modal
                if (!customerPhone || customerPhone.length < 10) {
                    console.log('📞 [TELEFONE] Telefone não visível, executando fluxo do modal...');
                    customerPhone = await capturarTelefoneViaFluxo(page);
                } else {
                    console.log('📞 [TELEFONE] Telefone já visível:', customerPhone);
                }
                
                customerPhone = customerPhone.replace(/\D/g, "").trim(); // Só números
                
                // Remover o 55 se começar com ele e tiver mais de 11 dígitos
                if (customerPhone.startsWith('55') && customerPhone.length > 11) {
                    customerPhone = customerPhone.substring(2);
                }
                
                console.log(`📞 Telefone capturado: ${customerPhone || '(vazio)'}`);

                // Capturar nome do entregador
                let entregador = await capturarEntregador(page);
                console.log('Entregador:', entregador || '(não encontrado)');

                let troco = await getTextFromShadowOrNormal(page, "#change-value");
                troco = troco.replace("R$", "").replace(",", ".").trim();

                let trocoCliente = await getTextFromShadowOrNormal(page, "#change-value-to-client");
                trocoCliente = trocoCliente.replace("R$", "").replace(",", ".").trim();

                let taxaConveniencia = await getTextFromShadowOrNormal(page, "#serviceFee");
                taxaConveniencia = taxaConveniencia.replace("R$", "").replace(",", ".").trim();

                let subTotal = await getTextFromShadowOrNormal(page, "#subtotal");
                subTotal = subTotal.replace("R$", "").replace(",", ".").trim();

                //let codigoEntrega = await getTextFromShadowOrNormal(page, '[data-testid="accept-order-actions-container"] p');
                const elements = await page.$$('hexa-v2-text');

                let codigoEntrega = null;

                for (const el of elements) {
                    const shadowRoot = await el.getProperty('shadowRoot');

                    if (shadowRoot) {
                        const spanHandle = await shadowRoot.$('span[data-testid="hexa-v2-text"]');
                        if (spanHandle) {
                            const text = await spanHandle.evaluate(e => e.textContent.trim());

                            // Ignora número do pedido
                            if (text.startsWith("Pedido")) continue;

                            // Se o texto tiver o formato de código de coleta, salva
                            if (/^[A-Z0-9]{3}\s[A-Z0-9]{3}\s[A-Z0-9]{3}\s[A-Z0-9]$/.test(text)) {
                                codigoEntrega = text;
                                break;
                            }
                        }
                    }
                }

                let obsPedido = await getTextFromShadowOrNormal(page, "#observation");

                const alertaHandle = await page.$('hexa-v2-alert.hydrated');
                let statusPedido = "";

                if (alertaHandle) {
                    // Dentro do elemento, pega o shadow root
                    const shadowRootHandle = await alertaHandle.evaluateHandle(el => el.shadowRoot);

                    if (shadowRootHandle) {
                        // Agora dentro do shadow root, seleciona o span.message
                        const spanHandle = await shadowRootHandle.asElement().$('span.message');

                        if (spanHandle) {
                            statusPedido = await page.evaluate(el => el.textContent.trim(), spanHandle);
                            // Fecha handles para evitar leaks
                            await spanHandle.dispose();
                        }

                        await shadowRootHandle.dispose();
                    }

                    await alertaHandle.dispose();
                }

                const agora = new Date();
                const dataHora = agora.toLocaleString("pt-BR"); 

                console.log(`[${dataHora}] DATA RESGATADA`);

                var myHeaders = new Headers();
                myHeaders.append("Cookie", "PHPSESSID=cf8beildg23vcb3rgi97ase11o");

                const pedidosData = produtos.map(pedido => ({
                    id: encodeURIComponent(id_pedido_info),
                    tags: pedido,
                    desconto: desconto,
                    frete: frete,
                    subTotal: subTotal,
                    cpfCliente: cpfCliente,
                    customerPhone: customerPhone,
                    telefoneCliente: customerPhone,
                    enderecoRota: enderecoRota,
                    enderecoComplemento: enderecoComplemento,
                    enderecoCidadeUF: enderecoCidadeUF,
                    enderecoCep: enderecoCep,
                    enderecoBairro: enderecoBairro,
                    troco: troco,
                    trocoCliente: trocoCliente,
                    taxaConveniencia: taxaConveniencia,
                    codigoEntrega: codigoEntrega,
                    obsPedido: obsPedido,
                    statusPedido: statusPedido,
                    entregador: entregador
                }));
                console.log(JSON.stringify(pedidosData));
                try {
                    // Enviar pedidos como array completo para o PHP
                    const result = await view_pedido(pedidosData);
                    console.log("Resposta do PHP:", result);
                } catch (error) {
                    console.error("Erro ao enviar pedidos:", error);
                }
            } catch (error) {
                console.error("Erro ao processar pedido:", error);

                // Redirecionar para uma tela genérica ou inicial
                await page.goto("https://seu.ze.delivery/home", {
                    waitUntil: "networkidle2",
                });
            }
        }

        //await sleep(2);
    }
}

async function statusScript(page) {
    await page.setViewport({ width: 1280, height: 800 });
    await page.setJavaScriptEnabled(true);
    await page.goto("https://seu.ze.delivery/home", {
        waitUntil: "networkidle2",
    });
    while (true) {
        let id_pedido_info = await pegar_id_pedido_status();

        if (id_pedido_info == 0) {
            console.log("SEM PEDIDOS DISPONIVEIS STATUS");
        } else {
            try {
                /**ABRIR TODOS OS PEDIDOS */
                await page.goto(
                    "https://seu.ze.delivery/order/" + encodeURIComponent(id_pedido_info)
                );

                console.log("PEDIDO ENCONTRADO: " + encodeURIComponent(id_pedido_info));

                await sleep(3);
                await page.waitForSelector('[data-testid="product"]', { timeout: 15000 });
                await sleep(2);

                const produtos = await page.$$eval('[data-testid="product"]', (produtos) => {
                    return produtos.map(produto => {
                        const nomeEl = produto.querySelector('[id^="info-title"]');
                        const quantComp = produto.querySelector('[id^="info-quantity"]');
                        const precoEl = produto.querySelector('[id^="info-cost"]');
                        const imagemEl = produto.querySelector('img');

                        // Extrai ID do produto do ID do elemento
                        const idMatch = nomeEl?.id?.match(/info-title-(\d+)/);
                        const idProduto = idMatch ? idMatch[1] : '';

                        const nomeSpan = nomeEl?.shadowRoot?.querySelector('span');
                        const precoSpan = precoEl?.shadowRoot?.querySelector('span');

                        let quantSpan = quantComp?.querySelector('hexa-v2-text')?.shadowRoot?.querySelector('span');
                        const quantidadeTexto = quantSpan?.textContent.trim() || '';
                        const quantidade = quantidadeTexto.replace(/^Qtd:\s*/, '');


                        return {
                            id: idProduto,
                            nome: nomeSpan?.textContent.trim() || '',
                            quantidade: quantidade,
                            preco: precoSpan?.textContent.replace('R$', '').replace('.', '').replace(',', '.').trim() || '',
                            imagem: imagemEl?.src || ''
                        };
                    });
                });

                console.log(produtos);

                let cpfCliente = await getTextFromShadowOrNormal(page, "#customer-document", "p[data-testid='hexa-v2-text']");
                cpfCliente = cpfCliente.replace(/\./g, "").replace(/-/g, "").trim();

                let enderecoRota = await getTextFromShadowOrNormal(page, "#route");
                enderecoRota = enderecoRota.replace(/-+/g, "").trim();

                let enderecoComplemento = await getTextFromShadowOrNormal(page, "#address-plus");
                enderecoComplemento = enderecoComplemento.replace(/-+/g, "").trim();

                let enderecoCidadeUF = await getTextFromShadowOrNormal(page, "#address-city-province");
                enderecoCidadeUF = enderecoCidadeUF.replace(/-+/g, "").trim();

                let enderecoCep = await getTextFromShadowOrNormal(page, "#address-zip-code");
                enderecoCep = enderecoCep.replace(/-+/g, "").trim();

                let enderecoBairro = await getTextFromShadowOrNormal(page, "#address-neighborhood");
                enderecoBairro = enderecoBairro.replace(/-+/g, "").trim();

                let desconto = await getTextFromShadowOrNormal(page, "#total-discount");
                desconto = desconto.replace("R$", "").replace(",", ".").trim();

                let frete = await getTextFromShadowOrNormal(page, "#freight");
                frete = frete.replace("R$", "").replace(",", ".").trim();


                // Capturar telefone do cliente
                let customerPhone = await getTextFromShadowOrNormal(page, "#customer-phone");
                if (!customerPhone) {
                    customerPhone = await getTextFromShadowOrNormal(page, '[data-testid="customer-phone"]');
                }
                customerPhone = customerPhone.replace(/\D/g, "").trim(); // Só números
                let troco = await getTextFromShadowOrNormal(page, "#change-value");
                troco = troco.replace("R$", "").replace(",", ".").trim();

                let trocoCliente = await getTextFromShadowOrNormal(page, "#change-value-to-client");
                trocoCliente = trocoCliente.replace("R$", "").replace(",", ".").trim();

                let taxaConveniencia = await getTextFromShadowOrNormal(page, "#serviceFee");
                taxaConveniencia = taxaConveniencia.replace("R$", "").replace(",", ".").trim();

                let subTotal = await getTextFromShadowOrNormal(page, "#subtotal");
                //subTotal = subTotal.replace("R$", "").replace(",", ".").trim();
                subTotal = subTotal.replace(/R\$/g, "")
                  .replace(/\./g, "")
                  .replace(",", ".")
                  .trim();

                let codigoEntrega = await getTextFromShadowOrNormal(page, '[data-testid="accept-order-actions-container"] p');

                let obsPedido = await getTextFromShadowOrNormal(page, "#observation");

                const alertaHandle = await page.$('hexa-v2-alert.hydrated');
                let statusPedido = "";

                if (alertaHandle) {
                    // Dentro do elemento, pega o shadow root
                    const shadowRootHandle = await alertaHandle.evaluateHandle(el => el.shadowRoot);

                    if (shadowRootHandle) {
                        // Agora dentro do shadow root, seleciona o span.message
                        const spanHandle = await shadowRootHandle.asElement().$('span.message');

                        if (spanHandle) {
                            statusPedido = await page.evaluate(el => el.textContent.trim(), spanHandle);
                            // Fecha handles para evitar leaks
                            await spanHandle.dispose();
                        }

                        await shadowRootHandle.dispose();
                    }

                    await alertaHandle.dispose();
                }

                console.log(cpfCliente);
                console.log(enderecoRota);
                console.log(enderecoComplemento);
                console.log(enderecoCidadeUF);
                console.log(enderecoCep);
                console.log(enderecoBairro);
                console.log(desconto);
                console.log(frete);
                console.log(troco);
                console.log(trocoCliente);
                console.log(taxaConveniencia);
                console.log(subTotal);
                console.log(codigoEntrega);
                console.log(obsPedido);
                console.log(statusPedido);



                const pedidosData = produtos.map(pedido => ({
                    id: encodeURIComponent(id_pedido_info),
                    tags: pedido,
                    statusPedido: statusPedido
                }));
                console.log(JSON.stringify(pedidosData));
                try {
                    const response = await fetch(configRobo.url_view_status, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify(pedidosData)
                    });

                    if (!response.ok) {
                        throw new Error(`Erro na requisição: ${response.statusText}`);
                    }

                    const resultado = await response.json();
                    console.log("Resposta da API:", resultado);
                } catch (error) {
                    console.error("Erro ao enviar pedidos:", error);
                }
            } catch (error) {
                console.error("Erro ao processar pedido:", error);

                // Redirecionar para uma tela genérica ou inicial
                await page.goto("https://seu.ze.delivery/home", {
                    waitUntil: "networkidle2",
                });
            }
        }

        await sleep(2);
    }
}
async function aceitaScript(browser, cookies) {
    while (true) {
        let page = null;
        try {
            page = await browser.newPage();
            await page.setCookie(...cookies);
            console.log('[ACEITA] Nova aba aberta para aceitar pedidos.');

            await page.goto("https://seu.ze.delivery/poc-orders", {
                waitUntil: "networkidle2",
            });

            for (let i = 0; i < 500; i++) {
                try {
                    const closeButton = await page.$('#close-alert-modal');
                    if (closeButton) {
                        await closeButton.click();
                    }

                    await page.waitForSelector('#accept-button', { visible: true, timeout: 100000 });

                    const button = await page.$('#accept-button');
                    if (button) {
                        const isDisabled = await page.evaluate(el => el.disabled, button);

                        if (!isDisabled) {
                            await button.click();
                            console.log('Botão clicado!');

                            const aceitarPedidoButton = await page.$('#orders-details-modal-button-accept');
                            if (aceitarPedidoButton) {
                                await aceitarPedidoButton.click();
                                console.log('Pedido Aceito!');
                                await sleep(10);
                            }

                            await page.goto("https://seu.ze.delivery/poc-orders", {
                                waitUntil: "networkidle2",
                            });
                        }
                    }
                } catch (err) {
                    console.error("Erro dentro do loop de aceite:", err.message);
                    try { await page.reload({ waitUntil: "networkidle2" }); } catch (e) { }
                }
            }

        } catch (error) {
            console.error("[ACEITA] Erro crítico, fechando/reabrindo aba:", error.message);
        } finally {
            if (page) {
                try { await page.close(); } catch (e) { }
                console.log("[ACEITA] Aba fechada, será reaberta...");
            }
        }
    }
}

async function waitForSafe(page, selector, timeout = 30000) {
    try {
        await page.waitForFunction(
            (sel) => document.querySelector(sel) !== null,
            { timeout },
            selector
        );
        return true;
    } catch {
        return false;
    }
}


async function serverScript(page) {
    await page.goto("https://seu.ze.delivery/history", {
        waitUntil: "networkidle2",
    });

    while (true) {
        try {
            // 🔹 Aguarda até 10 segundos pelo seletor da tabela
            const ready = await waitForSafe(page, "#order-history-table-body", 10000);
            if (!ready) {
                console.log("❌ Timeout esperando a tabela, recarregando...");
                await page.reload({ waitUntil: "networkidle2" });
                continue;
            }

            const tableData = await page.evaluate(() => {
                const rows = document.querySelectorAll(
                    "#order-history-table-body > hexa-v2-custom-table-row"
                );
                const data = [];

                rows.forEach((row) => {
                    const orderNumber = row
                        .querySelector('[id^="order-number"]')
                        ?.innerText.trim();
                    /*const orderDateTime = row
                        .querySelector(".css-1qohcwk span")
                        ?.innerText.trim();*/
                    const dateRegex = /\d{2}\/\d{2}\/\d{4} - \d{2}:\d{2}/;

                    const orderDateTime = (() => {
                        const spans = row.querySelectorAll("span");
                        for (const span of spans) {
                            const text = span.innerText.trim();
                            if (dateRegex.test(text)) {
                                return text.match(dateRegex)[0]; // retorna apenas a parte da data
                            }
                        }
                        return null; // se não encontrar
                    })();
                    const customerName = row
                        .querySelector('[id^="customer-name"]')
                        ?.innerText.trim();
                    //const status = row.querySelector('[id^="status"]')?.innerText.trim();
                    const status = 'Aceito';
                    const deliveryType = row
                        .querySelector('[id^="delivery-type"]')
                        ?.innerText.trim();
                    const paymentType = row
                        .querySelector('[id^="payment-type"]')
                        ?.innerText.trim();
                    const totalPrice = row
                        .querySelector('[id^="total-price"]')
                        ?.innerText.trim();
                    const priceFormatted = totalPrice
                        ? totalPrice.replace("R$", "").trim().replace(",", ".")
                        : "";

                    data.push({
                        orderNumber,
                        orderDateTime,
                        customerName,
                        status,
                        deliveryType,
                        paymentType,
                        priceFormatted,
                    });
                });

                return data;
            });

            // 🔹 Se não encontrar pedidos, recarrega a página
            if (tableData.length === 0) {
                console.log("⚠️ Nenhum pedido encontrado. Atualizando a página...");
                await page.reload({ waitUntil: "networkidle2" });
                await sleep(5);
                continue;
            }

            console.log(tableData);
            const startTime = performance.now();

            for (const order of tableData) {
                console.log(order);
                await insert_pedido(order);
                await sleep(1);
            }

            const endTime = performance.now();
            console.log(`Tempo de execução: ${(endTime - startTime).toFixed(2)} ms`);

            await sleep(2);
            await page.goto("https://seu.ze.delivery/history", {
                waitUntil: "networkidle2",
            });
            await sleep(5);
        } catch (error) {
            console.log(error);
            // 🔴 Se o seletor não for encontrado, recarrega a página e tenta de novo
            console.log(
                "❌ Erro ao encontrar a tabela de pedidos. Recarregando a página..."
            );
            await page.reload({ waitUntil: "networkidle2" });
            await sleep(5);
            continue;
        }
    }
}

async function criarJanelaItens(cookies) {
    console.log('🔄 Iniciando janela ITENS...');

    const browser = await puppeteer.launch({
        headless: false,
        args: [
            '--window-size=1000,700',
            '--window-position=0,0',
            '--disable-background-timer-throttling',
            '--disable-renderer-backgrounding'
        ]
    });

    const page = await browser.newPage();
    await page.setCookie(...cookies);
    await page.setViewport({ width: 1000, height: 700 });

    return { browser, page };
}

async function criarJanelaStatus(cookies) {
    console.log('🔄 Iniciando janela STATUS...');

    const browser = await puppeteer.launch({
        headless: false,
        args: [
            '--window-size=1000,700',
            '--window-position=1000,0',
            '--disable-background-timer-throttling',
            '--disable-renderer-backgrounding'
        ]
    });

    const page = await browser.newPage();
    await page.setCookie(...cookies);
    await page.setViewport({ width: 1000, height: 700 });

    return { browser, page };
}

(async () => {
    console.log('🚀 [v1-itens] Iniciando script de itens...');
    const isProduction = process.env.NODE_ENV === 'production';
    const PROFILE_NAME = sessionManager.PROFILE_NAME_V1_ITENS;
    
    console.log(`📍 [v1-itens] Ambiente: ${isProduction ? 'PRODUÇÃO' : 'DESENVOLVIMENTO'}`);
    
    // Inicializar tabela de sessão no banco
    console.log('🔧 [v1-itens] Inicializando sistema de sessão...');
    await sessionManager.initSessionTable();
    
    // Em produção (Railway), usar Chromium do sistema
    const executablePath = isProduction ? '/usr/bin/chromium' : undefined;
    if (executablePath) {
        console.log(`📍 [v1-itens] Usando Chromium: ${executablePath}`);
    }
    
    const browser = await puppeteer.launch({ 
        headless: 'new', 
        executablePath: executablePath,
        userDataDir: './' + PROFILE_NAME, 
        args: [
            '--start-maximized',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
            '--disable-software-rasterizer',
        ] 
    });
    console.log('✅ [v1-itens] Browser iniciado');
    
    const page1 = await browser.newPage();
    const { width, height } = await page1.evaluate(() => {
        return {
            width: window.screen.availWidth || 1920,
            height: window.screen.availHeight || 1080
        };
    });
    
    // Em produção, rodar indefinidamente. Em dev, timeout de ~20 minutos.
    if (!isProduction) {
        setTimeout(async () => {
            console.log('⏰ [DEV] Fechando aplicação após 20 minutos...');
            await browser.close();
            process.exit(0);
        }, 1250000);
    } else {
        console.log('🏭 [PRODUÇÃO] Script de itens rodando indefinidamente...');
    }
    
    await page1.setViewport({ width, height });
    
    // ESTRATÉGIA DE SESSÃO:
    // 1. Tentar restaurar sessão do banco de dados
    // 2. Se falhar, tentar usar perfil local do Chromium
    // 3. Se ainda falhar, fazer login com 2FA
    
    console.log('🔄 [v1-itens] Tentando restaurar sessão do banco...');
    let sessionRestored = await sessionManager.restoreSession(page1, PROFILE_NAME);
    
    if (!sessionRestored) {
        console.log('🌐 [v1-itens] Sessão não restaurada do banco, verificando perfil local...');
        await page1.goto("https://seu.ze.delivery/home", { waitUntil: 'networkidle2', timeout: 60000 });
        console.log('📍 [v1-itens] URL atual:', page1.url());

        if (page1.url().includes("login")) {
            console.log("🔑 [v1-itens] Sessão expirada, fazendo login novamente...");
            try {
                await fazerLogin(page1);
                console.log("✅ [v1-itens] Login concluído!");
                
                // Salvar nova sessão no banco
                console.log('💾 [v1-itens] Salvando nova sessão no banco...');
                await sessionManager.saveSession(page1, PROFILE_NAME);
            } catch (loginError) {
                console.error("❌ [v1-itens] Erro no login:", loginError.message);
                console.log("🔄 [v1-itens] Reiniciando em 30s...");
                await sleep(30);
                process.exit(1);
            }
        } else {
            console.log('✅ [v1-itens] Sessão ativa via perfil local');
            // Salvar sessão válida no banco para próximas vezes
            await sessionManager.saveSession(page1, PROFILE_NAME);
        }
    }

    // PEGA COOKIES DE AUTENTICAÇÃO
    const cookies = await page1.cookies();
    console.log(`🍪 [v1-itens] ${cookies.length} cookies capturados`);

    // ABRE AS OUTRAS ABAS E SETA OS COOKIES DE SESSÃO
    const page2 = await browser.newPage();
    await page2.setViewport({ width, height });

    await page2.setCookie(...cookies);
    
    // INICIAR SALVAMENTO PERIÓDICO DE SESSÃO
    console.log(`🔄 [v1-itens] Iniciando salvamento periódico de sessão a cada ${SESSION_SAVE_INTERVAL/1000}s`);
    setInterval(async () => {
        try {
            console.log('💾 [v1-itens] Salvando sessão periodicamente...');
            await sessionManager.saveSession(page1, PROFILE_NAME);
        } catch (error) {
            console.error('❌ [v1-itens] Erro ao salvar sessão:', error.message);
        }
    }, SESSION_SAVE_INTERVAL);

    console.log('🚀 [v1-itens] Iniciando script de itens...');
    
    // AGORA, CADA ABA EXECUTA UM DOS SEUS SCRIPTS
    await Promise.allSettled([
        //pedidoScript(page1),    // aba 1
        itensScript(page2),
        // aceitaScript(browser, cookies),
        //serverScript(page4),    // aba 4
        //statusScript(page5)     // aba 5
    ]);
})().catch(err => {
    console.error('❌ [v1-itens] Erro fatal:', err.message);
    process.exit(1);
});