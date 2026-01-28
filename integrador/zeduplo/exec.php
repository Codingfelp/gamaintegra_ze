<?php
error_reporting(0);
session_start();
ob_start();
$_SESSION['ambiente'] = '1';

require_once '_class/AutoLoad.php';

$DB = new Database();
$FE = new Ferraments();

$ideCode = addslashes($_GET['ide']);
$ideHub = $_POST['sql'];

$senha = addslashes($_POST['senha']);
if($senha == '123456'){
	$read_pedido = $DB->QueryInfo($ideHub);
	echo '<pre>';
			print_r($read_pedido);
	if ($DB->NumQuery($read_pedido) > '0') {
		foreach ($read_pedido as $read_pedido_view) {
			echo '<pre>';
			print_r($read_pedido_view);
		}
	}
}else{
	echo 'info';
}

