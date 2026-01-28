<?php
error_reporting(0);
session_start();
ob_start();
$_SESSION['ambiente'] = '1';

require_once '_class/AutoLoad.php';

$DB = new Database();
$FE = new Ferraments();
$ide = addslashes($_GET['ide']);

$read_pedido = $DB->ReadComposta("SELECT * FROM ze_pedido WHERE pedido_st_validacao = '0' AND pedido_ide = '".$ide."' LIMIT 1");

if ($DB->NumQuery($read_pedido) > '0') {
    foreach ($read_pedido as $read_pedido_view) {
        $json = [
            "id_pedido" => trim($read_pedido_view['pedido_code'])
        ];
        echo json_encode($json);
    }
} else {
    $json = [
        "id_pedido" => 0
    ];
    echo json_encode($json);
}
