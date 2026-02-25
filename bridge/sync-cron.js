// Sync automático OTIMIZADO para Lovable Cloud
// MELHORIAS: Debounce, cache de status, evita webhooks duplicados
require('dotenv').config();
const mysql = require('mysql2/promise');
const fetch = require('node-fetch');
const fs = require('fs');
const crypto = require('crypto');
const integrationLogger = require('./integration-logger');

// ============================================
// CONFIGURAÇÕES DE OTIMIZAÇÃO
// ============================================
const SYNC_INTERVAL = 10 * 1000;           // 10 segundos (era 3)
const DEBOUNCE_TIME = 5 * 1000;            // 5 segundos de debounce
const CACHE_TTL = 60 * 1000;               // Cache válido por 60 segundos
const MAX_ORDERS_PER_SYNC = 50;            // Limite de pedidos por sync
const WEBHOOK_COOLDOWN = 10 * 1000;        // 10 segundos entre webhooks do mesmo pedido

// ============================================
// CACHE GLOBAL - Evita updates/webhooks duplicados
// ============================================
const cache = {
  lastSyncHash: null,                      // Hash do último payload enviado
  lastSyncTime: 0,                         // Timestamp do último sync
  orderHashes: new Map(),                  // Hash de cada pedido (para detectar mudanças)
  webhookSent: new Map(),                  // Timestamp do último webhook por orderId
  pendingUpdates: [],                      // Updates pendentes para batch
  lastLogTime: 0,                          // Último log de integração
};

// ============================================
// FUNÇÕES DE OTIMIZAÇÃO
// ============================================

/**
 * Gera hash de um objeto para comparação
 */
function generateHash(obj) {
  const str = JSON.stringify(obj, Object.keys(obj).sort());
  return crypto.createHash('md5').update(str).digest('hex');
}

/**
 * Mapeia status do Zé Delivery para status do Lovable
 */
function mapZeStatus(zeStatus) {
  const status = parseInt(zeStatus) || 0;
  switch (status) {
    case 0: return 'pending';       // Pendente -> NOVOS
    case 2: return 'preparing';     // Aceito -> EM SEPARAÇÃO
    case 3: return 'shipped';       // A Caminho -> EM ROTA
    case 1: return 'awaiting_closure'; // Entregue -> AGUARDANDO ACERTO
    case 4:
    case 5: return 'cancelled';     // Cancelado
    case 6: return 'awaiting_closure'; // Rejeitado
    default: return 'pending';
  }
}

/**
 * Mapeia forma de pagamento
 */
