-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1:3307
-- Tempo de geração: 30/01/2026 às 00:00
-- Versão do servidor: 10.4.32-MariaDB
-- Versão do PHP: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Banco de dados: `zedelivery`
--

-- --------------------------------------------------------

--
-- Estrutura para tabela `delivery`
--

CREATE TABLE `delivery` (
  `delivery_id` int(11) NOT NULL,
  `delivery_id_company` int(11) DEFAULT NULL,
  `delivery_ide_hub_delivery` varchar(32) DEFAULT NULL,
  `delivery_ide` varchar(32) DEFAULT NULL,
  `delivery_code` varchar(255) DEFAULT NULL,
  `delivery_name_cliente` varchar(255) DEFAULT NULL,
  `delivery_date_time` datetime DEFAULT NULL,
  `delivery_status` int(11) DEFAULT NULL,
  `delivery_subtotal` double(15,2) DEFAULT NULL,
  `delivery_forma_pagamento` varchar(255) DEFAULT NULL,
  `delivery_desconto` double(15,2) DEFAULT NULL,
  `delivery_total` double(15,2) DEFAULT NULL,
  `delivery_trash` int(11) DEFAULT NULL,
  `delivery_frete` double(15,2) DEFAULT NULL,
  `delivery_cpf_cliente` varchar(255) DEFAULT NULL,
  `delivery_endereco_rota` varchar(255) DEFAULT NULL,
  `delivery_endereco_complemento` varchar(255) DEFAULT NULL,
  `delivery_endereco_cidade_uf` varchar(255) DEFAULT NULL,
  `delivery_endereco_cep` varchar(255) DEFAULT NULL,
  `delivery_endereco_bairro` varchar(255) DEFAULT NULL,
  `delivery_troco` double(15,2) DEFAULT NULL,
  `delivery_troco_para` double(15,2) DEFAULT NULL,
  `delivery_taxa_conveniencia` double(15,2) DEFAULT NULL,
  `delivery_data_hora_captura` datetime DEFAULT NULL,
  `delivery_codigo_entrega` varchar(60) DEFAULT NULL,
  `delivery_obs` mediumtext DEFAULT NULL,
  `delivery_data_itens` varchar(50) DEFAULT NULL,
  `delivery_tipo_pedido` varchar(50) DEFAULT NULL,
  `delivery_telefone` varchar(50) DEFAULT NULL,
  `delivery_tem_itens` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci ROW_FORMAT=DYNAMIC;

--
-- Despejando dados para a tabela `delivery`
--

INSERT INTO `delivery` (`delivery_id`, `delivery_id_company`, `delivery_ide_hub_delivery`, `delivery_ide`, `delivery_code`, `delivery_name_cliente`, `delivery_date_time`, `delivery_status`, `delivery_subtotal`, `delivery_forma_pagamento`, `delivery_desconto`, `delivery_total`, `delivery_trash`, `delivery_frete`, `delivery_cpf_cliente`, `delivery_endereco_rota`, `delivery_endereco_complemento`, `delivery_endereco_cidade_uf`, `delivery_endereco_cep`, `delivery_endereco_bairro`, `delivery_troco`, `delivery_troco_para`, `delivery_taxa_conveniencia`, `delivery_data_hora_captura`, `delivery_codigo_entrega`, `delivery_obs`, `delivery_data_itens`, `delivery_tipo_pedido`, `delivery_telefone`, `delivery_tem_itens`) VALUES
(160169, 2, 'e8194a871a0e6d26fe620d13f7baad86', 'ad9a03c6adba10351d0669e20dc37f27', '238934302', 'Abílio', '2026-01-27 21:15:18', 1, 205.28, 'Dinheiro', 0.00, 213.27, 0, 7.99, '11571554645', 'Rua Ozanam, 465', 'Casa', 'Belo Horizonte  MG', '31160210', 'Ipiranga', 0.00, 0.00, 0.00, '2026-01-28 01:16:18', 'PYG 6RI 25D G', '0', NULL, 'Pedido Comum', NULL, 1),
(160170, 2, 'e8194a871a0e6d26fe620d13f7baad86', 'b21d16ca9baaa6e677b2d4d2528aedc3', '607161344', 'Guilherme', '2026-01-27 21:10:18', 1, 108.59, 'Online Pix', 3.60, 112.98, 0, 7.99, '12464990612', 'Rua Faraday, 2', 'Primeira esquerda subindo moro', 'Belo Horizonte  MG', '31810020', 'Vila Primeiro de Maio', 0.00, 0.00, 0.00, '2026-01-28 01:16:19', 'RWF V24 KKV G', '0', NULL, 'Pedido Comum', NULL, 1),
(160171, 2, 'e8194a871a0e6d26fe620d13f7baad86', 'ffba7304ca679496931117b51c49f6b0', '955281344', 'Lucas', '2026-01-27 20:51:18', 1, 237.17, 'Dinheiro', 0.00, 245.16, 0, 7.99, '70362448604', '0', '0', '0', '0', '0', 0.00, 0.00, 0.00, '2026-01-28 01:16:20', '0', '0', NULL, 'Pedido Comum', NULL, 1),
(160172, 2, 'e8194a871a0e6d26fe620d13f7baad86', '471446a8725df888c2898faeb94f4e81', '972033224', 'Robert', '2026-01-27 20:38:18', 1, 100.17, 'Online Pix', 20.00, 88.16, 0, 7.99, '14764106663', '0', '0', '0', '0', '0', 0.00, 0.00, 0.00, '2026-01-28 01:16:22', '0', '0', NULL, 'Pedido Comum', NULL, 1),
(160173, 2, 'e8194a871a0e6d26fe620d13f7baad86', '10485979e899ec84c5c1a87aa8548c44', '520980191', 'Max', '2026-01-27 20:28:18', 1, 72.87, 'Cartão', 7.99, 72.87, 0, 7.99, '96090693634', '0', '0', '0', '0', '0', 0.00, 0.00, 0.00, '2026-01-28 01:16:23', '0', '0', NULL, 'Pedido Comum', NULL, 1),
(160174, 2, 'e8194a871a0e6d26fe620d13f7baad86', '7379cbe143fb0285e3c6a777566db592', '784052311', 'Ana', '2026-01-27 20:24:18', 1, 77.79, 'Online Nubank', 0.00, 85.78, 0, 7.99, '18504670643', '0', '0', '0', '0', '0', 0.00, 0.00, 0.00, '2026-01-28 01:16:24', '0', '0', NULL, 'Pedido Comum', NULL, 1),
(160175, 2, 'e8194a871a0e6d26fe620d13f7baad86', '45dbc59440afd5db3268f21f6abdd9ad', '237616360', 'Larissa', '2026-01-27 20:11:18', 1, 27.63, 'Online Crédito', 0.00, 36.61, 0, 8.98, '11243912669', '0', '0', '0', '0', '0', 0.00, 0.00, 0.00, '2026-01-28 01:16:25', '0', '0', NULL, 'Pedido Comum', NULL, 1),
(160176, 2, 'e8194a871a0e6d26fe620d13f7baad86', '795420ec63033bbc60db8d0dfbf76453', '264060431', 'Nilvania', '2026-01-27 19:42:18', 1, 128.64, 'Dinheiro', 7.99, 128.64, 0, 7.99, '63240971615', '0', '0', '0', '0', '0', 0.00, 130.00, 0.00, '2026-01-28 01:16:26', '0', '0', NULL, 'Pedido Comum', NULL, 1),
(160177, 2, 'e8194a871a0e6d26fe620d13f7baad86', '1afdd5dab4fa2880d89516dfcce309e5', '871319344', 'Leonardo', '2026-01-27 19:37:18', 1, 75.04, 'Online Pix', 0.00, 83.03, 0, 7.99, '69855471687', '0', '0', '0', '0', '0', 0.00, 0.00, 0.00, '2026-01-28 01:16:27', '0', '0', NULL, 'Pedido Comum', NULL, 1),
(160178, 2, 'e8194a871a0e6d26fe620d13f7baad86', '46428f456273599bb7350386219fb7db', '990093266', 'Hugo', '2026-01-27 19:32:18', 1, 54.27, 'Online Pix', 7.99, 54.27, 0, 7.99, '09033739631', '0', '0', '0', '0', '0', 0.00, 0.00, 0.00, '2026-01-28 01:16:28', '0', '0', NULL, 'Pedido Comum', NULL, 1),
(160179, 2, 'e8194a871a0e6d26fe620d13f7baad86', '8398da3a02a437a02e6ed8626c22f1f1', '307411183', 'Rafael', '2026-01-27 19:26:18', 1, 53.52, 'Online Pix', 10.00, 55.51, 0, 11.99, '05933741698', '0', '0', '0', '0', '0', 0.00, 0.00, 0.00, '2026-01-28 01:16:29', '0', '0', NULL, 'Pedido Turbo', NULL, 1),
(160180, 2, 'e8194a871a0e6d26fe620d13f7baad86', '1e1b773b8dd4d038f9b124510c25f46e', '173306930', 'Stefanie', '2026-01-27 19:23:18', 1, 27.97, 'Cartão', 7.99, 28.96, 0, 8.98, '07786779663', '0', '0', '0', '0', '0', 0.00, 0.00, 0.00, '2026-01-28 01:16:30', '0', '0', NULL, 'Pedido Comum', NULL, 1),
(160181, 2, 'e8194a871a0e6d26fe620d13f7baad86', '2561dccf1115c2985623b00fefdc9c0e', '745216618', 'João', '2026-01-27 18:57:18', 4, 65.57, 'Online Crédito', 7.99, 65.57, 0, 7.99, '06714097603', '0', '0', '0', '0', '0', 0.00, 0.00, 0.00, '2026-01-28 01:16:31', '0', '0', NULL, 'Pedido Comum', NULL, 1),
(160182, 2, 'e8194a871a0e6d26fe620d13f7baad86', '378c33e61f9d42c33a53135f5c3a6fe2', '712993902', 'selma', '2026-01-27 18:23:18', 1, 32.88, 'Dinheiro', 0.00, 41.86, 0, 8.98, '68899033668', '0', '0', '0', '0', '0', 0.00, 0.00, 0.00, '2026-01-28 01:16:33', '0', '0', NULL, 'Pedido Comum', NULL, 1),
(160183, 2, 'e8194a871a0e6d26fe620d13f7baad86', '875f7d249f371e5d7b1d81509f4c0315', '923904749', 'Janete', '2026-01-27 18:11:18', 1, 53.95, 'Cartão', 7.99, 53.95, 0, 7.99, '05920324694', '0', '0', '0', '0', '0', 0.00, 0.00, 0.00, '2026-01-28 01:16:34', '0', '0', NULL, 'Pedido Comum', NULL, 1),
(160184, 2, 'e8194a871a0e6d26fe620d13f7baad86', '85f8b9edde6ef45209fffc4004e66cc2', '297172340', 'Sofia', '2026-01-27 17:58:18', 1, 33.23, 'Online Crédito', 0.00, 42.21, 0, 8.98, '12342002602', '0', '0', '0', '0', '0', 0.00, 0.00, 0.00, '2026-01-28 01:16:35', '0', '0', NULL, 'Pedido Comum', NULL, 1),
(160185, 2, 'e8194a871a0e6d26fe620d13f7baad86', '6c65f57d20aefa33f25deb28649707bd', '847026445', 'Juliana', '2026-01-27 17:40:18', 1, 137.44, 'Online Nubank', 20.00, 133.42, 0, 7.99, '73302155620', '0', '0', '0', '0', '0', 0.00, 0.00, 7.99, '2026-01-28 01:16:36', '0', '0', NULL, 'Pedido Comum', NULL, 1),
(160186, 2, 'e8194a871a0e6d26fe620d13f7baad86', '85e81b74b74272fca6eaa33a20e39499', '258351688', 'Genderson', '2026-01-27 17:39:18', 1, 78.24, 'Online Crédito', 0.00, 86.23, 0, 7.99, '54702402668', '0', '0', '0', '0', '0', 0.00, 0.00, 0.00, '2026-01-28 01:16:37', '0', '0', NULL, 'Pedido Comum', NULL, 1),
(160187, 2, 'e8194a871a0e6d26fe620d13f7baad86', '26957bbaebfcfbd360b5c58e9b5a5804', '462993868', 'Luciano', '2026-01-27 17:36:18', 4, 160.56, 'Cartão', 0.00, 172.55, 0, 11.99, '85157317620', '0', '0', '0', '0', '0', 0.00, 0.00, 0.00, '2026-01-28 01:16:38', '0', '0', NULL, 'Pedido Turbo', NULL, 1),
(160188, 2, 'e8194a871a0e6d26fe620d13f7baad86', 'a1b0640a9c6137b88e39ffed4e7a5395', '627958801', 'Enrico', '2026-01-27 17:20:18', 1, 27.14, 'Online Crédito', 0.00, 36.12, 0, 8.98, '12425584625', '0', '0', '0', '0', '0', 0.00, 0.00, 0.00, '2026-01-28 01:16:39', '0', '0', NULL, 'Pedido Comum', NULL, 1),
(160189, 2, 'e8194a871a0e6d26fe620d13f7baad86', 'fa1627e70a116587a2f8efcd3f8e4a5a', '942551124', 'Vinicius', '2026-01-27 16:27:18', 1, 51.03, 'Cartão', 10.00, 49.02, 0, 7.99, '08844170779', '0', '0', '0', '0', '0', 0.00, 0.00, 0.00, '2026-01-28 01:16:40', '0', '0', NULL, 'Pedido Comum', NULL, 1),
(160190, 2, 'e8194a871a0e6d26fe620d13f7baad86', 'e8371828c63345cc6de92a4727991535', '232445597', 'Bruno', '2026-01-27 16:20:18', 1, 180.90, 'Online Pix', 0.00, 188.89, 0, 7.99, '04235413660', '0', '0', '0', '0', '0', 0.00, 0.00, 0.00, '2026-01-28 01:16:41', '0', '0', NULL, 'Pedido Comum', NULL, 1),
(160191, 2, 'e8194a871a0e6d26fe620d13f7baad86', 'f05e204e8705b0929661b76fb830fddc', '743484233', 'Luiza', '2026-01-27 15:37:18', 1, 34.00, 'Online Nubank', 7.99, 34.99, 0, 8.98, '14308116686', '0', '0', '0', '0', '0', 0.00, 0.00, 0.00, '2026-01-28 01:16:42', '0', '0', NULL, 'Pedido Comum', NULL, 1),
(160192, 2, 'e8194a871a0e6d26fe620d13f7baad86', 'b956a49162be67612eb4d00ada53629b', '142503539', 'Maria', '2026-01-27 15:32:18', 1, 53.88, 'Dinheiro', 0.00, 61.87, 0, 7.99, '03467059759', '0', '0', '0', '0', '0', 0.00, 65.00, 0.00, '2026-01-28 01:16:44', '0', '0', NULL, 'Pedido Comum', NULL, 1),
(160193, 2, 'e8194a871a0e6d26fe620d13f7baad86', 'b505e945cba3fe1154bda99a10ad56de', '398202688', 'Gabriela', '2026-01-27 14:53:18', 1, 41.30, 'Online Pix', 7.99, 41.30, 0, 7.99, '15845677670', '0', '0', '0', '0', '0', 0.00, 0.00, 0.00, '2026-01-28 01:16:45', '0', '0', NULL, 'Pedido Comum', NULL, 1),
(160194, 2, 'e8194a871a0e6d26fe620d13f7baad86', 'ddcfe77bfdfa2b271a2cf18b85700ef7', '630932561', 'João', '2026-01-27 14:41:18', 1, 104.30, 'Online Nubank', 0.00, 112.29, 0, 7.99, '08930698689', '0', '0', '0', '0', '0', 0.00, 0.00, 0.00, '2026-01-28 01:16:46', '0', '0', NULL, 'Pedido Comum', NULL, 1),
(160195, 2, 'e8194a871a0e6d26fe620d13f7baad86', '6c870ea1706d4ee80cb0d3b682194921', '650799796', 'Samuel', '2026-01-27 14:34:18', 1, 36.57, 'Cartão', 0.00, 44.56, 0, 7.99, '13065598639', '0', '0', '0', '0', '0', 0.00, 0.00, 0.00, '2026-01-28 01:16:47', '0', '0', NULL, 'Pedido Comum', NULL, 1),
(160196, 2, 'e8194a871a0e6d26fe620d13f7baad86', '3dc7d831dfc489371492d3977b20a6a8', '359347018', 'Brenda', '2026-01-27 14:03:18', 1, 101.65, 'Dinheiro', 20.00, 89.64, 0, 7.99, '02263290621', '0', '0', '0', '0', '0', 0.00, 0.00, 0.00, '2026-01-28 01:16:48', '0', '0', NULL, 'Pedido Comum', NULL, 1),
(160197, 2, 'e8194a871a0e6d26fe620d13f7baad86', '8d5b4ce98de7e118cabb082fc8e7b6f0', '703135418', 'Ferraz', '2026-01-27 12:05:18', 1, 88.52, 'Online Crédito', 0.00, 96.51, 0, 7.99, '01231161639', '0', '0', '0', '0', '0', 0.00, 0.00, 0.00, '2026-01-28 01:16:49', '0', '0', NULL, 'Pedido Comum', NULL, 1),
(160198, 2, 'e8194a871a0e6d26fe620d13f7baad86', '5e5e95efc41997bb5bbbac0463a4f31d', '987321292', 'Rafael', '2026-01-27 12:00:18', 1, 53.34, 'Cartão', 7.99, 53.34, 0, 7.99, '13374143601', '0', '0', '0', '0', '0', 0.00, 0.00, 0.00, '2026-01-28 01:16:50', '0', '0', NULL, 'Pedido Comum', NULL, 1),
(160199, 2, 'e8194a871a0e6d26fe620d13f7baad86', 'e654017431436f779e81c76763861835', '788971977', 'Joaima', '2026-01-27 22:10:33', 1, 27.56, 'Online Pix', 0.00, 37.54, 0, 9.98, '05994734608', '0', '0', '0', '0', '0', 0.00, 0.00, 0.00, '2026-01-28 02:56:34', '0', '0', NULL, 'Pedido Comum', NULL, 1),
(160200, 2, 'e8194a871a0e6d26fe620d13f7baad86', 'd6d61ac34dedd7aa8ddc29085fec2231', '488229435', 'Léah', '2026-01-27 22:09:33', 1, 28.70, 'Online Pix', 8.99, 29.69, 0, 9.98, '07596400680', '0', '0', '0', '0', '0', 0.00, 0.00, 0.00, '2026-01-28 02:56:35', '0', '0', NULL, 'Pedido Comum', NULL, 1),
(160201, 2, 'e8194a871a0e6d26fe620d13f7baad86', '8ece901b5071438a43484fe34dba6475', '376201647', '', '2026-01-27 21:29:33', 1, 54.73, 'Cartão', 7.99, 54.73, 0, 7.99, '70012514616', '0', '0', '0', '0', '0', 0.00, 0.00, 0.00, '2026-01-28 02:56:36', '0', '0', NULL, 'Pedido Comum', NULL, 1),
(160202, 2, 'e8194a871a0e6d26fe620d13f7baad86', 'fc2225dec84da2bb41f00473cc9759de', '575196487', 'Natália', '2026-01-28 12:52:38', 0, 44.52, 'Online Nubank', 7.99, 44.52, 0, 7.99, '01913120619', 'Rua Elza, 50', 'Casa', 'Belo Horizonte  MG', '31260530', 'Vila Suzana', 0.00, 0.00, 0.00, '2026-01-28 16:52:38', 'DPY 8D1 VVV Q', '0', NULL, 'Pedido Comum', NULL, 1),
(160203, 2, 'e8194a871a0e6d26fe620d13f7baad86', 'a320b63a80e2943c270084e7b02d8041', '406877792', 'Gabriel', '2026-01-28 11:32:38', 1, 63.46, 'Online Crédito', 0.00, 71.45, 0, 7.99, '06882235678', '0', '0', '0', '0', '0', 0.00, 0.00, 0.00, '2026-01-28 16:52:39', '0', '0', NULL, 'Pedido Comum', NULL, 1),
(160204, 2, 'e8194a871a0e6d26fe620d13f7baad86', '2e621a2c013618ffea2fcaa4d4b978aa', '123040254', 'Thalita', '2026-01-28 11:23:38', 1, 27.48, 'Online Pix', 1.00, 39.46, 0, 12.98, '03927174173', '0', '0', '0', '0', '0', 0.00, 0.00, 0.00, '2026-01-28 16:52:40', '0', '0', NULL, 'Pedido Turbo', NULL, 1),
(160205, 2, 'e8194a871a0e6d26fe620d13f7baad86', '3bfc56c452c6626657197b30ac544681', '248100937', 'Regiane', '2026-01-28 11:03:38', 1, 65.04, 'Online Pix', 10.00, 63.03, 0, 7.99, '08267926690', '0', '0', '0', '0', '0', 0.00, 0.00, 0.00, '2026-01-28 16:52:41', '0', '0', NULL, 'Pedido Comum', NULL, 1),
(160206, 2, 'e8194a871a0e6d26fe620d13f7baad86', '5514bae5c6366d5eed919be75bdc0705', '755962422', 'Renata', '2026-01-28 10:07:38', 1, 69.97, 'Cartão', 0.00, 77.96, 0, 7.99, '10570922666', '0', '0', '0', '0', '0', 0.00, 0.00, 0.00, '2026-01-28 16:52:43', '0', '0', NULL, 'Pedido Comum', NULL, 1),
(160207, 2, 'e8194a871a0e6d26fe620d13f7baad86', 'd79b3cd6f38ca4272a09c4b352222ed1', '162020894', 'Karine', '2026-01-28 10:05:42', 1, 35.30, 'Online Pix', 1.00, 42.29, 0, 7.99, '12896455663', '0', '0', '0', '0', '0', 0.00, 0.00, 0.00, '2026-01-28 16:52:47', '0', '0', NULL, 'Pedido Comum', NULL, 1);

-- --------------------------------------------------------

--
-- Estrutura para tabela `delivery_data`
--

CREATE TABLE `delivery_data` (
  `delivery_data_id` int(11) NOT NULL,
  `delivery_data_code` varchar(50) DEFAULT NULL,
  `delivery_data_hora_pedido` datetime DEFAULT NULL,
  `delivery_data_hora_aceite` datetime DEFAULT NULL,
  `delivery_data_hora_captura` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci ROW_FORMAT=DYNAMIC;

-- --------------------------------------------------------

--
-- Estrutura para tabela `delivery_itens`
--

CREATE TABLE `delivery_itens` (
  `delivery_itens_id` int(11) NOT NULL,
  `delivery_itens_id_delivery` int(11) DEFAULT NULL,
  `delivery_itens_id_produto` int(11) DEFAULT NULL,
  `delivery_itens_descricao` varchar(255) DEFAULT NULL,
  `delivery_itens_qtd` varchar(255) DEFAULT NULL,
  `delivery_itens_valor_unitario` double(15,2) DEFAULT NULL,
  `delivery_itens_valor_total` double(15,2) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci ROW_FORMAT=DYNAMIC;

--
-- Despejando dados para a tabela `delivery_itens`
--

INSERT INTO `delivery_itens` (`delivery_itens_id`, `delivery_itens_id_delivery`, `delivery_itens_id_produto`, `delivery_itens_descricao`, `delivery_itens_qtd`, `delivery_itens_valor_unitario`, `delivery_itens_valor_total`) VALUES
(308843, 160169, 961, 'Gin Beefeater Pink 700ml', '1', 116.68, 116.68),
(308844, 160169, 962, 'Red Bull Melancia 250ml', '10', 8.86, 88.60),
(308845, 160170, 963, 'Energético Baly 2L', '1', 17.79, 17.79),
(308846, 160170, 964, 'Gelo Saborizado Beats Red Mix Coco Leve 190g', '4', 4.39, 17.56),
(308847, 160170, 965, 'Gin Gordons London Dry 750ml', '1', 73.24, 73.24),
(308848, 160171, 966, 'Gin Tanqueray London Dry 750ml', '1', 129.29, 129.29),
(308849, 160171, 962, 'Red Bull Melancia 250ml', '12', 8.99, 107.88),
(308850, 160172, 967, 'Vinho Rosé Suave Campo Largo 750mL', '1', 26.29, 26.29),
(308851, 160172, 968, 'Vinho Tinto Suave de Mesa Pérgola 750ml', '2', 25.36, 50.72),
(308852, 160172, 969, 'Beats Senses 269ml', '4', 5.79, 23.16),
(308853, 160172, 969, 'Beats Senses 269ml', '4', 5.79, 23.16),
(308854, 160173, 970, 'Original 473ml', '6', 5.19, 31.14),
(308855, 160173, 971, 'Budweiser 473ml', '6', 5.39, 32.34),
(308856, 160173, 972, 'Guaraná Antarctica 2L', '1', 9.39, 9.39),
(308857, 160174, 973, 'Vinho Branco Blend Mateus 750ml', '1', 77.79, 77.79),
(308858, 160175, 974, 'Gatorade Morango-Maracujá 500ml', '1', 5.09, 5.09),
(308859, 160175, 975, 'Gatorade Limão 500ml', '1', 5.09, 5.09),
(308860, 160175, 976, 'Guaraná Antarctica 300ml | Vasilhame Incluso', '5', 3.49, 17.45),
(308861, 160176, 977, 'Brahma 300ml | Apenas o Líquido', '48', 2.68, 128.64),
(308862, 160177, 978, 'Michelob Ultra Light Lager 350ml', '16', 4.69, 75.04),
(308863, 160178, 979, 'Stella Artois 330ml', '9', 6.03, 54.27),
(308864, 160179, 980, 'Stella Pure Gold 473ml', '8', 6.69, 53.52),
(308865, 160180, 981, 'Brahma 473ml', '1', 4.99, 4.99),
(308866, 160180, 982, 'Chocolate Branco Lacta Com Recheio Ouro Branco 98G', '1', 9.99, 9.99),
(308867, 160180, 983, 'Cebolitos 91g', '1', 12.99, 12.99),
(308868, 160181, 984, 'Fandangos Presunto 115g', '1', 11.69, 11.69),
(308869, 160181, 985, 'Brahma 473ml - Pack Econômico (12 unidades)', '1', 53.88, 53.88),
(308870, 160182, 986, 'Skol 300ml | Apenas o Líquido', '12', 2.74, 32.88),
(308871, 160183, 987, 'Stella Artois 600ml | Vasilhame Incluso', '5', 10.79, 53.95),
(308872, 160184, 988, 'Fandangos Queijo 115g', '1', 11.69, 11.69),
(308873, 160184, 989, 'Gatorade Zero Caloria Frutas Silvestres 350ml', '6', 3.59, 21.54),
(308874, 160185, 990, 'Pepsi Black 2L', '16', 8.59, 137.44),
(308875, 160186, 978, 'Michelob Ultra Light Lager 350ml', '16', 4.89, 78.24),
(308876, 160187, 991, 'Heineken Zero 350ml', '24', 6.69, 160.56),
(308877, 160188, 992, 'Energético Baly Maçã Verde 2L', '1', 16.90, 16.90),
(308878, 160188, 993, 'Água Com Gás São Lourenço 1,26L', '2', 5.12, 10.24),
(308879, 160189, 994, 'Corona 473ml', '7', 7.29, 51.03),
(308880, 160190, 970, 'Original 473ml', '24', 5.19, 124.56),
(308881, 160190, 990, 'Pepsi Black 2L', '6', 9.39, 56.34),
(308882, 160191, 995, 'Vinho Branco Moscato Spritz Reservado Concha y Toro 750ml', '1', 34.00, 34.00),
(308883, 160192, 985, 'Brahma 473ml - Pack Econômico (12 unidades)', '1', 53.88, 53.88),
(308884, 160193, 996, 'Budweiser 350ml', '10', 4.13, 41.30),
(308885, 160194, 997, 'Whisky Johnnie Walker Red Label 1L', '1', 104.30, 104.30),
(308886, 160195, 963, 'Energético Baly 2L', '1', 17.79, 17.79),
(308887, 160195, 990, 'Pepsi Black 2L', '1', 9.39, 9.39),
(308888, 160195, 998, 'Guaraná Antarctica Zero 2L', '1', 9.39, 9.39),
(308889, 160196, 999, 'Gin Rocks Strawberry 1L', '1', 39.86, 39.86),
(308890, 160196, 963, 'Energético Baly 2L', '1', 17.79, 17.79),
(308891, 160196, 1000, 'Gelo Sabor Morango 200g', '8', 5.50, 44.00),
(308892, 160197, 1001, 'Tônica Antarctica Zero Açúcar 1 Litro', '1', 7.79, 7.79),
(308893, 160197, 1002, 'Stella Artois 350ml', '8', 4.98, 39.84),
(308894, 160197, 1003, 'Vinho Espumante Branco Brut Novecento 750ml', '1', 40.89, 40.89),
(308895, 160198, 1004, 'Pepsi Twist Zero 2L', '1', 9.39, 9.39),
(308896, 160198, 990, 'Pepsi Black 2L', '1', 9.39, 9.39),
(308897, 160198, 990, 'Pepsi Black 2L', '1', 9.39, 9.39),
(308898, 160198, 1005, 'H2OH Limão 1,5L', '3', 8.39, 25.17),
(308899, 160198, 1005, 'H2OH Limão 1,5L', '3', 8.39, 25.17),
(308900, 160198, 998, 'Guaraná Antarctica Zero 2L', '1', 9.39, 9.39),
(308901, 160198, 998, 'Guaraná Antarctica Zero 2L', '1', 9.39, 9.39),
(308902, 160199, 1006, 'Gatorade Uva 500ml', '1', 5.09, 5.09),
(308903, 160199, 1007, 'Gatorade Zero Caloria Laranja Pet 350ml', '1', 3.59, 3.59),
(308904, 160199, 972, 'Guaraná Antarctica 2L', '1', 9.39, 9.39),
(308905, 160199, 1008, 'Red Bull Energy Drink 250ml', '1', 9.49, 9.49),
(308906, 160200, 1009, 'Cheetos Onda Requeijão 105g', '1', 10.92, 10.92),
(308907, 160200, 1010, 'Papel Seda Papelito Brown', '1', 8.39, 8.39),
(308908, 160200, 972, 'Guaraná Antarctica 2L', '1', 9.39, 9.39),
(308909, 160201, 977, 'Brahma 300ml | Apenas o Líquido', '15', 2.65, 39.75),
(308910, 160201, 1011, 'Stella Artois 600ml |  Apenas o Líquido', '1', 9.79, 9.79),
(308911, 160201, 1012, 'Guaraná Antarctica 1L', '1', 5.19, 5.19),
(308912, 160202, 1013, 'Brahma 350ml', '12', 3.71, 44.52),
(308913, 160203, 1014, 'Baconzitos 103g', '1', 14.79, 14.79),
(308914, 160203, 1009, 'Cheetos Onda Requeijão 105g', '1', 11.49, 11.49),
(308915, 160203, 1015, 'Pepsi 2L', '2', 9.39, 18.78),
(308916, 160203, 972, 'Guaraná Antarctica 2L', '2', 9.20, 18.40),
(308917, 160204, 1016, 'Bombom Sonho de Valsa 20g', '5', 1.70, 8.50),
(308918, 160204, 1017, 'Red Bull Sugarfree 250ml', '2', 9.49, 18.98),
(308919, 160205, 977, 'Brahma 300ml | Apenas o Líquido', '24', 2.71, 65.04),
(308920, 160206, 1018, 'Smirnoff Ice 275ml - Long Neck', '7', 8.64, 60.48),
(308921, 160206, 1017, 'Red Bull Sugarfree 250ml', '1', 9.49, 9.49),
(308922, 160207, 992, 'Energético Baly Maçã Verde 2L', '1', 16.90, 16.90),
(308923, 160207, 1004, 'Pepsi Twist Zero 2L', '2', 9.20, 18.40);

-- --------------------------------------------------------

--
-- Estrutura para tabela `hub_delivery`
--

CREATE TABLE `hub_delivery` (
  `hub_delivery_id` int(11) NOT NULL,
  `hub_delivery_id_company` int(11) DEFAULT NULL,
  `hub_delivery_ide_client` varchar(32) DEFAULT NULL,
  `hub_delivery_ide` varchar(32) DEFAULT NULL,
  `hub_delivery_dev` varchar(50) DEFAULT NULL,
  `hub_delivery_clientid` varchar(255) DEFAULT NULL,
  `hub_delivery_secretid` varchar(255) DEFAULT NULL,
  `hub_delivery_status` int(11) DEFAULT NULL,
  `hub_delivery_trash` int(11) DEFAULT NULL,
  `hub_delivery_auth` int(11) DEFAULT NULL,
  `hub_delivery_senha_mail` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci ROW_FORMAT=DYNAMIC;

--
-- Despejando dados para a tabela `hub_delivery`
--

INSERT INTO `hub_delivery` (`hub_delivery_id`, `hub_delivery_id_company`, `hub_delivery_ide_client`, `hub_delivery_ide`, `hub_delivery_dev`, `hub_delivery_clientid`, `hub_delivery_secretid`, `hub_delivery_status`, `hub_delivery_trash`, `hub_delivery_auth`, `hub_delivery_senha_mail`) VALUES
(23, 2, '123', 'e8194a871a0e6d26fe620d13f7baad86', '123', '123', '123', 0, 0, 0, '123');

-- --------------------------------------------------------

--
-- Estrutura para tabela `produto`
--

CREATE TABLE `produto` (
  `produto_id` int(11) NOT NULL,
  `produto_descricao` varchar(255) DEFAULT NULL,
  `produto_tipo` varchar(25) DEFAULT NULL,
  `produto_link_imagem` varchar(255) DEFAULT NULL,
  `produto_codigo_ze` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci ROW_FORMAT=DYNAMIC;

--
-- Despejando dados para a tabela `produto`
--

INSERT INTO `produto` (`produto_id`, `produto_descricao`, `produto_tipo`, `produto_link_imagem`, `produto_codigo_ze`) VALUES
(961, 'Gin Beefeater Pink 700ml', 'zedelivery', 'https://courier-images-prod.imgix.net/product/00022923_dff17f12-3ec2-46d8-9445-b6345b46b16e.jpg', '22465'),
(962, 'Red Bull Melancia 250ml', 'zedelivery', 'https://courier-images-prod.imgix.net/product/00012676_d4b7ad42-5bf5-4611-aa22-038832ab6b62.jpg', '12306'),
(963, 'Energético Baly 2L', 'zedelivery', 'https://courier-images-prod.imgix.net/product/00018824_810d0d34-da8e-44ff-9335-7d0bc3b75369.jpg', '18371'),
(964, 'Gelo Saborizado Beats Red Mix Coco Leve 190g', 'zedelivery', 'https://courier-images-prod.imgix.net/product/00030218_e1c1f93a-cd8e-4082-9b20-7ca37e0b3786.jpg', '29759'),
(965, 'Gin Gordons London Dry 750ml', 'zedelivery', 'https://courier-images-prod.imgix.net/product/00009559_179ba2ff-554f-44ff-9bd5-8a648f5c2f13.jpg', '9193'),
(966, 'Gin Tanqueray London Dry 750ml', 'zedelivery', 'https://courier-images-prod.imgix.net/product/00009562_3df032b1-e975-42f6-95a5-2c8c8943e548.jpg', '9196'),
(967, 'Vinho Rosé Suave Campo Largo 750mL', 'zedelivery', 'https://courier-images-prod.imgix.net/product/00029055_efa0a6ce-aeb5-476b-8963-f25bc96519ae.jpg', '28597'),
(968, 'Vinho Tinto Suave de Mesa Pérgola 750ml', 'zedelivery', 'https://courier-images-prod.imgix.net/product/00010118_65d594de-c44c-464d-aec8-3c4e03fbb9c2.jpg', '9748'),
(969, 'Beats Senses 269ml', 'zedelivery', 'https://courier-images-prod.imgix.net/product/00008965_cd433000-ef93-4bec-a572-818725438f4d.jpg', '8599'),
(970, 'Original 473ml', 'zedelivery', 'https://courier-images-prod.imgix.net/product/00018533_b84d8455-ff44-47a7-b2be-94daf70600ce.jpg', '18080'),
(971, 'Budweiser 473ml', 'zedelivery', 'https://courier-images-prod.imgix.net/product/00009495_2e376e5f-755e-40c0-8ecc-25ec2fe80a4c.jpg', '9129'),
(972, 'Guaraná Antarctica 2L', 'zedelivery', 'https://courier-images-prod.imgix.net/product/00009250_da3ebc7b-cfa6-403a-bd3f-e29affdc5ec2.jpg', '8884'),
(973, 'Vinho Branco Blend Mateus 750ml', 'zedelivery', 'https://courier-images-prod.imgix.net/product/00023068_c952fb6c-cdd2-4999-863b-c1c54a6f09ae.jpg', '22610'),
(974, 'Gatorade Morango-Maracujá 500ml', 'zedelivery', 'https://courier-images-prod.imgix.net/product/00009324_dbbba8d9-1e47-4ef6-803b-4088eee12442.jpg', '8958'),
(975, 'Gatorade Limão 500ml', 'zedelivery', 'https://courier-images-prod.imgix.net/product/00009323_e1bee628-d313-45e5-ab28-c54518eaa152.jpg', '8957'),
(976, 'Guaraná Antarctica 300ml | Vasilhame Incluso', 'zedelivery', 'https://courier-images-prod.imgix.net/product/00029813_4fb663f2-a436-42dc-8eb5-eb0c88470815.jpg', '29354'),
(977, 'Brahma 300ml | Apenas o Líquido', 'zedelivery', 'https://courier-images-prod.imgix.net/product/00009095_ba7f0c34-743c-411e-9d79-36f4f9b1b5c8.jpg', '8729'),
(978, 'Michelob Ultra Light Lager 350ml', 'zedelivery', 'https://courier-images-prod.imgix.net/product/00017275_cd5a67ef-08a9-4f58-8773-bc8917980af7.jpg', '16831'),
(979, 'Stella Artois 330ml', 'zedelivery', 'https://courier-images-prod.imgix.net/product/00010254_0f72d0ff-fb09-411d-a89b-00cd0c7a09d9.jpg', '9876'),
(980, 'Stella Pure Gold 473ml', 'zedelivery', 'https://courier-images-prod.imgix.net/product/00027352_12f0da82-3095-4b8b-8a24-c7a5a267e640.jpg', '26894'),
(981, 'Brahma 473ml', 'zedelivery', 'https://courier-images-prod.imgix.net/product/00008883_f6370973-2a21-4000-b710-b3381e4b57eb.jpg', '8517'),
(982, 'Chocolate Branco Lacta Com Recheio Ouro Branco 98G', 'zedelivery', 'https://courier-images-prod.imgix.net/product/00023117_e68ad48a-bd05-456d-a2c0-d9218eef314f.jpg', '22659'),
(983, 'Cebolitos 91g', 'zedelivery', 'https://courier-images-prod.imgix.net/product/00026430_d9fa57af-db87-4efe-a0d6-e7c7a70531ed.jpg', '25972'),
(984, 'Fandangos Presunto 115g', 'zedelivery', 'https://courier-images-prod.imgix.net/product/00019658_4fa2f484-872c-4a94-8a31-0c9700fcd7e9.jpg', '19205'),
(985, 'Brahma 473ml - Pack Econômico (12 unidades)', 'zedelivery', 'https://courier-images-prod.imgix.net/product/00038604_18e297f1-d753-4baa-b0e8-281629887eab.jpg', '38145'),
(986, 'Skol 300ml | Apenas o Líquido', 'zedelivery', 'https://courier-images-prod.imgix.net/product/00009091_ddaf6501-0bb6-48d9-a2e5-8d06b942666b.jpg', '8725'),
(987, 'Stella Artois 600ml | Vasilhame Incluso', 'zedelivery', 'https://courier-images-prod.imgix.net/product/00015750_2b1596c9-1355-45fc-a7a5-646f381c4ff6.jpg', '15365'),
(988, 'Fandangos Queijo 115g', 'zedelivery', 'https://courier-images-prod.imgix.net/product/00019659_d71a5407-50f6-433c-8a1b-5e4cb279b81c.jpg', '19206'),
(989, 'Gatorade Zero Caloria Frutas Silvestres 350ml', 'zedelivery', 'https://courier-images-prod.imgix.net/product/00024196_c3f5f8e9-3c71-48fb-a4bd-56e839826362.jpg', '23738'),
(990, 'Pepsi Black 2L', 'zedelivery', 'https://courier-images-prod.imgix.net/product/00009257_ac96c808-8962-436c-b7fd-0a5bee755449.jpg', '8891'),
(991, 'Heineken Zero 350ml', 'zedelivery', 'https://courier-images-prod.imgix.net/product/00017543_9d9c457b-b2cd-4511-9d50-8bdb5741c2d1.jpg', '17090'),
(992, 'Energético Baly Maçã Verde 2L', 'zedelivery', 'https://courier-images-prod.imgix.net/product/00018826_025f34f5-039c-4f63-9dc7-943fc29dae2b.jpg', '18373'),
(993, 'Água Com Gás São Lourenço 1,26L', 'zedelivery', 'https://courier-images-prod.imgix.net/product/00010912_43cb6dfa-0e99-4f26-9ec0-094690aab563.jpg', '10542'),
(994, 'Corona 473ml', 'zedelivery', 'https://courier-images-prod.imgix.net/product/00024394_196e2309-5dae-4948-98ce-4548250e3502.jpg', '23936'),
(995, 'Vinho Branco Moscato Spritz Reservado Concha y Toro 750ml', 'zedelivery', 'https://courier-images-prod.imgix.net/product/00022991_f311595a-35e0-404d-a2b7-8757e8c0b48a.jpg', '22533'),
(996, 'Budweiser 350ml', 'zedelivery', 'https://courier-images-prod.imgix.net/product/00008945_79cfc905-9d5c-4b93-b945-e165e1b95f2f.jpg', '8579'),
(997, 'Whisky Johnnie Walker Red Label 1L', 'zedelivery', 'https://courier-images-prod.imgix.net/product/00009510_e3b9866f-a4e6-4b40-a0f5-7ec5db862b75.jpg', '9144'),
(998, 'Guaraná Antarctica Zero 2L', 'zedelivery', 'https://courier-images-prod.imgix.net/product/00009256_8aadb321-a834-4594-832a-829e897156dc.jpg', '8890'),
(999, 'Gin Rocks Strawberry 1L', 'zedelivery', 'https://courier-images-prod.imgix.net/product/00022189_96d60b5f-9a95-45b1-88ea-9fe6942fd90a.jpg', '21734'),
(1000, 'Gelo Sabor Morango 200g', 'zedelivery', 'https://courier-images-prod.imgix.net/product/00017124_45aae48c-6926-4563-850c-050f773fa8b8.jpg', '16687'),
(1001, 'Tônica Antarctica Zero Açúcar 1 Litro', 'zedelivery', 'https://courier-images-prod.imgix.net/product/00013919_7af6484d-585c-409b-a0a0-24b62d6a850f.jpg', '13534'),
(1002, 'Stella Artois 350ml', 'zedelivery', 'https://courier-images-prod.imgix.net/product/00010280_8202d8cd-f093-4d93-9290-63dc26935893.jpg', '9902'),
(1003, 'Vinho Espumante Branco Brut Novecento 750ml', 'zedelivery', 'https://courier-images-prod.imgix.net/product/00015411_0167ff2b-5c06-4196-80c1-7a665b4fdc37.jpg', '15026'),
(1004, 'Pepsi Twist Zero 2L', 'zedelivery', 'https://courier-images-prod.imgix.net/product/00009261_7ce19338-d187-4167-b808-e07cd4224fef.jpg', '8895'),
(1005, 'H2OH Limão 1,5L', 'zedelivery', 'https://courier-images-prod.imgix.net/product/00009330_e86bbdf8-16ef-4e7b-9e1a-2819b68449d7.jpg', '8964'),
(1006, 'Gatorade Uva 500ml', 'zedelivery', 'https://courier-images-prod.imgix.net/product/00009318_2b87f641-af9b-44c4-9ae4-821fa96906db.jpg', '8952'),
(1007, 'Gatorade Zero Caloria Laranja Pet 350ml', 'zedelivery', 'https://courier-images-prod.imgix.net/product/00024195_6a6450df-1061-457c-97ad-d8f8f645fde2.jpg', '23737'),
(1008, 'Red Bull Energy Drink 250ml', 'zedelivery', 'https://courier-images-prod.imgix.net/product/00010365_9df94482-a061-4b68-86c3-00a55b1fd79c.jpg', '9995'),
(1009, 'Cheetos Onda Requeijão 105g', 'zedelivery', 'https://courier-images-prod.imgix.net/product/00026360_67113820-82bb-4840-bd38-889badddd514.jpg', '25902'),
(1010, 'Papel Seda Papelito Brown', 'zedelivery', 'https://courier-images-prod.imgix.net/product/00022878_b12265b2-af57-49f9-b893-9f3790f7c4af.jpg', '22420'),
(1011, 'Stella Artois 600ml |  Apenas o Líquido', 'zedelivery', 'https://courier-images-prod.imgix.net/product/00015751_f4cb14b6-64ed-48ca-b913-5b933bba5a24.jpg', '15366'),
(1012, 'Guaraná Antarctica 1L', 'zedelivery', 'https://courier-images-prod.imgix.net/product/00010967_730da2c2-9c02-43fb-b63a-fed6e4beb0de.jpg', '10597'),
(1013, 'Brahma 350ml', 'zedelivery', 'https://courier-images-prod.imgix.net/product/00008879_edc7467d-418a-4a7b-92a1-224e091566b2.jpg', '8513'),
(1014, 'Baconzitos 103g', 'zedelivery', 'https://courier-images-prod.imgix.net/product/00009991_8fc7c686-7d27-4fb1-812d-d610c33def77.jpg', '9623'),
(1015, 'Pepsi 2L', 'zedelivery', 'https://courier-images-prod.imgix.net/product/00009251_a1ccf10f-778a-456a-b4df-37db75f35faa.jpg', '8885'),
(1016, 'Bombom Sonho de Valsa 20g', 'zedelivery', 'https://courier-images-prod.imgix.net/product/00010060_516eedfc-39ca-4479-998a-9e82ec798dd5.jpg', '9691'),
(1017, 'Red Bull Sugarfree 250ml', 'zedelivery', 'https://courier-images-prod.imgix.net/product/00010366_b11ebc65-41a5-4635-ae65-6cd6f359f4a7.jpg', '9996'),
(1018, 'Smirnoff Ice 275ml - Long Neck', 'zedelivery', 'https://courier-images-prod.imgix.net/product/00011172_3913c8f9-c6e9-4b59-88f2-a8d1e4cc57ef.jpg', '10802');

-- --------------------------------------------------------

--
-- Estrutura para tabela `ze_duplo`
--

CREATE TABLE `ze_duplo` (
  `duplo_id` int(11) NOT NULL,
  `duplo_ide_hub_delivery` varchar(255) DEFAULT NULL,
  `duplo_codigo` varchar(255) DEFAULT NULL,
  `duplo_status` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci ROW_FORMAT=DYNAMIC;

-- --------------------------------------------------------

--
-- Estrutura para tabela `ze_itens_pedido`
--

CREATE TABLE `ze_itens_pedido` (
  `itens_pedido_id` int(11) NOT NULL,
  `itens_pedido_id_pedido` int(11) DEFAULT NULL,
  `itens_pedido_id_produto` int(11) DEFAULT NULL,
  `itens_pedido_descricao_produto` varchar(255) DEFAULT NULL,
  `itens_pedido_qtd` varchar(255) DEFAULT NULL,
  `itens_pedido_valor_unitario` double(15,2) DEFAULT NULL,
  `itens_pedido_valor_total` double(15,2) DEFAULT NULL,
  `itens_pedido_st` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci ROW_FORMAT=DYNAMIC;

--
-- Despejando dados para a tabela `ze_itens_pedido`
--

INSERT INTO `ze_itens_pedido` (`itens_pedido_id`, `itens_pedido_id_pedido`, `itens_pedido_id_produto`, `itens_pedido_descricao_produto`, `itens_pedido_qtd`, `itens_pedido_valor_unitario`, `itens_pedido_valor_total`, `itens_pedido_st`) VALUES
(156379, 160169, 961, 'Gin Beefeater Pink 700ml', '1', 116.68, 116.68, 1),
(156380, 160169, 962, 'Red Bull Melancia 250ml', '10', 8.86, 88.60, 1),
(156381, 160170, 963, 'Energético Baly 2L', '1', 17.79, 17.79, 1),
(156382, 160170, 964, 'Gelo Saborizado Beats Red Mix Coco Leve 190g', '4', 4.39, 17.56, 1),
(156383, 160170, 965, 'Gin Gordons London Dry 750ml', '1', 73.24, 73.24, 1),
(156384, 160171, 966, 'Gin Tanqueray London Dry 750ml', '1', 129.29, 129.29, 1),
(156385, 160171, 962, 'Red Bull Melancia 250ml', '12', 8.99, 107.88, 1),
(156386, 160172, 967, 'Vinho Rosé Suave Campo Largo 750mL', '1', 26.29, 26.29, 1),
(156387, 160172, 968, 'Vinho Tinto Suave de Mesa Pérgola 750ml', '2', 25.36, 50.72, 1),
(156388, 160172, 969, 'Beats Senses 269ml', '4', 5.79, 23.16, 1),
(156389, 160173, 970, 'Original 473ml', '6', 5.19, 31.14, 1),
(156390, 160173, 971, 'Budweiser 473ml', '6', 5.39, 32.34, 1),
(156391, 160173, 972, 'Guaraná Antarctica 2L', '1', 9.39, 9.39, 1),
(156392, 160174, 973, 'Vinho Branco Blend Mateus 750ml', '1', 77.79, 77.79, 1),
(156393, 160175, 974, 'Gatorade Morango-Maracujá 500ml', '1', 5.09, 5.09, 1),
(156394, 160175, 975, 'Gatorade Limão 500ml', '1', 5.09, 5.09, 1),
(156395, 160175, 976, 'Guaraná Antarctica 300ml | Vasilhame Incluso', '5', 3.49, 17.45, 1),
(156396, 160176, 977, 'Brahma 300ml | Apenas o Líquido', '48', 2.68, 128.64, 1),
(156397, 160177, 978, 'Michelob Ultra Light Lager 350ml', '16', 4.69, 75.04, 1),
(156398, 160178, 979, 'Stella Artois 330ml', '9', 6.03, 54.27, 1),
(156399, 160179, 980, 'Stella Pure Gold 473ml', '8', 6.69, 53.52, 1),
(156400, 160180, 981, 'Brahma 473ml', '1', 4.99, 4.99, 1),
(156401, 160180, 982, 'Chocolate Branco Lacta Com Recheio Ouro Branco 98G', '1', 9.99, 9.99, 1),
(156402, 160180, 983, 'Cebolitos 91g', '1', 12.99, 12.99, 1),
(156403, 160181, 984, 'Fandangos Presunto 115g', '1', 11.69, 11.69, 1),
(156404, 160181, 985, 'Brahma 473ml - Pack Econômico (12 unidades)', '1', 53.88, 53.88, 1),
(156405, 160182, 986, 'Skol 300ml | Apenas o Líquido', '12', 2.74, 32.88, 1),
(156406, 160183, 987, 'Stella Artois 600ml | Vasilhame Incluso', '5', 10.79, 53.95, 1),
(156407, 160184, 988, 'Fandangos Queijo 115g', '1', 11.69, 11.69, 1),
(156408, 160184, 989, 'Gatorade Zero Caloria Frutas Silvestres 350ml', '6', 3.59, 21.54, 1),
(156409, 160185, 990, 'Pepsi Black 2L', '16', 8.59, 137.44, 1),
(156410, 160186, 978, 'Michelob Ultra Light Lager 350ml', '16', 4.89, 78.24, 1),
(156411, 160187, 991, 'Heineken Zero 350ml', '24', 6.69, 160.56, 1),
(156412, 160188, 992, 'Energético Baly Maçã Verde 2L', '1', 16.90, 16.90, 1),
(156413, 160188, 993, 'Água Com Gás São Lourenço 1,26L', '2', 5.12, 10.24, 1),
(156414, 160189, 994, 'Corona 473ml', '7', 7.29, 51.03, 1),
(156415, 160190, 970, 'Original 473ml', '24', 5.19, 124.56, 1),
(156416, 160190, 990, 'Pepsi Black 2L', '6', 9.39, 56.34, 1),
(156417, 160191, 995, 'Vinho Branco Moscato Spritz Reservado Concha y Toro 750ml', '1', 34.00, 34.00, 1),
(156418, 160192, 985, 'Brahma 473ml - Pack Econômico (12 unidades)', '1', 53.88, 53.88, 1),
(156419, 160193, 996, 'Budweiser 350ml', '10', 4.13, 41.30, 1),
(156420, 160194, 997, 'Whisky Johnnie Walker Red Label 1L', '1', 104.30, 104.30, 1),
(156421, 160195, 963, 'Energético Baly 2L', '1', 17.79, 17.79, 1),
(156422, 160195, 990, 'Pepsi Black 2L', '1', 9.39, 9.39, 1),
(156423, 160195, 998, 'Guaraná Antarctica Zero 2L', '1', 9.39, 9.39, 1),
(156424, 160196, 999, 'Gin Rocks Strawberry 1L', '1', 39.86, 39.86, 1),
(156425, 160196, 963, 'Energético Baly 2L', '1', 17.79, 17.79, 1),
(156426, 160196, 1000, 'Gelo Sabor Morango 200g', '8', 5.50, 44.00, 1),
(156427, 160197, 1001, 'Tônica Antarctica Zero Açúcar 1 Litro', '1', 7.79, 7.79, 1),
(156428, 160197, 1002, 'Stella Artois 350ml', '8', 4.98, 39.84, 1),
(156429, 160197, 1003, 'Vinho Espumante Branco Brut Novecento 750ml', '1', 40.89, 40.89, 1),
(156430, 160198, 1004, 'Pepsi Twist Zero 2L', '1', 9.39, 9.39, 1),
(156431, 160198, 990, 'Pepsi Black 2L', '1', 9.39, 9.39, 1),
(156432, 160198, 1005, 'H2OH Limão 1,5L', '3', 8.39, 25.17, 1),
(156433, 160198, 998, 'Guaraná Antarctica Zero 2L', '1', 9.39, 9.39, 1),
(156434, 160199, 1006, 'Gatorade Uva 500ml', '1', 5.09, 5.09, 1),
(156435, 160199, 1007, 'Gatorade Zero Caloria Laranja Pet 350ml', '1', 3.59, 3.59, 1),
(156436, 160199, 972, 'Guaraná Antarctica 2L', '1', 9.39, 9.39, 1),
(156437, 160199, 1008, 'Red Bull Energy Drink 250ml', '1', 9.49, 9.49, 1),
(156438, 160200, 1009, 'Cheetos Onda Requeijão 105g', '1', 10.92, 10.92, 1),
(156439, 160200, 1010, 'Papel Seda Papelito Brown', '1', 8.39, 8.39, 1),
(156440, 160200, 972, 'Guaraná Antarctica 2L', '1', 9.39, 9.39, 1),
(156441, 160201, 977, 'Brahma 300ml | Apenas o Líquido', '15', 2.65, 39.75, 1),
(156442, 160201, 1011, 'Stella Artois 600ml |  Apenas o Líquido', '1', 9.79, 9.79, 1),
(156443, 160201, 1012, 'Guaraná Antarctica 1L', '1', 5.19, 5.19, 1),
(156444, 160202, 1013, 'Brahma 350ml', '12', 3.71, 44.52, 1),
(156445, 160203, 1014, 'Baconzitos 103g', '1', 14.79, 14.79, 1),
(156446, 160203, 1009, 'Cheetos Onda Requeijão 105g', '1', 11.49, 11.49, 1),
(156447, 160203, 1015, 'Pepsi 2L', '2', 9.39, 18.78, 1),
(156448, 160203, 972, 'Guaraná Antarctica 2L', '2', 9.20, 18.40, 1),
(156449, 160204, 1016, 'Bombom Sonho de Valsa 20g', '5', 1.70, 8.50, 1),
(156450, 160204, 1017, 'Red Bull Sugarfree 250ml', '2', 9.49, 18.98, 1),
(156451, 160205, 977, 'Brahma 300ml | Apenas o Líquido', '24', 2.71, 65.04, 1),
(156452, 160206, 1018, 'Smirnoff Ice 275ml - Long Neck', '7', 8.64, 60.48, 1),
(156453, 160206, 1017, 'Red Bull Sugarfree 250ml', '1', 9.49, 9.49, 1),
(156454, 160207, 992, 'Energético Baly Maçã Verde 2L', '1', 16.90, 16.90, 1),
(156455, 160207, 1004, 'Pepsi Twist Zero 2L', '2', 9.20, 18.40, 1);

-- --------------------------------------------------------

--
-- Estrutura para tabela `ze_pedido`
--

CREATE TABLE `ze_pedido` (
  `pedido_id` int(11) NOT NULL,
  `pedido_ide` varchar(32) DEFAULT NULL,
  `pedido_code` varchar(255) DEFAULT NULL,
  `pedido_nome` varchar(255) DEFAULT '',
  `pedido_data` varchar(25) DEFAULT '',
  `pedido_hora` varchar(25) DEFAULT '',
  `pedido_status` varchar(50) DEFAULT NULL,
  `pedido_email_entregador` varchar(255) DEFAULT NULL,
  `pedido_valor` varchar(255) DEFAULT NULL,
  `pedido_pagamento` varchar(255) DEFAULT NULL,
  `pedido_tipo` varchar(255) DEFAULT NULL,
  `pedido_cupom` varchar(25) DEFAULT NULL,
  `pedido_desconto` double(15,2) DEFAULT NULL,
  `pedido_st` int(11) DEFAULT NULL,
  `pedido_st_delivery` int(11) DEFAULT NULL,
  `pedido_frete` double(15,2) DEFAULT NULL,
  `pedido_st_validacao` int(11) DEFAULT NULL,
  `pedido_nome_cliente` varchar(255) DEFAULT NULL,
  `pedido_cpf_cliente` varchar(255) DEFAULT NULL,
  `pedido_endereco_rota` varchar(255) DEFAULT NULL,
  `pedido_endereco_complemento` varchar(255) DEFAULT NULL,
  `pedido_endereco_cidade_uf` varchar(255) DEFAULT NULL,
  `pedido_endereco_cep` varchar(255) DEFAULT NULL,
  `pedido_endereco_bairro` varchar(255) DEFAULT NULL,
  `pedido_taxa_conveniencia` double(15,2) DEFAULT NULL,
  `pedido_troco_para` double(15,2) DEFAULT NULL,
  `pedido_troco` double(15,2) DEFAULT NULL,
  `pedido_data_hora_captura` varchar(255) DEFAULT NULL,
  `pedido_aceitar` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci ROW_FORMAT=DYNAMIC;

--
-- Despejando dados para a tabela `ze_pedido`
--

INSERT INTO `ze_pedido` (`pedido_id`, `pedido_ide`, `pedido_code`, `pedido_nome`, `pedido_data`, `pedido_hora`, `pedido_status`, `pedido_email_entregador`, `pedido_valor`, `pedido_pagamento`, `pedido_tipo`, `pedido_cupom`, `pedido_desconto`, `pedido_st`, `pedido_st_delivery`, `pedido_frete`, `pedido_st_validacao`, `pedido_nome_cliente`, `pedido_cpf_cliente`, `pedido_endereco_rota`, `pedido_endereco_complemento`, `pedido_endereco_cidade_uf`, `pedido_endereco_cep`, `pedido_endereco_bairro`, `pedido_taxa_conveniencia`, `pedido_troco_para`, `pedido_troco`, `pedido_data_hora_captura`, `pedido_aceitar`) VALUES
(160169, 'e8194a871a0e6d26fe620d13f7baad86', '238934302', 'Abílio', '27/01/2026', '21:15:18', 'Aceito', '', '213.27', 'Dinheiro', 'Comum', '', 0.00, 1, 0, 7.99, 1, NULL, '11571554645', 'Rua Ozanam, 465', 'Casa', 'Belo Horizonte  MG', '31160210', 'Ipiranga', 0.00, 0.00, NULL, '2026-01-28 01:16:18', NULL),
(160170, 'e8194a871a0e6d26fe620d13f7baad86', '607161344', 'Guilherme', '27/01/2026', '21:10:18', 'Aceito', '', '112.98', 'Online Pix', 'Comum', '', 3.60, 1, 0, 7.99, 1, NULL, '12464990612', 'Rua Faraday, 2', 'Primeira esquerda subindo moro', 'Belo Horizonte  MG', '31810020', 'Vila Primeiro de Maio', 0.00, 0.00, NULL, '2026-01-28 01:16:19', NULL),
(160171, 'e8194a871a0e6d26fe620d13f7baad86', '955281344', 'Lucas', '27/01/2026', '20:51:18', 'Aceito', '', '245.16', 'Dinheiro', 'Comum', '', 0.00, 1, 0, 7.99, 1, NULL, '70362448604', '0', '0', '0', '0', '0', 0.00, 0.00, NULL, '2026-01-28 01:16:20', NULL),
(160172, 'e8194a871a0e6d26fe620d13f7baad86', '972033224', 'Robert', '27/01/2026', '20:38:18', 'Aceito', '', '88.16', 'Online Pix', 'Comum', '', 20.00, 1, 0, 7.99, 1, NULL, '14764106663', '0', '0', '0', '0', '0', 0.00, 0.00, NULL, '2026-01-28 01:16:22', NULL),
(160173, 'e8194a871a0e6d26fe620d13f7baad86', '520980191', 'Max', '27/01/2026', '20:28:18', 'Aceito', '', '72.87', 'Cartão', 'Comum', '', 7.99, 1, 0, 7.99, 1, NULL, '96090693634', '0', '0', '0', '0', '0', 0.00, 0.00, NULL, '2026-01-28 01:16:23', NULL),
(160174, 'e8194a871a0e6d26fe620d13f7baad86', '784052311', 'Ana', '27/01/2026', '20:24:18', 'Aceito', '', '85.78', 'Online Nubank', 'Comum', '', 0.00, 1, 0, 7.99, 1, NULL, '18504670643', '0', '0', '0', '0', '0', 0.00, 0.00, NULL, '2026-01-28 01:16:24', NULL),
(160175, 'e8194a871a0e6d26fe620d13f7baad86', '237616360', 'Larissa', '27/01/2026', '20:11:18', 'Aceito', '', '36.61', 'Online Crédito', 'Comum', '', 0.00, 1, 0, 8.98, 1, NULL, '11243912669', '0', '0', '0', '0', '0', 0.00, 0.00, NULL, '2026-01-28 01:16:25', NULL),
(160176, 'e8194a871a0e6d26fe620d13f7baad86', '264060431', 'Nilvania', '27/01/2026', '19:42:18', 'Aceito', '', '128.64', 'Dinheiro', 'Comum', '', 7.99, 1, 0, 7.99, 1, NULL, '63240971615', '0', '0', '0', '0', '0', 0.00, 130.00, NULL, '2026-01-28 01:16:26', NULL),
(160177, 'e8194a871a0e6d26fe620d13f7baad86', '871319344', 'Leonardo', '27/01/2026', '19:37:18', 'Aceito', '', '83.03', 'Online Pix', 'Comum', '', 0.00, 1, 0, 7.99, 1, NULL, '69855471687', '0', '0', '0', '0', '0', 0.00, 0.00, NULL, '2026-01-28 01:16:27', NULL),
(160178, 'e8194a871a0e6d26fe620d13f7baad86', '990093266', 'Hugo', '27/01/2026', '19:32:18', 'Aceito', '', '54.27', 'Online Pix', 'Comum', '', 7.99, 1, 0, 7.99, 1, NULL, '09033739631', '0', '0', '0', '0', '0', 0.00, 0.00, NULL, '2026-01-28 01:16:28', NULL),
(160179, 'e8194a871a0e6d26fe620d13f7baad86', '307411183', 'Rafael', '27/01/2026', '19:26:18', 'Aceito', '', '55.51', 'Online Pix', 'Turbo', '', 10.00, 1, 0, 11.99, 1, NULL, '05933741698', '0', '0', '0', '0', '0', 0.00, 0.00, NULL, '2026-01-28 01:16:29', NULL),
(160180, 'e8194a871a0e6d26fe620d13f7baad86', '173306930', 'Stefanie', '27/01/2026', '19:23:18', 'Aceito', '', '28.96', 'Cartão', 'Comum', '', 7.99, 1, 0, 8.98, 1, NULL, '07786779663', '0', '0', '0', '0', '0', 0.00, 0.00, NULL, '2026-01-28 01:16:30', NULL),
(160181, 'e8194a871a0e6d26fe620d13f7baad86', '745216618', 'João', '27/01/2026', '18:57:18', 'Aceito', '', '65.57', 'Online Crédito', 'Comum', '', 7.99, 1, 0, 7.99, 1, NULL, '06714097603', '0', '0', '0', '0', '0', 0.00, 0.00, NULL, '2026-01-28 01:16:31', NULL),
(160182, 'e8194a871a0e6d26fe620d13f7baad86', '712993902', 'selma', '27/01/2026', '18:23:18', 'Aceito', '', '41.86', 'Dinheiro', 'Comum', '', 0.00, 1, 0, 8.98, 1, NULL, '68899033668', '0', '0', '0', '0', '0', 0.00, 0.00, NULL, '2026-01-28 01:16:33', NULL),
(160183, 'e8194a871a0e6d26fe620d13f7baad86', '923904749', 'Janete', '27/01/2026', '18:11:18', 'Aceito', '', '53.95', 'Cartão', 'Comum', '', 7.99, 1, 0, 7.99, 1, NULL, '05920324694', '0', '0', '0', '0', '0', 0.00, 0.00, NULL, '2026-01-28 01:16:34', NULL),
(160184, 'e8194a871a0e6d26fe620d13f7baad86', '297172340', 'Sofia', '27/01/2026', '17:58:18', 'Aceito', '', '42.21', 'Online Crédito', 'Comum', '', 0.00, 1, 0, 8.98, 1, NULL, '12342002602', '0', '0', '0', '0', '0', 0.00, 0.00, NULL, '2026-01-28 01:16:35', NULL),
(160185, 'e8194a871a0e6d26fe620d13f7baad86', '847026445', 'Juliana', '27/01/2026', '17:40:18', 'Aceito', '', '133.42', 'Online Nubank', 'Comum', '', 20.00, 1, 0, 7.99, 1, NULL, '73302155620', '0', '0', '0', '0', '0', 7.99, 0.00, NULL, '2026-01-28 01:16:36', NULL),
(160186, 'e8194a871a0e6d26fe620d13f7baad86', '258351688', 'Genderson', '27/01/2026', '17:39:18', 'Aceito', '', '86.23', 'Online Crédito', 'Comum', '', 0.00, 1, 0, 7.99, 1, NULL, '54702402668', '0', '0', '0', '0', '0', 0.00, 0.00, NULL, '2026-01-28 01:16:37', NULL),
(160187, 'e8194a871a0e6d26fe620d13f7baad86', '462993868', 'Luciano', '27/01/2026', '17:36:18', 'Aceito', '', '172.55', 'Cartão', 'Turbo', '', 0.00, 1, 0, 11.99, 1, NULL, '85157317620', '0', '0', '0', '0', '0', 0.00, 0.00, NULL, '2026-01-28 01:16:38', NULL),
(160188, 'e8194a871a0e6d26fe620d13f7baad86', '627958801', 'Enrico', '27/01/2026', '17:20:18', 'Aceito', '', '36.12', 'Online Crédito', 'Comum', '', 0.00, 1, 0, 8.98, 1, NULL, '12425584625', '0', '0', '0', '0', '0', 0.00, 0.00, NULL, '2026-01-28 01:16:39', NULL),
(160189, 'e8194a871a0e6d26fe620d13f7baad86', '942551124', 'Vinicius', '27/01/2026', '16:27:18', 'Aceito', '', '49.02', 'Cartão', 'Comum', '', 10.00, 1, 0, 7.99, 1, NULL, '08844170779', '0', '0', '0', '0', '0', 0.00, 0.00, NULL, '2026-01-28 01:16:40', NULL),
(160190, 'e8194a871a0e6d26fe620d13f7baad86', '232445597', 'Bruno', '27/01/2026', '16:20:18', 'Aceito', '', '188.89', 'Online Pix', 'Comum', '', 0.00, 1, 0, 7.99, 1, NULL, '04235413660', '0', '0', '0', '0', '0', 0.00, 0.00, NULL, '2026-01-28 01:16:41', NULL),
(160191, 'e8194a871a0e6d26fe620d13f7baad86', '743484233', 'Luiza', '27/01/2026', '15:37:18', 'Aceito', '', '34.99', 'Online Nubank', 'Comum', '', 7.99, 1, 0, 8.98, 1, NULL, '14308116686', '0', '0', '0', '0', '0', 0.00, 0.00, NULL, '2026-01-28 01:16:42', NULL),
(160192, 'e8194a871a0e6d26fe620d13f7baad86', '142503539', 'Maria', '27/01/2026', '15:32:18', 'Aceito', '', '61.87', 'Dinheiro', 'Comum', '', 0.00, 1, 0, 7.99, 1, NULL, '03467059759', '0', '0', '0', '0', '0', 0.00, 65.00, NULL, '2026-01-28 01:16:44', NULL),
(160193, 'e8194a871a0e6d26fe620d13f7baad86', '398202688', 'Gabriela', '27/01/2026', '14:53:18', 'Aceito', '', '41.30', 'Online Pix', 'Comum', '', 7.99, 1, 0, 7.99, 1, NULL, '15845677670', '0', '0', '0', '0', '0', 0.00, 0.00, NULL, '2026-01-28 01:16:45', NULL),
(160194, 'e8194a871a0e6d26fe620d13f7baad86', '630932561', 'João', '27/01/2026', '14:41:18', 'Aceito', '', '112.29', 'Online Nubank', 'Comum', '', 0.00, 1, 0, 7.99, 1, NULL, '08930698689', '0', '0', '0', '0', '0', 0.00, 0.00, NULL, '2026-01-28 01:16:46', NULL),
(160195, 'e8194a871a0e6d26fe620d13f7baad86', '650799796', 'Samuel', '27/01/2026', '14:34:18', 'Aceito', '', '44.56', 'Cartão', 'Comum', '', 0.00, 1, 0, 7.99, 1, NULL, '13065598639', '0', '0', '0', '0', '0', 0.00, 0.00, NULL, '2026-01-28 01:16:47', NULL),
(160196, 'e8194a871a0e6d26fe620d13f7baad86', '359347018', 'Brenda', '27/01/2026', '14:03:18', 'Aceito', '', '89.64', 'Dinheiro', 'Comum', '', 20.00, 1, 0, 7.99, 1, NULL, '02263290621', '0', '0', '0', '0', '0', 0.00, 0.00, NULL, '2026-01-28 01:16:48', NULL),
(160197, 'e8194a871a0e6d26fe620d13f7baad86', '703135418', 'Ferraz', '27/01/2026', '12:05:18', 'Aceito', '', '96.51', 'Online Crédito', 'Comum', '', 0.00, 1, 0, 7.99, 1, NULL, '01231161639', '0', '0', '0', '0', '0', 0.00, 0.00, NULL, '2026-01-28 01:16:49', NULL),
(160198, 'e8194a871a0e6d26fe620d13f7baad86', '987321292', 'Rafael', '27/01/2026', '12:00:18', 'Aceito', '', '53.34', 'Cartão', 'Comum', '', 7.99, 1, 0, 7.99, 1, NULL, '13374143601', '0', '0', '0', '0', '0', 0.00, 0.00, NULL, '2026-01-28 01:16:50', NULL),
(160199, 'e8194a871a0e6d26fe620d13f7baad86', '788971977', 'Joaima', '27/01/2026', '22:10:33', 'Aceito', '', '37.54', 'Online Pix', 'Comum', '', 0.00, 1, 0, 9.98, 1, NULL, '05994734608', '0', '0', '0', '0', '0', 0.00, 0.00, NULL, '2026-01-28 02:56:34', NULL),
(160200, 'e8194a871a0e6d26fe620d13f7baad86', '488229435', 'Léah', '27/01/2026', '22:09:33', 'Aceito', '', '29.69', 'Online Pix', 'Comum', '', 8.99, 1, 0, 9.98, 1, NULL, '07596400680', '0', '0', '0', '0', '0', 0.00, 0.00, NULL, '2026-01-28 02:56:35', NULL),
(160201, 'e8194a871a0e6d26fe620d13f7baad86', '376201647', '', '27/01/2026', '21:29:33', 'Aceito', '', '54.73', 'Cartão', 'Comum', '', 7.99, 1, 0, 7.99, 1, NULL, '70012514616', '0', '0', '0', '0', '0', 0.00, 0.00, NULL, '2026-01-28 02:56:36', NULL),
(160202, 'e8194a871a0e6d26fe620d13f7baad86', '575196487', 'Natália', '28/01/2026', '12:52:38', 'Aceito', '', '44.52', 'Online Nubank', 'Comum', '', 7.99, 1, 0, 7.99, 1, NULL, '01913120619', 'Rua Elza, 50', 'Casa', 'Belo Horizonte  MG', '31260530', 'Vila Suzana', 0.00, 0.00, NULL, '2026-01-28 16:52:38', NULL),
(160203, 'e8194a871a0e6d26fe620d13f7baad86', '406877792', 'Gabriel', '28/01/2026', '11:32:38', 'Aceito', '', '71.45', 'Online Crédito', 'Comum', '', 0.00, 1, 0, 7.99, 1, NULL, '06882235678', '0', '0', '0', '0', '0', 0.00, 0.00, NULL, '2026-01-28 16:52:39', NULL),
(160204, 'e8194a871a0e6d26fe620d13f7baad86', '123040254', 'Thalita', '28/01/2026', '11:23:38', 'Aceito', '', '39.46', 'Online Pix', 'Turbo', '', 1.00, 1, 0, 12.98, 1, NULL, '03927174173', '0', '0', '0', '0', '0', 0.00, 0.00, NULL, '2026-01-28 16:52:40', NULL),
(160205, 'e8194a871a0e6d26fe620d13f7baad86', '248100937', 'Regiane', '28/01/2026', '11:03:38', 'Aceito', '', '63.03', 'Online Pix', 'Comum', '', 10.00, 1, 0, 7.99, 1, NULL, '08267926690', '0', '0', '0', '0', '0', 0.00, 0.00, NULL, '2026-01-28 16:52:41', NULL),
(160206, 'e8194a871a0e6d26fe620d13f7baad86', '755962422', 'Renata', '28/01/2026', '10:07:38', 'Aceito', '', '77.96', 'Cartão', 'Comum', '', 0.00, 1, 0, 7.99, 1, NULL, '10570922666', '0', '0', '0', '0', '0', 0.00, 0.00, NULL, '2026-01-28 16:52:43', NULL),
(160207, 'e8194a871a0e6d26fe620d13f7baad86', '162020894', 'Karine', '28/01/2026', '10:05:42', 'Aceito', '', '42.29', 'Online Pix', 'Comum', '', 1.00, 1, 0, 7.99, 1, NULL, '12896455663', '0', '0', '0', '0', '0', 0.00, 0.00, NULL, '2026-01-28 16:52:47', NULL);

--
-- Índices para tabelas despejadas
--

--
-- Índices de tabela `delivery`
--
ALTER TABLE `delivery`
  ADD PRIMARY KEY (`delivery_id`) USING BTREE,
  ADD KEY `idx_delivery_main` (`delivery_id_company`,`delivery_tem_itens`,`delivery_date_time`) USING BTREE,
  ADD KEY `idx_delivery_company_ide` (`delivery_id_company`,`delivery_ide`) USING BTREE,
  ADD KEY `idx_delivery_company_status` (`delivery_id_company`,`delivery_status`) USING BTREE,
  ADD KEY `idx_delivery_company_hub` (`delivery_id_company`,`delivery_ide_hub_delivery`) USING BTREE,
  ADD KEY `idx_delivery_company_hub_status_date` (`delivery_id_company`,`delivery_ide_hub_delivery`,`delivery_status`,`delivery_tem_itens`,`delivery_date_time`) USING BTREE;

--
-- Índices de tabela `delivery_data`
--
ALTER TABLE `delivery_data`
  ADD PRIMARY KEY (`delivery_data_id`) USING BTREE;

--
-- Índices de tabela `delivery_itens`
--
ALTER TABLE `delivery_itens`
  ADD PRIMARY KEY (`delivery_itens_id`) USING BTREE,
  ADD KEY `idx_delivery_itens_delivery` (`delivery_itens_id_delivery`) USING BTREE;

--
-- Índices de tabela `hub_delivery`
--
ALTER TABLE `hub_delivery`
  ADD PRIMARY KEY (`hub_delivery_id`) USING BTREE,
  ADD KEY `idx_hub_delivery_company_ide` (`hub_delivery_id_company`,`hub_delivery_ide`) USING BTREE,
  ADD KEY `idx_hub_delivery_ide` (`hub_delivery_ide`) USING BTREE;

--
-- Índices de tabela `produto`
--
ALTER TABLE `produto`
  ADD PRIMARY KEY (`produto_id`) USING BTREE,
  ADD KEY `idx_produto_id` (`produto_id`) USING BTREE;

--
-- Índices de tabela `ze_duplo`
--
ALTER TABLE `ze_duplo`
  ADD PRIMARY KEY (`duplo_id`) USING BTREE;

--
-- Índices de tabela `ze_itens_pedido`
--
ALTER TABLE `ze_itens_pedido`
  ADD PRIMARY KEY (`itens_pedido_id`) USING BTREE;

--
-- Índices de tabela `ze_pedido`
--
ALTER TABLE `ze_pedido`
  ADD PRIMARY KEY (`pedido_id`) USING BTREE;

--
-- AUTO_INCREMENT para tabelas despejadas
--

--
-- AUTO_INCREMENT de tabela `delivery`
--
ALTER TABLE `delivery`
  MODIFY `delivery_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=160208;

--
-- AUTO_INCREMENT de tabela `delivery_data`
--
ALTER TABLE `delivery_data`
  MODIFY `delivery_data_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3897;

--
-- AUTO_INCREMENT de tabela `delivery_itens`
--
ALTER TABLE `delivery_itens`
  MODIFY `delivery_itens_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=308924;

--
-- AUTO_INCREMENT de tabela `hub_delivery`
--
ALTER TABLE `hub_delivery`
  MODIFY `hub_delivery_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=24;

--
-- AUTO_INCREMENT de tabela `produto`
--
ALTER TABLE `produto`
  MODIFY `produto_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=1019;

--
-- AUTO_INCREMENT de tabela `ze_duplo`
--
ALTER TABLE `ze_duplo`
  MODIFY `duplo_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=27;

--
-- AUTO_INCREMENT de tabela `ze_itens_pedido`
--
ALTER TABLE `ze_itens_pedido`
  MODIFY `itens_pedido_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=156456;

--
-- AUTO_INCREMENT de tabela `ze_pedido`
--
ALTER TABLE `ze_pedido`
  MODIFY `pedido_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=160208;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
