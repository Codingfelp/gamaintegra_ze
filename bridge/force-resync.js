// Script para forçar o reenvio de TODOS os pedidos para Lovable Cloud
// Uso: node force-resync.js

require('dotenv').config();
const mysql = require('mysql2/promise');
const fetch = require('node-fetch');
const fs = require('fs');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3309,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'railway',
  waitForConnections: true,
  connectionLimit: 5,
});

async function forceResync() {
  const timestamp = new Date().toISOString();
  console.log(`\n[${timestamp}]  FORÇANDO REENVIO DE TODOS OS PEDIDOS...`);
  
  try {
    // Buscar pedidos ÚNICOS (por delivery_code) priorizando os que têm itens
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
      ORDER BY d.delivery_date_time DESC
    `);

    console.log(` ${pedidos.length} pedidos encontrados no total`);

    // Buscar itens de cada pedido
    const pedidosFormatados = [];
    let pedidosSemItens = [];
    
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
      
      const itensFormatados = (itens || []).map(item => ({
        id: item.delivery_itens_id,
        nome: item.delivery_itens_descricao || item.produto_descricao || 'Produto',
        quantidade: item.delivery_itens_qtd || '1',
        preco_unitario: parseFloat(item.delivery_itens_valor_unitario) || 0,
        preco_total: parseFloat(item.delivery_itens_valor_total) || 0,
        codigo_ze: item.produto_codigo_ze || '',
        imagem: item.produto_link_imagem || ''
      }));

      // Rastrear pedidos sem itens
      if (itensFormatados.length === 0) {
        pedidosSemItens.push({
          id: pedido.delivery_id,
          code: pedido.delivery_code,
          tipo: pedido.delivery_tipo_pedido,
          tem_itens: pedido.delivery_tem_itens
        });
      }
      
      pedidosFormatados.push({
        // Identificadores
        id_local: pedido.delivery_id,
        external_id: pedido.delivery_code,
        ide: pedido.delivery_ide,
        
        // Cliente
        customer_name: pedido.delivery_name_cliente,
        customer_cpf: pedido.delivery_cpf_cliente,
        
        // Endereço
        address: pedido.delivery_endereco_rota,
        address_complement: pedido.delivery_endereco_complemento,
        address_neighborhood: pedido.delivery_endereco_bairro,
        address_city: pedido.delivery_endereco_cidade_uf,
        address_zip: pedido.delivery_endereco_cep,
        
        // Status e datas
        status: pedido.delivery_status,
        status_text: getStatusText(pedido.delivery_status),
        created_at: pedido.delivery_date_time,
        captured_at: pedido.delivery_data_hora_captura,
        
        // Valores
        subtotal: parseFloat(pedido.delivery_subtotal) || 0,
        discount: parseFloat(pedido.delivery_desconto) || 0,
        delivery_fee: parseFloat(pedido.delivery_frete) || 0,
        total: parseFloat(pedido.delivery_total) || 0,
        convenience_fee: parseFloat(pedido.delivery_taxa_conveniencia) || 0,
        
        // Pagamento
        payment_method: pedido.delivery_forma_pagamento,
        change_for: parseFloat(pedido.delivery_troco_para) || 0,
        change: parseFloat(pedido.delivery_troco) || 0,
        
        // Entrega - TIPO EXATO DO BANCO
        delivery_type: pedido.delivery_tipo_pedido || 'Pedido Comum',
        delivery_tipo_pedido: pedido.delivery_tipo_pedido || 'Pedido Comum',
        delivery_code: pedido.delivery_codigo_entrega,
        courier_email: pedido.delivery_email_entregador || null,
        notes: pedido.delivery_obs,
        
        // ITENS
        items: itensFormatados,
        items_json: JSON.stringify(itensFormatados),
        items_count: itensFormatados.length,
        has_items: itensFormatados.length > 0,
        
        // Metadata
        source: 'ze-delivery',
        synced_at: timestamp,
        force_update: true
      });
    }

    console.log(`\n📊 RESUMO:`);
    console.log(`   Total: ${pedidosFormatados.length} pedidos`);
    console.log(`   Com itens: ${pedidosFormatados.length - pedidosSemItens.length}`);
    console.log(`   Sem itens: ${pedidosSemItens.length}`);
    
    if (pedidosSemItens.length > 0) {
      console.log(`\n  Pedidos SEM itens no banco:`);
      pedidosSemItens.forEach(p => {
        console.log(`   - ${p.code} (${p.tipo}) tem_itens=${p.tem_itens}`);
      });
    }

    // Contar por tipo
    const tipoCount = {};
    pedidosFormatados.forEach(p => {
      const tipo = p.delivery_tipo_pedido || 'Não definido';
      tipoCount[tipo] = (tipoCount[tipo] || 0) + 1;
    });
    console.log(`\n Por tipo de pedido:`);
    Object.entries(tipoCount).forEach(([tipo, count]) => {
      console.log(`   ${tipo}: ${count}`);
    });

    // Verificar configuração Lovable
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SYNC_KEY = process.env.ZE_SYNC_KEY;

    if (!SUPABASE_URL || !SYNC_KEY) {
      console.log('\n  Lovable Cloud não configurado');
      fs.writeFileSync('/app/logs/force-resync-payload.json', JSON.stringify(pedidosFormatados, null, 2));
      console.log('   Payload salvo em /app/logs/force-resync-payload.json');
      process.exit(0);
    }

    // Enviar em lotes de 50 para não sobrecarregar
    const BATCH_SIZE = 50;
    let totalSynced = 0;
    let totalUpdated = 0;
    let totalErrors = 0;

    for (let i = 0; i < pedidosFormatados.length; i += BATCH_SIZE) {
      const batch = pedidosFormatados.slice(i, i + BATCH_SIZE);
      console.log(`\n Enviando lote ${Math.floor(i/BATCH_SIZE) + 1} (${batch.length} pedidos)...`);
      
      const payload = {
        pedidos: batch,
        source: 'gamatauri-ze-force-resync',
        timestamp: timestamp,
        force_update: true
      };

      try {
        const response = await fetch(
          `${SUPABASE_URL}/functions/v1/ze-sync-mysql`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${SYNC_KEY}`,
            },
            body: JSON.stringify(payload),
          }
        );

        if (response.ok) {
          const result = await response.json();
          console.log(`    Resultado: synced=${result.synced || 0} updated=${result.updated || 0}`);
          totalSynced += result.synced || 0;
          totalUpdated += result.updated || 0;
        } else {
          const error = await response.text();
          console.error(`    Erro: ${response.status} - ${error}`);
          totalErrors += batch.length;
        }
      } catch (err) {
        console.error(`    Erro de rede: ${err.message}`);
        totalErrors += batch.length;
      }

      // Aguardar 1 segundo entre lotes
      if (i + BATCH_SIZE < pedidosFormatados.length) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    console.log(`\n REENVIO COMPLETO!`);
    console.log(`   Novos: ${totalSynced}`);
    console.log(`   Atualizados: ${totalUpdated}`);
    console.log(`   Erros: ${totalErrors}`);

  } catch (err) {
    console.error(` Erro: ${err.message}`);
    console.error(err.stack);
  }

  process.exit(0);
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

// Executar
forceResync();
