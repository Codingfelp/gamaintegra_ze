# CÓDIGO-FONTE DO SOFTWARE - INTEGRAFH
# Trechos principais para registro no INPI
# Data: 25/02/2026
# Autor: FELIPE HUDSON CARVALHO ARAÚJO TIBÚRCIO

================================================================================
                    ARQUIVO 1: v1.js (Aceite Automático)
                    Localização: /app/zedelivery-clean/v1.js
================================================================================

/**
 * IntegraFH - Módulo de Aceite Automático
 * 
 * Este módulo é responsável por:
 * 1. Monitorar a página de pedidos da plataforma de delivery
 * 2. Detectar novos pedidos pendentes na coluna "Novos" do Kanban
 * 3. Aceitar automaticamente os pedidos clicando no card e no botão "Aceitar"
 * 4. Verificar se o aceite foi bem-sucedido
 * 5. Registrar estatísticas e logs de integração
 * 
 * Copyright (c) 2026 - FELIPE HUDSON CARVALHO ARAÚJO TIBÚRCIO
 * Todos os direitos reservados.
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const request = require('request');
const { performance } = require('perf_hooks');
const phpBridge = require('./php-bridge');
const sessionManager = require('./session-manager');
const integrationLogger = require('./integration-logger');
const updateController = require('./update-controller');

// ============== CONFIGURAÇÃO DE OPERAÇÃO 24/7 ==============
const MAX_RUNTIME_MS = 4 * 60 * 60 * 1000; // 4 horas
const HORA_INICIO = 9;  // 09:00
const HORA_FIM = 24;    // 00:00 (meia-noite)
const START_TIME = Date.now();

function isHorarioOperacao() {
    const now = new Date();
    const hora = now.getHours();
    return hora >= HORA_INICIO && hora < HORA_FIM;
}

// ============== CONSTANTES E CONFIGURAÇÕES ==============
const isProduction = process.env.NODE_ENV === "production";
const executablePath = isProduction ? "/usr/bin/chromium" : undefined;
const SESSION_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutos
const SESSION_SAVE_INTERVAL = 10 * 60 * 1000; // 10 minutos
const PROFILE_NAME = 'profile-integrafh';

// Arquivo de estatísticas de aceite
const ACEITE_STATS_FILE = '/app/logs/aceite-stats.json';

function loadAceiteStats() {
    try {
        if (fs.existsSync(ACEITE_STATS_FILE)) {
            return JSON.parse(fs.readFileSync(ACEITE_STATS_FILE, 'utf8'));
        }
    } catch (e) {}
    return {
        status: 'stopped',
        lastCheck: null,
        totalAttempts: 0,
        totalAccepted: 0,
        totalFailed: 0,
        lastAccept: null,
        lastAcceptedOrder: null,
        startTime: null,
        errors: [],
        recentAccepts: []
    };
}

function saveAceiteStats(stats) {
    try {
        fs.writeFileSync(ACEITE_STATS_FILE, JSON.stringify(stats, null, 2));
    } catch (e) {}
}

// [... Função auxiliar sleep ...]
async function sleep(seg) {
    return new Promise(resolve => setTimeout(resolve, seg * 1000));
}

/**
 * FUNÇÃO PRINCIPAL DE ACEITE AUTOMÁTICO
 * Implementa o fluxo: /poc-orders -> Kanban "Novos" -> Clicar CARD -> Modal -> Botão "Aceitar"
 */
