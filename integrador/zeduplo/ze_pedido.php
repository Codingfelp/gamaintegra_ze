<?php
error_reporting(0);
session_start();
ob_start();
$_SESSION['ambiente'] = '1';

require_once '_class/AutoLoad.php';

$DB = new Database();
$FE = new Ferraments();

$pedido_code = addslashes($_POST['orderNumber'] ?? '');
$pedido_data_hora = addslashes($_POST['orderDateTime'] ?? '');
$pedido_nome_cliente = addslashes($_POST['customerName'] ?? '');
$pedido_status = addslashes($_POST['status'] ?? '');
$pedido_delivery_tipo = addslashes($_POST['deliveryType'] ?? '');
$pedido_payment = addslashes($_POST['paymentType'] ?? '');
$pedido_total = addslashes($_POST['totalPrice'] ?? '');

$randPedido = md5(date('y-m-dH:i:s') . rand(100, 999));

// Ler dados: priorizar php://input, fallback para $_POST
$input = file_get_contents('php://input');
if (!empty($input)) {
    parse_str($input, $orderData);
} else {
    // CLI: dados vêm via $_POST (populado pelo php-bridge.js)
    $orderData = $_POST;
}
$orderNumberIde = addslashes($_GET['ide'] ?? '');


$read_pedido = $DB->ReadComposta("SELECT * FROM ze_pedido INNER JOIN hub_delivery ON hub_delivery_ide = pedido_ide WHERE pedido_st = '0' ORDER BY pedido_id ASC LIMIT 10");
if ($DB->NumQuery($read_pedido) > '0') {
    foreach ($read_pedido as $read_pedido_view) {
        // Verificar se já existe na tabela delivery pelo código
        $check_exists = $DB->ReadComposta("SELECT delivery_id FROM delivery WHERE delivery_code = '" . $read_pedido_view['pedido_code'] . "' LIMIT 1");
        if ($DB->NumQuery($check_exists) > 0) {
            // Já existe, apenas marcar como processado
            $up['pedido_st'] = '1';
            $DB->Update('ze_pedido', $up, "WHERE pedido_id = '" . $read_pedido_view['pedido_id'] . "' LIMIT 1");
            continue;
        }
        
        // Resetar array para evitar dados residuais
        $dev_form = [];
        
        $explode_data = explode('/', $read_pedido_view['pedido_data']);

        $valorNumerico = preg_replace('/[^0-9]/', '', $read_pedido_view['pedido_valor']);
        $valorFormatado = substr($valorNumerico, 0, -2) . "." . substr($valorNumerico, -2);
        $valorFloat = (float) $valorFormatado;
        $read_pedido_view['pedido_valor'] = $valorFloat;

        // delivery_id é auto-incremento, não definir!
        $dev_form['delivery_data_hora_captura'] = $read_pedido_view['pedido_data_hora_captura'];
        $dev_form['delivery_ide_hub_delivery']     = $read_pedido_view['pedido_ide'];
        $dev_form['delivery_ide']                 = hash('md5', date('YmdHis') . rand(1000, 9999));
        $dev_form['delivery_code']                 = $read_pedido_view['pedido_code'];
        $dev_form['delivery_name_cliente']         = str_replace('ė', 'e', $read_pedido_view['pedido_nome']);
        $dev_form['delivery_date_time']         = $explode_data['2'] . '-' . $explode_data['1'] . '-' . $explode_data['0'] . ' ' . $read_pedido_view['pedido_hora'];
        $dev_form['delivery_status']             = '0';
        $dev_form['delivery_subtotal']             = $read_pedido_view['pedido_valor'];
        $dev_form['delivery_forma_pagamento']     = $read_pedido_view['pedido_pagamento'];
        $dev_form['delivery_desconto']             = $read_pedido_view['pedido_desconto'];
        $dev_form['delivery_frete']             = $read_pedido_view['pedido_frete'];
        $dev_form['delivery_total']             = $read_pedido_view['pedido_valor'] - $read_pedido_view['pedido_desconto'];
        $dev_form['delivery_trash']                = '0';
        $dev_form['delivery_id_company']        = $read_pedido_view['hub_delivery_id_company'];

        $dev_form['delivery_cpf_cliente'] = $read_pedido_view['pedido_cpf_cliente'];
        $dev_form['delivery_endereco_rota'] = $read_pedido_view['pedido_endereco_rota'];
        $dev_form['delivery_endereco_complemento'] = $read_pedido_view['pedido_endereco_complemento'];
        $dev_form['delivery_endereco_cidade_uf'] = $read_pedido_view['pedido_endereco_cidade_uf'];
        $dev_form['delivery_endereco_cep'] = $read_pedido_view['pedido_endereco_cep'];
        $dev_form['delivery_endereco_bairro'] = $read_pedido_view['pedido_endereco_bairro'];
        if ($DB->Create('delivery', $dev_form)) {
            $up['pedido_st'] = '1';
            $DB->Update('ze_pedido', $up, "WHERE pedido_id = '" . $read_pedido_view['pedido_id'] . "' LIMIT 1");
        }
    }
}


