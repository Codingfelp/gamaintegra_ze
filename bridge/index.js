require('dotenv').config();
const express = require('express');
const mysql = require('mysql2/promise');
const fetch = require('node-fetch');

const app = express();
app.use(express.json());

// Configuração do banco
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'railway',
  waitForConnections: true,
  connectionLimit: 10,
});

// Health check
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ 
      status: 'online', 
      database: 'connected', 
      timestamp: new Date().toISOString() 
    });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

// Listar pedidos do dia
app.get('/pedidos', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT d.*, 
        (SELECT GROUP_CONCAT(di.delivery_itens_descricao SEPARATOR ', ')
         FROM delivery_itens di 
         WHERE di.delivery_itens_id_delivery = d.delivery_id) as produtos
      FROM delivery d
      WHERE DATE(d.delivery_date_time) >= CURDATE() - INTERVAL 7 DAY
      AND d.delivery_trash = 0
      ORDER BY d.delivery_id DESC
      LIMIT 100
    `);
    res.json({ success: true, count: rows.length, pedidos: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Sync para Lovable Cloud
app.post('/sync', async (req, res) => {
  try {
    // Buscar pedidos ativos
    const [pedidos] = await pool.query(`
      SELECT d.*, 
        (SELECT JSON_ARRAYAGG(JSON_OBJECT(
          'descricao', di.delivery_itens_descricao,
          'qtd', di.delivery_itens_qtd,
          'valor_unitario', di.delivery_itens_valor_unitario,
          'valor_total', di.delivery_itens_valor_total
        )) FROM delivery_itens di WHERE di.delivery_itens_id_delivery = d.delivery_id) as itens
      FROM delivery d
      WHERE d.delivery_status IN (0, 2, 3)
      AND DATE(d.delivery_date_time) = CURDATE()
      AND d.delivery_trash = 0
    `);
    
    console.log(`📦 Sincronizando ${pedidos.length} pedidos...`);
    
    // Verificar se há configuração do Lovable
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SYNC_KEY = process.env.ZE_SYNC_KEY;
    
    if (!SUPABASE_URL || !SYNC_KEY) {
      console.log('⚠️ Lovable Cloud não configurado, retornando apenas dados locais');
      return res.json({ 
        success: true, 
        synced: false,
        message: 'Lovable Cloud não configurado',
        pedidos_count: pedidos.length,
        pedidos 
      });
    }
    
    // Enviar para Edge Function do Lovable
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/ze-sync-mysql`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SYNC_KEY}`,
        },
        body: JSON.stringify({ pedidos }),
      }
    );
    
    const result = await response.json();
    console.log('✅ Resultado sync:', result);
    
    res.json({ 
      success: true, 
      synced: true,
      pedidos_count: pedidos.length,
      cloud_result: result 
    });
  } catch (err) {
    console.error('❌ Erro no sync:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Webhook para receber atualizações do Lovable
app.post('/webhook', async (req, res) => {
  try {
    const { action, order_id, status } = req.body;
    console.log(`📥 Webhook recebido: ${action} - Order ${order_id}`);
    
    if (action === 'update_status' && order_id) {
      await pool.query(
        'UPDATE delivery SET delivery_status = ? WHERE delivery_code = ?',
        [status, order_id]
      );
      console.log(`✅ Status atualizado: ${order_id} -> ${status}`);
    }
    
    res.json({ success: true });
  } catch (err) {
    console.error('❌ Erro webhook:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

const PORT = process.env.PORT || 3333;
app.listen(PORT, () => {
  console.log(`🚀 Ze Bridge rodando na porta ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   Pedidos: http://localhost:${PORT}/pedidos`);
  console.log(`   Sync: POST http://localhost:${PORT}/sync`);
});