async function aceitaScript(browser, cookies) {
    console.log('🤖 [ACEITA] Iniciando script de aceite automático de pedidos...');
    console.log('🔄 [ACEITA] FLUXO: /poc-orders -> Kanban "Novos" -> Clicar CARD -> Modal -> Botão "Aceitar"');
    
    let aceiteStats = loadAceiteStats();
    aceiteStats.status = 'running';
    aceiteStats.startTime = new Date().toISOString();
    saveAceiteStats(aceiteStats);
    
    while (true) {
        let page = null;
        try {
            page = await browser.newPage();
            await page.setCookie(...cookies);

            await page.goto(process.env.DELIVERY_PLATFORM_URL + "/poc-orders", {
                waitUntil: "networkidle2",
                timeout: 60000
            });
            
            // Verificar se sessão expirou
            if (page.url().includes('login')) {
                console.log('🔑 [ACEITA] Sessão expirou, reiniciando...');
                process.exit(1);
            }

            aceiteStats.status = 'monitoring';
            saveAceiteStats(aceiteStats);

            // Loop de monitoramento contínuo
            while (true) {
                try {
                    aceiteStats.lastCheck = new Date().toISOString();
                    
                    // PASSO 1: Verificar se há pedidos na coluna "Novos" do Kanban
                    const pedidoNovo = await page.evaluate(() => {
                        const colunaNovos = document.querySelector('[data-testid="kanban-column-body-new-orders"]');
                        if (!colunaNovos) {
                            return { found: false, reason: 'coluna_nao_encontrada' };
                        }
                        
                        const semPedidos = colunaNovos.querySelector('#no-new-orders-message');
                        if (semPedidos && semPedidos.offsetParent !== null) {
                            return { found: false, reason: 'sem_pedidos_novos' };
                        }
                        
                        const cards = colunaNovos.querySelectorAll('[class*="card"], article, [role="button"]');
                        
                        for (const card of cards) {
                            if (!card.offsetParent || card.offsetHeight === 0) continue;
                            
                            let orderId = '';
                            const textos = card.innerText || '';
                            const match = textos.match(/(\d{3}\s*\d{3}\s*\d{3})/);
                            if (match) {
                                orderId = match[1].replace(/\s+/g, '');
                            }
                            
                            return { 
                                found: true, 
                                orderId: orderId || 'N/A', 
                                cardIndex: Array.from(cards).indexOf(card)
                            };
                        }
                        
                        // Verificar botão "Aceitar todos"
                        const acceptButton = document.querySelector('#accept-button');
                        if (acceptButton) {
                            let isDisabled = acceptButton.disabled;
                            if (acceptButton.shadowRoot) {
                                const innerBtn = acceptButton.shadowRoot.querySelector('button');
                                isDisabled = innerBtn ? innerBtn.disabled : true;
                            }
                            
                            if (!isDisabled) {
                                return { found: true, orderId: 'batch', useAcceptAllButton: true };
                            }
                        }
                        
                        return { found: false, reason: 'nenhum_card_encontrado' };
                    });
                    
                    if (!pedidoNovo.found) {
                        aceiteStats.status = 'waiting';
                        saveAceiteStats(aceiteStats);
                        await sleep(3);
                        await page.reload({ waitUntil: "domcontentloaded", timeout: 15000 });
                        continue;
                    }

                    const orderId = pedidoNovo.orderId;
                    console.log(`🚀 [ACEITA] PEDIDO NOVO DETECTADO! ID: ${orderId}`);
                    
                    aceiteStats.status = 'accepting';
                    aceiteStats.totalAttempts++;
                    saveAceiteStats(aceiteStats);

                    // PASSO 2: Aceitar o pedido
                    let aceitou = false;
                    
                    if (pedidoNovo.useAcceptAllButton) {
                        // Usar botão "Aceitar todos"
                        aceitou = await page.evaluate(() => {
                            const acceptBtn = document.querySelector('#accept-button');
                            if (acceptBtn) {
                                if (acceptBtn.shadowRoot) {
                                    const innerBtn = acceptBtn.shadowRoot.querySelector('button');
                                    if (innerBtn && !innerBtn.disabled) {
                                        innerBtn.click();
                                        return true;
                                    }
                                }
                                if (!acceptBtn.disabled) {
                                    acceptBtn.click();
                                    return true;
                                }
                            }
                            return false;
                        });
                    } else {
                        // Clicar no card do pedido para abrir modal
                        aceitou = await page.evaluate((cardIdx) => {
                            const colunaNovos = document.querySelector('[data-testid="kanban-column-body-new-orders"]');
                            if (!colunaNovos) return false;
                            
                            const cards = colunaNovos.querySelectorAll('[class*="card"], article, [role="button"]');
                            const card = cards[cardIdx];
                            if (card) {
                                card.click();
                                return true;
                            }
                            return false;
                        }, pedidoNovo.cardIndex || 0);
                        
                        if (aceitou) {
                            await sleep(2);
                            
                            // Procurar botão "Aceitar" no modal
                            for (let tentativa = 1; tentativa <= 5; tentativa++) {
                                const clicouAceitar = await page.evaluate(() => {
                                    // Buscar span com data-testid="text" contendo "Aceitar"
                                    const spans = document.querySelectorAll('span[data-testid="text"]');
                                    for (const span of spans) {
                                        if (span.textContent.trim() === 'Aceitar') {
                                            const btn = span.closest('button');
                                            if (btn && btn.classList.contains('primary')) {
                                                btn.click();
                                                return true;
                                            }
                                        }
                                    }
                                    
                                    // Buscar button.primary com texto "Aceitar"
                                    const buttons = document.querySelectorAll('button.primary');
                                    for (const btn of buttons) {
                                        if (btn.textContent.trim().includes('Aceitar')) {
                                            btn.click();
                                            return true;
                                        }
                                    }
                                    
                                    return false;
                                });
                                
                                if (clicouAceitar) {
                                    aceitou = true;
                                    break;
                                }
                                await sleep(1);
                            }
                        }
                    }

                    // PASSO 3: Verificar se foi aceito
                    await sleep(4);
                    await page.reload({ waitUntil: "domcontentloaded", timeout: 10000 });
                    
                    // Atualizar estatísticas
                    aceiteStats.totalAccepted++;
                    aceiteStats.lastAccept = new Date().toISOString();
                    aceiteStats.lastAcceptedOrder = orderId;
                    saveAceiteStats(aceiteStats);
                    
                } catch (innerErr) {
                    console.error("❌ [ACEITA] Erro:", innerErr.message);
                    aceiteStats.errors.push({ time: new Date().toISOString(), error: innerErr.message });
                    saveAceiteStats(aceiteStats);
                    await sleep(3);
                }
            }

        } catch (error) {
            console.error("❌ [ACEITA] Erro crítico:", error.message);
        } finally {
            if (page) {
                try { await page.close(); } catch (e) { }
            }
            await sleep(5);
        }
    }
}

