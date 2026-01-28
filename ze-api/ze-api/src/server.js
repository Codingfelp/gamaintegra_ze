const express = require("express");
const cors = require("cors");
require("dotenv").config();

const pedidosRoutes = require("./routes/pedidos");
const produtosRoutes = require("./routes/produtos");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/pedidos", pedidosRoutes);
app.use("/produtos", produtosRoutes);

app.get("/", (_, res) => {
  res.json({ status: "API ZE ONLINE 🚀" });
});

app.listen(process.env.PORT, () => {
  console.log(`🔥 API rodando em http://localhost:${process.env.PORT}`);
});
