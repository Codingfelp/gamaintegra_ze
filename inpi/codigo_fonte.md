# CÓDIGO-FONTE DO SOFTWARE - INTEGRAFH
# Trechos estruturais para registro no INPI
# Data: 25/02/2026
# Autor: FELIPE HUDSON CARVALHO ARAÚJO TIBÚRCIO

================================================================================
                    ARQUIVO 1: auto-accept.js (Aceite Automático)
                    Localização: /app/delivery-adapter/auto-accept.js
================================================================================

/**
 * IntegraFH - Módulo de Aceite Automático
 * 
 * Este módulo é responsável por:
 * 1. Monitorar a página de pedidos da plataforma de delivery
 * 2. Detectar novos pedidos pendentes na interface Kanban
 * 3. Aceitar automaticamente os pedidos via interação com a UI
 * 4. Verificar se o aceite foi bem-sucedido
 * 5. Registrar estatísticas e logs de integração
 * 
 * Copyright (c) 2026 - FELIPE HUDSON CARVALHO ARAÚJO TIBÚRCIO
 * Todos os direitos reservados.
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const sessionManager = require('./session-manager');
const integrationLogger = require('./integration-logger');
const updateController = require('./update-controller');

// ============== CONFIGURAÇÃO DE OPERAÇÃO 24/7 ==============
const MAX_RUNTIME_MS = 4 * 60 * 60 * 1000;
const HORA_INICIO = 9;
const HORA_FIM = 24;
const START_TIME = Date.now();

function isHorarioOperacao() {
    const now = new Date();
    const hora = now.getHours();
    return hora >= HORA_INICIO && hora < HORA_FIM;
}

// ============== CONSTANTES E CONFIGURAÇÕES ==============
const isProduction = process.env.NODE_ENV === "production";
const executablePath = isProduction ? "/usr/bin/chromium" : undefined;
const SESSION_CHECK_INTERVAL = 5 * 60 * 1000;
const SESSION_SAVE_INTERVAL = 10 * 60 * 1000;
const PROFILE_NAME = 'profile-integrafh';
const STATS_FILE = '/app/logs/aceite-stats.json';

function loadStats() {
    try {
        if (fs.existsSync(STATS_FILE)) {
            return JSON.parse(fs.readFileSync(STATS_FILE, 'utf8'));
        }
    } catch (e) {}
    return {
        status: 'stopped',
        lastCheck: null,
        totalAttempts: 0,
        totalAccepted: 0,
        totalFailed: 0,
        lastAccept: null,
        startTime: null,
        errors: []
    };
}

function saveStats(stats) {
    try {
        fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2));
    } catch (e) {}
}

async function sleep(seg) {
    return new Promise(resolve => setTimeout(resolve, seg * 1000));
}

/**
 * FUNÇÃO PRINCIPAL DE ACEITE AUTOMÁTICO
 * Detecta pedidos novos na interface e executa aceite automatizado
 */
