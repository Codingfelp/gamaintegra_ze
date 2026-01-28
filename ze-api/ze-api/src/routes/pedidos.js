const express = require("express");
const router = express.Router();
const db = require("../db");

// 📦 LISTAR PEDIDOS
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT * FROM delivery
      WHERE delivery_trash = 0
      ORDER BY delivery_date_time DESC
      LIMIT 50
    `);

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 📦 PEDIDO COMPLETO (pedido + itens)
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const [[pedido]] = await db.query(
      "SELECT * FROM delivery WHERE delivery_id = ?",
      [id]
    );

    const [itens] = await db.query(`
      SELECT di.*, p.produto_descricao, p.produto_codigo_ze
      FROM delivery_itens di
      LEFT JOIN produto p 
        ON p.produto_id = di.delivery_itens_id_produto
      WHERE di.delivery_itens_id_delivery = ?
    `, [id]);

    res.json({ pedido, itens });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
