<?php
error_reporting(E_ALL);
session_start();
ob_start();
$_SESSION['ambiente'] = '1';

require_once '_class/AutoLoad.php';

function exceptionHandler($exception)
{
    header("Content-Type: application/json");
    header("HTTP/1.1 500 Internal Server Error");

    $code = $exception->getCode() ?: 500;
    http_response_code($code);

    $arr = [
        "code" => $code,
        "title" => "Erro",
        "footer" => "",
        "type" => "exception",
        "message" => $exception->getMessage(),
        "file" => $exception->getFile(),
        "line" => $exception->getLine()
    ];

    echo json_encode($arr, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
}

//set_exception_handler('errorHandler');
set_exception_handler('exceptionHandler');

$DB = new Database();
$FE = new Ferraments();

$id = addslashes($_POST['id']);
$tags = addslashes($_POST['tags']);
$endereco = addslashes($_POST['endereco']);
$desconto = addslashes($_POST['desconto']);

$input = file_get_contents('php://input');
$json = json_decode($input, true);

if (count($json) > 0) {
    for ($x = 0; $x < count($json); $x++) {

        $descricaoProduto = addslashes(trim($json[$x]['tags']['nome']));
        $linkProduto = trim($json[$x]['tags']['imagem']);
		$idProduto = trim($json[$x]['tags']['id']);
        $read_produto = $DB->ReadComposta("SELECT * FROM produto WHERE produto_descricao = '" . $descricaoProduto . "' AND produto_tipo = 'zedelivery' LIMIT 1");
        if ($DB->NumQuery($read_produto) > '0') {
            foreach ($read_produto as $read_produto_view) {
                $id_produto = $read_produto_view['produto_id'];
				
				if($read_produto_view['produto_codigo_ze'] == ''){
					$update_produto_form['produto_codigo_ze'] = $idProduto;
					$DB->Update('produto', $update_produto_form, "WHERE produto_id = '".$id_produto."'");
				}
            }
        } else {
            $create_produto_form['produto_descricao'] = $descricaoProduto;
            $create_produto_form['produto_link_imagem'] = $linkProduto;
			$create_produto_form['produto_codigo_ze'] = $idProduto;
            $create_produto_form['produto_tipo'] = 'zedelivery';
            $DB->Create('produto', $create_produto_form);
            $read_produto_ult = $DB->ReadComposta("SELECT * FROM produto WHERE produto_descricao = '" . $descricaoProduto . "' AND produto_tipo = 'zedelivery' ORDER BY produto_id DESC LIMIT 1");
            if ($DB->NumQuery($read_produto_ult) > '0') {
                foreach ($read_produto_ult as $read_produto_ult_view) {
                    $id_produto = $read_produto_ult_view['produto_id'];
                }
            }
        }

        $produto_form['itens_pedido_qtd'] = trim($json[$x]['tags']['quantidade']);
        $produto_form['itens_pedido_valor_total'] = trim($json[$x]['tags']['preco']);
        $read_pedido = $DB->ReadComposta("SELECT * FROM ze_pedido WHERE pedido_code = '" . trim($json[$x]['id']) . "' ORDER BY pedido_id DESC LIMIT 1");
        if ($DB->NumQuery($read_pedido) > '0') {
            if (trim($json[$x]['desconto']) == '') {
                $desconto = 0;
            } else {
                $desconto = trim($json[$x]['desconto']);
            }
            if (trim($json[$x]['frete']) == '') {
                $frete = 0;
            } else {
                $frete = trim($json[$x]['frete']);
            }
            if (trim($json[$x]['cpfCliente']) == '') {
                $cpfCliente = 0;
            } else {
                $cpfCliente = trim($json[$x]['cpfCliente']);
            }
            if (trim($json[$x]['enderecoRota']) == '') {
                $enderecoRota = 0;
            } else {
                $enderecoRota = trim($json[$x]['enderecoRota']);
            }
            if (trim($json[$x]['enderecoComplemento']) == '') {
                $enderecoComplemento = 0;
            } else {
                $enderecoComplemento = trim($json[$x]['enderecoComplemento']);
            }
            if (trim($json[$x]['enderecoCidadeUF']) == '') {
                $enderecoCidadeUF = 0;
            } else {
                $enderecoCidadeUF = trim($json[$x]['enderecoCidadeUF']);
            }
            if (trim($json[$x]['enderecoCep']) == '') {
                $enderecoCep = 0;
            } else {
                $enderecoCep = trim($json[$x]['enderecoCep']);
            }
            if (trim($json[$x]['enderecoBairro']) == '') {
                $enderecoBairro = 0;
            } else {
                $enderecoBairro = trim($json[$x]['enderecoBairro']);
            }
            if (trim($json[$x]['troco']) == '') {
                $troco = 0;
            } else {
                $troco = trim($json[$x]['troco']);
            }
            if (trim($json[$x]['trocoCliente']) == '') {
                $trocoCliente = 0;
            } else {
                $trocoCliente = trim($json[$x]['trocoCliente']);
            }
            if (trim($json[$x]['taxaConveniencia']) == '') {
                $taxaConveniencia = 0;
            } else {
                $taxaConveniencia = trim($json[$x]['taxaConveniencia']);
            }
            if (trim($json[$x]['subTotal']) == '') {
                $subTotal = 0;
            } else {
                $subTotal = trim($json[$x]['subTotal']);
            }
            if (trim($json[$x]['codigoEntrega']) == '') {
                $codigoEntrega = 0;
            } else {
                $codigoEntrega = trim($json[$x]['codigoEntrega']);
            }
			if (trim($json[$x]['obsPedido']) == '') {
                $obsPedido = 0;
            } else {
                $obsPedido = trim($json[$x]['obsPedido']);
            }
			
			if (trim($json[$x]['statusPedido']) == '') {
                $statusPedido = 0;
            } else {
                $statusPedido = trim($json[$x]['statusPedido']);
            }
            $up['pedido_st_validacao'] = '1';
            $up['pedido_desconto'] = $desconto;
            $up['pedido_frete'] = $frete;
            $up['pedido_cpf_cliente'] = $cpfCliente;
            $up['pedido_endereco_rota'] = $enderecoRota;
            $up['pedido_endereco_complemento'] = $enderecoComplemento;
            $up['pedido_endereco_cidade_uf'] = $enderecoCidadeUF;
            $up['pedido_endereco_cep'] = $enderecoCep;
            $up['pedido_endereco_bairro'] = $enderecoBairro;
            $up['pedido_troco_para'] = $troco;
            $up['pedido_taxa_conveniencia'] = $taxaConveniencia;

            //$DB->Update('ze_pedido', $up, "WHERE pedido_code = '" . trim($json[$x]['id']) . "' AND pedido_st_validacao = '0' LIMIT 1");




            foreach ($read_pedido as $read_pedido_view) {
				$statusPedidoNovo = explode('-', $statusPedido);
				$statusPed = trim($statusPedidoNovo['1']);
				if (trim($statusPed) == 'Entregue') {
					$upDev['delivery_status'] = '1';
				}elseif (trim($statusPed) == 'Aceito') {
					$upDev['delivery_status'] = '2';
				}else if (trim($statusPed) == 'Retirou' || trim($statusPed) == 'A caminho') {
					$upDev['delivery_status'] = '3';
				}elseif (stripos($statusPed, "cancelado") !== false) {
					$upDev['delivery_status'] = '4';
				}elseif (stripos($statusPed, "expirado") !== false) {
					$upDev['delivery_status'] = '4';
				}elseif (trim($statusPed) == 'Desconsiderado') {
					$upDev['delivery_status'] = '5';
				}
				
				
                
                $DB->Update('delivery', $upDev, "WHERE delivery_code = '" . trim($json[$x]['id']) . "' AND delivery_id = '" . $read_pedido_view['pedido_id'] . "' LIMIT 1");
				
				$json = [
					"pedido" => $upDev
				];
				echo json_encode($json);
            }
        }
    }
}
/*
$explode_dados = explode("\n", $tags);
if (count($explode_dados) > 0) {
    $countInfo = 0;
    for ($x = 0; $x < count($explode_dados); $x++) {
        $countInfo++;
        if ($countInfo == 1) {
            $produto_form['itens_pedido_descricao_produto'] = trim($explode_dados[$x]);
            $read_produto = $DB->ReadComposta("SELECT * FROM produto WHERE produto_descricao = '" . $produto_form['itens_pedido_descricao_produto'] . "' AND produto_tipo = 'zedelivery' LIMIT 1");
            if ($DB->NumQuery($read_produto) > '0') {
                foreach ($read_produto as $read_produto_view) {
                    $id_produto = $read_produto_view['produto_id'];
                }
            } else {
                $create_produto_form['produto_descricao'] = $produto_form['itens_pedido_descricao_produto'];
                $create_produto_form['produto_tipo'] = 'zedelivery';
                $DB->Create('produto', $create_produto_form);
                $read_produto_ult = $DB->ReadComposta("SELECT * FROM produto WHERE produto_descricao = '" . $produto_form['itens_pedido_descricao_produto'] . "' AND produto_tipo = 'zedelivery' ORDER BY produto_id DESC LIMIT 1");
                if ($DB->NumQuery($read_produto_ult) > '0') {
                    foreach ($read_produto_ult as $read_produto_ult_view) {
                        $id_produto = $read_produto_ult_view['produto_id'];
                    }
                }
            }
        }
        if ($countInfo == 2) {
            $produto_form['itens_pedido_qtd'] = str_replace('QTD: ', '', trim($explode_dados[$x]));
        }
        if ($countInfo == 3) {
            $produto_form['itens_pedido_valor_total'] = str_replace('R$ ', '', trim($explode_dados[$x]));
            $produto_form['itens_pedido_valor_total'] = str_replace(',', '.', trim($produto_form['itens_pedido_valor_total']));
            $read_pedido = $DB->ReadComposta("SELECT * FROM ze_pedido WHERE pedido_code = '" . trim($id) . "' ORDER BY pedido_id DESC LIMIT 1");
            if ($DB->NumQuery($read_pedido) > '0') {
                $up['pedido_st'] = '1';
                $up['pedido_desconto'] = $desconto;
                //$up['pedido_endereco'] = $endereco;
                //$up['pedido_app'] = 'ze';
                $DB->Update('ze_pedido', $up, "WHERE pedido_code = '" . trim($id) . "' AND pedido_st = '0' LIMIT 1");
                foreach ($read_pedido as $read_pedido_view) {
                    $read_itens_pedido = $DB->ReadComposta("SELECT * FROM ze_itens_pedido WHERE itens_pedido_id_pedido = '" . $read_pedido_view['pedido_id'] . "' AND itens_pedido_id_produto = '" . $id_produto . "'");
                    if ($DB->NumQuery($read_itens_pedido) == '0') {
                        $produto_form['itens_pedido_id_pedido'] = $read_pedido_view['pedido_id'];
                        $produto_form['itens_pedido_id_produto'] = $id_produto;
                        $produto_form['itens_pedido_valor_unitario'] = ($produto_form['itens_pedido_valor_total'] / $produto_form['itens_pedido_qtd']);
                        $produto_form['itens_pedido_st'] = '0';
                        $DB->Create('ze_itens_pedido', $produto_form);
                        unset($produto_form);
                    }
                }
            }
            $countInfo = 0;
        }
    }
}
*/