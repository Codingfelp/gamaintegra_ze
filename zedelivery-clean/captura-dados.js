/**
 * Módulo de captura de dados do Zé Delivery
 * Usa a área de impressão (#print-content) como fonte primária
 */

async function capturarDadosPedido(page) {
    // Aguardar a página carregar completamente
    await page.waitForSelector('#print-content', { timeout: 10000 }).catch(() => {});
    
    // Capturar todos os dados da área de impressão (texto plano, sem Shadow DOM)
    const dados = await page.evaluate(() => {
        const resultado = {
            codigoColeta: '',
            tipoPedido: '',
            bairro: '',
            endereco: '',
            complemento: '',
            cliente: '',
            itens: [],
            subtotal: '',
            frete: '',
            desconto: '',
            total: ''
        };
        
        // 1. CÓDIGO DE COLETA
        const coletaP = document.querySelector('#print-content .css-1k3cr89');
        if (coletaP) {
            const span = coletaP.querySelector('span');
            if (span) resultado.codigoColeta = span.textContent.trim();
        }
        
        // 2. TIPO DO PEDIDO
        const tipoEl = document.querySelector('[data-testid="delivery-type-label"]');
        if (tipoEl) {
            const texto = tipoEl.textContent.trim().toLowerCase();
            if (texto.includes('comum') || texto === 'comum') resultado.tipoPedido = 'Pedido Comum';
            else if (texto.includes('turbo')) resultado.tipoPedido = 'Pedido Turbo';
            else if (texto.includes('retirada') || texto.includes('pickup')) resultado.tipoPedido = 'Pedido Retirada';
            else resultado.tipoPedido = tipoEl.textContent.trim();
        }
        
        // 3. BAIRRO
        const bairroEl = document.querySelector('#neighborhood-info');
        if (bairroEl) resultado.bairro = bairroEl.textContent.trim();
        
        // 4. ENDEREÇO
        const enderecoEl = document.querySelector('#main-street');
        if (enderecoEl) resultado.endereco = enderecoEl.textContent.trim();
        
        // 5. COMPLEMENTO - elemento após main-street
        const customerInfo = document.querySelector('#receipt-customer-info');
        if (customerInfo) {
            const enderecoP = customerInfo.querySelectorAll('p')[1]; // Segundo <p>
            if (enderecoP) {
                const spans = enderecoP.querySelectorAll('span');
                if (spans.length >= 2) {
                    resultado.complemento = spans[1].textContent.trim();
                }
            }
        }
        
        // 6. CLIENTE
        const clienteEl = document.querySelector('#print-customer-name');
        if (clienteEl) resultado.cliente = clienteEl.textContent.trim();
        
        // 7. ITENS DO PEDIDO
        const itensContainer = document.querySelectorAll('#bought-items [data-testid="bought-items"]');
        itensContainer.forEach(item => {
            const qtdEl = item.querySelector('#item-quantity');
            const nomeEl = item.querySelector('#item-name');
            const precoEl = item.querySelector('#item-price span');
            
            const quantidade = qtdEl ? qtdEl.textContent.trim() : '1';
            const nome = nomeEl ? nomeEl.textContent.trim() : '';
            let preco = precoEl ? precoEl.textContent.trim() : '';
            preco = preco.replace('R$', '').replace(/\s/g, '').replace(',', '.').trim();
            
            // Extrair ID do item
            const idMatch = item.id?.match(/item-(\d+)/);
            const id = idMatch ? idMatch[1] : '';
            
            if (nome) {
                resultado.itens.push({ id, nome, quantidade, preco });
            }
        });
        
        // 8. VALORES FINANCEIROS
        const subtotalEl = document.querySelector('#payment-details-subtotal span:last-child');
        if (subtotalEl) {
            resultado.subtotal = subtotalEl.textContent.replace('R$', '').replace(/\s/g, '').replace(',', '.').trim();
        }
        
        const freteEl = document.querySelector('#payment-details-freight span:last-child');
        if (freteEl) {
            resultado.frete = freteEl.textContent.replace('R$', '').replace(/\s/g, '').replace(',', '.').trim();
        }
        
        const descontoEl = document.querySelector('#payment-details-discount span:last-child');
        if (descontoEl) {
            let desc = descontoEl.textContent.replace('R$', '').replace(/\s/g, '').replace(',', '.').trim();
            desc = desc.replace('-', '').trim();
            resultado.desconto = desc;
        }
        
        const totalEl = document.querySelector('#payment-details-total span strong span');
        if (totalEl) {
            resultado.total = totalEl.textContent.replace('R$', '').replace(/\s/g, '').replace(',', '.').trim();
        }
        
        return resultado;
    });
    
    return dados;
}

module.exports = { capturarDadosPedido };
