/**
 * Integration Logger - Envia logs para Supabase REST API
 * 
 * OTIMIZADO: Debounce, cache, evita logs duplicados
 * Endpoint: POST https://uppkjvovtvlgwfciqrbt.supabase.co/rest/v1/integration_logs
 */

const https = require('https');

// Configuração do Supabase - Usando SERVICE_ROLE_KEY para garantir acesso
const SUPABASE_URL = 'https://uppkjvovtvlgwfciqrbt.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVwcGtqdm92dHZsZ3dmY2lxcmJ0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDMyNTY1OSwiZXhwIjoyMDg1OTAxNjU5fQ.stSPy2ST1hk3M3bvYT_QNGtEjbEN5NQyILsHF_dHyyM';

// ============================================
// CONFIGURAÇÕES DE DEBOUNCE/CACHE (OTIMIZADO)
// ============================================
const LOG_DEBOUNCE_MS = 30000;           // 30 segundos entre logs do mesmo tipo
const MAX_LOGS_PER_MINUTE = 10;          // Máximo 10 logs por minuto (reduzido para economizar)
const CACHE_CLEANUP_INTERVAL = 120000;   // Limpar cache a cada 2 minutos

// Cache para evitar logs duplicados
const logCache = {
  lastLogByType: new Map(),              // Último log por tipo de processo
  logCount: 0,                           // Contador de logs no minuto atual
  lastCountReset: Date.now(),            // Timestamp do último reset do contador
  recentMessages: new Set(),             // Mensagens recentes (para evitar duplicatas)
};

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
 * Verifica se pode enviar log (respeitando debounce e rate limit)
 */
function canSendLog(processType, message) {
    const now = Date.now();
    
    // Reset contador a cada minuto
    if (now - logCache.lastCountReset > 60000) {
        logCache.logCount = 0;
        logCache.lastCountReset = now;
        logCache.recentMessages.clear();
    }
    
    // Rate limit global
    if (logCache.logCount >= MAX_LOGS_PER_MINUTE) {
        console.log(`[LOG] Rate limit atingido (${MAX_LOGS_PER_MINUTE}/min)`);
        return false;
    }
    
    // Verificar debounce por tipo
    const lastLog = logCache.lastLogByType.get(processType) || 0;
    if (now - lastLog < LOG_DEBOUNCE_MS) {
        console.log(`[LOG] Debounce ativo para ${processType}`);
        return false;
    }
    
    // Verificar se mensagem é duplicata
    const messageKey = `${processType}:${message}`;
    if (logCache.recentMessages.has(messageKey)) {
        console.log(`[LOG] Mensagem duplicada ignorada`);
        return false;
    }
    
    // Atualizar cache
    logCache.lastLogByType.set(processType, now);
    logCache.logCount++;
    logCache.recentMessages.add(messageKey);
    
    return true;
}

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
 * Cria novo log de integração (COM DEBOUNCE)
 * @returns {string|null} process_id para atualizações
 */
async function createLog(processType, status, message, errorMessage = null, metadata = {}) {
    // Verificar debounce/rate limit
    if (!canSendLog(processType, message)) {
        return null;
    }
    
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
 * Inicia processo (COM DEBOUNCE)
 */
async function startProcess(processType, message, metadata = {}) {
    if (!canSendLog(processType, message)) {
        console.log(`[LOG] Iniciando (local): ${processType} - ${message}`);
        return null;
    }
    
    console.log(`[LOG] Iniciando: ${processType} - ${message}`);
    return await createLog(processType, STATUS.IN_PROGRESS, message, null, metadata);
}

/**
 * Conclui processo
 */
async function completeProcess(processId, message, metadata = {}) {
    console.log(`[LOG] Concluído: ${message}`);
    if (processId) {
        await updateLog(processId, STATUS.COMPLETED, message, null, metadata);
    }
}

/**
 * Cancela processo
 */
async function cancelProcess(processId, message, errorMessage, metadata = {}) {
    console.log(`[LOG] Cancelado: ${message} - ${errorMessage}`);
    if (processId) {
        await updateLog(processId, STATUS.CANCELLED, message, errorMessage, metadata);
    }
}

/**
 * Log rápido (evento único) - COM DEBOUNCE
 */
async function logEvent(processType, status, message, metadata = {}) {
    if (!canSendLog(processType, message)) {
        console.log(`[LOG-LOCAL] ${processType}: ${message}`);
        return;
    }
    await createLog(processType, status, message, null, metadata);
}

// Limpar cache periodicamente
setInterval(() => {
    const now = Date.now();
    const expiry = now - 120000; // 2 minutos
    
    for (const [key, value] of logCache.lastLogByType) {
        if (value < expiry) {
            logCache.lastLogByType.delete(key);
        }
    }
    logCache.recentMessages.clear();
}, CACHE_CLEANUP_INTERVAL);

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
