/**
 * Supabase Push - Envia pedidos imediatamente para o Supabase
 * 
 * Este módulo é chamado pelo scraper após cada atualização de pedido
 * para garantir sincronização em tempo real (push), sem depender do sync-cron.js
 */

const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

// Configuração do Supabase
const SUPABASE_URL = process.env.LOVABLE_SUPABASE_URL || 'https://uppkjvovtvlgwfciqrbt.supabase.co';
const ZE_SYNC_KEY = process.env.LOVABLE_ZE_SYNC_KEY || 'ze-sync-2026-mmjjzahms6m1lxfwomn0q25kquc7eun8';

// Fila de pedidos para envio em batch (evita muitas requisições)
let pendingOrders = [];
let flushTimeout = null;
const BATCH_DELAY = 2000; // 2 segundos para agrupar pedidos

// Stats
const stats = {
    totalPushed: 0,
    totalErrors: 0,
    lastPush: null,
    lastError: null
};

/**
 * Mapeia status do MySQL para texto
 */
function getStatusText(status) {
    const statusMap = {
        0: 'Pendente',
        1: 'Entregue',
        2: 'Aceito',
        3: 'A Caminho',
        4: 'Cancelado',
        5: 'Rejeitado'
    };
    return statusMap[parseInt(status)] || 'Desconhecido';
}

/**
 * Formata data para ISO sem timezone
 */
function formatLocalTime(dateValue) {
    if (!dateValue) return null;
    if (typeof dateValue === 'string') {
        return dateValue.replace(/\.000Z$/, '').replace(/Z$/, '');
    }
    if (dateValue instanceof Date) {
        return dateValue.toISOString().replace(/\.000Z$/, '').replace(/Z$/, '');
    }
    return String(dateValue);
}

/**
 * Formata pedido para o padrão esperado pela Edge Function
 */
function formatOrderForSupabase(order) {
    const timestamp = new Date().toISOString();
    
    // Formatar itens se existirem
    const itensFormatados = (order.items || order.itens || []).map(item => ({
        id: item.id || item.delivery_itens_id,
        nome: item.nome || item.name || item.delivery_itens_descricao,
        quantidade: item.quantidade || item.quantity || item.delivery_itens_qtd || 1,
        preco_unitario: parseFloat(item.preco_unitario || item.unit_price || item.delivery_itens_valor_unitario) || 0,
        preco_total: parseFloat(item.preco_total || item.total_price || item.delivery_itens_valor_total) || 0,
        codigo_ze: item.codigo_ze || item.sku || '',
        imagem: item.imagem || item.image_url || ''
    }));

    return {
        // IDs
        id_local: order.delivery_id || order.id_local,
        external_id: order.delivery_code || order.orderNumber || order.external_id,
        order_number: order.delivery_code || order.orderNumber || order.order_number,
        delivery_code: order.delivery_codigo_entrega || order.pickupCode || '',
        pickup_code: order.delivery_codigo_entrega || order.pickupCode || '',
        ide: order.delivery_ide || order.ide || '',
        delivery_id: order.delivery_id || order.id_local,
        
        // Cliente
        customer_name: order.delivery_name_cliente || order.customerName || order.customer_name || '',
        customer_cpf: order.delivery_cpf_cliente || order.cpf || order.customer_cpf || '',
        customer_phone: order.delivery_telefone || order.customerPhone || order.customer_phone || null,
        
        // Endereço
        address: order.delivery_endereco_rota || order.address || '',
        address_complement: order.delivery_endereco_complemento || order.address_complement || '',
        address_neighborhood: order.delivery_endereco_bairro || order.address_neighborhood || '',
        address_city: order.delivery_endereco_cidade_uf || order.address_city || '',
        address_zip: order.delivery_endereco_cep || order.address_zip || '',
        
        // Status
        status: parseInt(order.delivery_status || order.status) || 0,
        delivery_status: parseInt(order.delivery_status || order.status) || 0,
        status_text: getStatusText(order.delivery_status || order.status),
        
        // Datas
        created_at: formatLocalTime(order.delivery_date_time || order.orderDateTime || order.created_at),
        delivery_date_time: formatLocalTime(order.delivery_date_time || order.orderDateTime),
        order_datetime: formatLocalTime(order.delivery_date_time || order.orderDateTime),
        captured_at: formatLocalTime(order.delivery_data_hora_captura || order.captured_at),
        
        // Valores financeiros
        subtotal: parseFloat(order.delivery_subtotal || order.subtotal) || 0,
        delivery_subtotal: parseFloat(order.delivery_subtotal || order.subtotal) || 0,
        discount: parseFloat(order.delivery_desconto || order.discount) || 0,
        delivery_desconto: parseFloat(order.delivery_desconto || order.discount) || 0,
        discount_description: order.delivery_desconto_descricao || order.discount_description || null,
        coupon_description: order.delivery_desconto_descricao || order.coupon_description || null,
        delivery_fee: parseFloat(order.delivery_frete || order.delivery_fee) || 0,
        delivery_frete: parseFloat(order.delivery_frete || order.delivery_fee) || 0,
        total: parseFloat(order.delivery_total || order.total) || 0,
        delivery_total: parseFloat(order.delivery_total || order.total) || 0,
        convenience_fee: parseFloat(order.delivery_taxa_conveniencia || order.convenience_fee) || 0,
        
        // Pagamento
        payment_method: order.delivery_forma_pagamento || order.paymentType || order.payment_method || '',
        delivery_forma_pagamento: order.delivery_forma_pagamento || order.paymentType || '',
        change_for: parseFloat(order.delivery_troco_para || order.change_for) || 0,
        change: parseFloat(order.delivery_troco || order.change) || 0,
        
        // Tipo e entrega
        delivery_type: order.delivery_tipo_pedido || order.deliveryType || order.delivery_type || 'Pedido Comum',
        delivery_tipo_pedido: order.delivery_tipo_pedido || order.deliveryType || 'Pedido Comum',
        courier_email: order.delivery_email_entregador || order.delivererEmail || order.courier_email || null,
        delivery_email_entregador: order.delivery_email_entregador || order.delivererEmail || null,
        
        // Notas
        notes: order.delivery_obs || order.notes || '',
        
        // Itens
        items: itensFormatados,
        itens: itensFormatados,
        items_json: JSON.stringify(itensFormatados),
        items_count: itensFormatados.length,
        has_items: itensFormatados.length > 0,
        
        // Metadata
        source: 'ze-delivery',
        synced_at: timestamp,
        push_immediate: true // Flag para indicar que foi push imediato
    };
}

