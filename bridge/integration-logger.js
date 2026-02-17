/**
 * Integration Logger - Envia logs de integração para Supabase Edge Function
 * 
 * Endpoint: POST https://uppkjvovtvlgwfciqrbt.supabase.co/functions/v1/integration-log-webhook
 * Autenticação: Header x-webhook-secret
 * 
 * Processos:
 * - product_sync: Sincronização de produtos
 * - order_accept: Aceite automático de pedidos
 * - order_scrape: Scraping de detalhes do pedido
 * - supabase_sync: Sincronização com Supabase
 * - status_update: Atualização de status de pedidos
 */

const https = require('https');
const http = require('http');
const url = require('url');

// Configuração do webhook
const WEBHOOK_URL = 'https://uppkjvovtvlgwfciqrbt.supabase.co/functions/v1/integration-log-webhook';
const WEBHOOK_SECRET = process.env.SUPABASE_WEBHOOK_SECRET || 'webhook_secret';

// Status possíveis
const STATUS = {
    NOT_STARTED: 'not_started',
    IN_PROGRESS: 'in_progress',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled'
};

// Tipos de processo
const PROCESS_TYPES = {
    PRODUCT_SYNC: 'product_sync',
    ORDER_ACCEPT: 'order_accept',
    ORDER_SCRAPE: 'order_scrape',
    SUPABASE_SYNC: 'supabase_sync',
    STATUS_UPDATE: 'status_update'
};

/**
 * Envia log para o webhook do Supabase
 * @param {Object} payload - Dados do log
 * @returns {Promise<Object>} Resposta do webhook (inclui process_id para atualizações)
 */
async function sendLog(payload) {
    return new Promise((resolve, reject) => {
        const parsedUrl = url.parse(WEBHOOK_URL);
        const data = JSON.stringify(payload);
        
        const options = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || 443,
            path: parsedUrl.path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data),
                'x-webhook-secret': WEBHOOK_SECRET,
                'x-api-key': WEBHOOK_SECRET
            },
            timeout: 10000
        };
        
        const protocol = parsedUrl.protocol === 'https:' ? https : http;
        
        const req = protocol.request(options, (res) => {
            let responseData = '';
            
            res.on('data', (chunk) => {
                responseData += chunk;
            });
            
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(responseData);
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(parsed);
                    } else {
                        console.error(`[INTEGRATION-LOG] Webhook retornou ${res.statusCode}:`, responseData);
                        resolve({ success: false, error: responseData, statusCode: res.statusCode });
                    }
                } catch (e) {
                    resolve({ success: false, raw: responseData, statusCode: res.statusCode });
                }
            });
        });
        
        req.on('error', (e) => {
            console.error('[INTEGRATION-LOG] Erro ao enviar log:', e.message);
            resolve({ success: false, error: e.message });
        });
        
        req.on('timeout', () => {
            req.destroy();
            console.error('[INTEGRATION-LOG] Timeout ao enviar log');
            resolve({ success: false, error: 'timeout' });
        });
        
        req.write(data);
        req.end();
    });
}

/**
 * Inicia um novo processo de integração
 * @param {string} processType - Tipo do processo (usar PROCESS_TYPES)
 * @param {string} message - Mensagem descritiva
 * @param {Object} metadata - Dados extras opcionais
 * @returns {Promise<string|null>} process_id para atualizações futuras
 */
async function startProcess(processType, message, metadata = {}) {
    console.log(`[INTEGRATION-LOG] Iniciando processo: ${processType} - ${message}`);
    
    const payload = {
        process_type: processType,
        status: STATUS.IN_PROGRESS,
        message: message,
        error_message: null,
        metadata: {
            ...metadata,
            started_at: new Date().toISOString(),
            hostname: require('os').hostname()
        }
    };
    
    const response = await sendLog(payload);
    
    if (response && response.process_id) {
        console.log(`[INTEGRATION-LOG] Processo criado: ${response.process_id}`);
        return response.process_id;
    }
    
    return null;
}

