/**
 * Serviço de Polling para Pedidos do Zé Delivery
 * 
 * Monitora novos pedidos via API oficial e executa ações automáticas:
 * - Aceite automático
 * - Salvamento no banco de dados local
 * - Sincronização com Supabase
 */

const zeApi = require('./ze-delivery-client');
const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// Configurações do banco
const DB_CONFIG = {
    host: process.env.DB_HOST || 'autorack.proxy.rlwy.net',
    port: parseInt(process.env.DB_PORT || '47941'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'vLyBCdisPwRKwcNYNAFGCwYbXBGVMxhD',
    database: process.env.DB_NAME || 'zedelivery'
};

// Estado do serviço
const STATS_FILE = path.join(__dirname, 'polling-stats.json');
let stats = {
    status: 'starting',
    lastPoll: null,
    totalPolls: 0,
    totalOrdersFound: 0,
    totalOrdersAccepted: 0,
    totalErrors: 0,
    recentOrders: [],
    errors: []
};

function loadStats() {
    try {
        if (fs.existsSync(STATS_FILE)) {
            stats = JSON.parse(fs.readFileSync(STATS_FILE, 'utf8'));
        }
    } catch (e) {}
}

function saveStats() {
    try {
        fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2));
    } catch (e) {}
}

/**
 * Mapeia status da API para código do banco local
 */
function mapStatusToCode(apiStatus) {
    const statusMap = {
        'CREATED': 0,      // Pendente
        'CONFIRMED': 2,    // Aceito
        'DISPATCHED': 3,   // A Caminho
        'DELIVERED': 1,    // Entregue
        'CANCELLED': 4,    // Cancelado
        'REJECTED': 5      // Rejeitado
    };
    return statusMap[apiStatus] || 0;
}

/**
 * Converte dados da API para formato do banco local
 */
function apiOrderToDbFormat(apiOrder) {
    return {
        delivery_code: apiOrder.orderNumber || apiOrder.orderDisplayId,
        delivery_name_cliente: apiOrder.customer?.name || '',
        delivery_telefone: apiOrder.customer?.phone || '',
        delivery_cpf_cliente: apiOrder.customer?.document || '',
        delivery_status: mapStatusToCode(apiOrder.status),
        delivery_date_time: apiOrder.createdAt ? new Date(apiOrder.createdAt) : new Date(),
        delivery_total: parseFloat(apiOrder.total?.amount || 0),
        delivery_subtotal: parseFloat(apiOrder.subtotal?.amount || 0),
        delivery_frete: parseFloat(apiOrder.deliveryFee?.amount || 0),
        delivery_desconto: parseFloat(apiOrder.discount?.amount || 0),
        delivery_forma_pagamento: apiOrder.payment?.method || '',
        delivery_tipo_pedido: apiOrder.deliveryType || 'delivery',
        delivery_endereco_rota: apiOrder.deliveryAddress?.street || '',
        delivery_endereco_complemento: apiOrder.deliveryAddress?.complement || '',
        delivery_endereco_bairro: apiOrder.deliveryAddress?.neighborhood || '',
        delivery_endereco_cidade_uf: `${apiOrder.deliveryAddress?.city || ''} - ${apiOrder.deliveryAddress?.state || ''}`,
        delivery_endereco_cep: apiOrder.deliveryAddress?.zipCode || '',
        delivery_codigo_entrega: apiOrder.pickupCode || '',
        delivery_obs: apiOrder.observations || '',
        delivery_email_entregador: apiOrder.courier?.email || '',
        delivery_tem_itens: apiOrder.items?.length > 0 ? 1 : 0,
        delivery_trash: 0
    };
}

/**
 * Salva pedido no banco de dados local
 */