async function autoAcceptScript(browser, cookies) {
    console.log('[ACEITE] Iniciando monitoramento automático...');
    
    let stats = loadStats();
    stats.status = 'running';
    stats.startTime = new Date().toISOString();
    saveStats(stats);
    
    while (true) {
        let page = null;
        try {
            page = await browser.newPage();
            await page.setCookie(...cookies);

            await page.goto(process.env.PLATFORM_BASE_URL + "/orders", {
                waitUntil: "networkidle2",
                timeout: 60000
            });
            
            if (page.url().includes('login')) {
                console.log('[ACEITE] Sessão expirou, reiniciando...');
                process.exit(1);
            }

            stats.status = 'monitoring';
            saveStats(stats);

            while (true) {
                try {
                    stats.lastCheck = new Date().toISOString();
                    
                    // Detectar pedidos novos na interface Kanban
                    const newOrder = await page.evaluate(() => {
                        const newOrdersColumn = document.querySelector('[data-testid*="new-orders"]');
                        if (!newOrdersColumn) {
                            return { found: false, reason: 'column_not_found' };
                        }
                        
                        const emptyMessage = newOrdersColumn.querySelector('[id*="no-orders"]');
                        if (emptyMessage && emptyMessage.offsetParent !== null) {
                            return { found: false, reason: 'no_new_orders' };
                        }
                        
                        const cards = newOrdersColumn.querySelectorAll('[class*="card"], article');
                        
                        for (const card of cards) {
                            if (!card.offsetParent || card.offsetHeight === 0) continue;
                            
                            let orderId = '';
                            const text = card.innerText || '';
                            const match = text.match(/(\d{9})/);
                            if (match) orderId = match[1];
                            
                            return { 
                                found: true, 
                                orderId: orderId || 'N/A', 
                                cardIndex: Array.from(cards).indexOf(card)
                            };
                        }
                        
                        return { found: false, reason: 'no_cards_found' };
                    });
                    
                    if (!newOrder.found) {
                        stats.status = 'waiting';
                        saveStats(stats);
                        await sleep(3);
                        await page.reload({ waitUntil: "domcontentloaded", timeout: 15000 });
                        continue;
                    }

                    console.log(`[ACEITE] Novo pedido detectado: ${newOrder.orderId}`);
                    
                    stats.status = 'accepting';
                    stats.totalAttempts++;
                    saveStats(stats);

                    // Executar aceite via clique no card + botão
                    let accepted = await page.evaluate((cardIdx) => {
                        const column = document.querySelector('[data-testid*="new-orders"]');
                        if (!column) return false;
                        
                        const cards = column.querySelectorAll('[class*="card"], article');
                        const card = cards[cardIdx];
                        if (card) {
                            card.click();
                            return true;
                        }
                        return false;
                    }, newOrder.cardIndex || 0);
                    
                    if (accepted) {
                        await sleep(2);
                        
                        // Localizar e clicar no botão de aceitar no modal
                        for (let attempt = 1; attempt <= 5; attempt++) {
                            const clicked = await page.evaluate(() => {
                                const buttons = document.querySelectorAll('button');
                                for (const btn of buttons) {
                                    const text = btn.textContent.trim().toLowerCase();
                                    if (text === 'aceitar' || text === 'accept') {
                                        btn.click();
                                        return true;
                                    }
                                }
                                return false;
                            });
                            
                            if (clicked) break;
                            await sleep(1);
                        }
                    }

                    await sleep(4);
                    await page.reload({ waitUntil: "domcontentloaded", timeout: 10000 });
                    
                    stats.totalAccepted++;
                    stats.lastAccept = new Date().toISOString();
                    saveStats(stats);
                    
                } catch (innerErr) {
                    console.error("[ACEITE] Erro:", innerErr.message);
                    stats.errors.push({ time: new Date().toISOString(), error: innerErr.message });
                    saveStats(stats);
                    await sleep(3);
                }
            }

        } catch (error) {
            console.error("[ACEITE] Erro crítico:", error.message);
        } finally {
            if (page) {
                try { await page.close(); } catch (e) { }
            }
            await sleep(5);
        }
    }
}

module.exports = { autoAcceptScript };

================================================================================
                    ARQUIVO 2: update-controller.js (Controle de Updates)
                    Localização: /app/delivery-adapter/update-controller.js
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

const UPDATE_DEBOUNCE_MS = 8000;
const WEBHOOK_COOLDOWN_MS = 10000;
const STATUS_CACHE_TTL_MS = 60000;

const cache = {
    orderStatus: new Map(),
    lastUpdate: new Map(),
    lastWebhook: new Map(),
};

/**
 * Verifica se o status do pedido realmente mudou
 */