function mapPaymentMethod(method) {
  if (!method) return 'online';
  const m = (method || '').toLowerCase();
  if (m.includes('dinheiro')) return 'dinheiro';
  if (m.includes('cartão') || m.includes('cartao') || m.includes('crédito') || m.includes('débito')) return 'cartao';
  if (m.includes('pix')) return 'pix';
  return 'online';
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
 * Verifica se pode enviar webhook (respeitando cooldown)
 */
function canSendWebhook(orderId) {
  const now = Date.now();
  const lastSent = cache.webhookSent.get(orderId) || 0;
  
  if (now - lastSent < WEBHOOK_COOLDOWN) {
    return false;
  }
  
  cache.webhookSent.set(orderId, now);
  return true;
}

/**
 * Debounce para evitar updates muito frequentes
 */
function shouldSync() {
  const now = Date.now();
  
  if (now - cache.lastSyncTime < DEBOUNCE_TIME) {
    return false;
  }
  
  return true;
}

/**
 * Log de integração com debounce (evita spam)
 */
async function logIntegration(processType, status, message, metadata = {}) {
  const now = Date.now();
  
  // Só logar a cada 30 segundos no mínimo
  if (now - cache.lastLogTime < 30000) {
    console.log(`[SKIP LOG] ${message}`);
    return null;
  }
  
  cache.lastLogTime = now;
  return await integrationLogger.logEvent(processType, status, message, metadata);
}

// ============================================
// CONFIGURAÇÃO DO BANCO DE DADOS
// ============================================

function formatLocalTime(dateValue) {
  if (!dateValue) return null;
  if (typeof dateValue === 'string') {
    return dateValue.replace(/\.000Z$/, '').replace(/Z$/, '');
  }
  if (dateValue instanceof Date) {
    return dateValue.toISOString().replace(/\.000Z$/, '').replace(/Z$/, '');
  }
  return String(dateValue);
}

// RAILWAY MYSQL - FALLBACK HARDCODED PARA PRODUÇÃO
const RAILWAY_CONFIG = {
  host: 'mainline.proxy.rlwy.net',
  port: 52996,
  user: 'root',
  password: 'eHeoVCebYyaJVBEBtCLfYNHgRCrxWVXU',
  database: 'railway'
};

const envHost = process.env.DB_HOST || process.env.MYSQLHOST || '';
const envPort = process.env.DB_PORT || process.env.MYSQLPORT || '';
const envUser = process.env.DB_USER || process.env.MYSQLUSER || '';
const envPass = process.env.DB_PASS || process.env.MYSQLPASSWORD || process.env.MYSQL_ROOT_PASSWORD || '';
const envDb = process.env.DB_NAME || process.env.MYSQL_DATABASE || process.env.MYSQLDATABASE || '';

const isWrongConfig = (
  envHost === '' ||
  envHost === 'localhost' ||
  envHost.includes('railway.internal') ||
  envDb.includes('zeconnect') ||
  envDb === 'test_database'
);

const dbConfig = isWrongConfig ? RAILWAY_CONFIG : {
  host: envHost || RAILWAY_CONFIG.host,
  port: parseInt(envPort) || RAILWAY_CONFIG.port,
  user: envUser || RAILWAY_CONFIG.user,
  password: envPass || RAILWAY_CONFIG.password,
  database: envDb || RAILWAY_CONFIG.database,
};

if (dbConfig.database === 'zeconnect-base' || dbConfig.database === 'test_database' || !dbConfig.database) {
  dbConfig.database = 'railway';
}

console.log(`🔧 MySQL Config: ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);
if (isWrongConfig) {
  console.log('⚠️ Usando Railway MySQL PÚBLICO');
}

const pool = mysql.createPool({
  ...dbConfig,
  waitForConnections: true,
  connectionLimit: 5,
});

// ============================================
// SINCRONIZAÇÃO LOCAL (MySQL interno)
// ============================================
async function syncLocalData() {
  try {
    // 1. Sincronizar CPF/endereço de ze_pedido para delivery
    await pool.query(`
      UPDATE delivery d
      INNER JOIN ze_pedido z ON d.delivery_code = z.pedido_code
      SET 
        d.delivery_cpf_cliente = COALESCE(NULLIF(z.pedido_cpf_cliente, ''), d.delivery_cpf_cliente),
        d.delivery_endereco_rota = COALESCE(NULLIF(z.pedido_endereco_rota, ''), d.delivery_endereco_rota),
        d.delivery_endereco_complemento = COALESCE(NULLIF(z.pedido_endereco_complemento, ''), d.delivery_endereco_complemento),
        d.delivery_endereco_cidade_uf = COALESCE(NULLIF(z.pedido_endereco_cidade_uf, ''), d.delivery_endereco_cidade_uf),
        d.delivery_endereco_cep = COALESCE(NULLIF(z.pedido_endereco_cep, ''), d.delivery_endereco_cep),
        d.delivery_endereco_bairro = COALESCE(NULLIF(z.pedido_endereco_bairro, ''), d.delivery_endereco_bairro)
      WHERE (d.delivery_cpf_cliente IS NULL OR d.delivery_cpf_cliente = '')
    `);
    
    // 2. Sincronizar itens de ze_itens_pedido para delivery_itens
    await pool.query(`
      INSERT INTO delivery_itens (delivery_itens_id_delivery, delivery_itens_id_produto, delivery_itens_descricao, delivery_itens_qtd, delivery_itens_valor_unitario, delivery_itens_valor_total)
      SELECT DISTINCT
        d.delivery_id,
        zi.itens_pedido_id_produto,
        zi.itens_pedido_descricao_produto,
        zi.itens_pedido_qtd,
        zi.itens_pedido_valor_unitario,
        zi.itens_pedido_valor_total
      FROM ze_itens_pedido zi
      INNER JOIN ze_pedido zp ON zi.itens_pedido_id_pedido = zp.pedido_id
      INNER JOIN delivery d ON d.delivery_code = zp.pedido_code
      LEFT JOIN delivery_itens di ON di.delivery_itens_id_delivery = d.delivery_id 
        AND di.delivery_itens_descricao = zi.itens_pedido_descricao_produto
      WHERE di.delivery_itens_id IS NULL
    `);
    
    // 3. Atualizar flag tem_itens
    await pool.query(`
      UPDATE delivery d
      INNER JOIN (
        SELECT delivery_itens_id_delivery, COUNT(*) as cnt
        FROM delivery_itens
        GROUP BY delivery_itens_id_delivery
      ) di ON d.delivery_id = di.delivery_itens_id_delivery
      SET d.delivery_tem_itens = 1
      WHERE d.delivery_tem_itens IS NULL OR d.delivery_tem_itens = 0
    `);
  } catch (err) {
    console.error('Erro na sincronização local:', err.message);
  }
}

// ============================================
// SINCRONIZAÇÃO COM SUPABASE (OTIMIZADA)
// ============================================
async function syncToLovable() {
  const timestamp = new Date().toISOString();
  
  // DEBOUNCE: Verificar se deve sincronizar
  if (!shouldSync()) {
    return;
  }
  
  cache.lastSyncTime = Date.now();
  
  console.log(`\n[${timestamp}] 🔄 Verificando mudanças...`);
  
  try {
    // Buscar pedidos ÚNICOS priorizando os que têm itens
    const [pedidos] = await pool.query(`
      SELECT 
        d.delivery_id,
        d.delivery_ide,
        d.delivery_code,
        d.delivery_name_cliente,
        d.delivery_date_time,
        d.delivery_data_hora_captura,
        d.delivery_status,
        d.delivery_subtotal,
        d.delivery_forma_pagamento,
        d.delivery_desconto,
        d.delivery_desconto_descricao,
        d.delivery_frete,
        d.delivery_total,
        d.delivery_cpf_cliente,
        d.delivery_telefone,
        d.delivery_endereco_rota,
        d.delivery_endereco_complemento,
        d.delivery_endereco_cidade_uf,
        d.delivery_endereco_cep,
        d.delivery_endereco_bairro,
        d.delivery_troco_para,
        d.delivery_troco,
        d.delivery_taxa_conveniencia,
        d.delivery_obs,
        d.delivery_tipo_pedido,
        d.delivery_codigo_entrega,
        d.delivery_email_entregador,
        d.delivery_tem_itens
      FROM delivery d
      INNER JOIN (
        SELECT delivery_code, MAX(delivery_id) as max_id
        FROM delivery
        WHERE delivery_trash = 0 AND delivery_tem_itens = 1
        GROUP BY delivery_code
        UNION
        SELECT delivery_code, MAX(delivery_id) as max_id
        FROM delivery
        WHERE delivery_trash = 0 AND (delivery_tem_itens IS NULL OR delivery_tem_itens = 0)
        AND delivery_code NOT IN (SELECT delivery_code FROM delivery WHERE delivery_trash = 0 AND delivery_tem_itens = 1)
        GROUP BY delivery_code
      ) best ON d.delivery_id = best.max_id
      WHERE DATE(d.delivery_date_time) >= CURDATE() - INTERVAL 7 DAY
      ORDER BY d.delivery_date_time DESC
      LIMIT ?
    `, [MAX_ORDERS_PER_SYNC]);

    // ============================================
    // FILTRAR APENAS PEDIDOS QUE MUDARAM
    // ============================================
    const pedidosAlterados = [];
    
    for (let pedido of pedidos) {
      const orderId = pedido.delivery_code;
      
      // Buscar itens apenas se o pedido mudou ou é novo
      const [itens] = await pool.query(`
        SELECT 
          di.delivery_itens_id,
          di.delivery_itens_descricao,
          di.delivery_itens_qtd,
          di.delivery_itens_valor_unitario,
          di.delivery_itens_valor_total,
          p.produto_descricao,
          p.produto_codigo_ze,
          p.produto_link_imagem
        FROM delivery_itens di
        LEFT JOIN produto p ON p.produto_id = di.delivery_itens_id_produto
        WHERE di.delivery_itens_id_delivery = ?
      `, [pedido.delivery_id]);
      
      const itensFormatados = (itens || []).map(item => ({
        id: item.delivery_itens_id,
        nome: item.delivery_itens_descricao || item.produto_descricao,
        quantidade: item.delivery_itens_qtd,
        preco_unitario: parseFloat(item.delivery_itens_valor_unitario) || 0,
        preco_total: parseFloat(item.delivery_itens_valor_total) || 0,
        codigo_ze: item.produto_codigo_ze || '',
        imagem: item.produto_link_imagem || ''
      }));
      
      // Criar objeto do pedido formatado
      const pedidoFormatado = {
        id_local: pedido.delivery_id,
        external_id: pedido.delivery_code,
        order_number: pedido.delivery_code,
        delivery_code: pedido.delivery_codigo_entrega,
        pickup_code: pedido.delivery_codigo_entrega,
        delivery_codigo_entrega: pedido.delivery_codigo_entrega,
        ide: pedido.delivery_ide,
        delivery_id: pedido.delivery_id,
        customer_name: pedido.delivery_name_cliente,
        customer_cpf: pedido.delivery_cpf_cliente,
        customer_phone: pedido.delivery_telefone || null,
        address: pedido.delivery_endereco_rota,
        address_complement: pedido.delivery_endereco_complemento,
        address_neighborhood: pedido.delivery_endereco_bairro,
        address_city: pedido.delivery_endereco_cidade_uf,
        address_zip: pedido.delivery_endereco_cep,
        status: pedido.delivery_status,
        delivery_status: pedido.delivery_status,
        status_text: getStatusText(pedido.delivery_status),
        created_at: formatLocalTime(pedido.delivery_date_time),
        delivery_date_time: formatLocalTime(pedido.delivery_date_time),
        order_datetime: formatLocalTime(pedido.delivery_date_time),
        captured_at: formatLocalTime(pedido.delivery_data_hora_captura),
        subtotal: parseFloat(pedido.delivery_subtotal) || 0,
        delivery_subtotal: parseFloat(pedido.delivery_subtotal) || 0,
        discount: parseFloat(pedido.delivery_desconto) || 0,
        delivery_desconto: parseFloat(pedido.delivery_desconto) || 0,
        discount_description: pedido.delivery_desconto_descricao || null,
        delivery_desconto_descricao: pedido.delivery_desconto_descricao || null,
        coupon_description: pedido.delivery_desconto_descricao || null,
        delivery_fee: parseFloat(pedido.delivery_frete) || 0,
        delivery_frete: parseFloat(pedido.delivery_frete) || 0,
        total: parseFloat(pedido.delivery_total) || 0,
        delivery_total: parseFloat(pedido.delivery_total) || 0,
        convenience_fee: parseFloat(pedido.delivery_taxa_conveniencia) || 0,
        payment_method: pedido.delivery_forma_pagamento,
        delivery_forma_pagamento: pedido.delivery_forma_pagamento,
        change_for: parseFloat(pedido.delivery_troco_para) || 0,
        change: parseFloat(pedido.delivery_troco) || 0,
        delivery_type: pedido.delivery_tipo_pedido || 'Pedido Comum',
        delivery_tipo_pedido: pedido.delivery_tipo_pedido || 'Pedido Comum',
        courier_email: pedido.delivery_email_entregador || null,
        delivery_email_entregador: pedido.delivery_email_entregador || null,
        delivery_entregador_email: pedido.delivery_email_entregador || null,
        deliverer_name: null,
        notes: pedido.delivery_obs,
        items: itensFormatados,
        itens: itensFormatados,
        items_json: JSON.stringify(itensFormatados),
        items_count: itensFormatados.length,
        has_items: itensFormatados.length > 0,
        source: 'ze-delivery',
        synced_at: timestamp
      };
      
      // VERIFICAR SE REALMENTE MUDOU
      if (hasOrderChanged(orderId, pedidoFormatado)) {
        pedidosAlterados.push(pedidoFormatado);
        console.log(`   📝 Pedido ${orderId} ALTERADO (status: ${pedido.delivery_status}, entregador: ${pedido.delivery_email_entregador || 'N/A'})`);
      }
    }
    
    // Se nenhum pedido mudou, não enviar nada
    if (pedidosAlterados.length === 0) {
      console.log(`   ✓ Nenhuma alteração detectada`);
      return;
    }
    
    console.log(`📦 ${pedidosAlterados.length}/${pedidos.length} pedidos com alterações`);

    // Verificar configuração Lovable
    const LOVABLE_URL = process.env.LOVABLE_SUPABASE_URL;
    const LOVABLE_KEY = process.env.LOVABLE_ZE_SYNC_KEY;
    const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!LOVABLE_URL) {
      console.log('⚠️  Lovable Cloud não configurado');
      fs.writeFileSync('/app/logs/sync-debug.json', JSON.stringify(pedidosAlterados, null, 2));
      return;
    }

    // Preparar payload APENAS com pedidos alterados
    const payload = {
      pedidos: pedidosAlterados,
      source: 'gamatauri-ze',
      timestamp: timestamp,
      force_update: true,
      is_incremental: true  // Indica que é update incremental
    };

    // Verificar se payload realmente mudou
    const payloadHash = generateHash(payload.pedidos);
    if (payloadHash === cache.lastSyncHash) {
      console.log(`   ✓ Payload idêntico ao anterior, pulando envio`);
      return;
    }
    cache.lastSyncHash = payloadHash;

    // Salvar debug
    fs.writeFileSync('/app/logs/sync-payload.json', JSON.stringify(payload, null, 2));
    console.log(`📤 Enviando ${pedidosAlterados.length} pedidos para ${LOVABLE_URL}...`);
    
    // Tentar Edge Function primeiro
    let syncSuccess = false;
    
    if (LOVABLE_KEY) {
      try {
        const response = await fetch(
          `${LOVABLE_URL}/functions/v1/ze-sync-mysql`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${LOVABLE_KEY}`,
              'x-api-key': LOVABLE_KEY,
            },
            body: JSON.stringify(payload),
          }
        );

        if (response.ok) {
          const result = await response.json();
          console.log(`✅ Edge Function: Sincronização concluída:`, JSON.stringify(result));
          syncSuccess = true;
          
          // Log de integração com debounce
          await logIntegration(
            integrationLogger.PROCESS_TYPES.SUPABASE_SYNC,
            integrationLogger.STATUS.COMPLETED,
            `${pedidosAlterados.length} pedidos sincronizados`,
            { count: pedidosAlterados.length }
          );
        } else {
          const error = await response.text();
          console.error(`❌ Edge Function falhou (${response.status}): ${error}`);
        }
      } catch (edgeFnErr) {
        console.error(`❌ Edge Function erro: ${edgeFnErr.message}`);
      }
    }
    
    if (!syncSuccess) {
      console.error(`❌ Sincronização falhou`);
    }
                  items: orderData.items,
                  courier_email: orderData.courier_email,
                  updated_at: new Date().toISOString(),
                }),
              }
            );
            
            if (updateResponse.ok) {
              console.log(`   🔄 Pedido ${externalOrderId} atualizado`);
            }
          } else {
            // INSERT
            const insertResponse = await fetch(
              `${LOVABLE_URL}/rest/v1/orders`,
              {
                method: 'POST',
                headers: {
                  'apikey': SERVICE_ROLE_KEY,
                  'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
                  'Content-Type': 'application/json',
                  'Prefer': 'return=minimal',
                },
                body: JSON.stringify(orderData),
              }
            );
            
            if (insertResponse.ok) {
              console.log(`   ✅ Pedido ${externalOrderId} inserido`);
            } else {
              const errText = await insertResponse.text();
              console.error(`   ❌ Erro ao inserir ${externalOrderId}: ${errText}`);
            }
          }
        } catch (restErr) {
          console.error(`   ❌ REST erro: ${restErr.message}`);
        }
      }
      
      syncSuccess = true;
    }
    
    if (syncSuccess) {
      // Log de integração com debounce
      await logIntegration(
        integrationLogger.PROCESS_TYPES.SUPABASE_SYNC,
        integrationLogger.STATUS.COMPLETED,
        `${pedidosAlterados.length} pedidos sincronizados`,
        { count: pedidosAlterados.length }
      );
    } else {
      console.error(`❌ Sincronização falhou - nenhum método disponível`);
    }

  } catch (err) {
    console.error(`❌ Erro: ${err.message}`);
  }
}