async function saveOrderToDb(orderData) {
    let connection;
    try {
        connection = await mysql.createConnection(DB_CONFIG);
        
        // Verificar se pedido já existe
        const [existing] = await connection.execute(
            'SELECT delivery_id FROM delivery WHERE delivery_code = ?',
            [orderData.delivery_code]
        );
        
        if (existing.length > 0) {
            // Atualizar pedido existente
            const updateFields = Object.keys(orderData)
                .filter(k => k !== 'delivery_code')
                .map(k => `${k} = ?`)
                .join(', ');
            
            const updateValues = Object.keys(orderData)
                .filter(k => k !== 'delivery_code')
                .map(k => orderData[k]);
            
            await connection.execute(
                `UPDATE delivery SET ${updateFields} WHERE delivery_code = ?`,
                [...updateValues, orderData.delivery_code]
            );
            
            console.log(`📝 Pedido #${orderData.delivery_code} atualizado no banco`);
            return { action: 'updated', id: existing[0].delivery_id };
        } else {
            // Inserir novo pedido
            const fields = Object.keys(orderData).join(', ');
            const placeholders = Object.keys(orderData).map(() => '?').join(', ');
            const values = Object.values(orderData);
            
            const [result] = await connection.execute(
                `INSERT INTO delivery (${fields}) VALUES (${placeholders})`,
                values
            );
            
            console.log(`✅ Pedido #${orderData.delivery_code} inserido no banco (ID: ${result.insertId})`);
            return { action: 'inserted', id: result.insertId };
        }
    } finally {
        if (connection) await connection.end();
    }
}

/**
 * Salva itens do pedido
 */
