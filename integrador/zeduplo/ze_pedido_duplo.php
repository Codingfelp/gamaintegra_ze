<?php
error_reporting(0);
session_start();
ob_start();
$_SESSION['ambiente'] = '1';

require_once '_class/AutoLoad.php';

$DB = new Database();
$FE = new Ferraments();
$ide = addslashes($_GET['ide']);

$read_pedido = $DB->ReadComposta("SELECT * FROM ze_duplo WHERE duplo_ide_hub_delivery = '".$ide."' AND duplo_status = '0' ORDER BY duplo_id DESC LIMIT 1");
if ($DB->NumQuery($read_pedido) > '0') {
    foreach ($read_pedido as $read_pedido_view) {
		$update_json['duplo_status'] = '1';
		
        $DB->Update('ze_duplo', $update_json, "WHERE duplo_id = '".$read_pedido_view['duplo_id']."'");
        $json = [
            "codigo" => trim($read_pedido_view['duplo_codigo'])
        ];
        echo json_encode($json);
    }
} else {
    $json = [
        "codigo" => 0
    ];
    echo json_encode($json);
}
