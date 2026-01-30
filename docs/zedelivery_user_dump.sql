/*M!999999\- enable the sandbox mode */ 
-- MariaDB dump 10.19  Distrib 10.11.14-MariaDB, for debian-linux-gnu (aarch64)
--
-- Host: localhost    Database: zedelivery
-- ------------------------------------------------------
-- Server version	10.11.14-MariaDB-0+deb12u2

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Current Database: `zedelivery`
--

/*!40000 DROP DATABASE IF EXISTS `zedelivery`*/;

CREATE DATABASE /*!32312 IF NOT EXISTS*/ `zedelivery` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci */;

USE `zedelivery`;

--
-- Table structure for table `delivery`
--

DROP TABLE IF EXISTS `delivery`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `delivery` (
  `delivery_id` int(11) NOT NULL AUTO_INCREMENT,
  `delivery_ide` varchar(64) DEFAULT NULL,
  `delivery_ide_hub_delivery` varchar(64) DEFAULT NULL,
  `delivery_code` varchar(50) DEFAULT NULL,
  `delivery_name_cliente` varchar(255) DEFAULT NULL,
  `delivery_date_time` datetime DEFAULT NULL,
  `delivery_data_hora_captura` datetime DEFAULT NULL,
  `delivery_data_hora_aceite` datetime DEFAULT NULL,
  `delivery_status` tinyint(4) DEFAULT 0,
  `delivery_subtotal` decimal(10,2) DEFAULT 0.00,
  `delivery_forma_pagamento` varchar(50) DEFAULT NULL,
  `delivery_desconto` decimal(10,2) DEFAULT 0.00,
  `delivery_frete` decimal(10,2) DEFAULT 0.00,
  `delivery_total` decimal(10,2) DEFAULT 0.00,
  `delivery_trash` tinyint(4) DEFAULT 0,
  `delivery_id_company` int(11) DEFAULT 0,
  `delivery_cpf_cliente` varchar(20) DEFAULT NULL,
  `delivery_endereco_rota` text DEFAULT NULL,
  `delivery_endereco_complemento` text DEFAULT NULL,
  `delivery_endereco_cidade_uf` varchar(100) DEFAULT NULL,
  `delivery_endereco_cep` varchar(15) DEFAULT NULL,
  `delivery_endereco_bairro` varchar(100) DEFAULT NULL,
  `delivery_troco_para` decimal(10,2) DEFAULT 0.00,
  `delivery_troco` decimal(10,2) DEFAULT 0.00,
  `delivery_taxa_conveniencia` decimal(10,2) DEFAULT 0.00,
  `delivery_obs` text DEFAULT NULL,
  `delivery_tipo_pedido` varchar(50) DEFAULT NULL,
  `delivery_codigo_entrega` varchar(50) DEFAULT NULL,
  `delivery_tem_itens` tinyint(4) DEFAULT 0,
  `delivery_created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`delivery_id`),
  KEY `idx_delivery_code` (`delivery_code`),
  KEY `idx_delivery_ide` (`delivery_ide_hub_delivery`),
  KEY `idx_delivery_status` (`delivery_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `delivery`
--

LOCK TABLES `delivery` WRITE;
/*!40000 ALTER TABLE `delivery` DISABLE KEYS */;
/*!40000 ALTER TABLE `delivery` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `delivery_data`
--

DROP TABLE IF EXISTS `delivery_data`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `delivery_data` (
  `delivery_data_id` int(11) NOT NULL AUTO_INCREMENT,
  `delivery_data_code` varchar(50) DEFAULT NULL,
  `delivery_data_hora_pedido` datetime DEFAULT NULL,
  `delivery_data_hora_aceite` datetime DEFAULT NULL,
  PRIMARY KEY (`delivery_data_id`),
  KEY `idx_delivery_data_code` (`delivery_data_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `delivery_data`
--

LOCK TABLES `delivery_data` WRITE;
/*!40000 ALTER TABLE `delivery_data` DISABLE KEYS */;
/*!40000 ALTER TABLE `delivery_data` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `delivery_itens`
--

DROP TABLE IF EXISTS `delivery_itens`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `delivery_itens` (
  `delivery_itens_id` int(11) NOT NULL AUTO_INCREMENT,
  `delivery_itens_id_delivery` int(11) DEFAULT NULL,
  `delivery_itens_id_produto` int(11) DEFAULT NULL,
  `delivery_itens_descricao` varchar(500) DEFAULT NULL,
  `delivery_itens_qtd` int(11) DEFAULT 1,
  `delivery_itens_valor_unitario` decimal(10,2) DEFAULT 0.00,
  `delivery_itens_valor_total` decimal(10,2) DEFAULT 0.00,
  PRIMARY KEY (`delivery_itens_id`),
  KEY `idx_delivery_itens` (`delivery_itens_id_delivery`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `delivery_itens`
--

LOCK TABLES `delivery_itens` WRITE;
/*!40000 ALTER TABLE `delivery_itens` DISABLE KEYS */;
/*!40000 ALTER TABLE `delivery_itens` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `hub_delivery`
--

DROP TABLE IF EXISTS `hub_delivery`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `hub_delivery` (
  `hub_delivery_id` int(11) NOT NULL AUTO_INCREMENT,
  `hub_delivery_ide` varchar(64) NOT NULL,
  `hub_delivery_nome` varchar(255) DEFAULT NULL,
  `hub_delivery_email` varchar(255) DEFAULT NULL,
  `hub_delivery_senha` varchar(255) DEFAULT NULL,
  `hub_delivery_token` varchar(255) DEFAULT NULL,
  `hub_delivery_id_company` int(11) DEFAULT 0,
  `hub_delivery_status` tinyint(4) DEFAULT 1,
  `hub_delivery_created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`hub_delivery_id`),
  UNIQUE KEY `hub_delivery_ide` (`hub_delivery_ide`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `hub_delivery`
--

LOCK TABLES `hub_delivery` WRITE;
/*!40000 ALTER TABLE `hub_delivery` DISABLE KEYS */;
INSERT INTO `hub_delivery` (`hub_delivery_id`, `hub_delivery_ide`, `hub_delivery_nome`, `hub_delivery_email`, `hub_delivery_senha`, `hub_delivery_token`, `hub_delivery_id_company`, `hub_delivery_status`, `hub_delivery_created_at`) VALUES (1,'e8194a871a0e6d26fe620d13f7baad86','Loja Principal','gamataurize@gmail.com','GamaZed01***','e8194a871a0e6d26fe620d13f7baad86',1,1,'2026-01-29 20:42:25');
/*!40000 ALTER TABLE `hub_delivery` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `produto`
--

DROP TABLE IF EXISTS `produto`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `produto` (
  `produto_id` int(11) NOT NULL AUTO_INCREMENT,
  `produto_descricao` varchar(500) DEFAULT NULL,
  `produto_link_imagem` text DEFAULT NULL,
  `produto_codigo_ze` varchar(100) DEFAULT NULL,
  `produto_tipo` varchar(50) DEFAULT NULL,
  `produto_created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`produto_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `produto`
--

LOCK TABLES `produto` WRITE;
/*!40000 ALTER TABLE `produto` DISABLE KEYS */;
/*!40000 ALTER TABLE `produto` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ze_duplo`
--

DROP TABLE IF EXISTS `ze_duplo`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `ze_duplo` (
  `duplo_id` int(11) NOT NULL AUTO_INCREMENT,
  `duplo_codigo` varchar(10) DEFAULT NULL,
  `duplo_usado` tinyint(4) DEFAULT 0,
  `duplo_created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`duplo_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ze_duplo`
--

LOCK TABLES `ze_duplo` WRITE;
/*!40000 ALTER TABLE `ze_duplo` DISABLE KEYS */;
/*!40000 ALTER TABLE `ze_duplo` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ze_itens_pedido`
--

DROP TABLE IF EXISTS `ze_itens_pedido`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `ze_itens_pedido` (
  `itens_pedido_id` int(11) NOT NULL AUTO_INCREMENT,
  `itens_pedido_id_pedido` int(11) DEFAULT NULL,
  `itens_pedido_id_produto` int(11) DEFAULT NULL,
  `itens_pedido_descricao_produto` varchar(500) DEFAULT NULL,
  `itens_pedido_qtd` int(11) DEFAULT 1,
  `itens_pedido_valor_unitario` decimal(10,2) DEFAULT 0.00,
  `itens_pedido_valor_total` decimal(10,2) DEFAULT 0.00,
  `itens_pedido_st` tinyint(4) DEFAULT 0,
  PRIMARY KEY (`itens_pedido_id`),
  KEY `idx_itens_pedido` (`itens_pedido_id_pedido`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ze_itens_pedido`
--

LOCK TABLES `ze_itens_pedido` WRITE;
/*!40000 ALTER TABLE `ze_itens_pedido` DISABLE KEYS */;
/*!40000 ALTER TABLE `ze_itens_pedido` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `ze_pedido`
--

DROP TABLE IF EXISTS `ze_pedido`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `ze_pedido` (
  `pedido_id` int(11) NOT NULL AUTO_INCREMENT,
  `pedido_ide` varchar(64) DEFAULT NULL,
  `pedido_st` tinyint(4) DEFAULT 0,
  `pedido_st_validacao` tinyint(4) DEFAULT 0,
  `pedido_st_delivery` tinyint(4) DEFAULT 0,
  `pedido_code` varchar(50) DEFAULT NULL,
  `pedido_nome` varchar(255) DEFAULT NULL,
  `pedido_data` varchar(20) DEFAULT NULL,
  `pedido_hora` varchar(10) DEFAULT NULL,
  `pedido_data_hora_captura` datetime DEFAULT NULL,
  `pedido_status` varchar(50) DEFAULT NULL,
  `pedido_email_entregador` varchar(255) DEFAULT NULL,
  `pedido_valor` decimal(10,2) DEFAULT 0.00,
  `pedido_pagamento` varchar(50) DEFAULT NULL,
  `pedido_tipo` varchar(50) DEFAULT NULL,
  `pedido_cupom` varchar(50) DEFAULT NULL,
  `pedido_desconto` decimal(10,2) DEFAULT 0.00,
  `pedido_frete` decimal(10,2) DEFAULT 0.00,
  `pedido_cpf_cliente` varchar(20) DEFAULT NULL,
  `pedido_endereco_rota` text DEFAULT NULL,
  `pedido_endereco_complemento` text DEFAULT NULL,
  `pedido_endereco_cidade_uf` varchar(100) DEFAULT NULL,
  `pedido_endereco_cep` varchar(15) DEFAULT NULL,
  `pedido_endereco_bairro` varchar(100) DEFAULT NULL,
  `pedido_troco_para` decimal(10,2) DEFAULT 0.00,
  `pedido_taxa_conveniencia` decimal(10,2) DEFAULT 0.00,
  `pedido_created_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`pedido_id`),
  KEY `idx_pedido_code` (`pedido_code`),
  KEY `idx_pedido_ide` (`pedido_ide`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `ze_pedido`
--

LOCK TABLES `ze_pedido` WRITE;
/*!40000 ALTER TABLE `ze_pedido` DISABLE KEYS */;
/*!40000 ALTER TABLE `ze_pedido` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping events for database 'zedelivery'
--

--
-- Dumping routines for database 'zedelivery'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-01-29 20:42:32