/**
 * Atualiza um processo existente
 * @param {string} processId - ID do processo retornado por startProcess
 * @param {string} status - Novo status (usar STATUS)
 * @param {string} message - Mensagem atualizada
 * @param {string|null} errorMessage - Mensagem de erro (se status = cancelled)
 * @param {Object} metadata - Dados extras opcionais
 */
async function updateProcess(processId, status, message, errorMessage = null, metadata = {}) {
    if (!processId) {
        console.warn('[INTEGRATION-LOG] Tentativa de atualizar processo sem ID');
        return;
    }
    
    console.log(`[INTEGRATION-LOG] Atualizando processo ${processId}: ${status} - ${message}`);
    
    const payload = {
        process_id: processId,
        status: status,
        message: message,
        error_message: errorMessage,
        metadata: {
            ...metadata,
            updated_at: new Date().toISOString()
        }
    };
    
    await sendLog(payload);
}

/**
 * Marca processo como concluído
 * @param {string} processId - ID do processo
 * @param {string} message - Mensagem de sucesso
 * @param {Object} metadata - Dados extras opcionais
 */
async function completeProcess(processId, message, metadata = {}) {
    await updateProcess(processId, STATUS.COMPLETED, message, null, {
        ...metadata,
        completed_at: new Date().toISOString()
    });
}

/**
 * Marca processo como cancelado/erro
 * @param {string} processId - ID do processo
 * @param {string} message - Mensagem de erro resumida
 * @param {string} errorMessage - Mensagem detalhada do erro
 * @param {Object} metadata - Dados extras opcionais
 */
async function cancelProcess(processId, message, errorMessage, metadata = {}) {
    await updateProcess(processId, STATUS.CANCELLED, message, errorMessage, {
        ...metadata,
        cancelled_at: new Date().toISOString()
    });
}

/**
 * Helper para logar um evento simples (sem criar processo)
 * @param {string} processType - Tipo do processo
 * @param {string} status - Status
 * @param {string} message - Mensagem
 * @param {Object} metadata - Dados extras
 */
async function logEvent(processType, status, message, metadata = {}) {
    const payload = {
        process_type: processType,
        status: status,
        message: message,
        error_message: null,
        metadata: {
            ...metadata,
            timestamp: new Date().toISOString()
        }
    };
    
    await sendLog(payload);
}

// Exportar módulo
module.exports = {
    // Constantes
    STATUS,
    PROCESS_TYPES,
    
    // Funções principais
    sendLog,
    startProcess,
    updateProcess,
    completeProcess,
    cancelProcess,
    logEvent,
    
    // Atalhos convenientes
    log: {
        productSync: {
            start: (msg, meta) => startProcess(PROCESS_TYPES.PRODUCT_SYNC, msg, meta),
            complete: (id, msg, meta) => completeProcess(id, msg, meta),
            cancel: (id, msg, err, meta) => cancelProcess(id, msg, err, meta)
        },
        orderAccept: {
            start: (msg, meta) => startProcess(PROCESS_TYPES.ORDER_ACCEPT, msg, meta),
            complete: (id, msg, meta) => completeProcess(id, msg, meta),
            cancel: (id, msg, err, meta) => cancelProcess(id, msg, err, meta)
        },
        orderScrape: {
            start: (msg, meta) => startProcess(PROCESS_TYPES.ORDER_SCRAPE, msg, meta),
            complete: (id, msg, meta) => completeProcess(id, msg, meta),
            cancel: (id, msg, err, meta) => cancelProcess(id, msg, err, meta)
        },
        supabaseSync: {
            start: (msg, meta) => startProcess(PROCESS_TYPES.SUPABASE_SYNC, msg, meta),
            complete: (id, msg, meta) => completeProcess(id, msg, meta),
            cancel: (id, msg, err, meta) => cancelProcess(id, msg, err, meta)
        },
        statusUpdate: {
            start: (msg, meta) => startProcess(PROCESS_TYPES.STATUS_UPDATE, msg, meta),
            complete: (id, msg, meta) => completeProcess(id, msg, meta),
            cancel: (id, msg, err, meta) => cancelProcess(id, msg, err, meta)
        }
    }
};