/**
 * Envia pedidos para o Supabase via Edge Function
 */
async function pushToSupabase(orders) {
    if (!orders || orders.length === 0) return { success: true, count: 0 };
    
    const timestamp = new Date().toISOString();
    
    // Formatar todos os pedidos
    const pedidosFormatados = orders.map(formatOrderForSupabase);
    
    const payload = {
        pedidos: pedidosFormatados,
        source: 'gamatauri-ze-push',
        timestamp: timestamp,
        force_update: true,
        is_push: true // Indica que é push imediato, não sync periódico
    };
    
    console.log(`📤 [PUSH] Enviando ${pedidosFormatados.length} pedido(s) para Supabase...`);
    
    try {
        const response = await fetch(
            `${SUPABASE_URL}/functions/v1/ze-sync-mysql`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${ZE_SYNC_KEY}`,
                    'x-api-key': ZE_SYNC_KEY,
                },
                body: JSON.stringify(payload),
                timeout: 30000
            }
        );
        
        if (response.ok) {
            const result = await response.json();
            console.log(`✅ [PUSH] Sucesso! ${pedidosFormatados.length} pedido(s) sincronizado(s)`);
            
            stats.totalPushed += pedidosFormatados.length;
            stats.lastPush = timestamp;
            
            // Salvar log de sucesso
            const logEntry = {
                timestamp,
                action: 'push',
                count: pedidosFormatados.length,
                orders: pedidosFormatados.map(p => p.order_number),
                result
            };
            
            try {
                const logFile = '/app/logs/supabase-push.log';
                fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n');
            } catch (e) {}
            
            return { success: true, count: pedidosFormatados.length, result };
        } else {
            const error = await response.text();
            console.error(`❌ [PUSH] Erro ${response.status}: ${error}`);
            
            stats.totalErrors++;
            stats.lastError = { timestamp, status: response.status, error };
            
            return { success: false, error, status: response.status };
        }
    } catch (err) {
        console.error(`❌ [PUSH] Erro de conexão: ${err.message}`);
        
        stats.totalErrors++;
        stats.lastError = { timestamp, error: err.message };
        
        return { success: false, error: err.message };
    }
}

/**
 * Adiciona pedido à fila de push (com debounce para agrupar)
 */
function queueOrderForPush(order) {
    // Adicionar à fila
    pendingOrders.push(order);
    
    console.log(`📋 [PUSH] Pedido ${order.delivery_code || order.orderNumber} adicionado à fila (${pendingOrders.length} pendentes)`);
    
    // Resetar timeout se já existir
    if (flushTimeout) {
        clearTimeout(flushTimeout);
    }
    
    // Agendar flush
    flushTimeout = setTimeout(flushPendingOrders, BATCH_DELAY);
}

/**
 * Envia todos os pedidos pendentes
 */
async function flushPendingOrders() {
    if (pendingOrders.length === 0) return;
    
    const ordersToSend = [...pendingOrders];
    pendingOrders = [];
    flushTimeout = null;
    
    await pushToSupabase(ordersToSend);
}

/**
 * Push imediato de um único pedido (sem fila)
 */
async function pushOrderImmediate(order) {
    return await pushToSupabase([order]);
}

/**
 * Retorna estatísticas do módulo
 */
function getStats() {
    return {
        ...stats,
        pendingCount: pendingOrders.length
    };
}

module.exports = {
    pushToSupabase,
    queueOrderForPush,
    pushOrderImmediate,
    flushPendingOrders,
    formatOrderForSupabase,
    getStats
};
