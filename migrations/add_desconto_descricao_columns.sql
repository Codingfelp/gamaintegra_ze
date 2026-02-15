-- Adicionar coluna desconto_descricao nas tabelas ze_pedido e delivery
-- Execute este SQL no banco de dados MySQL

-- Tabela ze_pedido
ALTER TABLE ze_pedido ADD COLUMN IF NOT EXISTS pedido_desconto_descricao TEXT DEFAULT NULL;

-- Tabela delivery
ALTER TABLE delivery ADD COLUMN IF NOT EXISTS delivery_desconto_descricao TEXT DEFAULT NULL;

-- Verificar se as colunas foram criadas
-- DESCRIBE ze_pedido;
-- DESCRIBE delivery;