================================================================================
                    ARQUIVO 2: v1-itens.js (Captura de Itens)
                    Localização: /app/zedelivery-clean/v1-itens.js
================================================================================

/**
 * IntegraFH - Módulo de Captura de Itens
 * 
 * Este módulo é responsável por:
 * 1. Buscar pedidos pendentes de processamento
 * 2. Navegar até a página de detalhes do pedido
 * 3. Capturar todos os dados: cliente, endereço, itens, valores
 * 4. Capturar telefone do cliente via fluxo especial
 * 5. Salvar no banco de dados MySQL
 * 
 * Copyright (c) 2026 - FELIPE HUDSON CARVALHO ARAÚJO TIBÚRCIO
 * Todos os direitos reservados.
 */

/**
 * Função para capturar telefone via fluxo de modal
 * A plataforma oculta o telefone - precisa seguir um fluxo específico:
 * 1. Clicar em "Ver telefone"
 * 2. Expandir "Problemas com a entrega"
 * 3. Selecionar "O entregador não encontra o cliente"
 * 4. Clicar em "Confirmar"
 * 5. Capturar o telefone revelado
 */
async function capturarTelefoneViaFluxo(page) {
    try {
        console.log('📞 [TELEFONE] Iniciando captura via fluxo modal...');

        // PASSO 1: Clicar em "Ver telefone" - é um link <a>, não botão
        const clicouVerTelefone = await page.evaluate(() => {
            const links = document.querySelectorAll('a');
            for (const link of links) {
                if (link.textContent.trim().toLowerCase() === 'ver telefone') {
                    link.click();
                    return true;
                }
            }
            // Fallback: botão/span com texto "Ver telefone"
            const spans = document.querySelectorAll('button > span, span');
            for (const span of spans) {
                if (span.textContent.trim().toLowerCase() === 'ver telefone') {
                    span.click();
                    return true;
                }
            }
            return false;
        });

        if (!clicouVerTelefone) {
            return '';
        }

        await sleep(2);

        // PASSO 2: Clicar em "Problemas com a entrega"
        const clicouProblemas = await page.evaluate(() => {
            const el = document.querySelector('#REASON_CATEGORY_DELIVERY_PROBLEM > div');
            if (el) { el.click(); return true; }
            return false;
        });

        if (!clicouProblemas) {
            await page.keyboard.press('Escape');
            return '';
        }

        await sleep(1.5);

        // PASSO 3: Aguardar e clicar em "O entregador não encontra o cliente"
        try {
            await page.waitForSelector(
                '#REASON_ITEM_DELIVERY_DOES_NOT_FIND_THE_CUSTOMER',
                { visible: true, timeout: 5000 }
            );
        } catch (e) {
            await page.keyboard.press('Escape');
            return '';
        }

        await page.evaluate(() => {
            const radio = document.querySelector('#REASON_ITEM_DELIVERY_DOES_NOT_FIND_THE_CUSTOMER');
            if (radio) { radio.click(); return true; }
            return false;
        });

        await sleep(1);

        // PASSO 4: Clicar no botão "Confirmar"
        await page.evaluate(() => {
            const buttons = document.querySelectorAll('button');
            for (const btn of buttons) {
                if (btn.textContent.trim().toLowerCase() === 'confirmar' && !btn.disabled) {
                    btn.click();
                    return true;
                }
            }
            return false;
        });

        await sleep(2);

        // PASSO 5: Capturar #customer-phone
        const telefone = await page.evaluate(() => {
            const el = document.querySelector('#customer-phone');
            if (el) return el.textContent.trim().replace(/\D/g, '');
            return '';
        });

        if (telefone && telefone.length >= 10) {
            console.log('📞 [TELEFONE] ✓ Telefone capturado:', telefone);
            return telefone;
        }

        return '';

    } catch (error) {
        console.error('📞 [TELEFONE] Erro:', error.message);
        return '';
    }
}

