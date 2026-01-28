<?php
error_reporting(0);
session_start();
ob_start();
$_SESSION['ambiente'] = '1';

require_once '_class/AutoLoad.php';

$DB = new Database();
$FE = new Ferraments();

$ideCode = addslashes($_GET['ide']);
$ideHub = addslashes($_GET['hub']);

$read_pedido = $DB->ReadComposta("SELECT * FROM delivery WHERE delivery_code = '".$ideCode."' ORDER BY delivery_id ASC LIMIT 10");
if ($DB->NumQuery($read_pedido) > '0') {
    foreach ($read_pedido as $read_pedido_view) {
        echo '<pre>';
		print_r($read_pedido_view);
    }
}

echo '<hr />';
if($ideHub != ''){
	$read_pedido = $DB->ReadComposta("SELECT * FROM delivery WHERE delivery_status IN(0,2,3) AND delivery_ide_hub_delivery = '".$ideHub."' AND delivery_date_time BETWEEN '2025-07-30 00:00:00' AND '2030-01-01 00:00:00' AND delivery_id_company = '2' ORDER BY delivery_date_time DESC");
}else{
	$read_pedido = $DB->ReadComposta("SELECT * FROM delivery WHERE delivery_status IN(0,2,3) AND delivery_date_time BETWEEN '2025-07-30 00:00:00' AND '2030-01-01 00:00:00' AND delivery_id_company = '2' ORDER BY delivery_date_time DESC");
}

echo $DB->NumQuery($read_pedido);
echo '<hr />';
if ($DB->NumQuery($read_pedido) > '0') {
    foreach ($read_pedido as $read_pedido_view) {
        echo '<pre>';
		print_r($read_pedido_view);
    }
} else {
    $json = [
        "id_pedido" => 0
    ];
    echo json_encode($json);
}
