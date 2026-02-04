const puppeteer = require('puppeteer');
const fs = require('fs');
const request = require('request');
const { performance } = require('perf_hooks');
const phpBridge = require('./php-bridge');

// Funções utilitárias compartilhadas
function readConfig() {
    const data = fs.readFileSync('configuracao.json', 'utf8');
    return JSON.parse(data);
}
const configRobo = readConfig();

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
    const maxTentativas = 10;
    
    for (let tentativa = 1; tentativa <= maxTentativas; tentativa++) {
        try {
            console.log(`📧 Tentativa ${tentativa}/${maxTentativas} - Buscando código 2FA...`);
            const codigo = await phpBridge.pegarCodigo2FA(30000);
            
            if (codigo && codigo.length === 6) {
                console.log(`✅ Código 2FA encontrado: ${codigo}`);
                return codigo;
            }
            
            console.log('⏳ Código não encontrado ainda, aguardando 5s...');
        } catch (error) {
            console.error("Erro ao pegar código 2FA:", error.message);
        }
        await sleep(5);
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
                } catch (error) {
                    console.log('Erro ao atualizar status:', error.message);
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
    
    const browser = await puppeteer.launch({
        headless: 'new',
        userDataDir: './profile-ze-v1',
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
    
    console.log('🌐 Navegando para https://seu.ze.delivery/home...');
    await page1.goto("https://seu.ze.delivery/home", { waitUntil: 'networkidle2', timeout: 60000 });
    console.log('📍 URL atual:', page1.url());

    if (page1.url().includes("login")) {
        console.log("🔑 Sessão expirada, fazendo login novamente...");
        try {
            await fazerLogin(page1);
            console.log("✅ Login concluído com sucesso!");
        } catch (loginError) {
            console.error("❌ Erro no login:", loginError.message);
            console.log("🔄 Reiniciando script em 30 segundos...");
            await sleep(30);
            process.exit(1); // Supervisor vai reiniciar
        }
    } else {
        console.log('✅ Sessão ativa, não precisa de login');
    }

    // PEGA COOKIES DE AUTENTICAÇÃO
    const cookies = await page1.cookies();
    console.log(`🍪 ${cookies.length} cookies capturados`);

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

    console.log('🚀 Iniciando scripts de monitoramento...');
    
    // AGORA, CADA ABA EXECUTA UM DOS SEUS SCRIPTS
    setTimeout(() => pedidoScript(page1), 3000);
    //itensScript(page2);  // aba 2
    //aceitaScript(browser, cookies); // aba 3
    setTimeout(() => serverScript(page4), 8000);
    setTimeout(() => statusScript(page5), 15000);
})().catch(err => {
    console.error('❌ [v1] Erro fatal:', err.message);
    process.exit(1);
});