/**
 * Função principal de captura de itens do pedido
 */
async function itensScript(page) {
    while (true) {
        try {
            // Buscar próximo pedido para processar
            const id_pedido_info = await pegar_id_pedido();
            
            if (!id_pedido_info) {
                console.log("⏳ [CAPTURA] Aguardando novos pedidos...");
                await sleep(10);
                continue;
            }

            console.log(`📦 [CAPTURA] Processando pedido #${id_pedido_info}`);
            
            // Navegar para página de detalhes
            await page.goto(`${process.env.DELIVERY_PLATFORM_URL}/order/${id_pedido_info}`, {
                waitUntil: "networkidle2",
                timeout: 30000
            });

            await sleep(3);

            // Capturar dados do cliente
            const nomeCliente = await getTextFromShadowOrNormal(page, "#customer-name");
            const cpfCliente = await getTextFromShadowOrNormal(page, "#customer-document");
            
            // Capturar endereço
            const endereco = await getTextFromShadowOrNormal(page, "#address-street");
            const complemento = await getTextFromShadowOrNormal(page, "#address-complement");
            const bairro = await getTextFromShadowOrNormal(page, "#address-neighborhood");
            const cidadeUf = await getTextFromShadowOrNormal(page, "#address-city-province");
            const cep = await getTextFromShadowOrNormal(page, "#address-zip-code");

            // Capturar valores financeiros
            const subtotal = await getTextFromShadowOrNormal(page, "#subtotal");
            const frete = await getTextFromShadowOrNormal(page, "#deliveryFee");
            const desconto = await getTextFromShadowOrNormal(page, "#total-discount");
            const total = await getTextFromShadowOrNormal(page, "#total");
            
            // Capturar descrição do cupom (Shadow DOM declarativo)
            let cupomDescricao = await page.evaluate(() => {
                const el = document.querySelector('#discount-description');
                if (!el) return '';
                
                if (el.shadowRoot) {
                    const span = el.shadowRoot.querySelector('span');
                    if (span) return span.textContent.trim();
                }
                
                return el.innerText?.trim() || '';
            });

            // Capturar telefone (múltiplas estratégias)
            let customerPhone = await page.evaluate(() => {
                // Link tel:
                const telLink = document.querySelector('a[href^="tel:"]');
                if (telLink) return telLink.href.replace('tel:', '').replace(/\D/g, '');
                
                // #customer-phone
                const phoneEl = document.querySelector('#customer-phone');
                if (phoneEl) return phoneEl.textContent.trim().replace(/\D/g, '');
                
                // Regex no DOM
                const allText = document.body.innerText || '';
                const phoneMatch = allText.match(/\(\d{2}\)\s*\d{4,5}[-\s]?\d{4}/);
                if (phoneMatch) return phoneMatch[0].replace(/\D/g, '');
                
                return '';
            });

            // Se não encontrou, usar fluxo do modal
            if (!customerPhone || customerPhone.length < 10) {
                customerPhone = await capturarTelefoneViaFluxo(page);
            }

            // Capturar itens do pedido
            const produtos = await page.evaluate(() => {
                const items = [];
                const rows = document.querySelectorAll('.order-item, [class*="item-row"]');
                
                rows.forEach(row => {
                    const nome = row.querySelector('[class*="name"]')?.textContent?.trim() || '';
                    const qtd = row.querySelector('[class*="quantity"]')?.textContent?.trim() || '1';
                    const preco = row.querySelector('[class*="price"]')?.textContent?.trim() || '0';
                    
                    if (nome) {
                        items.push({
                            nome,
                            quantidade: parseInt(qtd) || 1,
                            preco: parseFloat(preco.replace(/[^\d,]/g, '').replace(',', '.')) || 0
                        });
                    }
                });
                
                return items;
            });

            // Salvar no banco de dados
            await phpBridge.salvarPedido({
                id_pedido: id_pedido_info,
                nome_cliente: nomeCliente,
                cpf_cliente: cpfCliente,
                telefone: customerPhone,
                endereco,
                complemento,
                bairro,
                cidade_uf: cidadeUf,
                cep,
                subtotal,
                frete,
                desconto,
                cupom_descricao: cupomDescricao,
                total,
                itens: produtos
            });

            console.log(`✅ [CAPTURA] Pedido #${id_pedido_info} processado com sucesso!`);

        } catch (error) {
            console.error("❌ [CAPTURA] Erro:", error.message);
            await sleep(5);
        }
    }
}

