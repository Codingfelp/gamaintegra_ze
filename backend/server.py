const express = require("express");
const cors = require("cors");
const mysql = require("mysql2/promise");
const { spawn, exec } = require("child_process");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 8001;

app.use(cors());
app.use(express.json());

// Pool de conexão MySQL
const pool = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "",
  database: "zedelivery",
  port: 3306,
  waitForConnections: true,
  connectionLimit: 10
});

// ==================== ROTAS DE PEDIDOS ====================

// Listar pedidos
app.get("/api/pedidos", async (req, res) => {
  try {
    const { status, limit = 50, search } = req.query;
    let query = `
      SELECT d.*, 
        (SELECT COUNT(*) FROM delivery_itens WHERE delivery_itens_id_delivery = d.delivery_id) as total_itens
      FROM delivery d
      WHERE d.delivery_trash = 0
    `;
    const params = [];
    
    if (status && status !== "all") {
      query += " AND d.delivery_status = ?";
      params.push(status);
    }
    
    if (search) {
      query += " AND (d.delivery_code LIKE ? OR d.delivery_name_cliente LIKE ?)";
      params.push(`%${search}%`, `%${search}%`);
    }
    
    query += " ORDER BY d.delivery_date_time DESC LIMIT ?";
    params.push(parseInt(limit));
    
    const [rows] = await pool.query(query, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Detalhes do pedido
app.get("/api/pedidos/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const [[pedido]] = await pool.query(
      "SELECT * FROM delivery WHERE delivery_id = ?",
      [id]
    );
    
    const [itens] = await pool.query(`
      SELECT di.*, p.produto_descricao, p.produto_link_imagem, p.produto_codigo_ze
      FROM delivery_itens di
      LEFT JOIN produto p ON p.produto_id = di.delivery_itens_id_produto
      WHERE di.delivery_itens_id_delivery = ?
    `, [id]);
    
    res.json({ success: true, data: { pedido, itens } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Atualizar status do pedido
app.patch("/api/pedidos/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    await pool.query(
      "UPDATE delivery SET delivery_status = ? WHERE delivery_id = ?",
      [status, id]
    );
    
    res.json({ success: true, message: "Status atualizado" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Estatísticas dos pedidos
app.get("/api/pedidos/stats/summary", async (req, res) => {
  try {
    const [[total]] = await pool.query(
      "SELECT COUNT(*) as count FROM delivery WHERE delivery_trash = 0"
    );
    const [[pendentes]] = await pool.query(
      "SELECT COUNT(*) as count FROM delivery WHERE delivery_status = 0 AND delivery_trash = 0"
    );
    const [[aceitos]] = await pool.query(
      "SELECT COUNT(*) as count FROM delivery WHERE delivery_status = 2 AND delivery_trash = 0"
    );
    const [[entregues]] = await pool.query(
      "SELECT COUNT(*) as count FROM delivery WHERE delivery_status = 1 AND delivery_trash = 0"
    );
    const [[acaminho]] = await pool.query(
      "SELECT COUNT(*) as count FROM delivery WHERE delivery_status = 3 AND delivery_trash = 0"
    );
    const [[cancelados]] = await pool.query(
      "SELECT COUNT(*) as count FROM delivery WHERE delivery_status IN (4,5) AND delivery_trash = 0"
    );
    const [[faturamento]] = await pool.query(
      "SELECT COALESCE(SUM(delivery_total), 0) as total FROM delivery WHERE delivery_status = 1 AND delivery_trash = 0"
    );
    
    res.json({
      success: true,
      data: {
        total: total.count,
        pendentes: pendentes.count,
        aceitos: aceitos.count,
        entregues: entregues.count,
        acaminho: acaminho.count,
        cancelados: cancelados.count,
        faturamento: faturamento.total
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==================== ROTAS DE LOJAS ====================

app.get("/api/lojas", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM hub_delivery ORDER BY hub_delivery_id DESC");
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post("/api/lojas", async (req, res) => {
  try {
    const { nome, email, senha, id_company } = req.body;
    const crypto = require("crypto");
    const ide = crypto.createHash("md5").update(Date.now().toString() + Math.random()).digest("hex");
    
    await pool.query(
      `INSERT INTO hub_delivery (hub_delivery_ide, hub_delivery_nome, hub_delivery_email, hub_delivery_senha, hub_delivery_token, hub_delivery_id_company)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [ide, nome, email, senha, ide, id_company || 1]
    );
    
    res.json({ success: true, message: "Loja criada", ide });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.delete("/api/lojas/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM hub_delivery WHERE hub_delivery_id = ?", [req.params.id]);
    res.json({ success: true, message: "Loja removida" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==================== ROTAS DE PRODUTOS ====================

app.get("/api/produtos", async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM produto ORDER BY produto_id DESC LIMIT 100"
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==================== MONITORAMENTO DE SERVIÇOS ====================

// Store de logs em memória
let nodeLogs = [];
const MAX_LOGS = 500;

function addLog(type, message) {
  const log = {
    timestamp: new Date().toISOString(),
    type,
    message
  };
  nodeLogs.push(log);
  if (nodeLogs.length > MAX_LOGS) {
    nodeLogs = nodeLogs.slice(-MAX_LOGS);
  }
}

// Status dos serviços
app.get("/api/services/status", async (req, res) => {
  try {
    const services = {
      mysql: { status: "offline", message: "" },
      php: { status: "offline", message: "" },
      node_integrador: { status: "offline", message: "", pid: null },
      node_api: { status: "offline", message: "", pid: null }
    };
    
    // Verificar MySQL
    try {
      await pool.query("SELECT 1");
      services.mysql = { status: "online", message: "Conectado" };
    } catch (e) {
      services.mysql = { status: "offline", message: e.message };
    }
    
    // Verificar PHP
    try {
      const phpVersion = await new Promise((resolve, reject) => {
        exec("php -v | head -1", (err, stdout) => {
          if (err) reject(err);
          else resolve(stdout.trim());
        });
      });
      services.php = { status: "online", message: phpVersion };
    } catch (e) {
      services.php = { status: "offline", message: e.message };
    }
    
    // Verificar processos Node
    try {
      const psOutput = await new Promise((resolve, reject) => {
        exec("ps aux | grep -E 'v1.js|v1-itens.js|ze-api' | grep -v grep", (err, stdout) => {
          resolve(stdout || "");
        });
      });
      
      if (psOutput.includes("v1.js")) {
        const match = psOutput.match(/\s+(\d+)\s+.*v1\.js/);
        services.node_integrador = { 
          status: "online", 
          message: "Rodando",
          pid: match ? match[1] : null
        };
      }
      
      if (psOutput.includes("ze-api") || psOutput.includes("server.js")) {
        services.node_api = { status: "online", message: "Rodando" };
      }
    } catch (e) {
      // Processo não encontrado
    }
    
    res.json({ success: true, data: services });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Logs do integrador
app.get("/api/services/logs", (req, res) => {
  const { limit = 100 } = req.query;
  res.json({ 
    success: true, 
    data: nodeLogs.slice(-parseInt(limit)) 
  });
});

// Controlar serviços (start/stop/restart)
app.post("/api/services/:service/:action", async (req, res) => {
  const { service, action } = req.params;
  
  try {
    if (service === "integrador") {
      if (action === "start") {
        // Iniciar o integrador v1.js em background
        const child = spawn("node", ["v1.js"], {
          cwd: "/app/zedelivery-clean",
          detached: true,
          stdio: ["ignore", "pipe", "pipe"]
        });
        
        child.stdout.on("data", (data) => {
          addLog("info", data.toString());
        });
        
        child.stderr.on("data", (data) => {
          addLog("error", data.toString());
        });
        
        child.unref();
        addLog("info", `Integrador iniciado com PID ${child.pid}`);
        res.json({ success: true, message: "Integrador iniciado", pid: child.pid });
      } else if (action === "stop") {
        exec("pkill -f 'node v1.js'", (err) => {
          addLog("info", "Integrador parado");
          res.json({ success: true, message: "Integrador parado" });
        });
      } else if (action === "restart") {
        exec("pkill -f 'node v1.js'", () => {
          setTimeout(() => {
            const child = spawn("node", ["v1.js"], {
              cwd: "/app/zedelivery-clean",
              detached: true,
              stdio: ["ignore", "pipe", "pipe"]
            });
            child.stdout.on("data", (data) => addLog("info", data.toString()));
            child.stderr.on("data", (data) => addLog("error", data.toString()));
            child.unref();
            addLog("info", `Integrador reiniciado com PID ${child.pid}`);
            res.json({ success: true, message: "Integrador reiniciado", pid: child.pid });
          }, 1000);
        });
      }
    } else if (service === "itens") {
      if (action === "start") {
        const child = spawn("node", ["v1-itens.js"], {
          cwd: "/app/zedelivery-clean",
          detached: true,
          stdio: ["ignore", "pipe", "pipe"]
        });
        child.stdout.on("data", (data) => addLog("info", `[ITENS] ${data.toString()}`));
        child.stderr.on("data", (data) => addLog("error", `[ITENS] ${data.toString()}`));
        child.unref();
        addLog("info", `Serviço de itens iniciado com PID ${child.pid}`);
        res.json({ success: true, message: "Serviço de itens iniciado", pid: child.pid });
      } else if (action === "stop") {
        exec("pkill -f 'node v1-itens.js'", (err) => {
          addLog("info", "Serviço de itens parado");
          res.json({ success: true, message: "Serviço de itens parado" });
        });
      }
    } else {
      res.status(400).json({ success: false, error: "Serviço desconhecido" });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==================== CONFIGURAÇÃO ====================

app.get("/api/config", (req, res) => {
  try {
    const configPath = "/app/zedelivery-clean/configuracao.json";
    const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
    // Ocultar senha
    config.senha = "***";
    res.json({ success: true, data: config });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.put("/api/config", (req, res) => {
  try {
    const configPath = "/app/zedelivery-clean/configuracao.json";
    const currentConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
    
    // Atualizar apenas campos permitidos
    const { login, senha, token } = req.body;
    if (login) currentConfig.login = login;
    if (senha && senha !== "***") currentConfig.senha = senha;
    if (token) currentConfig.token = token;
    
    fs.writeFileSync(configPath, JSON.stringify(currentConfig, null, 4));
    res.json({ success: true, message: "Configuração atualizada" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Código de verificação (dupla autenticação)
app.get("/api/duplo", async (req, res) => {
  try {
    const [[row]] = await pool.query(
      "SELECT * FROM ze_duplo WHERE duplo_usado = 0 ORDER BY duplo_id DESC LIMIT 1"
    );
    if (row) {
      await pool.query("UPDATE ze_duplo SET duplo_usado = 1 WHERE duplo_id = ?", [row.duplo_id]);
      res.json({ codigo: row.duplo_codigo });
    } else {
      res.json({ codigo: null });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/duplo", async (req, res) => {
  try {
    const { codigo } = req.body;
    await pool.query("INSERT INTO ze_duplo (duplo_codigo) VALUES (?)", [codigo]);
    res.json({ success: true, message: "Código salvo" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Iniciar servidor
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 API Zé Delivery Integrador rodando em http://localhost:${PORT}`);
  addLog("info", "Servidor API iniciado");
});
