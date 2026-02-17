#!/usr/bin/env node
/**
 * Script para configurar sessão persistente do Zé Delivery
 * 
 * Este script abre um browser NÃO-headless para você fazer login manualmente.
 * Após o login, a sessão é salva e pode ser usada pelos scrapers.
 * 
 * Uso: node setup-session.js
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const USER_DATA_DIR = path.join(__dirname, 'chrome-session');
const COOKIES_FILE = path.join(__dirname, 'cookies.json');
const COOKIES_BACKUP_DIR = path.join(__dirname, 'cookies-backup');

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function prompt(question) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    
    return new Promise(resolve => {
        rl.question(question, answer => {
            rl.close();
            resolve(answer);
        });
    });
}

async function setupSession() {
    console.log('═══════════════════════════════════════════════════════');
    console.log('  CONFIGURAÇÃO DE SESSÃO DO ZÉ DELIVERY');
    console.log('═══════════════════════════════════════════════════════');
    console.log('');
    console.log('Um browser será aberto. Faça login manualmente no Zé Delivery.');
    console.log('Após fazer login com sucesso, digite "ok" no terminal.');
    console.log('');
    
    // Criar diretórios se não existirem
    if (!fs.existsSync(USER_DATA_DIR)) {
        fs.mkdirSync(USER_DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(COOKIES_BACKUP_DIR)) {
        fs.mkdirSync(COOKIES_BACKUP_DIR, { recursive: true });
    }
    
    // Abrir browser em modo visível
    const browser = await puppeteer.launch({
        executablePath: '/usr/bin/chromium',
        headless: false, // MODO VISÍVEL
        userDataDir: USER_DATA_DIR,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--start-maximized',
            '--disable-blink-features=AutomationControlled'
        ],
        defaultViewport: null
    });
    
    const page = await browser.newPage();
    
    // Remover detecção de automação
    await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });
    
    console.log('Navegando para o Zé Delivery...');
    await page.goto('https://seu.ze.delivery/login', { waitUntil: 'networkidle2', timeout: 60000 });
    
    console.log('');
    console.log('🔐 FAÇA LOGIN NO BROWSER QUE ABRIU');
    console.log('');
    
    // Aguardar o usuário fazer login
    await prompt('Pressione ENTER após fazer login com sucesso...');
    
    // Verificar se está logado
    const currentUrl = page.url();
    console.log(`URL atual: ${currentUrl}`);
    
    if (currentUrl.includes('login')) {
        console.log('⚠️ Ainda na página de login. Tentando novamente...');
        await prompt('Pressione ENTER quando estiver logado...');
    }
    
    // Extrair cookies
    console.log('Extraindo cookies...');
    const cookies = await page.cookies();
    
    if (cookies.length === 0) {
        console.log('❌ Nenhum cookie encontrado!');
        await browser.close();
        return;
    }
    
    console.log(`✅ ${cookies.length} cookies extraídos`);
    
    // Salvar cookies
    fs.writeFileSync(COOKIES_FILE, JSON.stringify(cookies, null, 2));
    console.log(`💾 Cookies salvos em ${COOKIES_FILE}`);
    
    // Salvar backups
    fs.writeFileSync(path.join(COOKIES_BACKUP_DIR, 'profile-ze-v1.json'), JSON.stringify(cookies, null, 2));
    fs.writeFileSync(path.join(COOKIES_BACKUP_DIR, 'profile-ze-v1-itens.json'), JSON.stringify(cookies, null, 2));
    console.log('💾 Backups salvos');
    
    // Verificar token
    const tokenCookie = cookies.find(c => c.name === 'seu_ze_access_token');
    if (tokenCookie) {
        console.log('✅ Token de acesso encontrado');
    } else {
        console.log('⚠️ Token de acesso NÃO encontrado - sessão pode não funcionar');
    }
    
    await browser.close();
    
    console.log('');
    console.log('═══════════════════════════════════════════════════════');
    console.log('  CONFIGURAÇÃO CONCLUÍDA!');
    console.log('═══════════════════════════════════════════════════════');
    console.log('');
    console.log('Reinicie os scrapers para usar a nova sessão:');
    console.log('  sudo supervisorctl restart ze-v1 ze-v1-itens');
    console.log('');
}

setupSession().catch(console.error);
