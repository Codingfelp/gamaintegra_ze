const express = require("express");
const router = express.Router();
const db = require("../db");

// 🛒 LISTAR PRODUTOS
router.get("/", async (_, res) => {
  try {
    const [rows] = await db.query(`
      SELECT produto_id, produto_descricao, produto_codigo_ze
      FROM produto
      ORDER BY produto_descricao
    `);

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
