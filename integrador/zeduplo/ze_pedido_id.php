<?php
error_reporting(0);
session_start();
ob_start();
$_SESSION['ambiente'] = '1';

require_once '_class/AutoLoad.php';

$DB = new Database();
$FE = new Ferraments();
$ide = addslashes($_GET['ide']);

// PRIORIDADE 0 (MAIS ALTA): Pedidos EM ROTA (status 3) sem telefone - CAPTURAR URGENTE!
// Telefone só pode ser capturado via modal quando pedido está A CAMINHO (status 3)
$read_pedido_urgente = $DB->ReadComposta("
    SELECT d.delivery_code 
    FROM delivery d
    WHERE d.delivery_ide_hub_delivery = '".$ide."'
    AND d.delivery_status = 3
    AND (d.delivery_telefone IS NULL OR d.delivery_telefone = '' OR d.delivery_telefone = '0')
    AND d.delivery_trash = 0
    AND d.delivery_date_time >= DATE_SUB(NOW(), INTERVAL 4 HOUR)
    ORDER BY d.delivery_id DESC
    LIMIT 1
");

if ($DB->NumQuery($read_pedido_urgente) > '0') {
    foreach ($read_pedido_urgente as $row) {
        $json = [
            "id_pedido" => trim($row['delivery_code']),
            "prioridade" => "urgente_telefone"
        ];
        echo json_encode($json);
    }
    exit;
}

// PRIORIDADE 1: Pedidos novos que ainda não foram processados (pedido_st_validacao = 0)
$read_pedido = $DB->ReadComposta("SELECT * FROM ze_pedido WHERE pedido_st_validacao = '0' AND pedido_ide = '".$ide."' ORDER BY pedido_id DESC LIMIT 1");

if ($DB->NumQuery($read_pedido) > '0') {
    foreach ($read_pedido as $read_pedido_view) {
        $json = [
            "id_pedido" => trim($read_pedido_view['pedido_code']),
            "prioridade" => "novo"
        ];
        echo json_encode($json);
    }
} else {
    // PRIORIDADE 2: Pedidos que foram validados mas não tiveram itens capturados
    // Isso acontece quando o pedido é entregue muito rápido antes de v1-itens processar
    // Buscar apenas pedidos das últimas 24 horas para não sobrecarregar
    // CRITÉRIO: Pedidos sem itens OU pedidos antigos (>30min) sem endereço completo
    $read_pedido_sem_itens = $DB->ReadComposta("
        SELECT d.delivery_code 
        FROM delivery d
        WHERE d.delivery_ide_hub_delivery = '".$ide."'
        AND d.delivery_trash = 0
        AND d.delivery_status NOT IN (4, 5)
        AND d.delivery_date_time >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
        AND (
            (d.delivery_tem_itens IS NULL OR d.delivery_tem_itens = 0)
            OR (
                d.delivery_date_time < DATE_SUB(NOW(), INTERVAL 30 MINUTE)
                AND (d.delivery_endereco_rota IS NULL OR d.delivery_endereco_rota = '' OR d.delivery_endereco_rota = '0')
            )
        )
        ORDER BY d.delivery_date_time DESC
        LIMIT 1
    ");
    
    if ($DB->NumQuery($read_pedido_sem_itens) > '0') {
        foreach ($read_pedido_sem_itens as $row) {
            $json = [
                "id_pedido" => trim($row['delivery_code']),
                "prioridade" => "reprocessar"
            ];
            echo json_encode($json);
        }
    } else {
        $json = [
            "id_pedido" => 0
        ];
        echo json_encode($json);
    }
}
