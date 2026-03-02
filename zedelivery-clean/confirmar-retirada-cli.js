#!/usr/bin/env node
/**
 * CLI para Confirmar Retirada de Pedido
 * 
 * USO:
 * node confirmar-retirada-cli.js <order_id> <code>
 * 
 * EXEMPLO:
 * node confirmar-retirada-cli.js 472230265 1234
 * 
 * Este script é chamado pelo webhook /api/webhook/confirmar-retirada
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const { confirmPickup } = require('./confirm-pickup');
const path = require('path');
const fs = require('fs');

puppeteer.use(StealthPlugin());

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Argumentos da linha de comando
const orderId = process.argv[2];
const code = process.argv[3];

if (!orderId || !code) {
    console.error('USO: node confirmar-retirada-cli.js <order_id> <code>');
    console.error('EXEMPLO: node confirmar-retirada-cli.js 472230265 1234');
    process.exit(1);
}

if (code.length !== 4 || !/^\d{4}$/.test(code)) {
    console.error('ERRO: O código deve ter exatamente 4 dígitos numéricos');
    process.exit(1);
}

async function main() {
    console.log(`\n [CONFIRMAR-RETIRADA] Iniciando confirmação`);
    console.log(`   Pedido: #${orderId}`);
    console.log(`   Código: ${code}`);
    console.log(`   Data: ${new Date().toISOString()}\n`);
    
    let browser = null;
    
    try {
        // Verificar se já existe um browser rodando (do scraper principal)
        const profileDir = '/app/zedelivery-clean/profile-ze-confirma';
        
        // Criar diretório do perfil se não existir
        if (!fs.existsSync(profileDir)) {
            fs.mkdirSync(profileDir, { recursive: true });
        }
        
        // Lançar browser
        console.log(' Iniciando navegador...');
        browser = await puppeteer.launch({
            headless: 'new',
            executablePath: '/usr/bin/chromium',
            userDataDir: profileDir,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu',
                '--window-size=1920,1080'
            ]
        });
        
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });
        
        // Navegar para o Zé Delivery
        console.log(' Navegando para o Zé Delivery...');
        await page.goto('https://seuze.ze.delivery/poc-orders', {
            waitUntil: 'networkidle2',
            timeout: 60000
        });
        
        await sleep(3000);
        
        // Verificar se está logado
        const currentUrl = await page.url();
        if (currentUrl.includes('login') || currentUrl.includes('auth')) {
            console.error(' ERRO: Não está logado no Zé Delivery. Execute o scraper principal primeiro.');
            await browser.close();
            process.exit(1);
        }
        
        console.log(' Navegador pronto na página do kanban');
        
        // Executar confirmação de retirada
        const success = await confirmPickup(page, orderId, code);
        
        if (success) {
            console.log(`\n SUCESSO: Pedido #${orderId} confirmado com código ${code}`);
        } else {
            console.log(`\n FALHA: Não foi possível confirmar o pedido #${orderId}`);
        }
        
        // Fechar browser
        await browser.close();
        
        process.exit(success ? 0 : 1);
        
    } catch (error) {
        console.error(`\n ERRO: ${error.message}`);
        
        if (browser) {
            try {
                await browser.close();
            } catch (e) {}
        }
        
        process.exit(1);
    }
}

main();
