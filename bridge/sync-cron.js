// Sync automático a cada 10 segundos para Lovable Cloud
require('dotenv').config();
const mysql = require('mysql2/promise');
const fetch = require('node-fetch');
const fs = require('fs');

const SYNC_INTERVAL = 10 * 1000; // 10 segundos

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3309,
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
    // Buscar TODOS os pedidos com TODOS os detalhes (colunas compatíveis com dump original)
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
      WHERE d.delivery_trash = 0
      AND DATE(d.delivery_date_time) >= CURDATE() - INTERVAL 7 DAY
      ORDER BY d.delivery_date_time DESC
      LIMIT 200
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

      console.log(`   Pedido ${pedido.delivery_code}: ${itensFormatados.length} itens`);
      
      // Formatar pedido para Lovable
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
        
        // Entrega - IMPORTANTE: enviar tipo exato do banco
        delivery_type: pedido.delivery_tipo_pedido || 'Pedido Comum',
        delivery_tipo_pedido: pedido.delivery_tipo_pedido || 'Pedido Comum', // Campo adicional com valor exato
        delivery_code: pedido.delivery_codigo_entrega,
        courier_email: pedido.delivery_email_entregador || null,
        notes: pedido.delivery_obs,
        
        // ITENS - enviar como array E como JSON string para redundância
        items: itensFormatados,
        items_json: JSON.stringify(itensFormatados),
        items_count: itensFormatados.length,
        has_items: itensFormatados.length > 0, // Flag para verificação
        
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
console.log('🚀 Sync Cron iniciado - sincronizando a cada 2 minutos');
syncToLovable();
setInterval(syncToLovable, SYNC_INTERVAL);

// Manter processo vivo
process.on('SIGINT', () => {
  console.log('\n👋 Sync Cron encerrado');
  process.exit(0);
});
