/**
 * Session Manager - Gerenciamento robusto de sessão para Zé Delivery
 * 
 * Funcionalidades:
 * - Salva cookies no banco MySQL (persistência)
 * - Restaura cookies salvos ao iniciar
 * - Detecta sessão expirada
 * - Re-login automático com 2FA
 * - Health checks periódicos
 */

const phpBridge = require('./php-bridge');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

// Configuração
const SESSION_TABLE = 'ze_session_cookies';
const PROFILE_NAME_V1 = 'profile-ze-v1';
const PROFILE_NAME_V1_ITENS = 'profile-ze-v1-itens';
const PHP_DIR = '/app/integrador/zeduplo';

/**
 * Executa script PHP de sessão
 * @param {string} action - Ação a executar (init, save, load, invalidate, check, update_check)
 * @param {string} profile - Nome do perfil
 * @param {string} cookies - JSON de cookies (para save)
 * @returns {Promise<object>}
 */
async function execSessionPHP(action, profile = '', cookies = '') {
    return new Promise((resolve, reject) => {
        const os = require('os');
        const tmpFile = path.join(os.tmpdir(), `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.json`);
        
        // Criar arquivo temporário com os dados
        const data = {
            action: action,
            profile: profile,
            cookies: cookies
        };
        
        try {
            fs.writeFileSync(tmpFile, JSON.stringify(data), 'utf8');
        } catch (err) {
            reject(new Error('Erro ao criar arquivo temporário: ' + err.message));
            return;
        }
        
        // PHP que lê do arquivo
        const cmd = `cd ${PHP_DIR} && php -r "
\\$data = json_decode(file_get_contents('${tmpFile}'), true);
\\$_GET['action'] = \\$data['action'];
\\$_GET['profile'] = \\$data['profile'];
if (!empty(\\$data['cookies'])) {
    \\$_POST['cookies'] = \\$data['cookies'];
}
include 'ze_session.php';
"`;
        
        exec(cmd, { timeout: 30000, maxBuffer: 5 * 1024 * 1024 }, (error, stdout, stderr) => {
            // Limpar arquivo temporário
            try { fs.unlinkSync(tmpFile); } catch (e) {}
            
            if (error && !stdout) {
                console.error('❌ [SESSION-PHP] Erro:', stderr || error.message);
                reject(error);
                return;
            }
            
            try {
                const result = JSON.parse(stdout.trim());
                resolve(result);
            } catch (parseError) {
                console.error('❌ [SESSION-PHP] Erro ao parsear resposta:', stdout);
                resolve({ success: false, message: 'Parse error', raw: stdout });
            }
        });
    });
}

/**
 * Inicializa a tabela de sessão no banco se não existir
 */
async function initSessionTable() {
    try {
        const result = await execSessionPHP('init');
        if (result.success) {
            console.log('✅ [SESSION] Tabela de sessão verificada/criada');
            return true;
        } else {
            console.error('❌ [SESSION] Erro ao criar tabela:', result.message);
            return false;
        }
    } catch (error) {
        console.error('❌ [SESSION] Erro ao criar tabela:', error.message);
        return false;
    }
}

/**
 * Salva cookies no banco de dados
 * @param {string} profileName - Nome do perfil (ex: 'profile-ze-v1')
 * @param {Array} cookies - Array de cookies do Puppeteer
 */
async function saveCookiesToDB(profileName, cookies) {
    if (!cookies || cookies.length === 0) {
        console.log('⚠️ [SESSION] Nenhum cookie para salvar');
        return false;
    }
    
    try {
        const cookiesJson = JSON.stringify(cookies);
        const result = await execSessionPHP('save', profileName, cookiesJson);
        
        if (result.success) {
            console.log(`✅ [SESSION] ${cookies.length} cookies salvos para ${profileName}`);
            return true;
        } else {
            console.error('❌ [SESSION] Erro ao salvar cookies:', result.message);
            return false;
        }
    } catch (error) {
        console.error('❌ [SESSION] Erro ao salvar cookies:', error.message);
        return false;
    }
}

/**
 * Carrega cookies do banco de dados
 * @param {string} profileName - Nome do perfil
 * @returns {Array|null} - Array de cookies ou null se não encontrado
 */
async function loadCookiesFromDB(profileName) {
    try {
        const result = await execSessionPHP('load', profileName);
        
        if (result.success && result.data && result.data.cookies_json) {
            try {
                const cookies = JSON.parse(result.data.cookies_json);
                console.log(`✅ [SESSION] ${cookies.length} cookies carregados para ${profileName}`);
                return cookies;
            } catch (parseError) {
                console.error('❌ [SESSION] Erro ao parsear cookies:', parseError.message);
                return null;
            }
        } else {
            console.log(`⚠️ [SESSION] Nenhum cookie encontrado para ${profileName}`);
            return null;
        }
    } catch (error) {
        console.error('❌ [SESSION] Erro ao carregar cookies:', error.message);
        return null;
    }
}

