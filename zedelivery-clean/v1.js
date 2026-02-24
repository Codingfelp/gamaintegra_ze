const puppeteer = require('puppeteer');
const fs = require('fs');
const request = require('request');
const { performance } = require('perf_hooks');
const phpBridge = require('./php-bridge');
const sessionManager = require('./session-manager');
const integrationLogger = require('./integration-logger');
const updateController = require('./update-controller');

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
        console.log(`🔄 [SISTEMA] Tempo de execução (${(runtime/1000/60/60).toFixed(2)}h) excedeu limite. Reiniciando...`);
        return true;
    }
    return false;
}

function logMemoryUsage() {
    const used = process.memoryUsage();
    console.log(`📊 [MEMÓRIA] Heap: ${Math.round(used.heapUsed / 1024 / 1024)}MB / ${Math.round(used.heapTotal / 1024 / 1024)}MB | RSS: ${Math.round(used.rss / 1024 / 1024)}MB`);
}

// Log de memória a cada 30 minutos
setInterval(() => {
    logMemoryUsage();
    if (shouldRestart()) {
        console.log('🔄 [SISTEMA] Iniciando reinício preventivo para evitar problemas de memória...');
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
const SESSION_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutos
const SESSION_SAVE_INTERVAL = 10 * 60 * 1000; // 10 minutos
let mainPage = null; // Referência global para a página principal

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
    // Usar PHP Bridge para chamar Gmail API diretamente
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
        
        // Aguardar entre tentativas
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
    
    // Debug: salvar screenshot após login
    try {
        await page.screenshot({ path: '/app/logs/debug-after-login-click.png' });
        console.log('📸 [fazerLogin] Screenshot salvo');
    } catch (e) {}
    
    // Verificar se há erro na página
    const pageContent = await page.content();
    if (pageContent.includes('limite') || pageContent.includes('bloqueado') || pageContent.includes('tentativas')) {
        console.log('⚠️ [fazerLogin] Possível bloqueio detectado na página');
    }
    
    // Verificar mensagens de erro visíveis
    const errorMessages = await page.evaluate(() => {
        const errors = [];
        document.querySelectorAll('[class*="error"], [class*="alert"], [class*="message"]').forEach(el => {
            if (el.textContent.trim()) errors.push(el.textContent.trim().substring(0, 100));
        });
        return errors;
    });
    if (errorMessages.length > 0) {
        console.log('⚠️ [fazerLogin] Mensagens na página:', errorMessages.slice(0, 3).join(' | '));
    }

    const btnSendEmail = await page.$("#send-email-button");
    if (btnSendEmail) {
        console.log('📧 [fazerLogin] 2FA necessário, solicitando código por email...');
        await page.click("#send-email-button");
        await sleep(8);

        const TIMEOUT_VERIFICACAO = 60000; // 60 segundos

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
        
        // Aguardar possível redirecionamento
        await sleep(5);
        
        // Verificar se saiu da página de login
        const currentUrl = page.url();
        console.log(`📍 [fazerLogin] URL atual: ${currentUrl}`);
        
        if (currentUrl.includes('login')) {
            // Ainda na página de login - pode precisar de 2FA ou credenciais erradas
            console.log('⚠️ [fazerLogin] Ainda na página de login, verificando novamente...');
            
            // Tentar aguardar mais
            await sleep(10);
            
            const newUrl = page.url();
            if (newUrl.includes('login')) {
                // Verificar se há mensagem de erro
                const errorMsg = await page.evaluate(() => {
                    const error = document.querySelector('.error-message, [class*="error"], [class*="alert"]');
                    return error ? error.textContent : null;
                });
                
                if (errorMsg) {
                    console.error(`❌ [fazerLogin] Erro de login: ${errorMsg}`);
                }
                
                // Verificar se apareceu botão de 2FA tardiamente
                const late2FA = await page.$("#send-email-button");
                if (late2FA) {
                    console.log('📧 [fazerLogin] Botão 2FA apareceu, reiniciando login...');
                    throw new Error("2FA necessário - reiniciando");
                }
                
                console.error('❌ [fazerLogin] Login falhou - credenciais podem estar incorretas ou há bloqueio');
                throw new Error("Login falhou");
            }
        }
        
        console.log("✅ [fazerLogin] Login concluído sem necessidade de 2FA!");
    }
    
    // Verificação final
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
            await sessionManager.saveCookiesToDB('profile-ze-v1', cookies);
        }
    } catch (saveError) {
        console.error('⚠️ [fazerLogin] Erro ao salvar cookies:', saveError.message);
    }
}

