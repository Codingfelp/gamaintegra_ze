/**
 * Integration Logger - Envia logs para Supabase REST API
 * 
 * Endpoint: POST https://uppkjvovtvlgwfciqrbt.supabase.co/rest/v1/integration_logs
 */

const https = require('https');

// Configuração do Supabase
const SUPABASE_URL = 'https://uppkjvovtvlgwfciqrbt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVwcGtqdm92dHZsZ3dmY2lxcmJ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzMjU2NTksImV4cCI6MjA4NTkwMTY1OX0.JdCNg4RQBCdGslv1xVytXYp8mA347sTHp0RROqRqEiU';

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
    STATUS_UPDATE: 'status_update',
    ORDER_UPDATE: 'order_update',
    ORDER_CREATED: 'order_created'
};

/**
 * Envia requisição para Supabase REST API
 */
function supabaseRequest(method, endpoint, data = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(endpoint, SUPABASE_URL);
        
        const options = {
            hostname: url.hostname,
            port: 443,
            path: url.pathname + url.search,
            method: method,
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=representation'
            },
            timeout: 10000
        };
        
        const req = https.request(options, (res) => {
            let responseData = '';
            res.on('data', chunk => responseData += chunk);
            res.on('end', () => {
                try {
                    const parsed = responseData ? JSON.parse(responseData) : {};
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(Array.isArray(parsed) ? parsed[0] : parsed);
                    } else {
                        console.error(`[LOG] Supabase error ${res.statusCode}:`, responseData.substring(0, 200));
                        resolve(null);
                    }
                } catch (e) {
                    resolve(null);
                }
            });
        });
        
        req.on('error', (e) => {
            console.error('[LOG] Request error:', e.message);
            resolve(null);
        });
        
        req.on('timeout', () => {
            req.destroy();
            resolve(null);
        });
        
        if (data) {
            req.write(JSON.stringify(data));
        }
        req.end();
    });
}

/**
 * Cria novo log de integração
 * @returns {string|null} process_id para atualizações
 */
async function createLog(processType, status, message, errorMessage = null, metadata = {}) {
    const data = {
        process_type: processType,
        status: status,
        message: message,
        error_message: errorMessage,
        metadata: metadata,
        started_at: new Date().toISOString()
    };
    
    if (status === STATUS.COMPLETED) {
        data.completed_at = new Date().toISOString();
    }
    
    const result = await supabaseRequest('POST', '/rest/v1/integration_logs', data);
    
    if (result && result.process_id) {
        console.log(`[LOG] Processo criado: ${result.process_id}`);
        return result.process_id;
    }
    return null;
}

/**
 * Atualiza log existente
 */
async function updateLog(processId, status, message, errorMessage = null, metadata = {}) {
    if (!processId) return;
    
    const data = {
        status: status,
        message: message,
        error_message: errorMessage,
        metadata: metadata
    };
    
    if (status === STATUS.COMPLETED || status === STATUS.CANCELLED) {
        data.completed_at = new Date().toISOString();
    }
    
    await supabaseRequest('PATCH', `/rest/v1/integration_logs?process_id=eq.${processId}`, data);
}

/**
 * Inicia processo
 */
async function startProcess(processType, message, metadata = {}) {
    console.log(`[LOG] Iniciando: ${processType} - ${message}`);
    return await createLog(processType, STATUS.IN_PROGRESS, message, null, metadata);
}

/**
 * Conclui processo
 */
async function completeProcess(processId, message, metadata = {}) {
    console.log(`[LOG] Concluído: ${message}`);
    await updateLog(processId, STATUS.COMPLETED, message, null, metadata);
}

/**
 * Cancela processo
 */
async function cancelProcess(processId, message, errorMessage, metadata = {}) {
    console.log(`[LOG] Cancelado: ${message} - ${errorMessage}`);
    await updateLog(processId, STATUS.CANCELLED, message, errorMessage, metadata);
}

/**
 * Log rápido (evento único)
 */
async function logEvent(processType, status, message, metadata = {}) {
    await createLog(processType, status, message, null, metadata);
}

module.exports = {
    STATUS,
    PROCESS_TYPES,
    startProcess,
    completeProcess,
    cancelProcess,
    logEvent,
    createLog,
    updateLog,
    
    // Atalhos
    log: {
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
        },
        productSync: {
            start: (msg, meta) => startProcess(PROCESS_TYPES.PRODUCT_SYNC, msg, meta),
            complete: (id, msg, meta) => completeProcess(id, msg, meta),
            cancel: (id, msg, err, meta) => cancelProcess(id, msg, err, meta)
        }
    }
};
