// Sync automático a cada 2 minutos para Lovable Cloud
require('dotenv').config();
const mysql = require('mysql2/promise');
const fetch = require('node-fetch');
const fs = require('fs');

const SYNC_INTERVAL = 2 * 60 * 1000; // 2 minutos

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'zedelivery',
  waitForConnections: true,
  connectionLimit: 5,
});

async function syncToLovable() {
  const timestamp = new Date().toISOString();
  console.log(`\n[${timestamp}] 🔄 Iniciando sincronização...`);
  
  try {
    // Buscar TODOS os pedidos com TODOS os detalhes
    const [pedidos] = await pool.query(`
      SELECT 
        d.delivery_id,
        d.delivery_ide,
        d.delivery_code,
        d.delivery_name_cliente,
        d.delivery_date_time,
        d.delivery_data_hora_captura,
        d.delivery_data_hora_aceite,
        d.delivery_status,
        d.delivery_subtotal,
        d.delivery_forma_pagamento,
        d.delivery_desconto,
        d.delivery_frete,
        d.delivery_total,
        d.delivery_cpf_cliente,
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
      WHERE d.delivery_trash = 0
      AND DATE(d.delivery_date_time) >= CURDATE() - INTERVAL 7 DAY
      ORDER BY d.delivery_date_time DESC
      LIMIT 200
    `);

    console.log(`📦 ${pedidos.length} pedidos encontrados`);

    // Buscar itens de cada pedido
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
      
      // Garantir que itens seja um array e converter para JSON string se necessário
      pedido.itens = itens || [];
      pedido.itens_json = JSON.stringify(itens || []);
      pedido.itens_count = itens ? itens.length : 0;
      
      console.log(`   Pedido ${pedido.delivery_code}: ${pedido.itens_count} itens`);
    }

    // Verificar configuração Lovable
    const LOVABLE_URL = process.env.LOVABLE_SUPABASE_URL;
    const LOVABLE_KEY = process.env.LOVABLE_ZE_SYNC_KEY;

    if (!LOVABLE_URL || !LOVABLE_KEY) {
      console.log('⚠️  Lovable Cloud não configurado');
      console.log('   Pedidos salvos apenas localmente.');
      
      // Salvar debug local
      fs.writeFileSync('/app/logs/sync-debug.json', JSON.stringify(pedidos, null, 2));
      console.log('   Debug salvo em /app/logs/sync-debug.json');
      return;
    }

    // Preparar payload com itens em formato JSON string
    const payload = {
      pedidos: pedidos.map(p => ({
        ...p,
        // Garantir que itens esteja em formato correto
        itens: p.itens,
        itens_json: JSON.stringify(p.itens || [])
      })),
      source: 'gamatauri-ze',
      timestamp: timestamp
    };

    // Salvar debug antes de enviar
    fs.writeFileSync('/app/logs/sync-payload.json', JSON.stringify(payload, null, 2));
    console.log(`📤 Enviando para ${LOVABLE_URL}...`);
    console.log(`   Payload salvo em /app/logs/sync-payload.json`);
    
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

// Executar imediatamente e depois a cada intervalo
console.log('🚀 Sync Cron iniciado - sincronizando a cada 2 minutos');
syncToLovable();
setInterval(syncToLovable, SYNC_INTERVAL);

// Manter processo vivo
process.on('SIGINT', () => {
  console.log('\n👋 Sync Cron encerrado');
  process.exit(0);
});