// Funções principais de cada script. Você pode expandir conforme queira mais detalhes de cada um.
async function pedidoScript(page) {
    console.log('📦 [pedidoScript] Iniciando monitoramento de pedidos...');
    
    try {
        await page.goto("https://seu.ze.delivery/history", {
            waitUntil: "networkidle2",
            timeout: 60000
        });
    } catch (navError) {
        console.error('❌ [pedidoScript] Erro ao navegar:', navError.message);
        return;
    }
    
    console.log('📍 [pedidoScript] URL:', page.url());
    
    // Se redirecionou para login, sessão expirou
    if (page.url().includes('login')) {
        console.log('🔑 [pedidoScript] Sessão expirou, reiniciando processo...');
        process.exit(1); // Supervisor vai reiniciar
    }

    let consecutiveErrors = 0;
    const maxConsecutiveErrors = 5;

    while (true) {
        try {
            // 🔹 Aguarda até 15 segundos pelo seletor da tabela
            const ready = await waitForSafe(page, "#order-history-table-body", 15000);
            if (!ready) {
                consecutiveErrors++;
                console.log(`❌ [pedidoScript] Timeout esperando tabela (${consecutiveErrors}/${maxConsecutiveErrors})`);
                
                if (consecutiveErrors >= maxConsecutiveErrors) {
                    console.log('🔄 [pedidoScript] Muitos erros consecutivos, reiniciando...');
                    process.exit(1);
                }
                
                await page.reload({ waitUntil: "networkidle2", timeout: 30000 });
                continue;
            }
            
            // Reset contador de erros quando sucesso
            consecutiveErrors = 0;

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

                    const now = new Date();
                    const seconds = now.getSeconds().toString().padStart(2, '0');

                    const orderDateTime = (() => {
                        const spans = row.querySelectorAll("span");
                        for (const span of spans) {
                            const text = span.innerText.trim();
                            if (dateRegex.test(text)) {
                                return text.match(dateRegex)[0] + `:${seconds}`; // retorna apenas a parte da data
                            }
                        }
                        return null; // se não encontrar
                    })();
                    const customerName = row
                        .querySelector('[id^="customer-name"]')
                        ?.innerText.trim();
                    //const status = row.querySelector('[id^="status"]')?.innerText.trim();
                    /*const statusElement = row.querySelector('[id^="status"]');
                    let status = null;
                    if (statusElement && statusElement.shadowRoot) {
                        // Primeiro procura pelo container, depois pelo span dentro dele
                        const container = statusElement.shadowRoot.querySelector('.container');
                        if (container) {
                            const statusSpan = container.querySelector('span');
                            status = statusSpan ? statusSpan.textContent.trim() : null;
                        }

                        // Se não encontrar via container, tenta direto
                        if (!status) {
                            const statusSpan = statusElement.shadowRoot.querySelector('span');
                            status = statusSpan ? statusSpan.textContent.trim() : null;
                        }
                    } else if (statusElement) {
                        status = statusElement.textContent.trim();
                    }*/
                    const status = 'Pendente'; // Pedidos novos entram como Pendente
                    
                    // 🔹 Capturar nome do entregador (aparece como "username retirou" ou "username a caminho")
                    let entregador = '';
                    const allTextContent = row.innerText || '';
                    const entregadorPattern = allTextContent.match(/([a-zA-Z0-9._-]+)\s+(retirou|a caminho|está a caminho)/i);
                    if (entregadorPattern) {
                        entregador = entregadorPattern[1].trim();
                    }
                    
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
                        entregador: entregador || '',
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

                await sleep(10);

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

                // ✅ NOVO: Capturar telefone do cliente via modal "Ver telefone"
                let customerPhone = await capturarTelefoneCliente(page);
                
                // Se não conseguiu pelo modal, tentar captura direta (fallback)
                if (!customerPhone) {
                    customerPhone = await getTextFromShadowOrNormal(page, "#customer-phone", "p[data-testid='hexa-v2-text']");
                    if (!customerPhone) {
                        customerPhone = await getTextFromShadowOrNormal(page, '[data-testid="customer-phone"]');
                    }
                    customerPhone = customerPhone.replace(/\D/g, "").trim();
                }
                
                console.log(`📞 [itensScript] Telefone do cliente: ${customerPhone || '(não encontrado)'}`);

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

                let troco = await getTextFromShadowOrNormal(page, "#change-value");
                troco = troco.replace("R$", "").replace(",", ".").trim();

                let trocoCliente = await getTextFromShadowOrNormal(page, "#change-value-to-client");
                trocoCliente = trocoCliente.replace("R$", "").replace(",", ".").trim();

                let taxaConveniencia = await getTextFromShadowOrNormal(page, "#serviceFee");
                taxaConveniencia = taxaConveniencia.replace("R$", "").replace(",", ".").trim();

                let subTotal = await getTextFromShadowOrNormal(page, "#subtotal");
                subTotal = subTotal.replace("R$", "").replace(",", ".").trim();

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



                const pedidosData = produtos.map(pedido => ({
                    id: encodeURIComponent(id_pedido_info),
                    tags: pedido,
                    desconto: desconto,
                    frete: frete,
                    subTotal: subTotal,
                    cpfCliente: cpfCliente,
                    customerPhone: customerPhone, // NOVO: Telefone do cliente
                    telefoneCliente: customerPhone, // Para ze_pedido_view.php
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
                    statusPedido: statusPedido
                }));
                console.log(JSON.stringify(pedidosData));
                try {
                    // Enviar pedidos via PHP Bridge
                    for (const pedidoData of pedidosData) {
                        const result = await view_pedido(pedidoData);
                        console.log("Resposta do PHP:", result);
                    }
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

async function statusScript(page) {
    console.log('📊 [statusScript] Iniciando monitoramento de status...');
    
    try {
        await page.goto("https://seu.ze.delivery/history", {
            waitUntil: "networkidle2",
            timeout: 60000
        });
    } catch (navError) {
        console.error('❌ [statusScript] Erro ao navegar:', navError.message);
        return;
    }
    
    console.log('📍 [statusScript] URL:', page.url());
    
    // Se redirecionou para login, sessão expirou
    if (page.url().includes('login')) {
        console.log('🔑 [statusScript] Sessão expirou, reiniciando processo...');
        process.exit(1); // Supervisor vai reiniciar
    }

    let consecutiveErrors = 0;
    const maxConsecutiveErrors = 5;

    while (true) {
        try {
            // 🔹 Aguarda até 15 segundos pelo seletor da tabela
            const ready = await waitForSafe(page, "#order-history-table-body", 15000);
            if (!ready) {
                consecutiveErrors++;
                console.log(`❌ [statusScript] Timeout esperando tabela (${consecutiveErrors}/${maxConsecutiveErrors})`);
                
                if (consecutiveErrors >= maxConsecutiveErrors) {
                    console.log('🔄 [statusScript] Muitos erros consecutivos, reiniciando...');
                    process.exit(1);
                }
                
                await page.reload({ waitUntil: "networkidle2", timeout: 30000 });
                continue;
            }
            
            // Reset contador de erros quando sucesso
            consecutiveErrors = 0;

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
                    const statusElement = row.querySelector('[id^="status"]');
                    let status = 'Aceito';
                    if (statusElement && statusElement.shadowRoot) {
                        // Primeiro procura pelo container, depois pelo span dentro dele
                        const container = statusElement.shadowRoot.querySelector('.container');
                        if (container) {
                            const statusSpan = container.querySelector('span');
                            status = statusSpan ? statusSpan.textContent.trim() : null;
                        }

                        // Se não encontrar via container, tenta direto
                        if (!status) {
                            const statusSpan = statusElement.shadowRoot.querySelector('span');
                            status = statusSpan ? statusSpan.textContent.trim() : null;
                        }
                    } else if (statusElement) {
                        status = statusElement.textContent.trim();
                    }
                    
                    // 🔹 Capturar nome do entregador
                    // O entregador aparece como "username retirou" ou "username a caminho"
                    // Procurar em todos os spans/textos do card pelo padrão
                    let entregador = '';
                    const allText = row.innerText || '';
                    const entregadorMatch = allText.match(/([a-zA-Z0-9._-]+)\s+(retirou|a caminho|está a caminho)/i);
                    if (entregadorMatch) {
                        entregador = entregadorMatch[1].trim();
                    }
                    // Também tentar buscar em elemento específico de courier/entregador
                    const courierEl = row.querySelector('[data-testid*="courier"], [id*="courier"], [id*="driver"], [class*="courier"]');
                    if (courierEl && !entregador) {
                        entregador = courierEl.innerText.replace(/retirou|a caminho|está a caminho/gi, '').trim();
                    }
                    
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
                        entregador,
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
                const orderNumberWithoutSpaces = order.orderNumber.replace(/\s+/g, '');
                console.log(order);
                let statusCode = '0'; // Default
                const statusPed = order.status.trim();

                // 🔹 TRATAMENTO ESPECÍFICO PARA STATUS
                if (statusPed === 'Entregue') {
                    statusCode = '1';
                } else if (statusPed === 'Aceito') {
                    statusCode = '2';
                } else if (statusPed === 'Retirou' || statusPed === 'A caminho') {
                    statusCode = '3';
                } else if (statusPed.toLowerCase().includes("cancelado")) {
                    statusCode = '4'; // 🔹 "Cancelado: usuário" → "4"
                } else if (statusPed === 'Desconsiderado') {
                    statusCode = '5';
                } else if (statusPed === 'Rejeitado') {
                    statusCode = '5';
                } else if (statusPed.toLowerCase().includes("expirado")) {
                    statusCode = '5';
                }

                console.log("Atualizando pedido:", orderNumberWithoutSpaces, "Status:", statusPed, "Código:", statusCode, "Token:", configRobo.token, "Entregador:", order.entregador || '(não encontrado)');

                // Usar PHP Bridge via CLI em vez de HTTP
                try {
                    const result = await phpBridge.atualizarStatusDireto(
                        orderNumberWithoutSpaces,
                        statusCode,
                        configRobo.token,
                        order.entregador || ''
                    );
                    console.log("Resultado da atualização:", result ? result.substring(0, 100) : 'OK');
                    
                    // Log de integração - apenas para status significativos
                    if (statusCode === '1' || statusCode === '4') {
                        integrationLogger.logEvent(
                            integrationLogger.PROCESS_TYPES.STATUS_UPDATE,
                            integrationLogger.STATUS.COMPLETED,
                            `Pedido #${orderNumberWithoutSpaces} atualizado para ${statusPed}`,
                            { orderId: orderNumberWithoutSpaces, status: statusPed, statusCode }
                        );
                    }
                } catch (error) {
                    console.log('Erro ao atualizar status:', error.message);
                    
                    // Log de integração - erro
                    integrationLogger.logEvent(
                        integrationLogger.PROCESS_TYPES.STATUS_UPDATE,
                        integrationLogger.STATUS.CANCELLED,
                        `Erro ao atualizar pedido #${orderNumberWithoutSpaces}`,
                        { orderId: orderNumberWithoutSpaces, error: error.message }
                    );
                }

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
// Estatísticas do auto-accept (salvas em arquivo para a API)
const ACEITE_STATS_FILE = '/app/logs/aceite-stats.json';

function saveAceiteStats(stats) {
    try {
        fs.writeFileSync(ACEITE_STATS_FILE, JSON.stringify(stats, null, 2));
    } catch (e) {
        console.error('Erro ao salvar stats:', e.message);
    }
}

function loadAceiteStats() {
    try {
        if (fs.existsSync(ACEITE_STATS_FILE)) {
            return JSON.parse(fs.readFileSync(ACEITE_STATS_FILE, 'utf8'));
        }
    } catch (e) {}
    return {
        status: 'starting',
        lastCheck: null,
        lastAccept: null,
        totalAccepted: 0,
        totalFailed: 0,
        totalAttempts: 0,
        errors: [],
        recentAccepts: []
    };
}

async function aceitaScript(browser, cookies) {
    console.log('🤖 [ACEITA] Iniciando script de aceite automático de pedidos...');
    console.log('🔄 [ACEITA] FLUXO CORRETO: /poc-orders -> Clicar CARD -> Modal -> Botão "Aceitar"');
    
    // Iniciar log de integração
    let currentProcessId = await integrationLogger.log.orderAccept.start(
        'Iniciando monitoramento de aceite automático',
        { hostname: require('os').hostname() }
    );
    
    let aceiteStats = loadAceiteStats();
    aceiteStats.status = 'running';
    aceiteStats.startTime = new Date().toISOString();
    saveAceiteStats(aceiteStats);
    
    while (true) { // Loop externo: reabre aba se necessário
        let page = null;
        try {
            page = await browser.newPage();
            await page.setCookie(...cookies);
            console.log('🆕 [ACEITA] Nova aba aberta para aceitar pedidos.');

            await page.goto("https://seu.ze.delivery/poc-orders", {
                waitUntil: "networkidle2",
                timeout: 60000
            });
            
            console.log('📍 [ACEITA] Navegou para página de pedidos:', page.url());
            
            // Se redirecionou para login, sessão expirou
            if (page.url().includes('login')) {
                console.log('🔑 [ACEITA] Sessão expirou, reiniciando...');
                aceiteStats.status = 'session_expired';
                aceiteStats.errors.push({ time: new Date().toISOString(), error: 'Session expired' });
                saveAceiteStats(aceiteStats);
                process.exit(1);
            }

            aceiteStats.status = 'monitoring';
            saveAceiteStats(aceiteStats);

            // Loop interno: monitora continuamente sem limite de iterações
            while (true) {
                try {
                    aceiteStats.lastCheck = new Date().toISOString();
                    
                    // Fechar modais de alerta se existirem
                    const closeButton = await page.$('#close-alert-modal');
                    if (closeButton) {
                        await closeButton.click();
                        console.log('🔔 [ACEITA] Modal de alerta fechado');
                    }

                    // =======================================================
                    // PASSO 1: Procurar CARD de pedido pendente em "Novos"
                    // =======================================================
                    const pedidoPendente = await page.evaluate(() => {
                        // Buscar cards na seção "Novos" ou com status "Pendente"
                        const rows = document.querySelectorAll('hexa-v2-custom-table-row');
                        for (const row of rows) {
                            const badges = row.querySelectorAll('hexa-v2-badge-status');
                            for (const badge of badges) {
                                let statusText = '';
                                if (badge.shadowRoot) {
                                    const span = badge.shadowRoot.querySelector('span');
                                    statusText = span ? span.textContent.trim().toLowerCase() : '';
                                }
                                if (statusText.includes('pendente') || statusText.includes('novo')) {
                                    // Capturar ID do pedido
                                    let orderId = '';
                                    const orderNumEl = row.querySelector('[id^="order-number"]');
                                    if (orderNumEl) {
                                        orderId = orderNumEl.textContent.trim().replace(/\s+/g, '');
                                    }
                                    if (!orderId) {
                                        const idEl = row.querySelector('hexa-v2-text');
                                        if (idEl && idEl.shadowRoot) {
                                            const span = idEl.shadowRoot.querySelector('span');
                                            orderId = span ? span.textContent.trim().replace(/\s+/g, '') : '';
                                        }
                                    }
                                    if (!orderId) {
                                        const allText = row.innerText || '';
                                        const match = allText.match(/(\d{3}\s*\d{3}\s*\d{3})/);
                                        if (match) orderId = match[1].replace(/\s+/g, '');
                                    }
                                    
                                    return { found: true, orderId: orderId || 'N/A', status: statusText, rowIndex: Array.from(rows).indexOf(row) };
                                }
                            }
                        }
                        return { found: false, orderId: null, status: null };
                    });
                    
                    if (!pedidoPendente.found) {
                        // Sem pedidos pendentes - aguardar e recarregar
                        aceiteStats.status = 'waiting';
                        saveAceiteStats(aceiteStats);
                        await sleep(2);
                        await page.reload({ waitUntil: "domcontentloaded", timeout: 15000 });
                        continue;
                    }

                    const orderId = pedidoPendente.orderId;
                    console.log(`🚀 [ACEITA] PEDIDO #${orderId} PENDENTE DETECTADO!`);
                    const startTime = performance.now();
                    
                    aceiteStats.status = 'accepting';
                    aceiteStats.totalAttempts++;
                    saveAceiteStats(aceiteStats);

                    // =======================================================
                    // PASSO 2: CLICAR NO CARD para abrir o modal
                    // O card é um hexa-v2-custom-table-row clicável
                    // =======================================================
                    console.log(`🖱️ [ACEITA] Clicando no CARD do pedido #${orderId}...`);
                    
                    const cardClicado = await page.evaluate((rowIdx) => {
                        const rows = document.querySelectorAll('hexa-v2-custom-table-row');
                        if (rows[rowIdx]) {
                            rows[rowIdx].click();
                            return true;
                        }
                        // Fallback: clicar no primeiro card com status pendente
                        for (const row of rows) {
                            const badges = row.querySelectorAll('hexa-v2-badge-status');
                            for (const badge of badges) {
                                let statusText = '';
                                if (badge.shadowRoot) {
                                    const span = badge.shadowRoot.querySelector('span');
                                    statusText = span ? span.textContent.trim().toLowerCase() : '';
                                }
                                if (statusText.includes('pendente') || statusText.includes('novo')) {
                                    row.click();
                                    return true;
                                }
                            }
                        }
                        return false;
                    }, pedidoPendente.rowIndex);

                    if (!cardClicado) {
                        console.log('❌ [ACEITA] Não conseguiu clicar no card do pedido');
                        await sleep(1);
                        continue;
                    }

                    console.log('✓ [ACEITA] Card clicado, aguardando modal...');
                    await sleep(2); // Aguardar modal abrir

                    // =======================================================
                    // PASSO 3: Localizar e clicar no botão "Aceitar" DENTRO DO MODAL
                    // HTML: <button class="button primary medium flex" part="button" type="submit">
                    //         <span class="text" part="text" data-testid="text">Aceitar</span>
                    //       </button>
                    // =======================================================
                    console.log('🔍 [ACEITA] Buscando botão "Aceitar" no modal...');
                    
                    let botaoAceitarClicado = false;
                    
                    for (let tentativa = 1; tentativa <= 5; tentativa++) {
                        botaoAceitarClicado = await page.evaluate(() => {
                            // ESTRATÉGIA 1: Buscar o botão com data-testid="text" contendo "Aceitar"
                            const spansAceitar = document.querySelectorAll('span[data-testid="text"]');
                            for (const span of spansAceitar) {
                                if (span.textContent.trim() === 'Aceitar') {
                                    // O botão é o parent (button.primary)
                                    const btn = span.closest('button');
                                    if (btn && btn.classList.contains('primary')) {
                                        btn.click();
                                        return true;
                                    }
                                }
                            }
                            
                            // ESTRATÉGIA 2: Buscar button.primary com texto "Aceitar"
                            const primaryButtons = document.querySelectorAll('button.primary');
                            for (const btn of primaryButtons) {
                                const texto = btn.textContent.trim();
                                if (texto === 'Aceitar') {
                                    btn.click();
                                    return true;
                                }
                            }
                            
                            // ESTRATÉGIA 3: Buscar em hexa-v2-button com shadowRoot
                            const hexaBtns = document.querySelectorAll('hexa-v2-button');
                            for (const hexaBtn of hexaBtns) {
                                if (hexaBtn.shadowRoot) {
                                    const innerBtn = hexaBtn.shadowRoot.querySelector('button.primary');
                                    if (innerBtn) {
                                        const spanText = innerBtn.querySelector('span')?.textContent?.trim() || '';
                                        const btnText = innerBtn.textContent?.trim() || '';
                                        if (spanText === 'Aceitar' || btnText.includes('Aceitar')) {
                                            innerBtn.click();
                                            return true;
                                        }
                                    }
                                }
                            }
                            
                            // ESTRATÉGIA 4: Qualquer botão com texto exato "Aceitar" em modal
                            const modal = document.querySelector('[role="dialog"], .modal, [class*="modal"]');
                            if (modal) {
                                const btnsInModal = modal.querySelectorAll('button');
                                for (const btn of btnsInModal) {
                                    if (btn.textContent.trim() === 'Aceitar') {
                                        btn.click();
                                        return true;
                                    }
                                }
                            }
                            
                            // ESTRATÉGIA 5: #orders-details-modal-button-accept
                            const modalBtn = document.querySelector('#orders-details-modal-button-accept');
                            if (modalBtn) {
                                if (modalBtn.shadowRoot) {
                                    const innerBtn = modalBtn.shadowRoot.querySelector('button');
                                    if (innerBtn) { innerBtn.click(); return true; }
                                }
                                modalBtn.click();
                                return true;
                            }
                            
                            return false;
                        });
                        
                        if (botaoAceitarClicado) break;
                        console.log(`⏳ [ACEITA] Tentativa ${tentativa}/5 - botão não encontrado, aguardando...`);
                        await sleep(1);
                    }

                    if (!botaoAceitarClicado) {
                        console.log('❌ [ACEITA] Botão "Aceitar" não encontrado no modal após 5 tentativas');
                        // Fechar modal se aberto (ESC ou clicar fora)
                        await page.keyboard.press('Escape');
                        await sleep(1);
                        aceiteStats.totalFailed++;
                        saveAceiteStats(aceiteStats);
                        continue;
                    }

                    console.log('✅ [ACEITA] Clicou no botão "Aceitar"!');
                    
                    // =======================================================
                    // PASSO 4: Aguardar 4 segundos e verificar se status mudou
                    // =======================================================
                    console.log('⏳ [ACEITA] Aguardando 4 segundos para verificar status...');
                    await sleep(4);
                    
                    // Recarregar página para verificar status atualizado
                    await page.reload({ waitUntil: "domcontentloaded", timeout: 10000 });
                    await sleep(1);
                    
                    const statusVerificado = await page.evaluate((targetOrderId) => {
                        const rows = document.querySelectorAll('hexa-v2-custom-table-row');
                        
                        // Verificar se ainda há pedidos pendentes
                        let pendentesCount = 0;
                        let pedidoEncontrado = false;
                        let novoStatus = '';
                        
                        for (const row of rows) {
                            let rowOrderId = '';
                            const orderNumEl = row.querySelector('[id^="order-number"]');
                            if (orderNumEl) {
                                rowOrderId = orderNumEl.textContent.trim().replace(/\s+/g, '');
                            }
                            
                            const badges = row.querySelectorAll('hexa-v2-badge-status');
                            for (const badge of badges) {
                                let statusText = '';
                                if (badge.shadowRoot) {
                                    const span = badge.shadowRoot.querySelector('span');
                                    statusText = span ? span.textContent.trim().toLowerCase() : '';
                                }
                                
                                if (statusText.includes('pendente')) {
                                    pendentesCount++;
                                }
                                
                                // Verificar se encontrou o pedido alvo
                                if (targetOrderId && targetOrderId !== 'N/A' && 
                                    (rowOrderId.includes(targetOrderId) || targetOrderId.includes(rowOrderId))) {
                                    pedidoEncontrado = true;
                                    novoStatus = statusText;
                                }
                            }
                        }
                        
                        return { 
                            pendentesCount, 
                            pedidoEncontrado, 
                            novoStatus,
                            success: novoStatus.includes('aceito') || novoStatus.includes('preparo') || 
                                     (!pedidoEncontrado && pendentesCount === 0)
                        };
                    }, orderId);
                    
                    const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
                    
                    if (statusVerificado.success || statusVerificado.novoStatus.includes('aceito')) {
                        console.log(`✅✅✅ [ACEITA] PEDIDO #${orderId} ACEITO COM SUCESSO em ${elapsed}s!`);
                        if (statusVerificado.novoStatus) {
                            console.log(`   Novo status: ${statusVerificado.novoStatus.toUpperCase()}`);
                        }
                        
                        // Log de integração - sucesso
                        integrationLogger.logEvent(
                            integrationLogger.PROCESS_TYPES.ORDER_ACCEPT,
                            integrationLogger.STATUS.COMPLETED,
                            `Pedido #${orderId} aceito com sucesso em ${elapsed}s`,
                            { orderId, elapsed, newStatus: statusVerificado.novoStatus }
                        );
                        
                        aceiteStats.totalAccepted++;
                        aceiteStats.lastAccept = new Date().toISOString();
                        aceiteStats.lastAcceptedOrder = orderId;
                        aceiteStats.lastElapsed = elapsed;
                        aceiteStats.status = 'success';
                        
                        aceiteStats.recentAccepts.unshift({
                            orderId: orderId,
                            time: new Date().toISOString(),
                            elapsed: elapsed,
                            status: 'success'
                        });
                        if (aceiteStats.recentAccepts.length > 10) {
                            aceiteStats.recentAccepts.pop();
                        }
                    } else if (statusVerificado.novoStatus.includes('pendente')) {
                        console.log(`❌ [ACEITA] FALHA! Pedido #${orderId} ainda está PENDENTE após ${elapsed}s`);
                        console.log(`   Ainda há ${statusVerificado.pendentesCount} pedido(s) pendente(s)`);
                        console.log(`   Tentando novamente...`);
                        
                        // Log de integração - falha
                        integrationLogger.logEvent(
                            integrationLogger.PROCESS_TYPES.ORDER_ACCEPT,
                            integrationLogger.STATUS.CANCELLED,
                            `Falha ao aceitar pedido #${orderId} - ainda pendente`,
                            { orderId, elapsed, error: 'Pedido ainda pendente após tentativa' }
                        );
                        
                        aceiteStats.totalFailed++;
                        aceiteStats.status = 'failed';
                    } else {
                        // Pedido não encontrado na lista - provavelmente foi aceito
                        console.log(`✅ [ACEITA] Pedido #${orderId} processado em ${elapsed}s (status inferido: aceito)`);
                        aceiteStats.totalAccepted++;
                        aceiteStats.lastAccept = new Date().toISOString();
                        aceiteStats.lastAcceptedOrder = orderId;
                        aceiteStats.status = 'success';
                        
                        aceiteStats.recentAccepts.unshift({
                            orderId: orderId,
                            time: new Date().toISOString(),
                            elapsed: elapsed,
                            status: 'inferred'
                        });
                        if (aceiteStats.recentAccepts.length > 10) {
                            aceiteStats.recentAccepts.pop();
                        }
                    }
                    
                    saveAceiteStats(aceiteStats);
                    aceiteStats.status = 'monitoring';
                    await sleep(1);
                    
                } catch (innerErr) {
                    console.error("❌ [ACEITA] Erro no loop interno:", innerErr.message);
                    aceiteStats.status = 'error';
                    aceiteStats.errors.push({ time: new Date().toISOString(), error: innerErr.message });
                    if (aceiteStats.errors.length > 20) aceiteStats.errors.shift();
                    saveAceiteStats(aceiteStats);
                    
                    try { 
                        await page.reload({ waitUntil: "networkidle2", timeout: 30000 }); 
                    } catch (reloadErr) {
                        console.error("❌ [ACEITA] Erro ao recarregar:", reloadErr.message);
                        break; // Sair do loop interno para reabrir aba
                    }
                    await sleep(3);
                }
            }

        } catch (error) {
            console.error("❌ [ACEITA] Erro crítico:", error.message);
            aceiteStats.status = 'critical_error';
            aceiteStats.errors.push({ time: new Date().toISOString(), error: error.message });
            saveAceiteStats(aceiteStats);
        } finally {
            if (page) {
                try { await page.close(); } catch (e) { }
                console.log("🔄 [ACEITA] Aba fechada, reabrindo em 5s...");
            }
            await sleep(5);
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

// ✅ NOVA FUNÇÃO: Capturar telefone do cliente via modal "Ver telefone"
// Fluxo: Ver telefone -> Problemas com a entrega -> O entregador não encontra o cliente -> Confirmar
async function capturarTelefoneCliente(page) {
    console.log('📞 [TELEFONE] Iniciando captura de telefone do cliente...');
    
    try {
        // Primeiro, verificar se o telefone já está visível (não tem botão "Ver telefone")
        const phoneAlreadyVisible = await page.evaluate(() => {
            // Procurar elemento com telefone já visível
            const phoneEl = document.querySelector('#customer-phone, [data-testid="customer-phone"]');
            if (phoneEl) {
                const text = phoneEl.innerText || phoneEl.textContent || '';
                const cleanPhone = text.replace(/\D/g, '');
                if (cleanPhone.length >= 10) {
                    return cleanPhone;
                }
            }
            return null;
        });
        
        if (phoneAlreadyVisible) {
            console.log(`📞 [TELEFONE] Telefone já visível: ${phoneAlreadyVisible}`);
            return phoneAlreadyVisible;
        }
        
        // Procurar botão "Ver telefone"
        const verTelefoneButton = await page.evaluate(() => {
            // Procurar botão com texto "Ver telefone" ou similar
            const buttons = document.querySelectorAll('button, hexa-v2-button, [role="button"]');
            for (const btn of buttons) {
                const text = (btn.innerText || btn.textContent || '').toLowerCase();
                if (text.includes('ver telefone') || text.includes('mostrar telefone') || text.includes('show phone')) {
                    return true;
                }
                // Verificar também no shadowRoot
                if (btn.shadowRoot) {
                    const shadowText = (btn.shadowRoot.innerText || btn.shadowRoot.textContent || '').toLowerCase();
                    if (shadowText.includes('ver telefone') || shadowText.includes('mostrar telefone')) {
                        return true;
                    }
                }
            }
            // Tentar seletor direto
            const directBtn = document.querySelector('[data-testid="view-phone-button"], #view-phone-button, [id*="phone-button"]');
            return directBtn !== null;
        });
        
        if (!verTelefoneButton) {
            console.log('📞 [TELEFONE] Botão "Ver telefone" não encontrado, pulando...');
            return '';
        }
        
        console.log('📞 [TELEFONE] Botão "Ver telefone" encontrado, clicando...');
        
        // Clicar no botão "Ver telefone"
        await page.evaluate(() => {
            const buttons = document.querySelectorAll('button, hexa-v2-button, [role="button"]');
            for (const btn of buttons) {
                const text = (btn.innerText || btn.textContent || '').toLowerCase();
                if (text.includes('ver telefone') || text.includes('mostrar telefone')) {
                    btn.click();
                    return;
                }
                if (btn.shadowRoot) {
                    const shadowBtn = btn.shadowRoot.querySelector('button');
                    const shadowText = (btn.shadowRoot.innerText || '').toLowerCase();
                    if (shadowText.includes('ver telefone') && shadowBtn) {
                        shadowBtn.click();
                        return;
                    }
                }
            }
            // Tentar seletor direto
            const directBtn = document.querySelector('[data-testid="view-phone-button"], #view-phone-button, [id*="phone-button"]');
            if (directBtn) directBtn.click();
        });
        
        await sleep(2);
        
        // Aguardar modal abrir - "Qual é o motivo para o contato com o cliente?"
        console.log('📞 [TELEFONE] Aguardando modal de motivo...');
        
        // Clicar em "Problemas com a entrega"
        const clickedProblemas = await page.evaluate(() => {
            const options = document.querySelectorAll('[role="option"], [role="button"], button, div[class*="option"], li');
            for (const opt of options) {
                const text = (opt.innerText || opt.textContent || '').toLowerCase();
                if (text.includes('problemas com a entrega') || text.includes('problema na entrega') || text.includes('delivery problem')) {
                    opt.click();
                    return true;
                }
            }
            // Tentar pelo índice se não encontrar pelo texto (segunda opção geralmente)
            const radioButtons = document.querySelectorAll('input[type="radio"], [role="radio"]');
            for (const radio of radioButtons) {
                const label = radio.closest('label') || radio.parentElement;
                const text = (label?.innerText || '').toLowerCase();
                if (text.includes('problemas com a entrega') || text.includes('entrega')) {
                    radio.click();
                    return true;
                }
            }
            return false;
        });
        
        if (!clickedProblemas) {
            console.log('📞 [TELEFONE] Opção "Problemas com a entrega" não encontrada');
            // Tentar fechar modal
            await page.keyboard.press('Escape');
            return '';
        }
        
        console.log('📞 [TELEFONE] Clicou em "Problemas com a entrega"');
        await sleep(1.5);
        
        // Clicar em "O entregador não encontra o cliente"
        const clickedEntregador = await page.evaluate(() => {
            const options = document.querySelectorAll('[role="option"], [role="button"], button, div[class*="option"], li, label');
            for (const opt of options) {
                const text = (opt.innerText || opt.textContent || '').toLowerCase();
                if (text.includes('entregador não encontra') || text.includes('não encontra o cliente') || text.includes('driver can\'t find')) {
                    opt.click();
                    return true;
                }
            }
            // Tentar input radio
            const radioButtons = document.querySelectorAll('input[type="radio"], [role="radio"]');
            for (const radio of radioButtons) {
                const label = radio.closest('label') || radio.parentElement;
                const text = (label?.innerText || '').toLowerCase();
                if (text.includes('entregador não encontra') || text.includes('não encontra')) {
                    radio.click();
                    return true;
                }
            }
            return false;
        });
        
        if (!clickedEntregador) {
            console.log('📞 [TELEFONE] Opção "O entregador não encontra o cliente" não encontrada');
            await page.keyboard.press('Escape');
            return '';
        }
        
        console.log('📞 [TELEFONE] Clicou em "O entregador não encontra o cliente"');
        await sleep(1.5);
        
        // Clicar no botão "Confirmar"
        const clickedConfirmar = await page.evaluate(() => {
            const buttons = document.querySelectorAll('button, hexa-v2-button, [role="button"]');
            for (const btn of buttons) {
                const text = (btn.innerText || btn.textContent || '').toLowerCase();
                if (text.includes('confirmar') || text.includes('confirm')) {
                    btn.click();
                    return true;
                }
                if (btn.shadowRoot) {
                    const shadowBtn = btn.shadowRoot.querySelector('button');
                    const shadowText = (btn.shadowRoot.innerText || '').toLowerCase();
                    if (shadowText.includes('confirmar') && shadowBtn) {
                        shadowBtn.click();
                        return true;
                    }
                }
            }
            return false;
        });
        
        if (!clickedConfirmar) {
            console.log('📞 [TELEFONE] Botão "Confirmar" não encontrado');
            await page.keyboard.press('Escape');
            return '';
        }
        
        console.log('📞 [TELEFONE] Clicou em "Confirmar"');
        await sleep(3);
        
        // Agora capturar o telefone que deve estar visível
        const telefone = await page.evaluate(() => {
            // Tentar vários seletores possíveis para o telefone
            const selectors = [
                '#customer-phone',
                '[data-testid="customer-phone"]',
                '[id*="phone"]',
                '[class*="phone"]'
            ];
            
            for (const sel of selectors) {
                const el = document.querySelector(sel);
                if (el) {
                    const text = el.innerText || el.textContent || '';
                    // Verificar se tem formato de telefone
                    const cleanPhone = text.replace(/\D/g, '');
                    if (cleanPhone.length >= 10 && cleanPhone.length <= 13) {
                        return cleanPhone;
                    }
                }
            }
            
            // Buscar por padrão de telefone em toda a página (região do cliente)
            const customerSection = document.querySelector('[id*="customer"], [class*="customer"], [data-testid*="customer"]');
            if (customerSection) {
                const text = customerSection.innerText || '';
                const phoneMatch = text.match(/\(?\d{2}\)?\s*\d{4,5}[-\s]?\d{4}/);
                if (phoneMatch) {
                    return phoneMatch[0].replace(/\D/g, '');
                }
            }
            
            return '';
        });
        
        if (telefone) {
            console.log(`📞 [TELEFONE] Telefone capturado com sucesso: ${telefone}`);
        } else {
            console.log('📞 [TELEFONE] Não foi possível capturar o telefone após modal');
        }
        
        return telefone || '';
        
    } catch (error) {
        console.error('📞 [TELEFONE] Erro ao capturar telefone:', error.message);
        return '';
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

                    const now = new Date();
                    const seconds = now.getSeconds().toString().padStart(2, '0');

                    const orderDateTime = (() => {
                        const spans = row.querySelectorAll("span");
                        for (const span of spans) {
                            const text = span.innerText.trim();
                            if (dateRegex.test(text)) {
                                return text.match(dateRegex)[0] + `:${seconds}`; // retorna apenas a parte da data
                            }
                        }
                        return null; // se não encontrar
                    })();
                    const customerName = row
                        .querySelector('[id^="customer-name"]')
                        ?.innerText.trim();
                    //const status = row.querySelector('[id^="status"]')?.innerText.trim();
                    /*const statusElement = row.querySelector('[id^="status"]');
                    let status = null;
                    if (statusElement && statusElement.shadowRoot) {
                        // Primeiro procura pelo container, depois pelo span dentro dele
                        const container = statusElement.shadowRoot.querySelector('.container');
                        if (container) {
                            const statusSpan = container.querySelector('span');
                            status = statusSpan ? statusSpan.textContent.trim() : null;
                        }

                        // Se não encontrar via container, tenta direto
                        if (!status) {
                            const statusSpan = statusElement.shadowRoot.querySelector('span');
                            status = statusSpan ? statusSpan.textContent.trim() : null;
                        }
                    } else if (statusElement) {
                        status = statusElement.textContent.trim();
                    }*/
                    const status = 'Pendente'; // Pedidos novos entram como Pendente
                    
                    // 🔹 Capturar nome do entregador (aparece como "username retirou" ou "username a caminho")
                    let entregador = '';
                    const allTextContent = row.innerText || '';
                    const entregadorPattern = allTextContent.match(/([a-zA-Z0-9._-]+)\s+(retirou|a caminho|está a caminho)/i);
                    if (entregadorPattern) {
                        entregador = entregadorPattern[1].trim();
                    }
                    
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
                        entregador: entregador || '',
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
    const isProduction = process.env.NODE_ENV === 'production';
    const PROFILE_NAME = sessionManager.PROFILE_NAME_V1;
    
    // Em produção (Railway), usar Chromium do sistema
    const executablePath = isProduction ? '/usr/bin/chromium' : undefined;
    
    console.log(`🚀 [v1] Iniciando browser... (produção: ${isProduction})`);
    if (executablePath) {
        console.log(`📍 [v1] Usando Chromium: ${executablePath}`);
    }
    
    // Inicializar tabela de sessão no banco
    console.log('🔧 [v1] Inicializando sistema de sessão...');
    await sessionManager.initSessionTable();
    
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
    
    const page1 = await browser.newPage();
    mainPage = page1; // Referência global
    
    const { width, height } = await page1.evaluate(() => {
        return {
            width: window.screen.availWidth || 1920,
            height: window.screen.availHeight || 1080
        };
    });
    
    // Em produção, rodar indefinidamente. Em dev, timeout de 10 minutos.
    if (!isProduction) {
        setTimeout(async () => {
            console.log('⏰ [DEV] Fechando aplicação após 10 minutos...');
            await browser.close();
            process.exit(0);
        }, 600000);
    } else {
        console.log('🏭 [PRODUÇÃO] Script rodando indefinidamente...');
    }
    
    await page1.setViewport({ width, height });
    
    // ESTRATÉGIA DE SESSÃO:
    // 1. Tentar restaurar sessão do banco de dados
    // 2. Se falhar, tentar usar perfil local do Chromium
    // 3. Se ainda falhar, fazer login com 2FA
    
    console.log('🔄 [v1] Tentando restaurar sessão do banco...');
    let sessionRestored = await sessionManager.restoreSession(page1, PROFILE_NAME);
    
    if (!sessionRestored) {
        console.log('🌐 [v1] Sessão não restaurada do banco, verificando perfil local...');
        await page1.goto("https://seu.ze.delivery/home", { waitUntil: 'networkidle2', timeout: 60000 });
        console.log('📍 [v1] URL atual:', page1.url());
        
        if (page1.url().includes("login")) {
            console.log("🔑 [v1] Sessão expirada, fazendo login novamente...");
            try {
                await fazerLogin(page1);
                console.log("✅ [v1] Login concluído com sucesso!");
                
                // Salvar nova sessão no banco
                console.log('💾 [v1] Salvando nova sessão no banco...');
                await sessionManager.saveSession(page1, PROFILE_NAME);
            } catch (loginError) {
                console.error("❌ [v1] Erro no login:", loginError.message);
                console.log("🔄 [v1] Reiniciando script em 30 segundos...");
                await sleep(30);
                process.exit(1); // Supervisor vai reiniciar
            }
        } else {
            console.log('✅ [v1] Sessão ativa via perfil local');
            // Salvar sessão válida no banco para próximas vezes
            await sessionManager.saveSession(page1, PROFILE_NAME);
        }
    }

    // PEGA COOKIES DE AUTENTICAÇÃO
    const cookies = await page1.cookies();
    console.log(`🍪 [v1] ${cookies.length} cookies capturados`);

    // ABRE AS OUTRAS ABAS E SETA OS COOKIES DE SESSÃO
    const page2 = await browser.newPage();
    const page3 = await browser.newPage();
    const page4 = await browser.newPage();
    const page5 = await browser.newPage();
    await page4.setViewport({ width, height });
    await page5.setViewport({ width, height });

    await page2.setCookie(...cookies);
    await page3.setCookie(...cookies);
    await page4.setCookie(...cookies);
    await page5.setCookie(...cookies);
    
    // INICIAR SALVAMENTO PERIÓDICO DE SESSÃO
    console.log(`🔄 [v1] Iniciando salvamento periódico de sessão a cada ${SESSION_SAVE_INTERVAL/1000}s`);
    setInterval(async () => {
        try {
            console.log('💾 [v1] Salvando sessão periodicamente...');
            await sessionManager.saveSession(page1, PROFILE_NAME);
        } catch (error) {
            console.error('❌ [v1] Erro ao salvar sessão:', error.message);
        }
    }, SESSION_SAVE_INTERVAL);
    
    // CALLBACK PARA QUANDO SESSÃO EXPIRAR
    const onSessionExpired = () => {
        console.log('🚨 [v1] SESSÃO EXPIROU! Reiniciando processo...');
        // Forçar reinício do script - supervisor vai reiniciar
        process.exit(1);
    };
    
    // INICIAR HEALTH CHECK PERIÓDICO
    sessionManager.startHealthCheck(page1, PROFILE_NAME, onSessionExpired, SESSION_CHECK_INTERVAL);

    console.log('🚀 [v1] Iniciando scripts de monitoramento...');
    
    // AGORA, CADA ABA EXECUTA UM DOS SEUS SCRIPTS
    setTimeout(() => pedidoScript(page1), 3000);
    //itensScript(page2);  // aba 2 - rodado no v1-itens.js separado
    setTimeout(() => aceitaScript(browser, cookies), 5000); // aba 3 - ACEITAR PEDIDOS AUTOMATICAMENTE
    setTimeout(() => serverScript(page4), 8000);
    setTimeout(() => statusScript(page5), 15000);
})().catch(err => {
    console.error('❌ [v1] Erro fatal:', err.message);
    process.exit(1);
});