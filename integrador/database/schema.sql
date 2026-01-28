-- Schema do banco de dados Zé Delivery Integrador
CREATE DATABASE IF NOT EXISTS zedelivery CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE zedelivery;

-- Tabela hub_delivery (configuração de lojas)
CREATE TABLE IF NOT EXISTS hub_delivery (
    hub_delivery_id INT AUTO_INCREMENT PRIMARY KEY,
    hub_delivery_ide VARCHAR(64) NOT NULL UNIQUE,
    hub_delivery_nome VARCHAR(255),
    hub_delivery_email VARCHAR(255),
    hub_delivery_senha VARCHAR(255),
    hub_delivery_token VARCHAR(255),
    hub_delivery_id_company INT DEFAULT 0,
    hub_delivery_status TINYINT DEFAULT 1,
    hub_delivery_created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela ze_pedido (pedidos do Zé Delivery)
CREATE TABLE IF NOT EXISTS ze_pedido (
    pedido_id INT AUTO_INCREMENT PRIMARY KEY,
    pedido_ide VARCHAR(64),
    pedido_st TINYINT DEFAULT 0,
    pedido_st_validacao TINYINT DEFAULT 0,
    pedido_st_delivery TINYINT DEFAULT 0,
    pedido_code VARCHAR(50),
    pedido_nome VARCHAR(255),
    pedido_data VARCHAR(20),
    pedido_hora VARCHAR(10),
    pedido_data_hora_captura DATETIME,
    pedido_status VARCHAR(50),
    pedido_email_entregador VARCHAR(255),
    pedido_valor DECIMAL(10,2) DEFAULT 0,
    pedido_pagamento VARCHAR(50),
    pedido_tipo VARCHAR(50),
    pedido_cupom VARCHAR(50),
    pedido_desconto DECIMAL(10,2) DEFAULT 0,
    pedido_frete DECIMAL(10,2) DEFAULT 0,
    pedido_cpf_cliente VARCHAR(20),
    pedido_endereco_rota TEXT,
    pedido_endereco_complemento TEXT,
    pedido_endereco_cidade_uf VARCHAR(100),
    pedido_endereco_cep VARCHAR(15),
    pedido_endereco_bairro VARCHAR(100),
    pedido_troco_para DECIMAL(10,2) DEFAULT 0,
    pedido_taxa_conveniencia DECIMAL(10,2) DEFAULT 0,
    pedido_created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_pedido_code (pedido_code),
    INDEX idx_pedido_ide (pedido_ide)
);

-- Tabela ze_itens_pedido (itens dos pedidos)
CREATE TABLE IF NOT EXISTS ze_itens_pedido (
    itens_pedido_id INT AUTO_INCREMENT PRIMARY KEY,
    itens_pedido_id_pedido INT,
    itens_pedido_id_produto INT,
    itens_pedido_descricao_produto VARCHAR(500),
    itens_pedido_qtd INT DEFAULT 1,
    itens_pedido_valor_unitario DECIMAL(10,2) DEFAULT 0,
    itens_pedido_valor_total DECIMAL(10,2) DEFAULT 0,
    itens_pedido_st TINYINT DEFAULT 0,
    INDEX idx_itens_pedido (itens_pedido_id_pedido)
);

-- Tabela produto (produtos do catálogo)
CREATE TABLE IF NOT EXISTS produto (
    produto_id INT AUTO_INCREMENT PRIMARY KEY,
    produto_descricao VARCHAR(500),
    produto_link_imagem TEXT,
    produto_codigo_ze VARCHAR(100),
    produto_tipo VARCHAR(50),
    produto_created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabela delivery (pedidos processados para o sistema externo)
CREATE TABLE IF NOT EXISTS delivery (
    delivery_id INT AUTO_INCREMENT PRIMARY KEY,
    delivery_ide VARCHAR(64),
    delivery_ide_hub_delivery VARCHAR(64),
    delivery_code VARCHAR(50),
    delivery_name_cliente VARCHAR(255),
    delivery_date_time DATETIME,
    delivery_data_hora_captura DATETIME,
    delivery_data_hora_aceite DATETIME,
    delivery_status TINYINT DEFAULT 0,
    delivery_subtotal DECIMAL(10,2) DEFAULT 0,
    delivery_forma_pagamento VARCHAR(50),
    delivery_desconto DECIMAL(10,2) DEFAULT 0,
    delivery_frete DECIMAL(10,2) DEFAULT 0,
    delivery_total DECIMAL(10,2) DEFAULT 0,
    delivery_trash TINYINT DEFAULT 0,
    delivery_id_company INT DEFAULT 0,
    delivery_cpf_cliente VARCHAR(20),
    delivery_endereco_rota TEXT,
    delivery_endereco_complemento TEXT,
    delivery_endereco_cidade_uf VARCHAR(100),
    delivery_endereco_cep VARCHAR(15),
    delivery_endereco_bairro VARCHAR(100),
    delivery_troco_para DECIMAL(10,2) DEFAULT 0,
    delivery_troco DECIMAL(10,2) DEFAULT 0,
    delivery_taxa_conveniencia DECIMAL(10,2) DEFAULT 0,
    delivery_obs TEXT,
    delivery_tipo_pedido VARCHAR(50),
    delivery_codigo_entrega VARCHAR(50),
    delivery_tem_itens TINYINT DEFAULT 0,
    delivery_created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_delivery_code (delivery_code),
    INDEX idx_delivery_ide (delivery_ide_hub_delivery),
    INDEX idx_delivery_status (delivery_status)
);

-- Tabela delivery_itens (itens dos pedidos processados)
CREATE TABLE IF NOT EXISTS delivery_itens (
    delivery_itens_id INT AUTO_INCREMENT PRIMARY KEY,
    delivery_itens_id_delivery INT,
    delivery_itens_id_produto INT,
    delivery_itens_descricao VARCHAR(500),
    delivery_itens_qtd INT DEFAULT 1,
    delivery_itens_valor_unitario DECIMAL(10,2) DEFAULT 0,
    delivery_itens_valor_total DECIMAL(10,2) DEFAULT 0,
    INDEX idx_delivery_itens (delivery_itens_id_delivery)
);

-- Tabela delivery_data (data de eventos dos pedidos)
CREATE TABLE IF NOT EXISTS delivery_data (
    delivery_data_id INT AUTO_INCREMENT PRIMARY KEY,
    delivery_data_code VARCHAR(50),
    delivery_data_hora_pedido DATETIME,
    delivery_data_hora_aceite DATETIME,
    INDEX idx_delivery_data_code (delivery_data_code)
);

-- Tabela ze_duplo (códigos de verificação)
CREATE TABLE IF NOT EXISTS ze_duplo (
    duplo_id INT AUTO_INCREMENT PRIMARY KEY,
    duplo_codigo VARCHAR(10),
    duplo_usado TINYINT DEFAULT 0,
    duplo_created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Inserir hub delivery padrão com o token existente
INSERT INTO hub_delivery (hub_delivery_ide, hub_delivery_nome, hub_delivery_email, hub_delivery_senha, hub_delivery_token, hub_delivery_id_company)
VALUES ('e8194a871a0e6d26fe620d13f7baad86', 'Loja Principal', 'gamataurize@gmail.com', 'GamaZed01***', 'e8194a871a0e6d26fe620d13f7baad86', 1)
ON DUPLICATE KEY UPDATE hub_delivery_nome = 'Loja Principal';