async function saveOrderItems(orderCode, items) {
    if (!items || items.length === 0) return;
    
    let connection;
    try {
        connection = await mysql.createConnection(DB_CONFIG);
        
        // Buscar ID do pedido
        const [order] = await connection.execute(
            'SELECT delivery_id FROM delivery WHERE delivery_code = ?',
            [orderCode]
        );
        
        if (order.length === 0) return;
        
        const deliveryId = order[0].delivery_id;
        
        // Deletar itens antigos
        await connection.execute(
            'DELETE FROM delivery_itens WHERE delivery_itens_delivery = ?',
            [deliveryId]
        );
        
        // Inserir novos itens
        for (const item of items) {
            await connection.execute(
                `INSERT INTO delivery_itens 
                (delivery_itens_delivery, delivery_itens_descricao, delivery_itens_qtd, 
                 delivery_itens_valor_unitario, delivery_itens_valor_total, 
                 delivery_itens_ean, delivery_itens_link_imagem)
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    deliveryId,
                    item.name || item.description || '',
                    item.quantity || 1,
                    parseFloat(item.unitPrice?.amount || 0),
                    parseFloat(item.totalPrice?.amount || 0),
                    item.ean || item.sku || '',
                    item.imageUrl || ''
                ]
            );
        }
        
        console.log(`📦 ${items.length} item(s) salvos para pedido #${orderCode}`);
    } finally {
        if (connection) await connection.end();
    }
}

/**
 * Processa um pedido novo
 */
async function processNewOrder(order) {
    const orderNumber = order.orderNumber || order.orderDisplayId;
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📦 NOVO PEDIDO: #${orderNumber}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    
    try {
        // 1. Buscar detalhes completos do pedido
        let orderDetails;
        try {
            orderDetails = await zeApi.getOrderDetails(orderNumber);
        } catch (e) {
            console.log('⚠️ Não foi possível buscar detalhes extras, usando dados básicos');
            orderDetails = order;
        }
        
        // 2. Converter para formato do banco
        const dbOrder = apiOrderToDbFormat(orderDetails);
        
        // 3. Salvar no banco
        await saveOrderToDb(dbOrder);
        
        // 4. Salvar itens
        if (orderDetails.items) {
            await saveOrderItems(orderNumber, orderDetails.items);
        }
        
        // 5. Aceitar automaticamente (se configurado)
        if (zeApi.config.auto_accept) {
            const delay = zeApi.config.auto_accept_delay || 5;
            console.log(`⏳ Aguardando ${delay}s antes de aceitar...`);
            await new Promise(r => setTimeout(r, delay * 1000));
            
            await zeApi.acceptOrder(orderNumber, 30);
            
            // Atualizar status no banco
            let connection;
            try {
                connection = await mysql.createConnection(DB_CONFIG);
                await connection.execute(
                    'UPDATE delivery SET delivery_status = 2 WHERE delivery_code = ?',
                    [orderNumber]
                );
            } finally {
                if (connection) await connection.end();
            }
            
            stats.totalOrdersAccepted++;
        }
        
        // 6. Atualizar estatísticas
        stats.totalOrdersFound++;
        stats.recentOrders.unshift({
            orderNumber,
            customer: dbOrder.delivery_name_cliente,
            total: dbOrder.delivery_total,
            status: 'accepted',
            timestamp: new Date().toISOString()
        });
        
        // Manter apenas últimos 20
        if (stats.recentOrders.length > 20) {
            stats.recentOrders = stats.recentOrders.slice(0, 20);
        }
        
        console.log(`✅ Pedido #${orderNumber} processado com sucesso!`);
        console.log(`   Cliente: ${dbOrder.delivery_name_cliente}`);
        console.log(`   Total: R$ ${dbOrder.delivery_total.toFixed(2)}`);
        console.log(`   Telefone: ${dbOrder.delivery_telefone || '(não disponível)'}`);
        
        return { success: true, orderNumber };
        
    } catch (error) {
        console.error(`❌ Erro ao processar pedido #${orderNumber}:`, error.message);
        stats.totalErrors++;
        stats.errors.unshift({
            orderNumber,
            error: error.message,
            timestamp: new Date().toISOString()
        });
        if (stats.errors.length > 10) stats.errors = stats.errors.slice(0, 10);
        
        return { success: false, orderNumber, error: error.message };
    }
}

/**
 * Loop principal de polling
 */
async function startPolling() {
    loadStats();
    
    console.log('═══════════════════════════════════════════════════════');
    console.log('🚀 INICIANDO SERVIÇO DE POLLING - ZÉ DELIVERY API');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`⚙️ Intervalo de polling: ${zeApi.config.polling_interval}s`);
    console.log(`⚙️ Aceite automático: ${zeApi.config.auto_accept ? 'ATIVADO' : 'DESATIVADO'}`);
    console.log('═══════════════════════════════════════════════════════\n');
    
    // Autenticar primeiro
    try {
        await zeApi.authenticate();
    } catch (e) {
        console.error('❌ Falha na autenticação inicial:', e.message);
        console.log('⚠️ Configure as credenciais em ze-api-config.json ou variáveis de ambiente');
        stats.status = 'auth_failed';
        saveStats();
        return;
    }
    
    stats.status = 'running';
    stats.startTime = new Date().toISOString();
    
    // Loop de polling
    while (true) {
        try {
            stats.lastPoll = new Date().toISOString();
            stats.totalPolls++;
            
            // Buscar pedidos com status CREATED (novos)
            const newOrders = await zeApi.getOrders('CREATED');
            
            if (newOrders.length > 0) {
                console.log(`\n🔔 ${newOrders.length} PEDIDO(S) NOVO(S) ENCONTRADO(S)!`);
                
                for (const order of newOrders) {
                    await processNewOrder(order);
                }
            } else {
                // Log discreto a cada 10 polls
                if (stats.totalPolls % 10 === 0) {
                    console.log(`[${new Date().toLocaleTimeString()}] Aguardando pedidos... (polls: ${stats.totalPolls})`);
                }
            }
            
            // Também verificar pedidos confirmados para atualização de status
            const confirmedOrders = await zeApi.getOrders('CONFIRMED');
            for (const order of confirmedOrders) {
                const orderNumber = order.orderNumber || order.orderDisplayId;
                const dbOrder = apiOrderToDbFormat(order);
                await saveOrderToDb(dbOrder);
            }
            
            saveStats();
            
        } catch (error) {
            console.error('❌ Erro no polling:', error.message);
            stats.totalErrors++;
        }
        
        // Aguardar intervalo
        await new Promise(r => setTimeout(r, zeApi.config.polling_interval * 1000));
    }
}

// Executar se chamado diretamente
if (require.main === module) {
    startPolling().catch(console.error);
}

module.exports = {
    startPolling,
    processNewOrder,
    saveOrderToDb,
    stats
};
