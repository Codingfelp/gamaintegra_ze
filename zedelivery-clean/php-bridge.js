/**
 * PHP Bridge - Chama scripts PHP via CLI (não HTTP)
 * 
 * HARDENED:
 * - Validação de ambiente antes de executar
 * - Arquivo temporário ao invés de php -r
 * - Timeout configurável
 * - Tratamento de erro robusto
 */

const { exec, execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const PHP_DIR = '/app/integrador/zeduplo';
const TOKEN = 'e8194a871a0e6d26fe620d13f7baad86';

// Cache do status do PHP (válido por 60 segundos)
let phpEnvCache = { valid: false, timestamp: 0, curl: false };
const CACHE_TTL = 60000;

/**
 * Verifica se o ambiente PHP está corretamente configurado
 * MIGRADO: Agora verifica cURL (usado pela Gmail API) ao invés de IMAP
 * @returns {Promise<{ok: boolean, curl: boolean, error?: string}>}
 */
async function checkPhpEnv() {
    const now = Date.now();
    
    // Usar cache se válido
    if (phpEnvCache.valid && (now - phpEnvCache.timestamp) < CACHE_TTL) {
        return { ok: phpEnvCache.curl, curl: phpEnvCache.curl };
    }
    
    return new Promise((resolve) => {
        // Verificar cURL (necessário para Gmail API)
        exec('php -r "echo extension_loaded(\'curl\') ? \'CURL_OK\' : \'CURL_FAIL\';"', 
            { timeout: 5000 }, 
            (error, stdout, stderr) => {
                const curl = stdout.includes('CURL_OK');
                
                // Atualizar cache
                phpEnvCache = { valid: true, timestamp: now, curl };
                
                if (error) {
                    resolve({ ok: false, curl: false, error: 'PHP not available' });
                } else if (!curl) {
                    resolve({ ok: false, curl: false, error: 'cURL extension not loaded' });
                } else {
                    resolve({ ok: true, curl: true });
                }
            }
        );
    });
}

/**
 * Executa script PHP via CLI usando arquivo wrapper
 * @param {string} script - Nome do script (ex: 'ze_pedido.php')
 * @param {object} getData - Dados para $_GET
 * @param {object} postData - Dados para $_POST
 * @param {number} timeout - Timeout em ms (default: 30000)
 * @returns {Promise<string>} - Output do PHP
 */
function execPhp(script, getData = {}, postData = {}, timeout = 30000) {
    return new Promise(async (resolve, reject) => {
        // Validar ambiente para scripts críticos (Gmail API usa cURL)
        if (script === 'ze_pedido_mail.php') {
            const env = await checkPhpEnv();
            if (!env.curl) {
                console.error(`⚠️ PHP cURL não disponível: ${env.error}`);
                return reject(new Error(`PHP environment error: ${env.error}`));
            }
        }
        
        // Criar arquivo temporário com o código PHP
        const tmpFile = path.join(os.tmpdir(), `php_bridge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.php`);
        
        // Serializar dados como JSON para evitar problemas de escaping
        const getDataJson = JSON.stringify({ ide: TOKEN, ...getData });
        const postDataJson = JSON.stringify(postData);
        
        const phpCode = `<?php
error_reporting(0);
set_time_limit(${Math.floor(timeout / 1000)});
chdir('${PHP_DIR}');

// Decodificar dados passados como argumentos
$_GET = json_decode($argv[1] ?? '{}', true) ?: [];
$_POST = json_decode($argv[2] ?? '{}', true) ?: [];

// Iniciar sessão se necessário
if (session_status() === PHP_SESSION_NONE) {
    @session_start();
}
$_SESSION['ambiente'] = '1';

ob_start();
include '${script}';
$output = ob_get_clean();
echo $output;
`;
        
        try {
            fs.writeFileSync(tmpFile, phpCode, 'utf8');
            
            // Escapar JSON para linha de comando
            const escapedGet = getDataJson.replace(/'/g, "'\\''");
            const escapedPost = postDataJson.replace(/'/g, "'\\''");
            
            const cmd = `php '${tmpFile}' '${escapedGet}' '${escapedPost}'`;
            
            exec(cmd, { 
                timeout, 
                maxBuffer: 1024 * 1024,
                cwd: PHP_DIR 
            }, (error, stdout, stderr) => {
                // Limpar arquivo temporário
                try { fs.unlinkSync(tmpFile); } catch (e) {}
                
                if (error && error.killed) {
                    reject(new Error(`PHP timeout: ${script}`));
                } else if (error) {
                    reject(new Error(`PHP error: ${stderr || error.message}`));
                } else {
                    resolve(stdout.trim());
                }
            });
        } catch (err) {
            // Limpar arquivo temporário em caso de erro
            try { fs.unlinkSync(tmpFile); } catch (e) {}
            reject(new Error(`PHP bridge error: ${err.message}`));
        }
    });
}

/**
 * Busca código 2FA do email (Gmail API OAuth 2.0)
 * MIGRADO: IMAP -> Gmail API
 * @param {number} timeout - Timeout em ms (default: 30000)
 * @returns {Promise<string|null>}
 */
async function pegarCodigo2FA(timeout = 30000) {
    try {
        // Verificar ambiente ANTES de tentar (Gmail API usa cURL)
        const env = await checkPhpEnv();
        if (!env.curl) {
            console.error('❌ cURL não disponível, pulando 2FA');
            return null;
        }
        
        console.log('📧 Buscando código 2FA via Gmail API...');
        const result = await execPhp('ze_pedido_mail.php', {}, {}, timeout);
        const cleanResult = result.replace(/^\uFEFF/, '').trim();
        if (!cleanResult) return null;
        
        const parsed = JSON.parse(cleanResult);
        
        // Verificar se houve erro
        if (parsed.erro) {
            console.error('❌ Erro na Gmail API:', parsed.msg);
            return null;
        }
        
        if (parsed.codigo && parsed.codigo !== 0 && parsed.codigo !== '0') {
            console.log('✅ Código 2FA encontrado via Gmail API');
            return String(parsed.codigo);
        }
        return null;
    } catch (error) {
        console.error('Erro ao pegar 2FA:', error.message);
        return null;
    }
}

/**
 * Insere pedido no banco
 * @param {object} orderData - Dados do pedido
 * @returns {Promise<object>}
 */
async function inserirPedido(orderData) {
    try {
        const result = await execPhp('ze_pedido.php', {}, orderData, 30000);
        console.log('PHP ze_pedido.php resultado:', result ? result.substring(0, 200) : 'vazio');
        
        if (!result) return { success: true };
        
        const cleanResult = result.replace(/^\uFEFF/, '').trim();
        if (!cleanResult) return { success: true };
        
        try {
            return JSON.parse(cleanResult);
        } catch {
            return { success: true, raw: cleanResult };
        }
    } catch (error) {
        console.error('Erro ao inserir pedido:', error.message);
        return { error: error.message };
    }
}

/**
 * Atualiza dados de um pedido
 * @param {object} orderData - Dados para atualizar
 * @returns {Promise<string>}
 */
async function atualizarPedido(orderData) {
    try {
        // Garantir que orderData é um array
        const dataArray = Array.isArray(orderData) ? orderData : [orderData];
        const dataJson = JSON.stringify(dataArray);
        
        // Usar curl para enviar dados como php://input
        const result = await new Promise((resolve, reject) => {
            const cmd = `cd ${PHP_DIR} && echo '${dataJson.replace(/'/g, "'\\''")}' | php ze_pedido_view.php ide=${TOKEN}`;
            exec(cmd, { timeout: 30000, maxBuffer: 1024*1024, cwd: PHP_DIR }, (error, stdout, stderr) => {
                if (error && !stdout) {
                    console.error('PHP Error:', stderr);
                    reject(error);
                } else {
                    resolve(stdout || 'OK');
                }
            });
        });
        
        console.log('PHP ze_pedido_view.php resultado:', result ? result.substring(0, 200) : 'vazio');
        return result;
    } catch (error) {
        console.error('Erro ao atualizar pedido:', error.message);
        return '';
    }
}

/**
 * Busca próximo pedido para processar
 * @returns {Promise<string|null>}
 */
async function pegarProximoPedido() {
    try {
        const result = await execPhp('ze_pedido_id.php', { ide: TOKEN }, {}, 10000);
        const cleanResult = result.replace(/^\uFEFF/, '').trim();
        if (!cleanResult) return null;
        
        const parsed = JSON.parse(cleanResult);
        return parsed.id_pedido || null;
    } catch (error) {
        console.error('Erro ao pegar próximo pedido:', error.message);
        return null;
    }
}

/**
 * Busca próximo pedido para atualizar status
 * @returns {Promise<string|null>}
 */
async function pegarProximoPedidoStatus() {
    try {
        const result = await execPhp('ze_pedido_status.php', { ide: TOKEN }, {}, 10000);
        const cleanResult = result.replace(/^\uFEFF/, '').trim();
        if (!cleanResult) return null;
        
        const parsed = JSON.parse(cleanResult);
        return parsed.id_pedido || null;
    } catch (error) {
        console.error('Erro ao pegar próximo pedido status:', error.message);
        return null;
    }
}

/**
 * Atualiza apenas o status de um pedido
 * @param {object} orderData - Dados do status
 * @returns {Promise<string>}
 */
async function atualizarStatus(orderData) {
    try {
        const result = await execPhp('ze_pedido_view_status.php', {}, orderData, 30000);
        return result;
    } catch (error) {
        console.error('Erro ao atualizar status:', error.message);
        return '';
    }
}

/**
 * Executa SQL diretamente no banco via exec.php
 * @param {string} sql - Query SQL para executar
 * @returns {Promise<string>}
 */
async function executarSQL(sql) {
    try {
        const result = await execPhp('exec.php', {}, { senha: '123456', sql: sql }, 30000);
        console.log('SQL executado:', sql.substring(0, 80));
        return result;
    } catch (error) {
        console.error('Erro ao executar SQL:', error.message);
        return '';
    }
}

/**
 * Atualiza status de um pedido diretamente no banco
 * @param {string} deliveryCode - Código do pedido (sem espaços)
 * @param {string} statusCode - Código do status (0, 1, 2, 3, 4, 5)
 * @param {string} token - Token do hub
 * @returns {Promise<string>}
 */
async function atualizarStatusDireto(deliveryCode, statusCode, token, entregador = '') {
    let sql = `UPDATE delivery SET delivery_status = '${statusCode}'`;
    
    // Se tiver entregador, atualizar também
    if (entregador && entregador.trim() !== '') {
        // Escapar aspas simples para evitar SQL injection
        const entregadorEscaped = entregador.replace(/'/g, "''");
        sql += `, delivery_email_entregador = '${entregadorEscaped}'`;
    }
    
    sql += ` WHERE delivery_code = '${deliveryCode}' AND delivery_ide_hub_delivery = '${token}' LIMIT 1`;
    return await executarSQL(sql);
}

module.exports = {
    checkPhpEnv,
    execPhp,
    pegarCodigo2FA,
    inserirPedido,
    atualizarPedido,
    pegarProximoPedido,
    pegarProximoPedidoStatus,
    atualizarStatus,
    executarSQL,
    atualizarStatusDireto
};