function getStatusText(status) {
  const statusMap = {
    0: 'Pendente',
    1: 'Entregue',
    2: 'Aceito',
    3: 'A Caminho',
    4: 'Cancelado',
    5: 'Rejeitado'
  };
  return statusMap[status] || 'Desconhecido';
}

// ============================================
// INICIALIZAÇÃO
// ============================================
console.log('🚀 Sync Cron OTIMIZADO iniciado');
console.log(`   Intervalo: ${SYNC_INTERVAL/1000}s | Debounce: ${DEBOUNCE_TIME/1000}s | Cache: ${CACHE_TTL/1000}s`);

async function runSync() {
  await syncLocalData();
  await syncToLovable();
}

runSync();
setInterval(runSync, SYNC_INTERVAL);

// Limpar cache de webhooks antigos a cada 5 minutos
setInterval(() => {
  const now = Date.now();
  const expiry = now - (5 * 60 * 1000);
  
  for (const [key, value] of cache.webhookSent) {
    if (value < expiry) {
      cache.webhookSent.delete(key);
    }
  }
  
  // Limpar hashes antigos (manter últimos 500)
  if (cache.orderHashes.size > 500) {
    const entries = Array.from(cache.orderHashes.entries());
    const toDelete = entries.slice(0, entries.length - 500);
    toDelete.forEach(([key]) => cache.orderHashes.delete(key));
  }
}, 5 * 60 * 1000);

process.on('SIGINT', () => {
  console.log('\n👋 Sync Cron encerrado');
  process.exit(0);
});