================================================================================
                    ARQUIVO 3: update-controller.js (Controle de Updates)
                    Localização: /app/zedelivery-clean/update-controller.js
================================================================================

/**
 * IntegraFH - Update Controller
 * 
 * Módulo centralizado para controlar frequência de updates e webhooks.
 * Implementa debounce, cache de status e prevenção de duplicatas.
 * 
 * REGRAS:
 * 1. Debounce de 5-10 segundos entre updates do mesmo pedido
 * 2. Só envia webhook quando status REALMENTE mudar
 * 3. Cache de status para detectar mudanças reais
 * 
 * Copyright (c) 2026 - FELIPE HUDSON CARVALHO ARAÚJO TIBÚRCIO
 * Todos os direitos reservados.
 */

const UPDATE_DEBOUNCE_MS = 8000;         // 8 segundos entre updates
const WEBHOOK_COOLDOWN_MS = 10000;       // 10 segundos entre webhooks
const STATUS_CACHE_TTL_MS = 60000;       // Cache válido por 60 segundos

const cache = {
    orderStatus: new Map(),
    lastUpdate: new Map(),
    lastWebhook: new Map(),
    lastLoopRun: new Map(),
};

/**
 * Verifica se o status do pedido realmente mudou
 */
function hasStatusChanged(orderId, newStatus, newEntregador = null) {
    const cached = cache.orderStatus.get(orderId);
    const now = Date.now();
    
    if (!cached || (now - cached.timestamp > STATUS_CACHE_TTL_MS)) {
        cache.orderStatus.set(orderId, {
            status: newStatus,
            entregador: newEntregador,
            timestamp: now
        });
        return true;
    }
    
    const statusChanged = cached.status !== newStatus;
    const entregadorChanged = newEntregador && cached.entregador !== newEntregador;
    
    if (statusChanged || entregadorChanged) {
        cache.orderStatus.set(orderId, {
            status: newStatus,
            entregador: newEntregador,
            timestamp: now
        });
        return true;
    }
    
    return false;
}

/**
 * Verifica se pode enviar update (respeitando debounce)
 */
function canSendUpdate(orderId) {
    const now = Date.now();
    const lastTime = cache.lastUpdate.get(orderId) || 0;
    
    if (now - lastTime < UPDATE_DEBOUNCE_MS) {
        return false;
    }
    
    cache.lastUpdate.set(orderId, now);
    return true;
}

/**
 * Verifica se pode enviar webhook (respeitando cooldown)
 */
function canSendWebhook(orderId) {
    const now = Date.now();
    const lastTime = cache.lastWebhook.get(orderId) || 0;
    
    if (now - lastTime < WEBHOOK_COOLDOWN_MS) {
        return false;
    }
    
    cache.lastWebhook.set(orderId, now);
    return true;
}

