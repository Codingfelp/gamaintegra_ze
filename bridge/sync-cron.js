// Sync automático a cada 3 segundos para Lovable Cloud - TEMPO REAL
require('dotenv').config();
const mysql = require('mysql2/promise');
const fetch = require('node-fetch');
const fs = require('fs');
const integrationLogger = require('./integration-logger');

const SYNC_INTERVAL = 3 * 1000; // 3 segundos - quase instantâneo

// Função para formatar horário local (Brasil/BRT) sem sufixo Z
function formatLocalTime(dateValue) {
  if (!dateValue) return null;
  
  // Se já é string, remover o sufixo Z e .000Z
  if (typeof dateValue === 'string') {
    return dateValue.replace(/\.000Z$/, '').replace(/Z$/, '');
  }
  
  // Se é Date, formatar como ISO sem Z
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

// Verificar TODAS as variáveis possíveis (DB_* para preview, MYSQL* para produção)
const envHost = process.env.DB_HOST || process.env.MYSQLHOST || '';
const envPort = process.env.DB_PORT || process.env.MYSQLPORT || '';
const envUser = process.env.DB_USER || process.env.MYSQLUSER || '';
const envPass = process.env.DB_PASS || process.env.MYSQLPASSWORD || process.env.MYSQL_ROOT_PASSWORD || '';
const envDb = process.env.DB_NAME || process.env.MYSQL_DATABASE || process.env.MYSQLDATABASE || '';

// Detectar configuração errada (MongoDB, zeconnect-base, localhost, internal)
// IMPORTANTE: mysql.railway.internal NÃO funciona externamente
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

// Forçar database railway se vier errado
if (dbConfig.database === 'zeconnect-base' || dbConfig.database === 'test_database' || !dbConfig.database) {
  dbConfig.database = 'railway';
}

console.log(`🔧 MySQL Config: ${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`);
if (isWrongConfig) {
  console.log('⚠️ Usando Railway MySQL PÚBLICO (config internal ou vazia detectada)');
}

const pool = mysql.createPool({
  ...dbConfig,
  waitForConnections: true,
  connectionLimit: 5,
});

// Sincroniza dados de ze_pedido para delivery e itens
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

async function syncToLovable() {
  const timestamp = new Date().toISOString();
  console.log(`\n[${timestamp}] 🔄 Iniciando sincronização...`);
  
  // Iniciar log de integração
  let processId = await integrationLogger.log.supabaseSync.start(
    'Iniciando sincronização com Supabase',
    { timestamp }
  );
  
  try {
    // Buscar pedidos ÚNICOS (por delivery_code) priorizando os que têm itens
    // Usa subquery para pegar o registro com mais itens de cada código
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
      LIMIT 50
    `);

    console.log(`📦 ${pedidos.length} pedidos encontrados`);

    // Buscar itens de cada pedido e formatar para Lovable
    const pedidosFormatados = [];
    
    for (let pedido of pedidos) {
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
      
      // Formatar itens para um array simples
      const itensFormatados = (itens || []).map(item => ({
        id: item.delivery_itens_id,
        nome: item.delivery_itens_descricao || item.produto_descricao,
        quantidade: item.delivery_itens_qtd,
        preco_unitario: parseFloat(item.delivery_itens_valor_unitario) || 0,
        preco_total: parseFloat(item.delivery_itens_valor_total) || 0,
        codigo_ze: item.produto_codigo_ze || '',
        imagem: item.produto_link_imagem || ''
      }));

      console.log(`   Pedido ${pedido.delivery_code}: ${itensFormatados.length} itens, entregador: ${pedido.delivery_email_entregador || 'N/A'}`);
      
      // Formatar pedido para Lovable
      pedidosFormatados.push({
        // Identificadores - ENVIANDO AMBOS: número do pedido (9 dígitos) E código de entrega
        id_local: pedido.delivery_id,
        external_id: pedido.delivery_code,           // Número do pedido (9 dígitos): "228147196"
        order_number: pedido.delivery_code,          // Número do pedido (9 dígitos): "228147196"  
        delivery_code: pedido.delivery_codigo_entrega, // Código de entrega: "CRK 7WZ 1DJ W"
        pickup_code: pedido.delivery_codigo_entrega,   // Código de entrega: "CRK 7WZ 1DJ W"
        delivery_codigo_entrega: pedido.delivery_codigo_entrega,
        ide: pedido.delivery_ide,
        delivery_id: pedido.delivery_id,
        
        // Cliente
        customer_name: pedido.delivery_name_cliente,
        customer_cpf: pedido.delivery_cpf_cliente,
        customer_phone: pedido.delivery_telefone || null,
        
        // Endereço
        address: pedido.delivery_endereco_rota,
        address_complement: pedido.delivery_endereco_complemento,
        address_neighborhood: pedido.delivery_endereco_bairro,
        address_city: pedido.delivery_endereco_cidade_uf,
        address_zip: pedido.delivery_endereco_cep,
        
        // Status e datas - HORÁRIO LOCAL (Brasil/BRT) sem sufixo Z
        status: pedido.delivery_status,
        delivery_status: pedido.delivery_status,
        status_text: getStatusText(pedido.delivery_status),
        created_at: formatLocalTime(pedido.delivery_date_time),
        delivery_date_time: formatLocalTime(pedido.delivery_date_time),
        order_datetime: formatLocalTime(pedido.delivery_date_time),
        captured_at: formatLocalTime(pedido.delivery_data_hora_captura),
        
        // Valores
        subtotal: parseFloat(pedido.delivery_subtotal) || 0,
        delivery_subtotal: parseFloat(pedido.delivery_subtotal) || 0,
        discount: parseFloat(pedido.delivery_desconto) || 0,
        delivery_desconto: parseFloat(pedido.delivery_desconto) || 0,
        delivery_fee: parseFloat(pedido.delivery_frete) || 0,
        delivery_frete: parseFloat(pedido.delivery_frete) || 0,
        total: parseFloat(pedido.delivery_total) || 0,
        delivery_total: parseFloat(pedido.delivery_total) || 0,
        convenience_fee: parseFloat(pedido.delivery_taxa_conveniencia) || 0,
        
        // Pagamento
        payment_method: pedido.delivery_forma_pagamento,
        delivery_forma_pagamento: pedido.delivery_forma_pagamento,
        change_for: parseFloat(pedido.delivery_troco_para) || 0,
        change: parseFloat(pedido.delivery_troco) || 0,
        
        // Entrega - IMPORTANTE: enviar tipo exato do banco
        delivery_type: pedido.delivery_tipo_pedido || 'Pedido Comum',
        delivery_tipo_pedido: pedido.delivery_tipo_pedido || 'Pedido Comum',
        delivery_code: pedido.delivery_codigo_entrega,
        delivery_codigo_entrega: pedido.delivery_codigo_entrega,
        pickup_code: pedido.delivery_codigo_entrega, // Campo esperado pelo Lovable
        
        // ENTREGADOR - Múltiplos campos para garantir
        // ✅ CORREÇÃO: NÃO usar email como deliverer_name
        courier_email: pedido.delivery_email_entregador || null,
        delivery_email_entregador: pedido.delivery_email_entregador || null,
        delivery_entregador_email: pedido.delivery_email_entregador || null,
        // deliverer_name será preenchido pelo ze-sync-mysql via vinculação com tabela deliverers
        deliverer_name: null,
        
        notes: pedido.delivery_obs,
        
        // ITENS - enviar como array E como JSON string para redundância
        items: itensFormatados,
        itens: itensFormatados,
        items_json: JSON.stringify(itensFormatados),
        items_count: itensFormatados.length,
        has_items: itensFormatados.length > 0,
        
        // Metadata
        source: 'ze-delivery',
        synced_at: timestamp
      });
    }

    // Verificar configuração Lovable
    const LOVABLE_URL = process.env.LOVABLE_SUPABASE_URL;
    const LOVABLE_KEY = process.env.LOVABLE_ZE_SYNC_KEY;

    if (!LOVABLE_URL || !LOVABLE_KEY) {
      console.log('⚠️  Lovable Cloud não configurado');
      fs.writeFileSync('/app/logs/sync-debug.json', JSON.stringify(pedidosFormatados, null, 2));
      console.log('   Debug salvo em /app/logs/sync-debug.json');
      return;
    }

    // Preparar payload
    const payload = {
      pedidos: pedidosFormatados,
      source: 'gamatauri-ze',
      timestamp: timestamp,
      force_update: true // Forçar atualização mesmo se existir
    };

    // Salvar debug
    fs.writeFileSync('/app/logs/sync-payload.json', JSON.stringify(payload, null, 2));
    console.log(`📤 Enviando para ${LOVABLE_URL}...`);
    
    const response = await fetch(
      `${LOVABLE_URL}/functions/v1/ze-sync-mysql`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${LOVABLE_KEY}`,
        },
        body: JSON.stringify(payload),
      }
    );

    if (response.ok) {
      const result = await response.json();
      console.log(`✅ Sincronização concluída:`, JSON.stringify(result));
    } else {
      const error = await response.text();
      console.error(`❌ Erro na sincronização: ${response.status} - ${error}`);
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

// Executar imediatamente e depois a cada intervalo
console.log('🚀 Sync Cron iniciado - sincronizando a cada 10 segundos');

// Função principal que sincroniza local + Lovable
async function runSync() {
  await syncLocalData();  // Sincroniza ze_pedido → delivery
  await syncToLovable();  // Envia para Lovable Cloud
}

runSync();
setInterval(runSync, SYNC_INTERVAL);

// Manter processo vivo
process.on('SIGINT', () => {
  console.log('\n👋 Sync Cron encerrado');
  process.exit(0);
});
