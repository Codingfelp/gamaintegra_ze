<?php
error_reporting(0);
session_start();
ob_start();
$_SESSION['ambiente'] = '1';

require_once '_class/AutoLoad.php';

$DB = new Database();
$FE = new Ferraments();

$id = addslashes($_POST['id'] ?? '');
$tags = addslashes($_POST['tags'] ?? '');
$endereco = addslashes($_POST['endereco'] ?? '');
$desconto = addslashes($_POST['desconto'] ?? '');
if ($desconto == '') {
    $desconto = 0;
} else {
    $strreplacedesconto = str_replace('R$ ', '', $desconto);
    $desconto = str_replace(',', '.', $strreplacedesconto);
}

// Ler dados: priorizar stdin (para CLI), fallback para php://input, depois $_POST
$input = '';

// 1. Tentar ler de stdin (CLI)
if (defined('STDIN') && !stream_isatty(STDIN)) {
    $input = stream_get_contents(STDIN);
}

// 2. Se vazio, tentar php://input (HTTP)
if (empty($input)) {
    $input = file_get_contents('php://input');
}

// 3. Se ainda vazio, tentar $_POST['pedidosData']
if (empty($input) && !empty($_POST['pedidosData'])) {
    $input = $_POST['pedidosData'];
}

// 4. Se ainda vazio, tentar argumentos de linha de comando
if (empty($input) && isset($argv[1]) && $argv[1] !== 'ide=' . ($ide ?? '')) {
    $input = $argv[1];
}

$json = json_decode($input, true);

if (is_array($json) && count($json) > 0) {
    for ($x = 0; $x < count($json); $x++) {

        $descricaoProduto = addslashes(trim($json[$x]['tags']['nome']));
        $linkProduto = trim($json[$x]['tags']['imagem']);
        $idProduto = trim($json[$x]['tags']['id']);
        $read_produto = $DB->ReadComposta("SELECT * FROM produto WHERE produto_descricao = '" . $descricaoProduto . "' AND produto_tipo = 'zedelivery' LIMIT 1");
        if ($DB->NumQuery($read_produto) > '0') {
            foreach ($read_produto as $read_produto_view) {
                $id_produto = $read_produto_view['produto_id'];

                if ($read_produto_view['produto_codigo_ze'] == '') {
                    $update_produto_form['produto_codigo_ze'] = $idProduto;
                    $DB->Update('produto', $update_produto_form, "WHERE produto_id = '" . $id_produto . "'");
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
            // Telefone do cliente
            if (empty(trim($json[$x]['telefoneCliente'] ?? ''))) {
                $telefoneCliente = '';
            } else {
                $telefoneCliente = trim($json[$x]['telefoneCliente']);
            }
            // Email do entregador
            if (empty(trim($json[$x]['emailEntregador'] ?? ''))) {
                $emailEntregador = '';
            } else {
                $emailEntregador = trim($json[$x]['emailEntregador']);
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
            $statusPedidoNovo = explode('-', $statusPedido);
            $statusPed = trim($statusPedidoNovo['0']);
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

            $DB->Update('ze_pedido', $up, "WHERE pedido_code = '" . trim($json[$x]['id']) . "' AND pedido_st_validacao = '0' LIMIT 1");




            foreach ($read_pedido as $read_pedido_view) {
                // Só atualizar campos se o novo valor não for vazio/0 OU se o valor atual for vazio
                // Isso preserva os dados que já foram capturados antes do pedido ser entregue
                
                if ($cpfCliente != '' && $cpfCliente != '0') {
                    $upDev['delivery_cpf_cliente'] = $cpfCliente;
                }
                
                // Telefone do cliente
                if ($telefoneCliente != '' && $telefoneCliente != '0') {
                    $upDev['delivery_telefone'] = $telefoneCliente;
                }
                
                // Email do entregador
                if ($emailEntregador != '' && $emailEntregador != '0') {
                    $upDev['delivery_email_entregador'] = $emailEntregador;
                }
                
                // Preservar endereço se já existir no banco
                if ($enderecoRota != '' && $enderecoRota != '0') {
                    $upDev['delivery_endereco_rota'] = $enderecoRota;
                }
                if ($enderecoComplemento != '' && $enderecoComplemento != '0') {
                    $upDev['delivery_endereco_complemento'] = $enderecoComplemento;
                }
                if ($enderecoCidadeUF != '' && $enderecoCidadeUF != '0') {
                    $upDev['delivery_endereco_cidade_uf'] = $enderecoCidadeUF;
                }
                if ($enderecoCep != '' && $enderecoCep != '0') {
                    $upDev['delivery_endereco_cep'] = $enderecoCep;
                }
                if ($enderecoBairro != '' && $enderecoBairro != '0') {
                    $upDev['delivery_endereco_bairro'] = $enderecoBairro;
                }
                
                // Valores financeiros - sempre atualizar
                $upDev['delivery_desconto'] = $desconto;
                $upDev['delivery_frete'] = $frete;
                $upDev['delivery_troco_para'] = $troco;
                $upDev['delivery_troco'] = $trocoCliente;
                $upDev['delivery_taxa_conveniencia'] = $taxaConveniencia;
                $upDev['delivery_subtotal'] = $subTotal;
                
                // Observações
                if ($obsPedido != '' && $obsPedido != '0') {
                    $upDev['delivery_obs'] = $obsPedido;
                }
                
                // Tipo de pedido
                if ($statusPed != '' && $statusPed != '0') {
                    $upDev['delivery_tipo_pedido'] = $statusPed;
                }
                
                // Código de entrega - só atualizar se não existir
                if ($read_pedido_view['delivery_codigo_entrega'] == '' || $read_pedido_view['delivery_codigo_entrega'] == '0') {
                    if ($codigoEntrega != '' && $codigoEntrega != '0') {
                        $upDev['delivery_codigo_entrega'] = $codigoEntrega;
                    }
                }

                $cdPedidoNovo = trim($json[$x]['id']);
                $idPedidoNovo = $read_pedido_view['pedido_id'];

                // Corrigido: usar apenas delivery_code para o UPDATE (delivery_id é diferente de pedido_id)
                $DB->Update('delivery', $upDev, "WHERE delivery_code = '" . trim($json[$x]['id']) . "' LIMIT 1");

                $produto_form['itens_pedido_id_pedido'] = $read_pedido_view['pedido_id'];
                $produto_form['itens_pedido_id_produto'] = $id_produto;
                $produto_form['itens_pedido_descricao_produto'] = trim($descricaoProduto);
                $produto_form['itens_pedido_valor_unitario'] = ($produto_form['itens_pedido_valor_total'] / $produto_form['itens_pedido_qtd']);
                $produto_form['itens_pedido_st'] = '0';
                $DB->Create('ze_itens_pedido', $produto_form);
                unset($produto_form);
            }
        }
    }
    $uppedido['delivery_tem_itens'] = '1';
    // Corrigido: usar apenas delivery_code
    $DB->Update('delivery', $uppedido, "WHERE delivery_code = '" . $cdPedidoNovo . "' LIMIT 1");
}
// Retornar resposta JSON para o cliente Node.js
header('Content-Type: application/json');
echo json_encode([
    'success' => true,
    'message' => 'Dados processados com sucesso',
    'timestamp' => date('Y-m-d H:i:s')
]);
exit;
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