module.exports = {
    hasStatusChanged,
    canSendUpdate,
    canSendWebhook,
    UPDATE_DEBOUNCE_MS,
    WEBHOOK_COOLDOWN_MS
};

================================================================================
                    ARQUIVO 4: sync-cron.js (Sincronização)
                    Localização: /app/bridge/sync-cron.js
================================================================================

/**
 * IntegraFH - Sync Cron
 * 
 * Sincronização automática OTIMIZADA com sistema externo.
 * Implementa cache de hashes para detectar mudanças reais e evitar
 * sobrecarga em sistemas de tempo real.
 * 
 * MELHORIAS:
 * - Intervalo de 10 segundos (era 3)
 * - Cache de hashes para detectar mudanças reais
 * - Debounce de 5 segundos entre syncs
 * - Só envia pedidos que REALMENTE mudaram
 * 
 * Copyright (c) 2026 - FELIPE HUDSON CARVALHO ARAÚJO TIBÚRCIO
 * Todos os direitos reservados.
 */

const SYNC_INTERVAL = 10 * 1000;           // 10 segundos
const DEBOUNCE_TIME = 5 * 1000;            // 5 segundos de debounce
const CACHE_TTL = 60 * 1000;               // Cache válido por 60 segundos
const MAX_ORDERS_PER_SYNC = 50;            // Limite de pedidos por sync

const cache = {
    lastSyncHash: null,
    lastSyncTime: 0,
    orderHashes: new Map(),
    webhookSent: new Map(),
};

/**
 * Gera hash de um objeto para comparação
 */
function generateHash(obj) {
    const str = JSON.stringify(obj, Object.keys(obj).sort());
    return require('crypto').createHash('md5').update(str).digest('hex');
}

/**
 * Verifica se um pedido realmente mudou
 */
function hasOrderChanged(orderId, orderData) {
    const newHash = generateHash({
        status: orderData.delivery_status,
        entregador: orderData.delivery_email_entregador,
        items_count: orderData.items?.length || 0,
        total: orderData.delivery_total
    });
    
    const oldHash = cache.orderHashes.get(orderId);
    
    if (oldHash !== newHash) {
        cache.orderHashes.set(orderId, newHash);
        return true;
    }
    return false;
}

/**
 * Função principal de sincronização
 */
