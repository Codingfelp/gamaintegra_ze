const puppeteer = require('puppeteer');
const fs = require('fs');
const request = require('request');
const { performance } = require('perf_hooks');
const phpBridge = require('./php-bridge');
const sessionManager = require('./session-manager');
const integrationLogger = require('./integration-logger');

// ============== CONFIGURAÇÃO DE OPERAÇÃO 24/7 ==============
// Estratégia: Reiniciar automaticamente a cada 4 horas para evitar memory leaks
// Horário de operação: 09:00 - 00:00 (se fora desse horário, aguarda)
const MAX_RUNTIME_MS = 4 * 60 * 60 * 1000; // 4 horas
const HORA_INICIO = 9;  // 09:00
const HORA_FIM = 24;    // 00:00 (meia-noite)
const START_TIME = Date.now();

function isHorarioOperacao() {
    const now = new Date();
    const hora = now.getHours();
    return hora >= HORA_INICIO && hora < HORA_FIM;
}

function shouldRestart() {
    const runtime = Date.now() - START_TIME;
    if (runtime >= MAX_RUNTIME_MS) {
        console.log(`🔄 [v1-itens] Tempo de execução (${(runtime/1000/60/60).toFixed(2)}h) excedeu limite. Reiniciando...`);
        return true;
    }
    return false;
}

function logMemoryUsage() {
    const used = process.memoryUsage();
    console.log(`📊 [v1-itens MEMÓRIA] Heap: ${Math.round(used.heapUsed / 1024 / 1024)}MB / ${Math.round(used.heapTotal / 1024 / 1024)}MB | RSS: ${Math.round(used.rss / 1024 / 1024)}MB`);
}