$read_itens_pedido = $DB->ReadComposta("SELECT * FROM ze_itens_pedido WHERE itens_pedido_st = '0' ORDER BY itens_pedido_id ASC LIMIT 10");
if ($DB->NumQuery($read_itens_pedido) > '0') {
    foreach ($read_itens_pedido as $read_itens_pedido_view) {
        $item_dev_form['delivery_itens_id_delivery']         = $read_itens_pedido_view['itens_pedido_id_pedido'];
        $item_dev_form['delivery_itens_id_produto']         = $read_itens_pedido_view['itens_pedido_id_produto'];
        $item_dev_form['delivery_itens_descricao']             = $read_itens_pedido_view['itens_pedido_descricao_produto'];
        $item_dev_form['delivery_itens_qtd']                 = $read_itens_pedido_view['itens_pedido_qtd'];
        $item_dev_form['delivery_itens_valor_unitario']     = $read_itens_pedido_view['itens_pedido_valor_unitario'];
        $item_dev_form['delivery_itens_valor_total']         = $read_itens_pedido_view['itens_pedido_valor_total'];
        if ($DB->Create('delivery_itens', $item_dev_form)) {
            $upItens['itens_pedido_st'] = '1';
            $DB->Update('ze_itens_pedido', $upItens, "WHERE itens_pedido_id = '" . $read_itens_pedido_view['itens_pedido_id'] . "' LIMIT 1");
        }
    }
}

