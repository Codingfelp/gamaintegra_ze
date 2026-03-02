const mysql = require('mysql2/promise');
const fetch = require('node-fetch');

const SUPABASE_URL = 'https://uppkjvovtvlgwfciqrbt.supabase.co';
const ZE_SYNC_KEY = 'ze-sync-2026-mmjjzahms6m1lxfwomn0q25kquc7eun8';
const BATCH_SIZE = 50;

async function main() {
  console.log(' Iniciando reprocessamento completo para Supabase...');
  console.log(' Início:', new Date().toISOString());
  
  const conn = await mysql.createConnection({
    host: 'mainline.proxy.rlwy.net',
    port: 52996,
    user: 'root', 
    password: 'eHeoVCebYyaJVBEBtCLfYNHgRCrxWVXU',
    database: 'railway'
  });

  // Buscar todos os pedidos
  const [pedidos] = await conn.execute(`
    SELECT 
      d.delivery_id as id_local,
      d.delivery_code as order_number,
      d.delivery_status as status,
      d.delivery_name_cliente as customer_name,
      d.delivery_telefone as customer_phone,
      d.delivery_cpf_cliente as customer_cpf,
      d.delivery_date_time as created_at,
      d.delivery_subtotal as subtotal,
      d.delivery_total as total,
      d.delivery_frete as delivery_frete,
      d.delivery_desconto as discount,
      d.delivery_forma_pagamento as payment_method,
      d.delivery_email_entregador as courier_email,
      d.delivery_endereco_rota as delivery_endereco_rota,
      d.delivery_endereco_complemento as delivery_endereco_complemento,
      d.delivery_endereco_cidade_uf as delivery_endereco_cidade_uf,
      d.delivery_endereco_cep as delivery_endereco_cep,
      d.delivery_endereco_bairro as delivery_endereco_bairro,
      zp.pedido_tipo as delivery_tipo_pedido,
      zp.pedido_taxa_conveniencia as delivery_taxa_conveniencia,
      zp.pedido_troco_para as delivery_troco_para,
      zp.pedido_codigo_entrega as pickup_code
    FROM delivery d
    LEFT JOIN ze_pedido zp ON zp.pedido_code = d.delivery_code
    ORDER BY d.delivery_id DESC
  `);

  console.log('📊 Total de pedidos:', pedidos.length);
  
  // Buscar itens
  const [allItems] = await conn.execute(`
    SELECT delivery_itens_id_delivery, delivery_itens_descricao as nome,
           delivery_itens_qtd as quantidade, delivery_itens_valor_unitario as preco_unitario,
           delivery_itens_valor_total as preco_total
    FROM delivery_itens
  `);
  
  const itemsMap = new Map();
  allItems.forEach(item => {
    const key = item.delivery_itens_id_delivery;
    if (!itemsMap.has(key)) itemsMap.set(key, []);
    itemsMap.get(key).push(item);
  });
  
  const pedidosComItens = pedidos.map(p => ({...p, items: itemsMap.get(p.id_local) || []}));

  let totalSynced = 0, totalUpdated = 0, totalErrors = 0;
  const totalBatches = Math.ceil(pedidosComItens.length / BATCH_SIZE);

  for (let i = 0; i < pedidosComItens.length; i += BATCH_SIZE) {
    const batch = pedidosComItens.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/ze-sync-mysql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${ZE_SYNC_KEY}`,
          'x-api-key': ZE_SYNC_KEY
        },
        body: JSON.stringify({ pedidos: batch })
      });
      
      const result = await response.json();
      
      if (result.success) {
        totalSynced += result.synced || 0;
        totalUpdated += result.updated || 0;
        console.log(` Lote ${batchNum}/${totalBatches}: ${result.synced || 0} novos, ${result.updated || 0} atualizados`);
        if (result.errors) totalErrors += result.errors.length;
      } else {
        console.log(` Lote ${batchNum}: ${result.error}`);
        totalErrors += batch.length;
      }
    } catch (err) {
      console.log(` Lote ${batchNum}: ${err.message}`);
      totalErrors += batch.length;
    }
    
    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`\n========================================`);
  console.log(`📊 RESULTADO FINAL:`);
  console.log(`   Total: ${pedidosComItens.length}`);
  console.log(`   Novos: ${totalSynced}`);
  console.log(`   Atualizados: ${totalUpdated}`);
  console.log(`   Erros: ${totalErrors}`);
  console.log(` Fim: ${new Date().toISOString()}`);
  console.log(`========================================`);

  await conn.end();
}

main().catch(console.error);
