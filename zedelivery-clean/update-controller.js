/**
 * Update Controller - Controla frequência de updates e webhooks
 * 
 * REGRAS:
 * 1. Debounce de 5-10 segundos entre updates do mesmo pedido
 * 2. Só envia webhook quando status REALMENTE mudar
 * 3. Não fazer polling a cada segundo
 * 4. Cache de status para evitar updates duplicados
 */

// ============================================
// CONFIGURAÇÕES
// ============================================
const UPDATE_DEBOUNCE_MS = 8000;         // 8 segundos entre updates do mesmo pedido
const WEBHOOK_COOLDOWN_MS = 10000;       // 10 segundos entre webhooks do mesmo pedido
const STATUS_CACHE_TTL_MS = 60000;       // Cache de status válido por 60 segundos
const MIN_LOOP_INTERVAL_MS = 5000;       // Mínimo 5 segundos entre iterações de loop

// ============================================
// CACHE GLOBAL
// ============================================
const cache = {
    // Cache de status por pedido: { orderId: { status, entregador, timestamp } }
    orderStatus: new Map(),
    
    // Último update enviado por pedido: { orderId: timestamp }
    lastUpdate: new Map(),
    
    // Último webhook enviado por pedido: { orderId: timestamp }
    lastWebhook: new Map(),
    
    // Último tempo de iteração de cada loop
    lastLoopRun: new Map(),
};

// ============================================
// FUNÇÕES DE CONTROLE
// ============================================

/**
 * Verifica se o status do pedido realmente mudou
 * @returns {boolean} true se mudou, false se é igual ao cache
 */
function hasStatusChanged(orderId, newStatus, newEntregador = null) {
    const cached = cache.orderStatus.get(orderId);
    const now = Date.now();
    
    // Se não tem cache ou expirou, considerar como mudança
    if (!cached || (now - cached.timestamp > STATUS_CACHE_TTL_MS)) {
        cache.orderStatus.set(orderId, {
            status: newStatus,
            entregador: newEntregador,
            timestamp: now
        });
        return true;
    }
    
    // Verificar se realmente mudou
    const statusChanged = cached.status !== newStatus;
    const entregadorChanged = newEntregador && cached.entregador !== newEntregador;
    
    if (statusChanged || entregadorChanged) {
        cache.orderStatus.set(orderId, {
            status: newStatus,
            entregador: newEntregador,
            timestamp: now
        });
        console.log(`[UPDATE-CTRL] Pedido ${orderId}: status ${cached.status} -> ${newStatus}`);
        return true;
    }
    
    return false;
}

/**
 * Verifica se pode enviar update (respeitando debounce)
 * @returns {boolean} true se pode enviar, false se deve esperar
 */
function canSendUpdate(orderId) {
    const now = Date.now();
    const lastTime = cache.lastUpdate.get(orderId) || 0;
    
    if (now - lastTime < UPDATE_DEBOUNCE_MS) {
        const remaining = Math.ceil((UPDATE_DEBOUNCE_MS - (now - lastTime)) / 1000);
        console.log(`[UPDATE-CTRL] Debounce ativo para ${orderId}, aguarde ${remaining}s`);
        return false;
    }
    
    cache.lastUpdate.set(orderId, now);
    return true;
}

/**
 * Verifica se pode enviar webhook (respeitando cooldown)
 * @returns {boolean} true se pode enviar, false se deve esperar
 */
function canSendWebhook(orderId) {
    const now = Date.now();
    const lastTime = cache.lastWebhook.get(orderId) || 0;
    
    if (now - lastTime < WEBHOOK_COOLDOWN_MS) {
        console.log(`[UPDATE-CTRL] Webhook cooldown ativo para ${orderId}`);
        return false;
    }
    
    cache.lastWebhook.set(orderId, now);
    return true;
}

/**
 * Verifica se o loop pode executar (evita polling muito frequente)
 * @param {string} loopName - Nome identificador do loop
 * @param {number} minInterval - Intervalo mínimo em ms (default: MIN_LOOP_INTERVAL_MS)
 * @returns {boolean} true se pode executar, false se deve esperar
 */