function hasStatusChanged(orderId, newStatus, newDriver = null) {
    const cached = cache.orderStatus.get(orderId);
    const now = Date.now();
    
    if (!cached || (now - cached.timestamp > STATUS_CACHE_TTL_MS)) {
        cache.orderStatus.set(orderId, {
            status: newStatus,
            driver: newDriver,
            timestamp: now
        });
        return true;
    }
    
    const statusChanged = cached.status !== newStatus;
    const driverChanged = newDriver && cached.driver !== newDriver;
    
    if (statusChanged || driverChanged) {
        cache.orderStatus.set(orderId, {
            status: newStatus,
            driver: newDriver,
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
                    ARQUIVO 3: sync-cron.js (Sincronização)
                    Localização: /app/bridge/sync-cron.js
================================================================================

/**
 * IntegraFH - Sync Cron
 * 
 * Sincronização automática OTIMIZADA com sistema externo.
 * Implementa cache de hashes para detectar mudanças reais e evitar
 * sobrecarga em sistemas de tempo real.
 * 
 * Copyright (c) 2026 - FELIPE HUDSON CARVALHO ARAÚJO TIBÚRCIO
 * Todos os direitos reservados.
 */

const SYNC_INTERVAL = 10 * 1000;
const DEBOUNCE_TIME = 5 * 1000;
const CACHE_TTL = 60 * 1000;
const MAX_ORDERS_PER_SYNC = 50;

const cache = {
    lastSyncHash: null,
    lastSyncTime: 0,
    orderHashes: new Map(),
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
        status: orderData.status,
        driver: orderData.driver_email,
        items_count: orderData.items?.length || 0,
        total: orderData.total
    });
    
    const oldHash = cache.orderHashes.get(orderId);
    
    if (oldHash !== newHash) {
        cache.orderHashes.set(orderId, newHash);
        return true;
    }
    return false;
}

/**
 * Função principal de sincronização incremental
 */
async function syncToCloud() {
    const timestamp = new Date().toISOString();
    
    if (Date.now() - cache.lastSyncTime < DEBOUNCE_TIME) {
        return;
    }
    
    cache.lastSyncTime = Date.now();
    
    const [orders] = await pool.query(`
        SELECT id, code, customer_name, status, total, phone, discount_description, driver_email
        FROM orders
        WHERE DATE(created_at) >= CURDATE() - INTERVAL 7 DAY
        ORDER BY created_at DESC
        LIMIT ?
    `, [MAX_ORDERS_PER_SYNC]);

    const changedOrders = orders.filter(order => 
        hasOrderChanged(order.code, order)
    );
    
    if (changedOrders.length === 0) {
        console.log('✓ Nenhuma alteração detectada');
        return;
    }

    const payload = {
        orders: changedOrders,
        source: 'integrafh',
        timestamp,
        is_incremental: true
    };

    await fetch(`${process.env.CLOUD_SYNC_URL}/functions/v1/sync`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.CLOUD_SYNC_KEY}`,
        },
        body: JSON.stringify(payload),
    });
    
    console.log(`✅ ${changedOrders.length} pedidos sincronizados`);
}

module.exports = { syncToCloud, hasOrderChanged, generateHash };

================================================================================
                    ARQUIVO 4: server.py (API Backend)
                    Localização: /app/backend/server.py
================================================================================

"""
IntegraFH - API Backend

API REST desenvolvida com FastAPI para comunicação entre o frontend
e os serviços de automação.

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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MYSQL_CONFIG = {
    "host": os.environ.get("DB_HOST"),
    "port": int(os.environ.get("DB_PORT", 3306)),
    "user": os.environ.get("DB_USER"),
    "password": os.environ.get("DB_PASS"),
    "database": os.environ.get("DB_NAME"),
}

def get_db():
    return mysql.connector.connect(**MYSQL_CONFIG)

@app.get("/api/health")
async def health_check():
    return {"status": "healthy"}

@app.get("/api/orders")
async def list_orders(limit: int = 50, offset: int = 0):
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    
    cursor.execute("""
        SELECT id, code, customer_name, status, total, created_at, order_type, phone, discount_description
        FROM orders 
        WHERE trash = 0
        ORDER BY created_at DESC
        LIMIT %s OFFSET %s
    """, (limit, offset))
    
    orders = cursor.fetchall()
    cursor.close()
    conn.close()
    
    return {"success": True, "data": orders}

@app.get("/api/orders/{order_id}")
async def order_details(order_id: str):
    conn = get_db()
    cursor = conn.cursor(dictionary=True)
    
    cursor.execute("SELECT * FROM orders WHERE code = %s", (order_id,))
    order = cursor.fetchone()
    
    if not order:
        raise HTTPException(status_code=404, detail="Pedido não encontrado")
    
    cursor.execute("SELECT * FROM order_items WHERE order_id = %s", (order['id'],))
    items = cursor.fetchall()
    
    cursor.close()
    conn.close()
    
    return {"success": True, "order": order, "items": items}

@app.get("/api/accept/status")
async def accept_status():
    try:
        with open('/app/logs/aceite-stats.json', 'r') as f:
            stats = json.load(f)
        return {"success": True, "data": stats}
    except:
        return {"success": False, "data": None}

@app.post("/api/orders/{order_id}/confirm-pickup")
async def confirm_pickup(order_id: str, background_tasks: BackgroundTasks):
    background_tasks.add_task(
        subprocess.run,
        ['node', '/app/scripts/confirm-pickup.js', order_id]
    )
    return {"success": True, "message": f"Confirmação iniciada para pedido #{order_id}"}

@app.post("/api/services/{service_name}/{action}")
async def control_service(service_name: str, action: str):
    if action not in ['start', 'stop', 'restart']:
        raise HTTPException(status_code=400, detail="Ação inválida")
    
    result = subprocess.run(
        ['sudo', 'supervisorctl', action, service_name],
        capture_output=True, text=True
    )
    
    return {"success": result.returncode == 0, "output": result.stdout}

================================================================================
                    ARQUIVO 5: App.js (Frontend React)
                    Localização: /app/frontend/src/App.js
================================================================================

/**
 * IntegraFH - Frontend React
 * 
 * Dashboard de monitoramento para acompanhamento em tempo real
 * de pedidos, serviços e operações do integrador.
 * 
 * Copyright (c) 2026 - FELIPE HUDSON CARVALHO ARAÚJO TIBÚRCIO
 * Todos os direitos reservados.
 */

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './components/ui/dialog';

const API_URL = process.env.REACT_APP_BACKEND_URL;

function App() {
  const [orders, setOrders] = useState([]);
  const [acceptStatus, setAcceptStatus] = useState(null);
  const [pickupLoading, setPickupLoading] = useState(false);

  const fetchOrders = async () => {
    try {
      const res = await fetch(`${API_URL}/api/orders`);
      const data = await res.json();
      if (data.success) setOrders(data.data);
    } catch (err) {
      console.error('Erro ao buscar pedidos:', err);
    }
  };

  const fetchAcceptStatus = async () => {
    try {
      const res = await fetch(`${API_URL}/api/accept/status`);
      const data = await res.json();
      if (data.success) setAcceptStatus(data.data);
    } catch (err) {
      console.error('Erro ao buscar status:', err);
    }
  };

  const confirmPickup = async (orderId) => {
    if (!window.confirm(`Confirmar retirada do pedido #${orderId}?`)) return;
    
    setPickupLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/orders/${orderId}/confirm-pickup`, {
        method: 'POST'
      });
      const data = await res.json();
      alert(data.message || 'Retirada confirmada!');
    } catch (err) {
      alert('Erro ao confirmar retirada');
    } finally {
      setPickupLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    fetchAcceptStatus();
    const interval = setInterval(() => {
      fetchOrders();
      fetchAcceptStatus();
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <h1 className="text-3xl font-bold mb-6">IntegraFH</h1>
      
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Monitor 24/7</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className={`w-4 h-4 rounded-full ${
              acceptStatus?.status === 'monitoring' || acceptStatus?.status === 'waiting' 
                ? 'bg-green-500' 
                : 'bg-red-500'
            }`} />
            <span>
              {acceptStatus?.status === 'monitoring' ? 'FUNCIONANDO' : 
               acceptStatus?.status === 'waiting' ? 'AGUARDANDO PEDIDOS' : 
               'PARADO'}
            </span>
          </div>
        </CardContent>
      </Card>

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
              {orders.map(order => (
                <tr key={order.id}>
                  <td>#{order.code}</td>
                  <td>{order.customer_name}</td>
                  <td>R$ {parseFloat(order.total).toFixed(2)}</td>
                  <td>
                    <Button>Ver</Button>
                    {order.order_type?.toLowerCase().includes('retirada') && (
                      <Button
                        onClick={() => confirmPickup(order.code)}
                        disabled={pickupLoading}
                        className="ml-2 bg-yellow-400 text-black"
                      >
                        Confirmar Retirada
                      </Button>
                    )}
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
                    Total de arquivos principais: 5
                    
                    Copyright (c) 2026 - FELIPE HUDSON CARVALHO ARAÚJO TIBÚRCIO
                    Todos os direitos reservados.
                    
                    Data de geração: 25/02/2026
================================================================================