/**
 * Marca sessão como inválida no banco
 * @param {string} profileName - Nome do perfil
 */
async function invalidateSession(profileName) {
    try {
        const result = await execSessionPHP('invalidate', profileName);
        if (result.success) {
            console.log(`⚠️ [SESSION] Sessão invalidada para ${profileName}`);
            return true;
        } else {
            console.error('❌ [SESSION] Erro ao invalidar sessão:', result.message);
            return false;
        }
    } catch (error) {
        console.error('❌ [SESSION] Erro ao invalidar sessão:', error.message);
        return false;
    }
}

/**
 * Verifica se a sessão está ativa navegando para uma página protegida
 * @param {Page} page - Página do Puppeteer
 * @returns {boolean} - true se a sessão está ativa
 */
async function checkSessionHealth(page) {
    try {
        const currentUrl = page.url();
        
        // Se já está em uma página de login, sessão expirou
        if (currentUrl.includes('login')) {
            console.log('⚠️ [SESSION] Já está na página de login - sessão expirada');
            return false;
        }
        
        // Navegar para a home para verificar
        await page.goto('https://seu.ze.delivery/home', {
            waitUntil: 'networkidle2',
            timeout: 30000
        });
        
        const newUrl = page.url();
        
        if (newUrl.includes('login')) {
            console.log('⚠️ [SESSION] Redirecionado para login - sessão expirada');
            return false;
        }
        
        console.log('✅ [SESSION] Sessão ativa');
        return true;
    } catch (error) {
        console.error('❌ [SESSION] Erro ao verificar sessão:', error.message);
        return false;
    }
}

/**
 * Aplica cookies a uma página
 * @param {Page} page - Página do Puppeteer
 * @param {Array} cookies - Array de cookies
 */
async function applyCookies(page, cookies) {
    if (!cookies || cookies.length === 0) {
        return false;
    }
    
    try {
        // IMPORTANTE: Navegar primeiro para o domínio antes de aplicar cookies
        const currentUrl = page.url();
        if (!currentUrl.includes('ze.delivery')) {
            console.log('🌐 [SESSION] Navegando para domínio antes de aplicar cookies...');
            await page.goto('https://seu.ze.delivery/', {
                waitUntil: 'domcontentloaded',
                timeout: 30000
            });
        }
        
        // Filtrar cookies válidos
        const validCookies = cookies.filter(c => {
            // Remover cookies expirados
            if (c.expires && c.expires > 0 && c.expires < Date.now() / 1000) {
                return false;
            }
            // Também verificar expirationDate (formato diferente)
            if (c.expirationDate && c.expirationDate > 0 && c.expirationDate < Date.now() / 1000) {
                return false;
            }
            return c.name && c.value;
        });
        
        if (validCookies.length === 0) {
            console.log('⚠️ [SESSION] Todos os cookies estão expirados');
            return false;
        }
        
        // Normalizar cookies para formato Puppeteer
        const puppeteerCookies = validCookies.map(c => ({
            name: c.name,
            value: c.value,
            domain: c.domain || '.ze.delivery',
            path: c.path || '/',
            expires: c.expires || c.expirationDate || -1,
            httpOnly: c.httpOnly || false,
            secure: c.secure !== false,
            sameSite: c.sameSite === 'no_restriction' ? 'None' : (c.sameSite || 'Lax')
        }));
        
        await page.setCookie(...puppeteerCookies);
        console.log(`✅ [SESSION] ${puppeteerCookies.length} cookies aplicados`);
        return true;
    } catch (error) {
        console.error('❌ [SESSION] Erro ao aplicar cookies:', error.message);
        return false;
    }
}

/**
 * Exporta cookies de uma página
 * @param {Page} page - Página do Puppeteer
 * @returns {Array} - Array de cookies
 */
async function exportCookies(page) {
    try {
        const cookies = await page.cookies();
        console.log(`📤 [SESSION] ${cookies.length} cookies exportados`);
        return cookies;
    } catch (error) {
        console.error('❌ [SESSION] Erro ao exportar cookies:', error.message);
        return [];
    }
}

/**
 * Salva cookies também em arquivo local (backup)
 * @param {string} profileName - Nome do perfil
 * @param {Array} cookies - Array de cookies
 */
