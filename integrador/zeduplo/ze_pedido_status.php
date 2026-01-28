<?php
error_reporting(0);
session_start();
ob_start();
$_SESSION['ambiente'] = '1';

require_once '_class/AutoLoad.php';

$DB = new Database();
$FE = new Ferraments();
$ide = addslashes($_GET['ide']);
/*
if($r->delivery_status == '1'){
					$statusDelivery = 'CONCLUDED';
				}elseif($r->delivery_status == '2'){
					$statusDelivery = 'CONFIRMED';
				}elseif($r->delivery_status == '3'){
					$statusDelivery = 'DISPATCHED';
				}elseif($r->delivery_status == '4'){
					$statusDelivery = 'CANCELLED';
				}elseif($r->delivery_status == '5'){
					$statusDelivery = 'DISREGARDED';
				}else{
					$statusDelivery = 'CREATED';
				}*/

$read_pedido = $DB->ReadComposta("SELECT * FROM delivery WHERE delivery_status IN(0,2,3) AND delivery_taxa_conveniencia IS NOT NULL AND delivery_ide_hub_delivery = '".$ide."' AND delivery_date_time BETWEEN '2025-07-30 00:00:00' AND '2030-01-01 00:00:00' AND delivery_id_company = '2' ORDER BY rand() LIMIT 1");
if ($DB->NumQuery($read_pedido) > '0') {
    foreach ($read_pedido as $read_pedido_view) {
        $json = [
            "id_pedido" => trim($read_pedido_view['delivery_code'])
        ];
        echo json_encode($json);
    }
} else {
    $json = [
        "id_pedido" => 0
    ];
    echo json_encode($json);
}