// Log de memória a cada 30 minutos
setInterval(() => {
    logMemoryUsage();
    if (shouldRestart()) {
        console.log('🔄 [v1-itens] Iniciando reinício preventivo para evitar problemas de memória...');
        process.exit(0); // Supervisor irá reiniciar automaticamente
    }
}, 30 * 60 * 1000);

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
        // O php-bridge agora retorna {id, prioridade}
        if (result && result.id) {
            console.log(`📋 Próximo pedido: ${result.id} (${result.prioridade})`);
            return result.id;
        }
        return 0;
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
    
    // IMPORTANTE: Salvar cookies após login bem sucedido
    try {
        const cookies = await page.cookies();
        if (cookies && cookies.length > 0) {
            // Salvar no arquivo local
            const cookiesPath = require('path').join(__dirname, 'cookies.json');
            require('fs').writeFileSync(cookiesPath, JSON.stringify(cookies, null, 2));
            console.log(`💾 [fazerLogin] ${cookies.length} cookies salvos em cookies.json`);
            
            // Também salvar no banco via session-manager
            await sessionManager.saveCookiesToDB('profile-ze-v1-itens', cookies);
        }
    } catch (saveError) {
        console.error('⚠️ [fazerLogin] Erro ao salvar cookies:', saveError.message);
    }
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

        if (id_pedido_info == 0 || id_pedido_info === null) {
            console.log("⏳ [CAPTURA] Aguardando novos pedidos para capturar detalhes...");
            await sleep(5);
        } else {
            // Iniciar log de integração para captura de pedido
            let processId = await integrationLogger.log.orderScrape.start(
                `Iniciando captura do pedido #${id_pedido_info}`,
                { orderId: id_pedido_info }
            );
            
            try {
                /**ABRIR TODOS OS PEDIDOS */
                await page.goto(
                    "https://seu.ze.delivery/order/" + encodeURIComponent(id_pedido_info)
                );

                console.log("═══════════════════════════════════════════════════════");
                console.log("📦 [CAPTURA] INICIANDO CAPTURA DO PEDIDO: " + encodeURIComponent(id_pedido_info));
                console.log("═══════════════════════════════════════════════════════");

                // Aguardar carregamento da página
                await sleep(3);
                
                // =====================================================
                // CAPTURA SIMPLIFICADA - USA ÁREA DE IMPRESSÃO (#print-content)
                // Esta área contém texto plano, sem Shadow DOM
                // =====================================================
                
                // Aguardar área de impressão carregar
                await page.waitForSelector('#print-content', { timeout: 10000 }).catch(() => {
                    console.log('⚠️ [CAPTURA] Área de impressão não encontrada');
                });
                
                // Capturar TODOS os dados de uma vez da área de impressão
                const dadosPrintArea = await page.evaluate(() => {
                    const resultado = {
                        codigoColeta: '',
                        tipoPedido: '',
                        bairro: '',
                        endereco: '',
                        complemento: '',
                        cidadeUF: '',
                        cep: '',
                        cliente: '',
                        cpf: '',
                        itens: [],
                        subtotal: '',
                        frete: '',
                        desconto: '',
                        taxaConveniencia: '',
                        troco: '',
                        total: '',
                        cupomDescricao: ''
                    };
                    
                    // 1. CÓDIGO DE COLETA - está em um <p> com span
                    const paragrafos = document.querySelectorAll('#print-content p');
                    for (const p of paragrafos) {
                        if (p.textContent.includes('Código de coleta:')) {
                            const span = p.querySelector('span');
                            if (span) resultado.codigoColeta = span.textContent.trim();
                            break;
                        }
                    }
                    
                    // 2. TIPO DO PEDIDO
                    const tipoEl = document.querySelector('[data-testid="delivery-type-label"]');
                    if (tipoEl) {
                        const texto = tipoEl.textContent.trim().toLowerCase();
                        if (texto === 'comum' || texto.includes('comum')) resultado.tipoPedido = 'Pedido Comum';
                        else if (texto === 'turbo' || texto.includes('turbo')) resultado.tipoPedido = 'Pedido Turbo';
                        else if (texto === 'retirada' || texto.includes('retirada') || texto.includes('pickup')) resultado.tipoPedido = 'Pedido Retirada';
                        else resultado.tipoPedido = tipoEl.textContent.trim();
                    }
                    
                    // 3. BAIRRO - múltiplas fontes
                    const bairroEl = document.querySelector('#neighborhood-info');
                    if (bairroEl) resultado.bairro = bairroEl.textContent.trim();
                    if (!resultado.bairro) {
                        const bairroAlt = document.querySelector('#address-neighborhood');
                        if (bairroAlt) resultado.bairro = bairroAlt.textContent.trim();
                    }
                    
                    // 4. ENDEREÇO COMPLETO - do #receipt-customer-info
                    const receiptInfo = document.querySelector('#receipt-customer-info');
                    if (receiptInfo) {
                        // Endereço principal
                        const enderecoEl = receiptInfo.querySelector('#main-street');
                        if (enderecoEl) resultado.endereco = enderecoEl.textContent.trim();
                        
                        // Complemento - span após main-street
                        const enderecoP = receiptInfo.querySelector('p:has(#main-street)') || receiptInfo.querySelector('p:nth-child(2)');
                        if (enderecoP) {
                            const spans = enderecoP.querySelectorAll('span');
                            // O terceiro span geralmente é complemento
                            if (spans.length >= 3 && !spans[2].id) {
                                resultado.complemento = spans[2].textContent.trim();
                            }
                        }
                    }
                    
                    // Fallback para endereço se não encontrou
                    if (!resultado.endereco) {
                        const enderecoEl = document.querySelector('#main-street');
                        if (enderecoEl) resultado.endereco = enderecoEl.textContent.trim();
                    }
                    
                    // 5. CIDADE/UF e CEP
                    const cidadeEl = document.querySelector('#address-city-province');
                    if (cidadeEl) resultado.cidadeUF = cidadeEl.textContent.trim();
                    
                    // 6. CLIENTE
                    const clienteEl = document.querySelector('#print-customer-name');
                    if (clienteEl) resultado.cliente = clienteEl.textContent.trim();
                    
                    // 7. CPF - buscar na área de impressão
                    const textoGeral = receiptInfo ? receiptInfo.innerText : '';
                    const cpfMatch = textoGeral.match(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/);
                    if (cpfMatch) resultado.cpf = cpfMatch[0];
                    
                    // 8. ITENS DO PEDIDO
                    // ESTRATÉGIA: Capturar PREÇO TOTAL da linha e calcular PREÇO UNITÁRIO
                    // O preço exibido na UI pode variar entre áreas, então vamos padronizar:
                    // - Capturar o preço como está (assumindo que é TOTAL da linha)
                    // - Calcular unitário = total / quantidade
                    const itensContainer = document.querySelectorAll('#bought-items [data-testid="bought-items"]');
                    itensContainer.forEach(item => {
                        const qtdEl = item.querySelector('#item-quantity');
                        const nomeEl = item.querySelector('#item-name');
                        const precoEl = item.querySelector('#item-price span');
                        
                        const quantidadeStr = qtdEl ? qtdEl.textContent.trim() : '1';
                        const quantidade = parseInt(quantidadeStr, 10) || 1;
                        const nome = nomeEl ? nomeEl.textContent.trim() : '';
                        let precoTexto = precoEl ? precoEl.textContent.trim() : '';
                        precoTexto = precoTexto.replace('R$', '').replace(/\s/g, '').replace(',', '.').trim();
                        const precoCapturado = parseFloat(precoTexto) || 0;
                        
                        // Na área de impressão, o preço mostrado é UNITÁRIO
                        // Então calculamos: precoTotal = precoUnitario * quantidade
                        const precoUnitario = precoCapturado;
                        const precoTotal = precoCapturado * quantidade;
                        
                        const idMatch = item.id?.match(/item-(\d+)/);
                        const id = idMatch ? idMatch[1] : '';
                        
                        if (nome) {
                            resultado.itens.push({ 
                                id, 
                                nome, 
                                quantidade: quantidadeStr, 
                                preco: precoUnitario.toFixed(2),  // Preço unitário
                                precoTotal: precoTotal.toFixed(2) // Preço total da linha
                            });
                        }
                    });
                    
                    // 9. VALORES FINANCEIROS - do #print-order-payment-details
                    // Estrutura HTML: <div id="payment-details-X"><span>Label:</span><span>Valor</span></div>
                    const paymentDetails = document.querySelector('#print-order-payment-details');
                    const paymentInfo = document.querySelector('#receipt-payment-info');
                    
                    // Função auxiliar para extrair valor de um elemento de pagamento
                    const extrairValor = (seletor) => {
                        const el = document.querySelector(seletor);
                        if (el) {
                            // Pegar todos os spans e usar o último (que contém o valor)
                            const spans = el.querySelectorAll('span');
                            if (spans.length >= 2) {
                                return spans[spans.length - 1].textContent
                                    .replace('R$', '')
                                    .replace(/\s/g, '')
                                    .replace(',', '.')
                                    .replace('-', '')
                                    .trim();
                            }
                            // Fallback: tentar pegar o texto direto
                            const texto = el.textContent || '';
                            const match = texto.match(/R?\$?\s*([\d,\.]+)/);
                            if (match) {
                                return match[1].replace(',', '.').trim();
                            }
                        }
                        return '';
                    };
                    
                    // Subtotal - "Soma dos produtos:"
                    resultado.subtotal = extrairValor('#payment-details-subtotal');
                    
                    // Frete/Envio
                    resultado.frete = extrairValor('#payment-details-freight');
                    if (!resultado.frete) {
                        resultado.frete = extrairValor('#payment-details-delivery');
                    }
                    
                    // Desconto
                    resultado.desconto = extrairValor('#payment-details-discount');
                    
                    // Taxa de Conveniência
                    resultado.taxaConveniencia = extrairValor('#payment-details-convenience-fee');
                    if (!resultado.taxaConveniencia) {
                        resultado.taxaConveniencia = extrairValor('#payment-details-service-fee');
                    }
                    
                    // Total
                    const totalEl = document.querySelector('#payment-details-total');
                    if (totalEl) {
                        const strongEl = totalEl.querySelector('strong span') || totalEl.querySelector('strong');
                        if (strongEl) {
                            resultado.total = strongEl.textContent
                                .replace('R$', '')
                                .replace(/\s/g, '')
                                .replace(',', '.')
                                .trim();
                        }
                    }
                    
                    // Troco - buscar no texto de pagamento ou em divs específicas
                    // Primeiro verificar se há um elemento específico de troco
                    resultado.troco = extrairValor('#payment-details-change');
                    if (!resultado.troco) {
                        resultado.troco = extrairValor('#payment-details-troco');
                    }
                    // Fallback: buscar no texto geral
                    if (!resultado.troco && paymentDetails) {
                        const textoPayment = paymentDetails.innerText || '';
                        const trocoMatch = textoPayment.match(/troco[:\s]+R?\$?\s*([\d,\.]+)/i);
                        if (trocoMatch) {
                            resultado.troco = trocoMatch[1].replace(',', '.').trim();
                        }
                    }
                    if (!resultado.troco && paymentInfo) {
                        const textoPayment = paymentInfo.innerText || '';
                        const trocoMatch = textoPayment.match(/troco[:\s]+R?\$?\s*([\d,\.]+)/i);
                        if (trocoMatch) {
                            resultado.troco = trocoMatch[1].replace(',', '.').trim();
                        }
                    }
                    
                    // DEBUG: Log dos valores encontrados
                    console.log('[PRINT-AREA] Valores financeiros capturados:', {
                        subtotal: resultado.subtotal,
                        frete: resultado.frete,
                        desconto: resultado.desconto,
                        taxaConveniencia: resultado.taxaConveniencia,
                        troco: resultado.troco,
                        total: resultado.total
                    });
                    
                    return resultado;
                });
                
                console.log('📄 [CAPTURA] Dados da área de impressão:', JSON.stringify(dadosPrintArea, null, 2));
                
                // Usar os dados capturados da área de impressão
                let tipoDelivery = dadosPrintArea.tipoPedido;
                let codigoEntrega = dadosPrintArea.codigoColeta;
                let enderecoBairro = dadosPrintArea.bairro;
                let enderecoRota = dadosPrintArea.endereco;
                let enderecoComplemento = dadosPrintArea.complemento;
                let enderecoCidadeUF = dadosPrintArea.cidadeUF;
                let cpfCapturado = dadosPrintArea.cpf;
                let produtos = dadosPrintArea.itens.map(item => ({
                    id: item.id,
                    nome: item.nome,
                    quantidade: item.quantidade,
                    preco: item.preco,           // Preço unitário
                    precoTotal: item.precoTotal || item.preco,  // Preço total da linha
                    imagem: ''
                }));
                let subTotal = dadosPrintArea.subtotal;
                let frete = dadosPrintArea.frete;
                let desconto = dadosPrintArea.desconto;
                let taxaConveniencia = dadosPrintArea.taxaConveniencia;
                let troco = dadosPrintArea.troco;
                let cupomDescricao = ''; // Será capturado via Shadow DOM
                
                // =====================================================
                // CAPTURA DE ITENS - SEMPRE VIA SHADOW DOM (UI PRINCIPAL)
                // O preço no Shadow DOM é o PREÇO TOTAL DA LINHA
                // Calculamos: precoUnitario = precoTotal / quantidade
                // =====================================================
                console.log('📦 [ITENS] Capturando itens via Shadow DOM (fonte principal)...');
                
                let temProdutos = false;
                
                try {
                    const produtosShadow = await page.$$eval('[data-testid="product"]', (produtos) => {
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
                            const quantidadeStr = quantidadeTexto.replace(/^Qtd:\s*/, '') || '1';
                            const quantidade = parseInt(quantidadeStr, 10) || 1;

                            // PREÇO TOTAL DA LINHA (como mostrado na UI)
                            // Formato: "R$ 76,32" -> 76.32
                            let precoTotalTexto = precoSpan?.textContent || '0';
                            precoTotalTexto = precoTotalTexto.replace('R$', '').replace(/\s/g, '').replace('.', '').replace(',', '.').trim();
                            const precoTotalLinha = parseFloat(precoTotalTexto) || 0;
                            
                            // PREÇO UNITÁRIO = TOTAL / QUANTIDADE
                            const precoUnitario = quantidade > 0 ? (precoTotalLinha / quantidade) : 0;

                            return {
                                id: idProduto,
                                nome: nomeSpan?.textContent.trim() || '',
                                quantidade: quantidadeStr,
                                preco: precoUnitario.toFixed(2),           // Preço UNITÁRIO calculado
                                precoTotal: precoTotalLinha.toFixed(2),    // Preço TOTAL da linha (original)
                                imagem: imagemEl?.src || ''
                            };
                        });
                    });
                    
                    // Usar se capturou produtos válidos
                    if (produtosShadow.length > 0 && produtosShadow.some(p => p.nome && p.nome.length > 2)) {
                        produtos = produtosShadow;
                        temProdutos = true;
                        console.log(`📦 [ITENS] ✅ ${produtos.length} produto(s) via Shadow DOM`);
                        // Log detalhado para debug
                        produtos.forEach(p => {
                            console.log(`   📦 ${p.quantidade}x ${p.nome} - Unit: R$${p.preco} | Total: R$${p.precoTotal}`);
                        });
                    } else {
                        console.log('📦 [ITENS] ⚠️ Shadow DOM não retornou itens válidos');
                    }
                } catch (e) {
                    console.log('📦 [ITENS] ❌ Falha no Shadow DOM:', e.message);
                }
                
                // FALLBACK: Se Shadow DOM falhou, tentar área de impressão #bought-items
                // NOTA: Na área de impressão, o preço mostrado é UNITÁRIO (diferente do Shadow DOM)
                if (!temProdutos) {
                    console.log('📦 [ITENS] ⚠️ Usando FALLBACK: área de impressão (preço = unitário)...');
                    
                    // Debug: verificar se elementos existem
                    const debugInfo = await page.evaluate(() => {
                        const printContent = document.querySelector('#print-content');
                        const boughtItems = document.querySelector('#bought-items');
                        const itemsFound = document.querySelectorAll('#bought-items [data-testid="bought-items"]');
                        const allTestIds = [...document.querySelectorAll('[data-testid]')].map(el => el.getAttribute('data-testid')).slice(0, 20);
                        
                        return {
                            hasPrintContent: !!printContent,
                            hasBoughtItems: !!boughtItems,
                            itemsCount: itemsFound.length,
                            sampleTestIds: allTestIds
                        };
                    });
                    console.log('📦 [ITENS] Debug:', JSON.stringify(debugInfo));
                    
                    produtos = await page.evaluate(() => {
                        const items = [];
                        
                        // Área de impressão tem os dados em texto plano
                        const boughtItems = document.querySelectorAll('#bought-items [data-testid="bought-items"]');
                        
                        for (const item of boughtItems) {
                            const quantEl = item.querySelector('#item-quantity');
                            const nomeEl = item.querySelector('#item-name');
                            const precoEl = item.querySelector('#item-price span');
                            
                            const quantidadeStr = quantEl ? quantEl.textContent.trim() : '1';
                            const quantidade = parseInt(quantidadeStr, 10) || 1;
                            const nome = nomeEl ? nomeEl.textContent.trim() : '';
                            let precoTexto = precoEl ? precoEl.textContent.trim() : '';
                            
                            // Limpar preço: "R$ 3.49" -> "3.49"
                            precoTexto = precoTexto.replace('R$', '').replace(/\s/g, '').replace(',', '.').trim();
                            const precoCapturado = parseFloat(precoTexto) || 0;
                            
                            // CORREÇÃO: Na área de impressão, o preço mostrado é o TOTAL DA LINHA!
                            // Exemplo: 4x Guaraná → R$ 7.04 (total), unitário = 7.04/4 = 1.76
                            const precoTotalLinha = precoCapturado;
                            const precoUnitario = quantidade > 0 ? (precoTotalLinha / quantidade) : precoCapturado;
                            
                            // Extrair ID do item do elemento pai (ex: id="item-10308")
                            const idMatch = item.id?.match(/item-(\d+)/);
                            const idProduto = idMatch ? idMatch[1] : '';
                            
                            if (nome) {
                                items.push({
                                    id: idProduto,
                                    nome: nome,
                                    quantidade: quantidadeStr,
                                    preco: precoUnitario.toFixed(2),      // Preço UNITÁRIO (calculado)
                                    precoTotal: precoTotalLinha.toFixed(2), // Preço TOTAL da linha (original)
                                    imagem: ''
                                });
                            }
                        }
                        
                        return items;
                    });
                    
                    console.log(`📦 [ITENS] Capturados ${produtos.length} item(s) via área de impressão`);
                }
                
                // Se ainda não encontrou, tentar estratégia alternativa
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
                            const quantidadeStr = qtdEl ? qtdEl.textContent.replace(/\D/g, '') || '1' : '1';
                            const quantidade = parseInt(quantidadeStr, 10) || 1;
                            
                            // Procurar preço
                            const precoEl = container.querySelector('[class*="price"], [class*="preco"]');
                            const precoTexto = precoEl ? precoEl.textContent.replace(/[^\d,\.]/g, '').replace(',', '.') : '0';
                            const precoCapturado = parseFloat(precoTexto) || 0;
                            
                            // Assumir que é preço unitário neste fallback
                            const precoUnitario = precoCapturado;
                            const precoTotal = (precoCapturado * quantidade).toFixed(2);
                            
                            // Procurar imagem
                            const imgEl = container.querySelector('img');
                            const imagem = imgEl ? imgEl.src : '';
                            
                            if (nome && nome.length > 2) {
                                items.push({ 
                                    id: '', 
                                    nome, 
                                    quantidade: quantidadeStr, 
                                    preco: precoUnitario.toFixed(2),
                                    precoTotal: precoTotal,
                                    imagem 
                                });
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

                // =====================================================
                // CAPTURA DE CPF DO CLIENTE
                // =====================================================
                console.log('📋 [CPF] Capturando CPF do cliente...');
                
                // Usar CPF já capturado da área de impressão, se disponível
                let cpfCliente = cpfCapturado || '';
                
                // ESTRATÉGIA 1: Se não tem CPF, buscar na área de impressão
                if (!cpfCliente || cpfCliente.length < 11) {
                    cpfCliente = await page.evaluate(() => {
                        // Buscar CPF na área de impressão #receipt-customer-info
                        const receiptInfo = document.querySelector('#receipt-customer-info');
                        if (receiptInfo) {
                            const texto = receiptInfo.innerText || receiptInfo.textContent || '';
                            // Buscar padrão CPF: XXX.XXX.XXX-XX ou XXXXXXXXXXX
                            const cpfMatch = texto.match(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/);
                            if (cpfMatch) return cpfMatch[0];
                        }
                    
                        // Buscar em #print-content
                        const printContent = document.querySelector('#print-content');
                        if (printContent) {
                            const texto = printContent.innerText || printContent.textContent || '';
                            const cpfMatch = texto.match(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/);
                            if (cpfMatch) return cpfMatch[0];
                        }
                    
                        return '';
                    });
                }
                
                // ESTRATÉGIA 2: Se não encontrou, tentar via Shadow DOM
                if (!cpfCliente || cpfCliente.length < 11) {
                    cpfCliente = await getTextFromShadowOrNormal(page, "#customer-document", "p[data-testid='hexa-v2-text']");
                }
                
                // ESTRATÉGIA 3: Fallback - buscar em toda a página
                if (!cpfCliente || cpfCliente === '-' || cpfCliente.length < 11) {
                    cpfCliente = await page.evaluate(() => {
                        // Procurar elemento com ID customer-document
                        const docEl = document.querySelector('#customer-document');
                        if (docEl) {
                            if (docEl.shadowRoot) {
                                const span = docEl.shadowRoot.querySelector('span, p');
                                if (span && span.textContent.trim() !== '-') {
                                    return span.textContent.trim();
                                }
                            }
                            const texto = docEl.textContent.trim();
                            if (texto && texto !== '-' && texto.length >= 11) return texto;
                        }
                        
                        // Procurar na seção #user-info
                        const userInfo = document.querySelector('#user-info');
                        if (userInfo) {
                            const texto = userInfo.innerText || '';
                            const cpfMatch = texto.match(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/);
                            if (cpfMatch) return cpfMatch[0];
                        }
                        
                        // Busca geral na página
                        const bodyText = document.body.innerText || '';
                        const cpfMatches = bodyText.match(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g);
                        if (cpfMatches && cpfMatches.length > 0) {
                            // Retornar o primeiro CPF válido encontrado
                            for (const cpf of cpfMatches) {
                                const limpo = cpf.replace(/\D/g, '');
                                if (limpo.length === 11) return cpf;
                            }
                        }
                        
                        return '';
                    });
                }
                
                cpfCliente = cpfCliente ? cpfCliente.replace(/\./g, "").replace(/-/g, "").trim() : '';
                console.log('📋 [CPF] Capturado:', cpfCliente || '(vazio)');

                // =====================================================
                // CAPTURA DE ENDEREÇO COMPLETO
                // =====================================================
                console.log('📍 [ENDEREÇO] Capturando endereço...');
                
                // ESTRATÉGIA PRINCIPAL: Área de impressão (dados em texto plano)
                let enderecoImpressao = await page.evaluate(() => {
                    const resultado = {
                        rua: '',
                        bairro: '',
                        complemento: ''
                    };
                    
                    // Bairro - da área de impressão
                    const bairroEl = document.querySelector('#neighborhood-info');
                    if (bairroEl) {
                        resultado.bairro = bairroEl.textContent.trim();
                    }
                    
                    // Endereço principal - da área de impressão
                    const ruaEl = document.querySelector('#main-street');
                    if (ruaEl) {
                        resultado.rua = ruaEl.textContent.trim();
                    }
                    
                    // Complemento - span após main-street no receipt-customer-info
                    const receiptCustomerInfo = document.querySelector('#receipt-customer-info');
                    if (receiptCustomerInfo) {
                        const enderecoP = receiptCustomerInfo.querySelector('p:nth-child(2)');
                        if (enderecoP) {
                            const spans = enderecoP.querySelectorAll('span');
                            // O terceiro span geralmente é o complemento
                            if (spans.length >= 3) {
                                resultado.complemento = spans[2].textContent.trim();
                            }
                        }
                    }
                    
                    return resultado;
                });
                
                console.log('📍 [ENDEREÇO] Via impressão:', enderecoImpressao);
                
                // Usar valores da área de impressão OU os já capturados anteriormente
                if (enderecoImpressao.rua && enderecoImpressao.rua.length > 3) {
                    enderecoRota = enderecoImpressao.rua;
                }
                if (enderecoImpressao.bairro && enderecoImpressao.bairro.length > 2) {
                    enderecoBairro = enderecoImpressao.bairro;
                }
                if (!enderecoComplemento) {
                    enderecoComplemento = enderecoImpressao.complemento;
                }
                
                // Se não encontrou na área de impressão, tentar via Shadow DOM
                if (!enderecoRota || enderecoRota === "-" || enderecoRota.length < 3) {
                    enderecoRota = await getTextFromShadowOrNormal(page, "#route");
                }
                if (!enderecoRota || enderecoRota === "-" || enderecoRota.length < 3) {
                    // Tentar pegar da seção de impressão alternativa
                    enderecoRota = await page.$eval('#main-street', el => el.textContent.trim()).catch(() => '');
                }
                
                // Se ainda não encontrou, tentar estratégias alternativas
                if (!enderecoRota || enderecoRota === "-" || enderecoRota.length < 3) {
                    enderecoRota = await page.evaluate(() => {
                        // Procurar na seção de endereço
                        const addressSection = document.querySelector('#address-info, [class*="address"]');
                        if (addressSection) {
                            // Procurar primeiro texto que pareça endereço
                            const textos = addressSection.querySelectorAll('hexa-v2-text, span, p');
                            for (const el of textos) {
                                let texto = '';
                                if (el.shadowRoot) {
                                    const span = el.shadowRoot.querySelector('span');
                                    texto = span ? span.textContent.trim() : '';
                                }
                                if (!texto) texto = el.textContent.trim();
                                
                                // Se parece com endereço (contém Rua, Av, número etc)
                                if (texto.length > 10 && /\d+/.test(texto) && 
                                    (texto.toLowerCase().includes('rua') || 
                                     texto.toLowerCase().includes('av') || 
                                     texto.toLowerCase().includes('alameda') ||
                                     texto.toLowerCase().includes('travessa') ||
                                     /^[A-Za-zÀ-ú\s]+,?\s*\d+/.test(texto))) {
                                    return texto;
                                }
                            }
                        }
                        return '';
                    });
                }
                enderecoRota = enderecoRota.replace(/-+/g, " ").replace(/\s+/g, " ").trim();
                console.log('📍 [ENDEREÇO] Rota:', enderecoRota || '(vazio)');

                // Complemento - fallback via Shadow DOM se não veio da área de impressão
                if (!enderecoComplemento || enderecoComplemento.length < 2) {
                    enderecoComplemento = await getTextFromShadowOrNormal(page, "#address-plus");
                }
                enderecoComplemento = enderecoComplemento.replace(/-+/g, "").trim();

                // Cidade/UF - fallback via Shadow DOM se não veio da área de impressão
                if (!enderecoCidadeUF || enderecoCidadeUF === "-") {
                    enderecoCidadeUF = await getTextFromShadowOrNormal(page, "#address-city-province");
                }
                enderecoCidadeUF = enderecoCidadeUF ? enderecoCidadeUF.replace(/-+/g, "").trim() : '';

                let enderecoCep = await getTextFromShadowOrNormal(page, "#address-zip-code");
                enderecoCep = enderecoCep ? enderecoCep.replace(/-+/g, "").trim() : '';

                // Bairro - fallback via Shadow DOM se não veio da área de impressão
                if (!enderecoBairro || enderecoBairro === "-" || enderecoBairro.length < 2) {
                    enderecoBairro = await getTextFromShadowOrNormal(page, "#address-neighborhood");
                }
                if (!enderecoBairro || enderecoBairro === "-" || enderecoBairro.length < 2) {
                    // Tentar pegar da seção de impressão diretamente
                    enderecoBairro = await page.$eval('#neighborhood-info', el => el.textContent.trim()).catch(() => '');
                }
                enderecoBairro = enderecoBairro.replace(/-+/g, "").trim();
                
                console.log('📍 [ENDEREÇO] Bairro:', enderecoBairro || '(vazio)');
                console.log('📍 [ENDEREÇO] Complemento:', enderecoComplemento || '(vazio)');
                console.log('📍 [ENDEREÇO] Cidade/UF:', enderecoCidadeUF || '(vazio)');
                console.log('📍 [ENDEREÇO] CEP:', enderecoCep || '(vazio)');

                // =====================================================
                // VALIDAÇÃO E FALLBACK DE VALORES FINANCEIROS
                // Os valores já foram capturados em dadosPrintArea (linhas ~908-990)
                // Aqui apenas fazemos fallback via Shadow DOM se necessário
                // =====================================================
                console.log('💰 [VALORES] Verificando valores financeiros já capturados...');
                console.log('💰 [VALORES] Subtotal:', subTotal || '(vazio)');
                console.log('💰 [VALORES] Frete:', frete || '(vazio)');
                console.log('💰 [VALORES] Desconto:', desconto || '0');
                console.log('💰 [VALORES] Taxa Conveniência:', taxaConveniencia || '0');
                console.log('💰 [VALORES] Troco:', troco || '0');
                
                // FALLBACK via Shadow DOM apenas se valores estiverem vazios
                if (!subTotal) {
                    const subTotalShadow = await getTextFromShadowOrNormal(page, "#subtotal");
                    if (subTotalShadow && subTotalShadow !== '-') {
                        subTotal = subTotalShadow.replace("R$", "").replace(",", ".").trim();
                        console.log('💰 [VALORES] Subtotal via Shadow DOM:', subTotal);
                    }
                }
                
                if (!frete) {
                    const freteShadow = await getTextFromShadowOrNormal(page, "#freight");
                    if (freteShadow && freteShadow !== '-') {
                        frete = freteShadow.replace("R$", "").replace(",", ".").trim();
                        console.log('💰 [VALORES] Frete via Shadow DOM:', frete);
                    }
                }
                
                if (!desconto || desconto === '0' || desconto === '0.00') {
                    const descontoShadow = await getTextFromShadowOrNormal(page, "#total-discount");
                    if (descontoShadow && descontoShadow !== '-') {
                        desconto = descontoShadow.replace("R$", "").replace(",", ".").replace("-", "").trim();
                        console.log('💰 [VALORES] Desconto via Shadow DOM:', desconto);
                    }
                }
                
                if (!taxaConveniencia) {
                    const taxaShadow = await getTextFromShadowOrNormal(page, "#serviceFee");
                    if (taxaShadow && taxaShadow !== '-') {
                        taxaConveniencia = taxaShadow.replace("R$", "").replace(",", ".").trim();
                        console.log('💰 [VALORES] Taxa Conveniência via Shadow DOM:', taxaConveniencia);
                    }
                }
                
                console.log('💰 [VALORES] FINAIS - Subtotal:', subTotal || '(vazio)', '| Frete:', frete || '0', '| Desconto:', desconto || '0', '| Taxa:', taxaConveniencia || '0', '| Troco:', troco || '0');

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

                // Troco - fallback via Shadow DOM se não veio da área de impressão
                if (!troco) {
                    troco = await getTextFromShadowOrNormal(page, "#change-value");
                }
                troco = troco ? troco.replace("R$", "").replace(",", ".").trim() : '';

                let trocoCliente = await getTextFromShadowOrNormal(page, "#change-value-to-client");
                trocoCliente = trocoCliente ? trocoCliente.replace("R$", "").replace(",", ".").trim() : '';

                // Taxa de conveniência - fallback via Shadow DOM se não veio da área de impressão
                if (!taxaConveniencia) {
                    taxaConveniencia = await getTextFromShadowOrNormal(page, "#serviceFee");
                }
                taxaConveniencia = taxaConveniencia ? taxaConveniencia.replace("R$", "").replace(",", ".").trim() : '';

                // =====================================================
                // CAPTURA DA DESCRIÇÃO DO CUPOM
                // =====================================================
                console.log('🎟️ [CUPOM] Capturando descrição do cupom...');
                
                // Tentar capturar via Shadow DOM (elemento #discount-description é hexa-v2-text)
                cupomDescricao = await page.evaluate(() => {
                    // O elemento #discount-description é um hexa-v2-text com Shadow DOM
                    const discountDescEl = document.querySelector('#discount-description');
                    if (discountDescEl) {
                        // Tentar pegar do Shadow DOM (hexa-v2-text tem span interno)
                        if (discountDescEl.shadowRoot) {
                            const span = discountDescEl.shadowRoot.querySelector('span');
                            if (span && span.textContent.trim()) {
                                return span.textContent.trim();
                            }
                        }
                        // Fallback: texto direto do elemento
                        if (discountDescEl.textContent.trim()) {
                            return discountDescEl.textContent.trim();
                        }
                    }
                    return '';
                });
                
                console.log('🎟️ [CUPOM] Resultado #discount-description:', cupomDescricao || '(vazio)');
                
                // Se não encontrou, tentar buscar por texto que indica descrição de cupom na página
                if (!cupomDescricao) {
                    cupomDescricao = await page.evaluate(() => {
                        // Procurar em todo hexa-v2-text da área de descontos/pagamento
                        const allHexaTexts = document.querySelectorAll('.css-iuyyuz hexa-v2-text, .eeuashx5 hexa-v2-text');
                        for (const el of allHexaTexts) {
                            let texto = '';
                            if (el.shadowRoot) {
                                const span = el.shadowRoot.querySelector('span');
                                texto = span?.textContent.trim() || '';
                            } else {
                                texto = el.textContent.trim();
                            }
                            
                            // Verificar se parece descrição de cupom
                            if (texto && (
                                texto.toLowerCase().includes('desconto de r$') ||
                                texto.toLowerCase().includes('cupom') ||
                                texto.toLowerCase().includes('zé compensa') ||
                                texto.toLowerCase().includes('pedido mínimo') ||
                                texto.toLowerCase().includes('válido para')
                            )) {
                                return texto;
                            }
                        }
                        
                        // Buscar texto visível na seção de desconto
                        const descontoSection = document.querySelector('[color="#888888"]');
                        if (descontoSection) {
                            const nextSibling = descontoSection.nextElementSibling;
                            if (nextSibling) {
                                const hexaText = nextSibling.querySelector('hexa-v2-text');
                                if (hexaText && hexaText.shadowRoot) {
                                    const span = hexaText.shadowRoot.querySelector('span');
                                    if (span && span.textContent.trim()) {
                                        return span.textContent.trim();
                                    }
                                }
                            }
                        }
                        
                        // Último fallback: buscar padrões de texto na página
                        const pageText = document.body.innerText || '';
                        const cupomPatterns = [
                            /(Desconto de R\$\s*[\d,\.]+\s*com[^.!]+[.!])/i,
                            /(Zé Compensa[^.!]+[.!])/i,
                            /(Válido para compras[^.!]+[.!])/i,
                            /(Pedido mínimo[^.!]+[.!])/i,
                            /(Cupom[^.!]+[.!])/i
                        ];
                        
                        for (const pattern of cupomPatterns) {
                            const match = pageText.match(pattern);
                            if (match) {
                                return match[1].trim();
                            }
                        }
                        
                        return '';
                    });
                }
                
                // Limpar a descrição do cupom
                cupomDescricao = cupomDescricao ? cupomDescricao.trim() : '';
                console.log('🎟️ [CUPOM] Descrição:', cupomDescricao || '(sem cupom)');

                // subTotal já foi capturado anteriormente na seção de valores

                // =====================================================
                // CAPTURA DO CÓDIGO DE ENTREGA/COLETA
                // =====================================================
                console.log('🏷️ [CÓDIGO] Capturando código de entrega...');
                
                // Só busca código se não foi capturado anteriormente da área de impressão
                if (!codigoEntrega) {
                    // ESTRATÉGIA 1: Área de impressão (mais confiável)
                    codigoEntrega = await page.evaluate(() => {
                        // Procurar na área de impressão - "Código de coleta: XXX XXX XXX X"
                        const coletaEl = document.querySelector('#print-content p');
                        if (coletaEl && coletaEl.textContent.includes('Código de coleta:')) {
                            const span = coletaEl.querySelector('span');
                            if (span) {
                                return span.textContent.trim();
                            }
                        }
                        
                        // Procurar span com padrão de código
                        const spans = document.querySelectorAll('#print-content span');
                        for (const span of spans) {
                            const texto = span.textContent.trim();
                            // Padrão flexível: grupos de letras/números separados por espaços
                            if (/^[A-Z0-9]{2,4}(\s[A-Z0-9]{2,4}){2,4}$/i.test(texto)) {
                                return texto;
                            }
                        }
                        
                        return null;
                    });
                }
                
                // ESTRATÉGIA 2: Via hexa-v2-text se não encontrou na área de impressão
                if (!codigoEntrega) {
                    const elements = await page.$$('hexa-v2-text');
                    
                    for (const el of elements) {
                        const shadowRoot = await el.getProperty('shadowRoot');

                        if (shadowRoot) {
                            const spanHandle = await shadowRoot.$('span[data-testid="hexa-v2-text"]');
                            if (spanHandle) {
                                const text = await spanHandle.evaluate(e => e.textContent.trim());

                                // Ignora número do pedido
                                if (text.startsWith("Pedido")) continue;

                                // Padrão flexível: grupos de letras/números separados por espaços
                                // Aceita: "XXX XXX XXX X", "XX XXX XXX", "XXX XXX XXX XX", etc.
                                if (/^[A-Z0-9]{2,4}(\s[A-Z0-9]{2,4}){2,4}$/i.test(text)) {
                                    codigoEntrega = text;
                                    break;
                                }
                            }
                        }
                    }
                }
                
                console.log('🏷️ [CÓDIGO] Código de entrega:', codigoEntrega || '(vazio)');

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
                
                // =====================================================
                // VERIFICAR CAMPOS NÃO CAPTURADOS
                // =====================================================
                const camposNaoCapturados = [];
                if (!tipoDelivery) camposNaoCapturados.push('Tipo Delivery');
                if (!cpfCliente) camposNaoCapturados.push('CPF');
                if (!customerPhone) camposNaoCapturados.push('Telefone');
                if (!enderecoRota && tipoDelivery !== 'Pedido Retirada') camposNaoCapturados.push('Endereço');
                if (!enderecoBairro && tipoDelivery !== 'Pedido Retirada') camposNaoCapturados.push('Bairro');
                if (!subTotal) camposNaoCapturados.push('SubTotal');
                if (produtos.length === 0) camposNaoCapturados.push('Itens do Pedido');
                if (!codigoEntrega && tipoDelivery !== 'Pedido Retirada') camposNaoCapturados.push('Código de Entrega');
                
                // =====================================================
                // RESUMO DO QUE FOI CAPTURADO
                // =====================================================
                console.log('═══════════════════════════════════════════════════════');
                console.log('📦 RESUMO DA CAPTURA DO PEDIDO ' + id_pedido_info);
                console.log('═══════════════════════════════════════════════════════');
                
                // Se houver campos não capturados, mostrar alerta
                if (camposNaoCapturados.length > 0) {
                    console.log('⚠️ ATENÇÃO: CAMPOS NÃO CAPTURADOS:');
                    console.log('   ❌ ' + camposNaoCapturados.join('\n   ❌ '));
                    console.log('───────────────────────────────────────────────────────');
                }
                
                console.log('🚚 Tipo Delivery:', tipoDelivery || '❌ NÃO CAPTURADO');
                console.log('📋 CPF:', cpfCliente || '❌ NÃO CAPTURADO');
                console.log('📞 Telefone:', customerPhone || '❌ NÃO CAPTURADO');
                console.log('📍 Endereço:', enderecoRota || (tipoDelivery === 'Pedido Retirada' ? '(Retirada - sem endereço)' : '❌ NÃO CAPTURADO'));
                console.log('📍 Bairro:', enderecoBairro || (tipoDelivery === 'Pedido Retirada' ? '(Retirada)' : '❌ NÃO CAPTURADO'));
                console.log('📍 Cidade/UF:', enderecoCidadeUF || '(vazio)');
                console.log('📍 CEP:', enderecoCep || '(vazio)');
                console.log('📍 Complemento:', enderecoComplemento || '(vazio)');
                console.log('💰 Frete:', frete || '0');
                console.log('💰 Desconto:', desconto || '0');
                console.log('💰 SubTotal:', subTotal || '❌ NÃO CAPTURADO');
                console.log('💰 Taxa Conveniência:', taxaConveniencia || '0');
                console.log('💰 Troco:', troco || '0');
                console.log('🏷️ Código Entrega:', codigoEntrega || (tipoDelivery === 'Pedido Retirada' ? '(Retirada)' : '❌ NÃO CAPTURADO'));
                console.log('🎟️ Cupom Descrição:', cupomDescricao || '(sem cupom)');
                console.log('📝 Observação:', obsPedido || '(vazia)');
                console.log('📊 Status:', statusPedido || '❌ NÃO CAPTURADO');
                console.log('🚴 Entregador:', entregador || '(não encontrado)');
                console.log('📦 Qtd Itens:', produtos.length);
                if (produtos.length > 0) {
                    console.log('   Itens:');
                    produtos.forEach(p => {
                        const precoUnit = p.preco || '?';
                        const precoTotal = p.precoTotal || '?';
                        console.log(`     ${p.quantidade}x ${p.nome} - Unit: R$${precoUnit} | Total: R$${precoTotal}`);
                    });
                } else {
                    console.log('   ❌ NENHUM ITEM CAPTURADO!');
                }
                
                // Status final da captura
                if (camposNaoCapturados.length === 0) {
                    console.log('✅ CAPTURA COMPLETA - Todos os campos capturados com sucesso!');
                } else {
                    console.log(`⚠️ CAPTURA INCOMPLETA - ${camposNaoCapturados.length} campo(s) faltando`);
                }
                console.log('═══════════════════════════════════════════════════════');

                var myHeaders = new Headers();
                myHeaders.append("Cookie", "PHPSESSID=cf8beildg23vcb3rgi97ase11o");

                // Se não tiver produtos, criar pelo menos um registro para enviar os dados do pedido
                let pedidosData;
                if (produtos.length === 0) {
                    console.log('⚠️ [ITENS] Nenhum item encontrado, criando registro sem itens...');
                    pedidosData = [{
                        id: encodeURIComponent(id_pedido_info),
                        tags: { id: '', nome: '', quantidade: '', preco: '', precoTotal: '', imagem: '' },
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
                        entregador: entregador,
                        emailEntregador: '',  // Email do entregador (capturar se disponível)
                        tipoDelivery: tipoDelivery,
                        cupomDescricao: cupomDescricao
                    }];
                } else {
                    pedidosData = produtos.map(pedido => ({
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
                        entregador: entregador,
                        emailEntregador: '',  // Email do entregador (capturar se disponível)
                        tipoDelivery: tipoDelivery,
                        cupomDescricao: cupomDescricao
                    }));
                }
                
                // RESUMO DE CAPTURA - VERIFICAÇÃO DE CAMPOS
                console.log("═══════════════════════════════════════════════════════");
                console.log("📊 [RESUMO] CAMPOS CAPTURADOS:");
                console.log("═══════════════════════════════════════════════════════");
                console.log(`  📋 CPF: ${cpfCliente || '❌ NÃO CAPTURADO'}`);
                console.log(`  📦 Tipo Pedido: ${tipoDelivery || '❌ NÃO CAPTURADO'}`);
                console.log(`  📍 Endereço: ${enderecoRota || '❌ NÃO CAPTURADO'}`);
                console.log(`  🏠 Complemento: ${enderecoComplemento || '(vazio)'}`);
                console.log(`  🏘️ Bairro: ${enderecoBairro || '❌ NÃO CAPTURADO'}`);
                console.log(`  🏙️ Cidade/UF: ${enderecoCidadeUF || '(vazio)'}`);
                console.log(`  📮 CEP: ${enderecoCep || '(vazio)'}`);
                console.log(`  🏷️ Código Entrega: ${codigoEntrega || '❌ NÃO CAPTURADO'}`);
                console.log(`  📦 Itens: ${produtos.length} produto(s)`);
                console.log(`  💰 Subtotal: ${subTotal || '❌ NÃO CAPTURADO'}`);
                console.log(`  🚚 Frete: ${frete || '0'}`);
                console.log(`  🎁 Desconto: ${desconto || '0'}`);
                console.log(`  💳 Taxa Conveniência: ${taxaConveniencia || '0'}`);
                console.log(`  💵 Troco: ${troco || '0'}`);
                console.log(`  📞 Telefone: ${customerPhone || '(não capturado)'}`);
                console.log(`  🎟️ Cupom Descrição: ${cupomDescricao || '(sem cupom)'}`);
                console.log("═══════════════════════════════════════════════════════");
                
                // Alertar se campos críticos estão faltando
                const camposFaltando = [];
                if (!cpfCliente) camposFaltando.push('CPF');
                if (!tipoDelivery) camposFaltando.push('Tipo Pedido');
                if (!enderecoRota) camposFaltando.push('Endereço');
                if (!enderecoBairro) camposFaltando.push('Bairro');
                if (!codigoEntrega) camposFaltando.push('Código Entrega');
                if (!subTotal) camposFaltando.push('Subtotal');
                if (produtos.length === 0) camposFaltando.push('Itens');
                
                if (camposFaltando.length > 0) {
                    console.log(`⚠️ [ALERTA] CAMPOS CRÍTICOS NÃO CAPTURADOS: ${camposFaltando.join(', ')}`);
                } else {
                    console.log(`✅ [SUCESSO] Todos os campos críticos foram capturados!`);
                }
                console.log("═══════════════════════════════════════════════════════");
                
                console.log(JSON.stringify(pedidosData));
                try {
                    // Enviar pedidos como array completo para o PHP
                    const result = await view_pedido(pedidosData);
                    console.log("Resposta do PHP:", result);
                    
                    // Log de integração - sucesso
                    await integrationLogger.completeProcess(
                        processId,
                        `Pedido #${id_pedido_info} capturado com sucesso`,
                        { 
                            orderId: id_pedido_info,
                            itemsCount: produtos.length,
                            hasPhone: !!telefoneCliente
                        }
                    );
                } catch (error) {
                    console.error("Erro ao enviar pedidos:", error);
                    
                    // Log de integração - falha no envio
                    await integrationLogger.cancelProcess(
                        processId,
                        `Erro ao salvar pedido #${id_pedido_info}`,
                        error.message,
                        { orderId: id_pedido_info }
                    );
                }
            } catch (error) {
                console.error("Erro ao processar pedido:", error);
                
                // Log de integração - erro geral
                if (processId) {
                    await integrationLogger.cancelProcess(
                        processId,
                        `Erro ao capturar pedido #${id_pedido_info}`,
                        error.message,
                        { orderId: id_pedido_info }
                    );
                }

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
                            console.log('[ACEITA] ⏳ Botão disponível, clicando...');
                            const startTime = Date.now();
                            await button.click();
                            console.log('[ACEITA] ✓ Botão clicado!');

                            // Aguardar modal aparecer
                            await sleep(0.5);
                            
                            const aceitarPedidoButton = await page.$('#orders-details-modal-button-accept');
                            if (aceitarPedidoButton) {
                                await aceitarPedidoButton.click();
                                console.log('[ACEITA] ✓ Botão Aceitar Pedido clicado!');
                                
                                // VERIFICAÇÃO DE SUCESSO: Aguardar mudança de status
                                let aceitoComSucesso = false;
                                const maxTentativas = 10;
                                
                                for (let tentativa = 0; tentativa < maxTentativas; tentativa++) {
                                    await sleep(1);
                                    
                                    // Verificar se o modal fechou ou se há indicação de sucesso
                                    const modalFechado = await page.$('#orders-details-modal-button-accept') === null;
                                    const msgSucesso = await page.evaluate(() => {
                                        const alerts = document.querySelectorAll('[role="alert"], .toast, .notification');
                                        for (const alert of alerts) {
                                            const texto = alert.textContent.toLowerCase();
                                            if (texto.includes('aceito') || texto.includes('sucesso')) {
                                                return true;
                                            }
                                        }
                                        return false;
                                    });
                                    
                                    if (modalFechado || msgSucesso) {
                                        aceitoComSucesso = true;
                                        const elapsed = Date.now() - startTime;
                                        console.log(`[ACEITA] ✅ Pedido ACEITO com sucesso em ${elapsed}ms!`);
                                        break;
                                    }
                                    
                                    console.log(`[ACEITA] ⏳ Verificando status... tentativa ${tentativa + 1}/${maxTentativas}`);
                                }
                                
                                if (!aceitoComSucesso) {
                                    console.log('[ACEITA] ⚠️ Não foi possível confirmar o aceite. Recarregando...');
                                }
                                
                                await sleep(2);
                            }

                            await page.goto("https://seu.ze.delivery/poc-orders", {
                                waitUntil: "networkidle2",
                            });
                        }
                    }
                } catch (err) {
                    console.error("[ACEITA] Erro dentro do loop de aceite:", err.message);
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
        aceitaScript(browser, cookies),  // Script de aceite automático ATIVADO
        //serverScript(page4),    // aba 4
        //statusScript(page5)     // aba 5
    ]);
})().catch(err => {
    console.error('❌ [v1-itens] Erro fatal:', err.message);
    process.exit(1);
});