function saveCookiesToFile(profileName, cookies) {
    try {
        const cookiesDir = path.join(__dirname, 'cookies-backup');
        if (!fs.existsSync(cookiesDir)) {
            fs.mkdirSync(cookiesDir, { recursive: true });
        }
        
        const filePath = path.join(cookiesDir, `${profileName}.json`);
        fs.writeFileSync(filePath, JSON.stringify(cookies, null, 2));
        console.log(`💾 [SESSION] Cookies salvos em arquivo: ${filePath}`);
        return true;
    } catch (error) {
        console.error('❌ [SESSION] Erro ao salvar cookies em arquivo:', error.message);
        return false;
    }
}

/**
 * Carrega cookies de arquivo local (fallback)
 * @param {string} profileName - Nome do perfil
 * @returns {Array|null}
 */
function loadCookiesFromFile(profileName) {
    try {
        const filePath = path.join(__dirname, 'cookies-backup', `${profileName}.json`);
        if (!fs.existsSync(filePath)) {
            return null;
        }
        
        const data = fs.readFileSync(filePath, 'utf8');
        const cookies = JSON.parse(data);
        console.log(`📂 [SESSION] ${cookies.length} cookies carregados de arquivo`);
        return cookies;
    } catch (error) {
        console.error('❌ [SESSION] Erro ao carregar cookies de arquivo:', error.message);
        return null;
    }
}

/**
 * Processo completo de restauração de sessão
 * @param {Page} page - Página do Puppeteer
 * @param {string} profileName - Nome do perfil
 * @returns {boolean} - true se sessão foi restaurada com sucesso
 */
async function restoreSession(page, profileName) {
    console.log(`🔄 [SESSION] Tentando restaurar sessão para ${profileName}...`);
    
    // 1. Tentar carregar do banco
    let cookies = await loadCookiesFromDB(profileName);
    
    // 2. Fallback: carregar de arquivo
    if (!cookies || cookies.length === 0) {
        console.log('📂 [SESSION] Tentando carregar de arquivo local...');
        cookies = loadCookiesFromFile(profileName);
    }
    
    if (!cookies || cookies.length === 0) {
        console.log('⚠️ [SESSION] Nenhum cookie salvo encontrado');
        return false;
    }
    
    // 3. Aplicar cookies
    const applied = await applyCookies(page, cookies);
    if (!applied) {
        return false;
    }
    
    // 4. Verificar se sessão está ativa
    const isValid = await checkSessionHealth(page);
    
    if (!isValid) {
        console.log('⚠️ [SESSION] Cookies aplicados mas sessão não é válida');
        await invalidateSession(profileName);
        return false;
    }
    
    console.log('✅ [SESSION] Sessão restaurada com sucesso!');
    return true;
}

/**
 * Salva sessão atual (banco + arquivo)
 * @param {Page} page - Página do Puppeteer
 * @param {string} profileName - Nome do perfil
 */
async function saveSession(page, profileName) {
    const cookies = await exportCookies(page);
    
    if (cookies.length === 0) {
        console.log('⚠️ [SESSION] Nenhum cookie para salvar');
        return false;
    }
    
    // Salvar no banco
    await saveCookiesToDB(profileName, cookies);
    
    // Salvar em arquivo (backup)
    saveCookiesToFile(profileName, cookies);
    
    return true;
}

/**
 * Inicia health check periódico
 * @param {Page} page - Página do Puppeteer
 * @param {string} profileName - Nome do perfil
 * @param {Function} onSessionExpired - Callback quando sessão expira
 * @param {number} intervalMs - Intervalo entre checks (default: 5 minutos)
 */
function startHealthCheck(page, profileName, onSessionExpired, intervalMs = 300000) {
    console.log(`🏥 [SESSION] Iniciando health check a cada ${intervalMs/1000}s`);
    
    const checkInterval = setInterval(async () => {
        try {
            console.log('🏥 [SESSION] Executando health check...');
            
            // Salvar cookies atuais antes do check
            await saveSession(page, profileName);
            
            const isHealthy = await checkSessionHealth(page);
            
            if (!isHealthy) {
                console.log('❌ [SESSION] Sessão expirou! Notificando...');
                await invalidateSession(profileName);
                
                if (onSessionExpired) {
                    onSessionExpired();
                }
            } else {
                // Atualizar last_check no banco
                try {
                    await execSessionPHP('update_check', profileName);
                } catch (e) {
                    console.log('⚠️ [SESSION] Erro ao atualizar last_check:', e.message);
                }
            }
        } catch (error) {
            console.error('❌ [SESSION] Erro no health check:', error.message);
        }
    }, intervalMs);
    
    return checkInterval;
}

module.exports = {
    initSessionTable,
    saveCookiesToDB,
    loadCookiesFromDB,
    invalidateSession,
    checkSessionHealth,
    applyCookies,
    exportCookies,
    saveCookiesToFile,
    loadCookiesFromFile,
    restoreSession,
    saveSession,
    startHealthCheck,
    PROFILE_NAME_V1,
    PROFILE_NAME_V1_ITENS
};
