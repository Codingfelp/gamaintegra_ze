/**
 * Script para importar cookies manualmente do Zé Delivery
 * 
 * USO:
 * 1. Faça login no Zé Delivery no seu browser
 * 2. Abra o DevTools (F12) > Application > Cookies > https://seu.ze.delivery
 * 3. Exporte os cookies ou copie os valores necessários
 * 4. Execute: node import-cookies.js "JSON_DOS_COOKIES"
 * 
 * Ou use a extensão "EditThisCookie" para exportar cookies como JSON
 */

const fs = require('fs');
const path = require('path');
const sessionManager = require('./session-manager');

const COOKIES_FILE = path.join(__dirname, 'cookies.json');

// Cookies essenciais do Zé Delivery
const ESSENTIAL_COOKIES = [
    'is_authenticated',
    '_cls_v',
    '_cls_s',
    'rto',
    'visid_incap_',
    'nlbi_',
    'incap_ses_'
];

async function importCookies(cookiesJson) {
    try {
        let cookies;
        
        // Se passou como argumento
        if (cookiesJson) {
            cookies = JSON.parse(cookiesJson);
        } else {
            // Tentar ler de stdin
            console.log('Cole o JSON dos cookies e pressione Ctrl+D:');
            const stdin = fs.readFileSync(0, 'utf-8');
            cookies = JSON.parse(stdin.trim());
        }
        
        if (!Array.isArray(cookies)) {
            throw new Error('Cookies devem ser um array JSON');
        }
        
        console.log(`📥 Recebidos ${cookies.length} cookies`);
        
        // Validar cookies
        const validCookies = cookies.filter(c => {
            if (!c.name || !c.value) return false;
            // Verificar se não está expirado
            if (c.expires && c.expires > 0 && c.expires < Date.now() / 1000) {
                console.log(`   Cookie expirado: ${c.name}`);
                return false;
            }
            return true;
        });
        
        console.log(` ${validCookies.length} cookies válidos`);
        
        // Verificar cookies essenciais
        const hasEssential = ESSENTIAL_COOKIES.some(essential => 
            validCookies.some(c => c.name.includes(essential))
        );
        
        if (!hasEssential) {
            console.warn(' AVISO: Nenhum cookie essencial encontrado!');
            console.warn('   Cookies esperados:', ESSENTIAL_COOKIES.join(', '));
        }
        
        // Normalizar cookies para formato Puppeteer
        const puppeteerCookies = validCookies.map(c => ({
            name: c.name,
            value: c.value,
            domain: c.domain || '.ze.delivery',
            path: c.path || '/',
            expires: c.expires || c.expirationDate || -1,
            httpOnly: c.httpOnly || false,
            secure: c.secure || true,
            sameSite: c.sameSite || 'Lax'
        }));
        
        // Salvar em arquivo local
        fs.writeFileSync(COOKIES_FILE, JSON.stringify(puppeteerCookies, null, 2));
        console.log(` Cookies salvos em ${COOKIES_FILE}`);
        
        // Tentar salvar no banco
        try {
            await sessionManager.initSessionTable();
            await sessionManager.saveCookiesToDB('profile-ze-v1', puppeteerCookies);
            await sessionManager.saveCookiesToDB('profile-ze-v1-itens', puppeteerCookies);
            console.log(' Cookies salvos no banco de dados');
        } catch (dbError) {
            console.warn(' Não foi possível salvar no banco:', dbError.message);
        }
        
        console.log('\n SUCESSO! Reinicie os scrapers para usar os novos cookies:');
        console.log('   sudo supervisorctl restart ze-v1 ze-v1-itens');
        
    } catch (error) {
        console.error(' Erro:', error.message);
        process.exit(1);
    }
}

// Executar se chamado diretamente
if (require.main === module) {
    const arg = process.argv[2];
    importCookies(arg).catch(console.error);
}

module.exports = { importCookies };
