// Wrapper que injeta --no-sandbox nos scripts v1.js e v1-itens.js
// Sem modificar os arquivos originais

const Module = require('module');
const originalRequire = Module.prototype.require;

// Patchar o puppeteer para adicionar --no-sandbox automaticamente
Module.prototype.require = function(path) {
    const result = originalRequire.apply(this, arguments);
    
    if (path === 'puppeteer') {
        const originalLaunch = result.launch;
        result.launch = async function(options = {}) {
            options.args = options.args || [];
            if (!options.args.includes('--no-sandbox')) {
                options.args.push('--no-sandbox');
            }
            if (!options.args.includes('--disable-setuid-sandbox')) {
                options.args.push('--disable-setuid-sandbox');
            }
            if (!options.args.includes('--disable-dev-shm-usage')) {
                options.args.push('--disable-dev-shm-usage');
            }
            // Usar chromium do sistema
            options.executablePath = options.executablePath || '/usr/bin/chromium';
            
            console.log('[WRAPPER] Puppeteer launch with args:', options.args.join(' '));
            return originalLaunch.call(this, options);
        };
    }
    
    return result;
};

// Carregar o script original
const scriptPath = process.argv[2] || 'v1.js';
console.log(`[WRAPPER] Loading ${scriptPath} with no-sandbox patch...`);
require(`./${scriptPath}`);