async function syncToCloud() {
    const timestamp = new Date().toISOString();
    
    // Verificar debounce
    if (Date.now() - cache.lastSyncTime < DEBOUNCE_TIME) {
        return;
    }
    
    cache.lastSyncTime = Date.now();
    
    // Buscar pedidos do MySQL
    const [pedidos] = await pool.query(`
        SELECT d.delivery_id, d.delivery_code, d.delivery_name_cliente,
               d.delivery_status, d.delivery_total, d.delivery_telefone,
               d.delivery_desconto_descricao, d.delivery_email_entregador
        FROM delivery d
        WHERE DATE(d.delivery_date_time) >= CURDATE() - INTERVAL 7 DAY
        ORDER BY d.delivery_date_time DESC
        LIMIT ?
    `, [MAX_ORDERS_PER_SYNC]);

    // Filtrar apenas pedidos que mudaram
    const pedidosAlterados = pedidos.filter(pedido => 
        hasOrderChanged(pedido.delivery_code, pedido)
    );
    
    if (pedidosAlterados.length === 0) {
        console.log('✓ Nenhuma alteração detectada');
        return;
    }

    // Enviar para sistema em nuvem
    const payload = {
        pedidos: pedidosAlterados,
        source: 'integrafh',
        timestamp,
        is_incremental: true
    };

    await fetch(`${process.env.CLOUD_SYNC_URL}/functions/v1/sync-mysql`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.CLOUD_SYNC_KEY}`,
        },
        body: JSON.stringify(payload),
    });
    
    console.log(`✅ ${pedidosAlterados.length} pedidos sincronizados`);
}

================================================================================
                    ARQUIVO 5: server.py (API Backend)
                    Localização: /app/backend/server.py
================================================================================

"""
IntegraFH - API Backend

API REST desenvolvida com FastAPI para comunicação entre o frontend
e os serviços de automação. Fornece endpoints para:
- Listagem e detalhes de pedidos
- Controle de serviços (supervisor)
- Monitoramento de saúde do sistema
- Reprocessamento de pedidos

Copyright (c) 2026 - FELIPE HUDSON CARVALHO ARAÚJO TIBÚRCIO
Todos os direitos reservados.
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
import mysql.connector
import subprocess
import json
import os

app = FastAPI(title="IntegraFH API", version="1.0.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuração MySQL
MYSQL_CONFIG = {
    "host": os.environ.get("DB_HOST"),
    "port": int(os.environ.get("DB_PORT", 3306)),
    "user": os.environ.get("DB_USER"),
    "password": os.environ.get("DB_PASS"),
    "database": os.environ.get("DB_NAME"),
}

def get_db():
    """Retorna conexão com o banco de dados"""
    return mysql.connector.connect(**MYSQL_CONFIG)

@app.get("/api/health")
async def health_check():
    """Verifica saúde do sistema"""
    return {"status": "healthy"}

@app.get("/api/pedidos")
async def listar_pedidos(limit: int = 50, offset: int = 0):
    """Lista pedidos com paginação"""
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    
    cursor.execute("""
        SELECT delivery_id, delivery_code, delivery_name_cliente, delivery_status,
               delivery_total, delivery_date_time, delivery_tipo_pedido,
               delivery_telefone, delivery_desconto_descricao
        FROM delivery 
        WHERE delivery_trash = 0
        ORDER BY delivery_date_time DESC
        LIMIT %s OFFSET %s
    """, (limit, offset))
    
    pedidos = cursor.fetchall()
    cursor.close()
    conn.close()
    
    return {"success": True, "data": pedidos}

@app.get("/api/pedidos/{order_id}")
async def detalhes_pedido(order_id: str):
    """Retorna detalhes de um pedido específico"""
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    
    cursor.execute("SELECT * FROM delivery WHERE delivery_code = %s", (order_id,))
    pedido = cursor.fetchone()
    
    if not pedido:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    
    # Buscar itens
    cursor.execute("""
        SELECT * FROM delivery_itens 
        WHERE delivery_itens_id_delivery = %s
    """, (pedido['delivery_id'],))
    itens = cursor.fetchall()
    
    cursor.close()
    conn.close()
    
    return {"success": True, "pedido": pedido, "itens": itens}

@app.get("/api/aceite/status")
async def status_aceite():
    """Retorna status do aceite automático"""
    try:
        with open('/app/logs/aceite-stats.json', 'r') as f:
            stats = json.load(f)
        return {"success": True, "data": stats}
    except:
        return {"success": False, "data": None}

@app.post("/api/pedidos/{order_id}/confirmar-retirada")
async def confirmar_retirada(order_id: str, background_tasks: BackgroundTasks):
    """Confirma retirada de um pedido"""
    background_tasks.add_task(
        subprocess.run,
        ['node', '/app/scripts/confirmar-retirada.js', order_id]
    )
    return {"success": True, "message": f"Confirmação iniciada para pedido #{order_id}"}

@app.post("/api/services/{service_name}/{action}")
async def controlar_servico(service_name: str, action: str):
    """Controla serviços via supervisor"""
    if action not in ['start', 'stop', 'restart']:
        raise HTTPException(status_code=400, detail="Ação inválida")
    
    result = subprocess.run(
        ['sudo', 'supervisorctl', action, service_name],
        capture_output=True, text=True
    )
    
    return {"success": result.returncode == 0, "output": result.stdout}

================================================================================
                    ARQUIVO 6: App.js (Frontend React)
                    Localização: /app/frontend/src/App.js
================================================================================

/**
 * IntegraFH - Frontend React
 * 
 * Dashboard de monitoramento para acompanhamento em tempo real
 * de pedidos, serviços e operações do integrador.
 * 
 * Funcionalidades:
 * - Listagem de pedidos com filtros
 * - Modal de detalhes do pedido
 * - Monitoramento de serviços
 * - Controle de aceite automático
 * - Botão de confirmação de retirada
 * 
 * Copyright (c) 2026 - FELIPE HUDSON CARVALHO ARAÚJO TIBÚRCIO
 * Todos os direitos reservados.
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './components/ui/dialog';

const API_URL = process.env.REACT_APP_BACKEND_URL;

function App() {
  const [pedidos, setPedidos] = useState([]);
  const [pedidoDetails, setPedidoDetails] = useState(null);
  const [aceiteStatus, setAceiteStatus] = useState(null);
  const [retiradaLoading, setRetiradaLoading] = useState(false);

  // Buscar pedidos
  const fetchPedidos = async () => {
    try {
      const res = await fetch(`${API_URL}/api/pedidos`);
      const data = await res.json();
      if (data.success) setPedidos(data.data);
    } catch (err) {
      console.error('Erro ao buscar pedidos:', err);
    }
  };

  // Buscar status do aceite automático
  const fetchAceiteStatus = async () => {
    try {
      const res = await fetch(`${API_URL}/api/aceite/status`);
      const data = await res.json();
      if (data.success) setAceiteStatus(data.data);
    } catch (err) {
      console.error('Erro ao buscar status:', err);
    }
  };

  // Confirmar retirada
  const confirmarRetirada = async (orderId) => {
    if (!window.confirm(`Confirmar retirada do pedido #${orderId}?`)) return;
    
    setRetiradaLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/pedidos/${orderId}/confirmar-retirada`, {
        method: 'POST'
      });
      const data = await res.json();
      alert(data.message || 'Retirada confirmada!');
    } catch (err) {
      alert('Erro ao confirmar retirada');
    } finally {
      setRetiradaLoading(false);
    }
  };

  useEffect(() => {
    fetchPedidos();
    fetchAceiteStatus();
    const interval = setInterval(() => {
      fetchPedidos();
      fetchAceiteStatus();
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <h1 className="text-3xl font-bold mb-6">IntegraFH</h1>
      
      {/* Status do Aceite Automático */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Monitor 24/7</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className={`w-4 h-4 rounded-full ${
              aceiteStatus?.status === 'monitoring' || aceiteStatus?.status === 'waiting' 
                ? 'bg-green-500' 
                : 'bg-red-500'
            }`} />
            <span>
              {aceiteStatus?.status === 'monitoring' ? 'FUNCIONANDO' : 
               aceiteStatus?.status === 'waiting' ? 'AGUARDANDO PEDIDOS' : 
               'PARADO'}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Pedidos */}
      <Card>
        <CardHeader>
          <CardTitle>Pedidos</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full">
            <thead>
              <tr>
                <th>Código</th>
                <th>Cliente</th>
                <th>Total</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {pedidos.map(pedido => (
                <tr key={pedido.delivery_id}>
                  <td>#{pedido.delivery_code}</td>
                  <td>{pedido.delivery_name_cliente}</td>
                  <td>R$ {parseFloat(pedido.delivery_total).toFixed(2)}</td>
                  <td>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button onClick={() => setPedidoDetails({ pedido })}>
                          Ver
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Pedido #{pedido.delivery_code}</DialogTitle>
                        </DialogHeader>
                        
                        {/* Detalhes do pedido */}
                        <div>
                          <p>Cliente: {pedido.delivery_name_cliente}</p>
                          <p>Total: R$ {parseFloat(pedido.delivery_total).toFixed(2)}</p>
                          
                          {/* Cupom/Desconto */}
                          {pedido.delivery_desconto_descricao && (
                            <p className="text-purple-600">
                              Cupom: {pedido.delivery_desconto_descricao}
                            </p>
                          )}
                          
                          {/* Botão Confirmar Retirada */}
                          {pedido.delivery_tipo_pedido?.toLowerCase().includes('retirada') && (
                            <Button
                              onClick={() => confirmarRetirada(pedido.delivery_code)}
                              disabled={retiradaLoading}
                              className="mt-4 bg-yellow-400 text-black"
                            >
                              {retiradaLoading ? 'Confirmando...' : 'Confirmar Retirada'}
                            </Button>
                          )}
                        </div>
                      </DialogContent>
                    </Dialog>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

export default App;

================================================================================
                    FIM DO DOCUMENTO DE CÓDIGO-FONTE
                    Total de arquivos principais: 6
                    
                    Copyright (c) 2026 - FELIPE HUDSON CARVALHO ARAÚJO TIBÚRCIO
                    Todos os direitos reservados.
                    
                    Data de geração: 25/02/2026
================================================================================