function canRunLoop(loopName, minInterval = MIN_LOOP_INTERVAL_MS) {
    const now = Date.now();
    const lastTime = cache.lastLoopRun.get(loopName) || 0;
    
    if (now - lastTime < minInterval) {
        return false;
    }
    
    cache.lastLoopRun.set(loopName, now);
    return true;
}

/**
 * Wrapper para enviar update apenas se necessário
 * @param {string} orderId 
 * @param {string} newStatus 
 * @param {string} entregador 
 * @param {Function} updateFn - Função que faz o update real
 * @returns {Promise<boolean>} true se enviou, false se pulou
 */
async function sendUpdateIfChanged(orderId, newStatus, entregador, updateFn) {
    // 1. Verificar se status mudou
    if (!hasStatusChanged(orderId, newStatus, entregador)) {
        console.log(`[UPDATE-CTRL] Skip update ${orderId}: status não mudou`);
        return false;
    }
    
    // 2. Verificar debounce
    if (!canSendUpdate(orderId)) {
        return false;
    }
    
    // 3. Executar update
    try {
        await updateFn();
        console.log(`[UPDATE-CTRL] ✓ Update enviado para ${orderId}`);
        return true;
    } catch (error) {
        console.error(`[UPDATE-CTRL] Erro no update ${orderId}:`, error.message);
        return false;
    }
}

/**
 * Wrapper para enviar webhook apenas se necessário
 * @param {string} orderId 
 * @param {string} newStatus 
 * @param {Function} webhookFn - Função que envia o webhook
 * @returns {Promise<boolean>} true se enviou, false se pulou
 */
async function sendWebhookIfChanged(orderId, newStatus, webhookFn) {
    // 1. Verificar se status mudou (usa o mesmo cache)
    const cached = cache.orderStatus.get(orderId);
    if (cached && cached.status === newStatus) {
        console.log(`[UPDATE-CTRL] Skip webhook ${orderId}: status não mudou`);
        return false;
    }
    
    // 2. Verificar cooldown
    if (!canSendWebhook(orderId)) {
        return false;
    }
    
    // 3. Executar webhook
    try {
        await webhookFn();
        console.log(`[UPDATE-CTRL] ✓ Webhook enviado para ${orderId}`);
        return true;
    } catch (error) {
        console.error(`[UPDATE-CTRL] Erro no webhook ${orderId}:`, error.message);
        return false;
    }
}

/**
 * Limpa cache de pedidos antigos (executar periodicamente)
 */
function cleanupCache() {
    const now = Date.now();
    const maxAge = 10 * 60 * 1000; // 10 minutos
    
    for (const [key, value] of cache.orderStatus) {
        if (now - value.timestamp > maxAge) {
            cache.orderStatus.delete(key);
        }
    }
    
    for (const [key, value] of cache.lastUpdate) {
        if (now - value > maxAge) {
            cache.lastUpdate.delete(key);
        }
    }
    
    for (const [key, value] of cache.lastWebhook) {
        if (now - value > maxAge) {
            cache.lastWebhook.delete(key);
        }
    }
    
    console.log(`[UPDATE-CTRL] Cache limpo. Status: ${cache.orderStatus.size}, Updates: ${cache.lastUpdate.size}`);
}

/**
 * Retorna estatísticas do cache
 */
function getStats() {
    return {
        orderStatusCount: cache.orderStatus.size,
        lastUpdateCount: cache.lastUpdate.size,
        lastWebhookCount: cache.lastWebhook.size,
        config: {
            updateDebounceMs: UPDATE_DEBOUNCE_MS,
            webhookCooldownMs: WEBHOOK_COOLDOWN_MS,
            minLoopIntervalMs: MIN_LOOP_INTERVAL_MS
        }
    };
}

// Limpar cache automaticamente a cada 5 minutos
setInterval(cleanupCache, 5 * 60 * 1000);

module.exports = {
    // Funções principais
    hasStatusChanged,
    canSendUpdate,
    canSendWebhook,
    canRunLoop,
    sendUpdateIfChanged,
    sendWebhookIfChanged,
    cleanupCache,
    getStats,
    
    // Constantes (para uso externo se necessário)
    UPDATE_DEBOUNCE_MS,
    WEBHOOK_COOLDOWN_MS,
    MIN_LOOP_INTERVAL_MS,
    STATUS_CACHE_TTL_MS
};