if (!empty($orderData)) {
    $orderNumber = str_replace(' ', '', urldecode($orderData['orderNumber']));
    $orderDateTime = explode(' - ', urldecode($orderData['orderDateTime']));
    $customerName = urldecode($orderData['customerName']);
    $status = urldecode($orderData['status']);
    $deliveryType = urldecode($orderData['deliveryType']);
    $paymentType = urldecode($orderData['paymentType']);
    $totalPrice = str_replace('R$ ', '', urldecode($orderData['priceFormatted']));



    $pedido_form['pedido_st_validacao'] = '0';
    $pedido_form['pedido_data_hora_captura'] = date('Y-m-d H:i:s');

    $statusCancelado = trim($status);

    $statusColocado = trim($status);

    $explodeCancelado = explode(' - ', $statusCancelado);

    if (trim($status) == 'Entregue') {
        $read_pedido = $DB->ReadComposta("SELECT * FROM ze_pedido WHERE pedido_code = '" . trim($orderNumber) . "' ORDER BY pedido_id DESC LIMIT 1");
        if ($DB->NumQuery($read_pedido) > '0') {
            foreach ($read_pedido as $read_pedido_view) {
                $UpdateStatusPedido['delivery_status'] = '1';
                $DB->Update('delivery', $UpdateStatusPedido, "WHERE delivery_code = '" . trim($read_pedido_view['pedido_code']) . "' AND delivery_ide_hub_delivery = '" . $read_pedido_view['pedido_ide'] . "' LIMIT 1");
                $json = [
                    "id_pedido" => trim(str_replace(' ', '', $orderNumber))
                ];
                echo json_encode($json);
            }
        } else {
            $pedido_form['pedido_ide']      = trim($orderNumberIde);
            $pedido_form['pedido_st']       = '0';
            $pedido_form['pedido_code']     = trim($orderNumber);
            $pedido_form['pedido_nome']     = trim($customerName);
            $pedido_form['pedido_data']     = trim($orderDateTime['0']);
            $pedido_form['pedido_hora']     = trim($orderDateTime['1']);
            $pedido_form['pedido_status']     = trim($status);
            $pedido_form['pedido_email_entregador'] = trim('');
            $pedido_form['pedido_valor'] = trim($totalPrice);
            $pedido_form['pedido_pagamento'] = trim($paymentType);
            $pedido_form['pedido_tipo'] = trim($deliveryType);
            $pedido_form['pedido_cupom'] = trim('');
            $pedido_form['pedido_desconto'] = '0';
            $pedido_form['pedido_frete'] = '0';
            $pedido_form['pedido_st_delivery'] = '0';
            $pedido_form['pedido_st_validacao'] = '0';  // IMPORTANTE: permite v1-itens coletar detalhes
            $pedido_form['pedido_data_hora_captura'] = date('Y-m-d H:i:s');
            $DB->Create('ze_pedido', $pedido_form);

            $json = [
                "id_pedido" => trim($orderNumber)
            ];
            echo json_encode($json);
        }
    } else if (trim($status) == 'Aceito') {
        $read_pedido = $DB->ReadComposta("SELECT * FROM ze_pedido WHERE pedido_code = '" . trim($orderNumber) . "' ORDER BY pedido_id DESC LIMIT 1");
        if ($DB->NumQuery($read_pedido) > '0') {
            foreach ($read_pedido as $read_pedido_view) {
                $UpdateStatusPedido['delivery_status'] = '2';
                $DB->Update('delivery', $UpdateStatusPedido, "WHERE delivery_code = '" . trim($read_pedido_view['pedido_code']) . "' AND delivery_ide_hub_delivery = '" . $read_pedido_view['pedido_ide'] . "' LIMIT 1");


                $UpdateDataPedido['delivery_data_hora_aceite'] = date('Y-m-d H:i:s', strtotime('-10 seconds'));
                $DB->Update('delivery_data', $UpdateDataPedido, "WHERE delivery_data_code = '" . trim($read_pedido_view['pedido_code']) . "' AND delivery_data_hora_aceite IS NULL LIMIT 1");
                $json = [
                    "id_pedido" => trim(str_replace(' ', '', $orderNumber))
                ];
                echo json_encode($json);
            }
        } else {
            $pedido_form['pedido_ide']      = trim($orderNumberIde);
            $pedido_form['pedido_st']       = '0';
            $pedido_form['pedido_code']     = trim($orderNumber);
            $pedido_form['pedido_nome']     = trim($customerName);
            $pedido_form['pedido_data']     = trim($orderDateTime['0']);
            $pedido_form['pedido_hora']     = trim($orderDateTime['1']);
            $pedido_form['pedido_status']     = trim($status);
            $pedido_form['pedido_email_entregador'] = trim('');
            $pedido_form['pedido_valor'] = trim($totalPrice);
            $pedido_form['pedido_pagamento'] = trim($paymentType);
            $pedido_form['pedido_tipo'] = trim($deliveryType);
            $pedido_form['pedido_cupom'] = trim('');
            $pedido_form['pedido_desconto'] = '0';
            $pedido_form['pedido_frete'] = '0';
            $pedido_form['pedido_st_delivery'] = '0';
            $pedido_form['pedido_st_validacao'] = '0';  // IMPORTANTE: permite v1-itens coletar detalhes
            $pedido_form['pedido_data_hora_captura'] = date('Y-m-d H:i:s');
            $DB->Create('ze_pedido', $pedido_form);

            $json = [
                "id_pedido" => trim($orderNumber)
            ];
            echo json_encode($json);
        }
    } else if (stripos($status, 'colocado') !== false) {
        $read_pedido_data = $DB->ReadComposta("SELECT * FROM delivery_data WHERE delivery_data_code = '" . trim($orderNumber) . "' ORDER BY delivery_data_id DESC LIMIT 1");
        if ($DB->NumQuery($read_pedido_data) > '0') {
        } else {
            $pedido_form_dev['delivery_data_code']     = trim($orderNumber);
            $pedido_form_dev['delivery_data_hora_pedido']     = date('Y-m-d H:i:s');
            $DB->Create('delivery_data', $pedido_form_dev);
        }
        /*$read_pedido = $DB->ReadComposta("SELECT * FROM ze_pedido WHERE pedido_code = '" . trim($orderNumber) . "' ORDER BY pedido_id DESC LIMIT 1");
        if ($DB->NumQuery($read_pedido) > '0') {
            foreach ($read_pedido as $read_pedido_view) {
                $UpdateStatusPedido['delivery_status'] = '0';
                $DB->Update('delivery', $UpdateStatusPedido, "WHERE delivery_code = '" . trim($read_pedido_view['pedido_code']) . "' AND delivery_ide_hub_delivery = '" . $read_pedido_view['pedido_ide'] . "' LIMIT 1");
                $json = [
                    "id_pedido" => trim(str_replace(' ', '', $orderNumber))
                ];
                echo json_encode($json);
            }
        } else {
            $pedido_form['pedido_ide']      = trim($orderNumberIde);
            $pedido_form['pedido_st']       = '0';
            $pedido_form['pedido_code']     = trim($orderNumber);
            $pedido_form['pedido_nome']     = trim($customerName);
            $pedido_form['pedido_data']     = trim($orderDateTime['0']);
            $pedido_form['pedido_hora']     = trim($orderDateTime['1']);
            $pedido_form['pedido_status']     = trim($status);
            $pedido_form['pedido_email_entregador'] = trim('');
            $pedido_form['pedido_valor'] = trim($totalPrice);
            $pedido_form['pedido_pagamento'] = trim($paymentType);
            $pedido_form['pedido_tipo'] = trim($deliveryType);
            $pedido_form['pedido_cupom'] = trim('');
            $pedido_form['pedido_desconto'] = '0';
            $pedido_form['pedido_frete'] = '0';
            $pedido_form['pedido_st_delivery'] = '0';
            $pedido_form['pedido_st_validacao'] = '0';  // IMPORTANTE: permite v1-itens coletar detalhes
            $pedido_form['pedido_data_hora_captura'] = date('Y-m-d H:i:s');
            $DB->Create('ze_pedido', $pedido_form);

            $json = [
                "id_pedido" => trim($orderNumber)
            ];
            echo json_encode($json);
        }*/
    } else if (trim($status) == 'Retirou' || trim($status) == 'A caminho') {
        $read_pedido = $DB->ReadComposta("SELECT * FROM ze_pedido WHERE pedido_code = '" . trim($orderNumber) . "' ORDER BY pedido_id DESC LIMIT 1");
        if ($DB->NumQuery($read_pedido) > '0') {
            foreach ($read_pedido as $read_pedido_view) {
                $UpdateStatusPedido['delivery_status'] = '3';
                //$DB->Update('delivery', $UpdateStatusPedido, "WHERE delivery_code = '" . trim($read_pedido_view['pedido_code']) . "' AND delivery_ide_hub_delivery = '" . $read_pedido_view['pedido_ide'] . "' LIMIT 1");
                $json = [
                    "id_pedido" => trim(str_replace(' ', '', $orderNumber))
                ];
                echo json_encode($json);
            }
        } else {
            $pedido_form['pedido_ide']      = trim($orderNumberIde);
            $pedido_form['pedido_st']       = '0';
            $pedido_form['pedido_code']     = trim($orderNumber);
            $pedido_form['pedido_nome']     = trim($customerName);
            $pedido_form['pedido_data']     = trim($orderDateTime['0']);
            $pedido_form['pedido_hora']     = trim($orderDateTime['1']);
            $pedido_form['pedido_status']     = trim($status);
            $pedido_form['pedido_email_entregador'] = trim('');
            $pedido_form['pedido_valor'] = trim($totalPrice);
            $pedido_form['pedido_pagamento'] = trim($paymentType);
            $pedido_form['pedido_tipo'] = trim($deliveryType);
            $pedido_form['pedido_cupom'] = trim('');
            $pedido_form['pedido_desconto'] = '0';
            $pedido_form['pedido_frete'] = '0';
            $pedido_form['pedido_st_delivery'] = '0';
            $pedido_form['pedido_st_validacao'] = '0';  // IMPORTANTE: permite v1-itens coletar detalhes
            $pedido_form['pedido_data_hora_captura'] = date('Y-m-d H:i:s');
            $DB->Create('ze_pedido', $pedido_form);

            $json = [
                "id_pedido" => trim($orderNumber)
            ];
            echo json_encode($json);
        }
    } else if (trim($explodeCancelado['0']) == 'Cancelado') {
        $read_pedido = $DB->ReadComposta("SELECT * FROM ze_pedido WHERE pedido_code = '" . trim($orderNumber) . "' ORDER BY pedido_id DESC LIMIT 1");
        if ($DB->NumQuery($read_pedido) > '0') {
            foreach ($read_pedido as $read_pedido_view) {
                $UpdateStatusPedido['delivery_status'] = '5';
                //$DB->Update('delivery', $UpdateStatusPedido, "WHERE delivery_code = '" . trim($read_pedido_view['pedido_code']) . "' AND delivery_ide_hub_delivery = '" . $read_pedido_view['pedido_ide'] . "' LIMIT 1");
                $json = [
                    "id_pedido" => trim(str_replace(' ', '', $orderNumber))
                ];
                echo json_encode($json);
            }
        } else {
            $pedido_form['pedido_ide']      = trim($orderNumberIde);
            $pedido_form['pedido_st']       = '0';
            $pedido_form['pedido_code']     = trim($orderNumber);
            $pedido_form['pedido_nome']     = trim($customerName);
            $pedido_form['pedido_data']     = trim($orderDateTime['0']);
            $pedido_form['pedido_hora']     = trim($orderDateTime['1']);
            $pedido_form['pedido_status']     = trim($status);
            $pedido_form['pedido_email_entregador'] = trim('');
            $pedido_form['pedido_valor'] = trim($totalPrice);
            $pedido_form['pedido_pagamento'] = trim($paymentType);
            $pedido_form['pedido_tipo'] = trim($deliveryType);
            $pedido_form['pedido_cupom'] = trim('');
            $pedido_form['pedido_desconto'] = '0';
            $pedido_form['pedido_frete'] = '0';
            $pedido_form['pedido_st_delivery'] = '0';
            $pedido_form['pedido_st_validacao'] = '0';  // IMPORTANTE: permite v1-itens coletar detalhes
            $pedido_form['pedido_data_hora_captura'] = date('Y-m-d H:i:s');
            $DB->Create('ze_pedido', $pedido_form);

            $json = [
                "id_pedido" => trim($orderNumber)
            ];
            echo json_encode($json);
        }
    } else if (trim($status) == 'Desconsiderado') {
        $read_pedido = $DB->ReadComposta("SELECT * FROM ze_pedido WHERE pedido_code = '" . trim($orderNumber) . "' ORDER BY pedido_id DESC LIMIT 1");
        if ($DB->NumQuery($read_pedido) > '0') {
            foreach ($read_pedido as $read_pedido_view) {
                $UpdateStatusPedido['delivery_status'] = '2';
                //$DB->Update('delivery', $UpdateStatusPedido, "WHERE delivery_code = '" . trim($read_pedido_view['pedido_code']) . "' AND delivery_ide_hub_delivery = '" . $read_pedido_view['pedido_ide'] . "' LIMIT 1");
                $json = [
                    "id_pedido" => trim(str_replace(' ', '', $orderNumber))
                ];
                echo json_encode($json);
            }
        } else {
            $pedido_form['pedido_ide']      = trim($orderNumberIde);
            $pedido_form['pedido_st']       = '0';
            $pedido_form['pedido_code']     = trim($orderNumber);
            $pedido_form['pedido_nome']     = trim($customerName);
            $pedido_form['pedido_data']     = trim($orderDateTime['0']);
            $pedido_form['pedido_hora']     = trim($orderDateTime['1']);
            $pedido_form['pedido_status']     = trim($status);
            $pedido_form['pedido_email_entregador'] = trim('');
            $pedido_form['pedido_valor'] = trim($totalPrice);
            $pedido_form['pedido_pagamento'] = trim($paymentType);
            $pedido_form['pedido_tipo'] = trim($deliveryType);
            $pedido_form['pedido_cupom'] = trim('');
            $pedido_form['pedido_desconto'] = '0';
            $pedido_form['pedido_frete'] = '0';
            $pedido_form['pedido_st_delivery'] = '0';
            $pedido_form['pedido_st_validacao'] = '0';  // IMPORTANTE: permite v1-itens coletar detalhes
            $pedido_form['pedido_data_hora_captura'] = date('Y-m-d H:i:s');
            $DB->Create('ze_pedido', $pedido_form);

            $json = [
                "id_pedido" => trim($orderNumber)
            ];
            echo json_encode($json);
        }
    } else {
        $json = [
            "id_pedido" => 'SEM PEDIDO'
        ];
        echo json_encode($json);
    }
}
