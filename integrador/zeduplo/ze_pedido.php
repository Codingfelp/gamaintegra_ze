<?php
error_reporting(0);
session_start();
ob_start();
$_SESSION['ambiente'] = '1';

require_once '_class/AutoLoad.php';

$DB = new Database();
$FE = new Ferraments();

/**
 * SISTEMA INTELIGENTE DE PROGRESSÃO DE STATUS
 * 
 * Ordem de progressão: Pendente (0) → Aceito (2) → A Caminho (3) → Entregue (1)
 * Status finais (não podem ser alterados): Entregue (1), Cancelado (4, 5)
 * 
 * REGRA: Status só pode AVANÇAR, nunca REGREDIR
 */

// Mapa de prioridade de status (maior = mais avançado)
$STATUS_PRIORITY = [
    '0' => 1,  // Pendente
    '2' => 2,  // Aceito
    '3' => 3,  // A Caminho
    '1' => 4,  // Entregue (final)
    '4' => 5,  // Cancelado Cliente (final)
    '5' => 5,  // Cancelado Loja (final)
];

// Status finais que não podem ser alterados
$FINAL_STATUS = ['1', '4', '5'];

/**
 * Verifica se uma atualização de status é permitida
 * @param string $current_status Status atual no banco
 * @param string $new_status Novo status a ser aplicado
 * @return array ['allowed' => bool, 'reason' => string]
 */
function canUpdateStatus($current_status, $new_status) {
    global $STATUS_PRIORITY, $FINAL_STATUS;
    
    $current = strval($current_status);
    $new = strval($new_status);
    
    // Se o status atual é final, não pode mudar
    if (in_array($current, $FINAL_STATUS)) {
        return ['allowed' => false, 'reason' => 'current_is_final', 'current' => $current];
    }
    
    // Se o novo status tem prioridade menor ou igual, não atualizar
    $current_priority = $STATUS_PRIORITY[$current] ?? 0;
    $new_priority = $STATUS_PRIORITY[$new] ?? 0;
    
    if ($new_priority <= $current_priority) {
        return ['allowed' => false, 'reason' => 'would_regress', 'current' => $current, 'current_priority' => $current_priority, 'new_priority' => $new_priority];
    }
    
    return ['allowed' => true, 'reason' => 'ok'];
}

/**
 * Converte texto de status para código numérico
 */
function statusTextToCode($status_text) {
    $status = strtolower(trim($status_text));
    
    if ($status === 'entregue') return '1';
    if ($status === 'aceito') return '2';
    if ($status === 'a caminho' || $status === 'retirou') return '3';
    if (strpos($status, 'cancelado') !== false) return '4';
    if ($status === 'desconsiderado' || $status === 'rejeitado' || strpos($status, 'expirado') !== false) return '5';
    
    return '0'; // Pendente como default
}

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
    $conn = $DB->Conn();
    foreach ($read_pedido as $read_pedido_view) {
        // Verificar se já existe na tabela delivery pelo código
        $check_exists = mysqli_query($conn, "SELECT delivery_id, delivery_status FROM delivery WHERE delivery_code = '" . mysqli_real_escape_string($conn, $read_pedido_view['pedido_code']) . "' LIMIT 1");
        $existing = mysqli_fetch_assoc($check_exists);
        
        if ($existing) {
            // Já existe, apenas marcar como processado - NÃO ALTERAR STATUS
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

        // Converter status do ze_pedido para código numérico
        $initialStatus = statusTextToCode($read_pedido_view['pedido_status'] ?? 'Pendente');

        // delivery_id é auto-incremento, não definir!
        $dev_form['delivery_data_hora_captura'] = $read_pedido_view['pedido_data_hora_captura'];
        $dev_form['delivery_ide_hub_delivery']     = $read_pedido_view['pedido_ide'];
        $dev_form['delivery_ide']                 = hash('md5', date('YmdHis') . rand(1000, 9999));
        $dev_form['delivery_code']                 = $read_pedido_view['pedido_code'];
        $dev_form['delivery_name_cliente']         = str_replace('ė', 'e', $read_pedido_view['pedido_nome']);
        $dev_form['delivery_date_time']         = $explode_data['2'] . '-' . $explode_data['1'] . '-' . $explode_data['0'] . ' ' . $read_pedido_view['pedido_hora'];
        $dev_form['delivery_status']             = $initialStatus; // Usar status do ze_pedido, não hardcoded '0'
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
        
        // Usar INSERT ... ON DUPLICATE KEY UPDATE com proteção de status
        $sql = "INSERT INTO delivery (
            delivery_data_hora_captura, delivery_ide_hub_delivery, delivery_ide,
            delivery_code, delivery_name_cliente, delivery_date_time, delivery_status,
            delivery_subtotal, delivery_forma_pagamento, delivery_desconto, delivery_frete,
            delivery_total, delivery_trash, delivery_id_company,
            delivery_cpf_cliente, delivery_endereco_rota, delivery_endereco_complemento,
            delivery_endereco_cidade_uf, delivery_endereco_cep, delivery_endereco_bairro
        ) VALUES (
            '" . mysqli_real_escape_string($conn, $dev_form['delivery_data_hora_captura']) . "',
            '" . mysqli_real_escape_string($conn, $dev_form['delivery_ide_hub_delivery']) . "',
            '" . $dev_form['delivery_ide'] . "',
            '" . mysqli_real_escape_string($conn, $dev_form['delivery_code']) . "',
            '" . mysqli_real_escape_string($conn, $dev_form['delivery_name_cliente']) . "',
            '" . $dev_form['delivery_date_time'] . "',
            '" . $dev_form['delivery_status'] . "',
            '" . $dev_form['delivery_subtotal'] . "',
            '" . mysqli_real_escape_string($conn, $dev_form['delivery_forma_pagamento']) . "',
            '" . $dev_form['delivery_desconto'] . "',
            '" . $dev_form['delivery_frete'] . "',
            '" . $dev_form['delivery_total'] . "',
            '0',
            '" . $dev_form['delivery_id_company'] . "',
            '" . mysqli_real_escape_string($conn, $dev_form['delivery_cpf_cliente'] ?? '') . "',
            '" . mysqli_real_escape_string($conn, $dev_form['delivery_endereco_rota'] ?? '') . "',
            '" . mysqli_real_escape_string($conn, $dev_form['delivery_endereco_complemento'] ?? '') . "',
            '" . mysqli_real_escape_string($conn, $dev_form['delivery_endereco_cidade_uf'] ?? '') . "',
            '" . mysqli_real_escape_string($conn, $dev_form['delivery_endereco_cep'] ?? '') . "',
            '" . mysqli_real_escape_string($conn, $dev_form['delivery_endereco_bairro'] ?? '') . "'
        ) ON DUPLICATE KEY UPDATE 
            delivery_status = CASE 
                WHEN delivery_status IN ('1', '4', '5') THEN delivery_status
                WHEN '" . $dev_form['delivery_status'] . "' > delivery_status THEN '" . $dev_form['delivery_status'] . "'
                ELSE delivery_status
            END";
        
        if (mysqli_query($conn, $sql)) {
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
    $orderNumber = str_replace(' ', '', urldecode($orderData['orderNumber'] ?? ''));
    $orderDateTime = explode(' - ', urldecode($orderData['orderDateTime'] ?? ''));
    $customerName = urldecode($orderData['customerName'] ?? '');
    $status = urldecode($orderData['status'] ?? '');
    $deliveryType = urldecode($orderData['deliveryType'] ?? '');
    $paymentType = urldecode($orderData['paymentType'] ?? '');
    $totalPrice = str_replace('R$ ', '', urldecode($orderData['priceFormatted'] ?? ''));

    // Converter status texto para código numérico
    $newStatusCode = statusTextToCode($status);
    
    // Verificar se o pedido já existe na tabela delivery
    $conn = $DB->Conn();
    $checkDelivery = mysqli_query($conn, "SELECT delivery_id, delivery_status FROM delivery WHERE delivery_code = '" . mysqli_real_escape_string($conn, $orderNumber) . "' LIMIT 1");
    $existingDelivery = mysqli_fetch_assoc($checkDelivery);
    
    if ($existingDelivery) {
        // PEDIDO JÁ EXISTE - Verificar se pode atualizar o status
        $currentStatus = strval($existingDelivery['delivery_status']);
        $canUpdate = canUpdateStatus($currentStatus, $newStatusCode);
        
        if (!$canUpdate['allowed']) {
            // NÃO PODE ATUALIZAR - Status iria regredir ou já é final
            $json = [
                "id_pedido" => $orderNumber,
                "skipped" => true,
                "reason" => $canUpdate['reason'],
                "current_status" => $currentStatus,
                "attempted_status" => $newStatusCode
            ];
            echo json_encode($json);
        } else {
            // PODE ATUALIZAR - Status está avançando
            mysqli_query($conn, "UPDATE delivery SET delivery_status = '" . $newStatusCode . "' WHERE delivery_code = '" . mysqli_real_escape_string($conn, $orderNumber) . "'");
            mysqli_query($conn, "UPDATE ze_pedido SET pedido_status = '" . mysqli_real_escape_string($conn, trim($status)) . "' WHERE pedido_code = '" . mysqli_real_escape_string($conn, $orderNumber) . "'");
            
            $json = [
                "id_pedido" => $orderNumber,
                "updated" => true,
                "from_status" => $currentStatus,
                "to_status" => $newStatusCode
            ];
            echo json_encode($json);
        }
    } else {
        // PEDIDO NÃO EXISTE - Verificar se existe em ze_pedido e criar em delivery
        $read_pedido = $DB->ReadComposta("SELECT * FROM ze_pedido WHERE pedido_code = '" . trim($orderNumber) . "' ORDER BY pedido_id DESC LIMIT 1");
        
        if ($DB->NumQuery($read_pedido) > 0) {
            // Existe em ze_pedido mas não em delivery - Criar entrada
            foreach ($read_pedido as $read_pedido_view) {
                $explode_data = explode('/', $read_pedido_view['pedido_data']);
                $valorNumerico = preg_replace('/[^0-9]/', '', $read_pedido_view['pedido_valor']);
                $valorFormatado = substr($valorNumerico, 0, -2) . "." . substr($valorNumerico, -2);
                $valorFloat = (float) $valorFormatado;
                
                // INSERT com proteção contra duplicatas (UNIQUE constraint)
                $sql = "INSERT INTO delivery (
                    delivery_data_hora_captura, delivery_ide_hub_delivery, delivery_ide,
                    delivery_code, delivery_name_cliente, delivery_date_time, delivery_status,
                    delivery_subtotal, delivery_forma_pagamento, delivery_desconto, delivery_frete,
                    delivery_total, delivery_trash, delivery_id_company,
                    delivery_cpf_cliente, delivery_endereco_rota, delivery_endereco_complemento,
                    delivery_endereco_cidade_uf, delivery_endereco_cep, delivery_endereco_bairro
                ) VALUES (
                    '" . $read_pedido_view['pedido_data_hora_captura'] . "',
                    '" . $read_pedido_view['pedido_ide'] . "',
                    '" . md5(date('YmdHis') . rand(1000, 9999)) . "',
                    '" . mysqli_real_escape_string($conn, $read_pedido_view['pedido_code']) . "',
                    '" . mysqli_real_escape_string($conn, str_replace('ė', 'e', $read_pedido_view['pedido_nome'])) . "',
                    '" . $explode_data[2] . '-' . $explode_data[1] . '-' . $explode_data[0] . ' ' . $read_pedido_view['pedido_hora'] . "',
                    '" . $newStatusCode . "',
                    '" . $valorFloat . "',
                    '" . mysqli_real_escape_string($conn, $read_pedido_view['pedido_pagamento']) . "',
                    '" . $read_pedido_view['pedido_desconto'] . "',
                    '" . $read_pedido_view['pedido_frete'] . "',
                    '" . ($valorFloat - $read_pedido_view['pedido_desconto']) . "',
                    '0',
                    '" . $read_pedido_view['hub_delivery_id_company'] . "',
                    '" . mysqli_real_escape_string($conn, $read_pedido_view['pedido_cpf_cliente'] ?? '') . "',
                    '" . mysqli_real_escape_string($conn, $read_pedido_view['pedido_endereco_rota'] ?? '') . "',
                    '" . mysqli_real_escape_string($conn, $read_pedido_view['pedido_endereco_complemento'] ?? '') . "',
                    '" . mysqli_real_escape_string($conn, $read_pedido_view['pedido_endereco_cidade_uf'] ?? '') . "',
                    '" . mysqli_real_escape_string($conn, $read_pedido_view['pedido_endereco_cep'] ?? '') . "',
                    '" . mysqli_real_escape_string($conn, $read_pedido_view['pedido_endereco_bairro'] ?? '') . "'
                ) ON DUPLICATE KEY UPDATE 
                    delivery_status = CASE 
                        WHEN delivery_status IN ('1', '4', '5') THEN delivery_status
                        WHEN '" . $newStatusCode . "' > delivery_status THEN '" . $newStatusCode . "'
                        ELSE delivery_status
                    END";
                
                mysqli_query($conn, $sql);
                
                // Atualizar ze_pedido
                mysqli_query($conn, "UPDATE ze_pedido SET pedido_status = '" . mysqli_real_escape_string($conn, trim($status)) . "', pedido_st = '1' WHERE pedido_code = '" . mysqli_real_escape_string($conn, $orderNumber) . "'");
                
                $json = ["id_pedido" => $orderNumber, "created" => true, "status" => $newStatusCode];
                echo json_encode($json);
                break;
            }
        } else {
            // Não existe em lugar nenhum - Criar em ze_pedido primeiro
            $pedido_form = [
                'pedido_ide' => trim($orderNumberIde),
                'pedido_st' => '0',
                'pedido_code' => trim($orderNumber),
                'pedido_nome' => trim($customerName),
                'pedido_data' => trim($orderDateTime[0] ?? ''),
                'pedido_hora' => trim($orderDateTime[1] ?? ''),
                'pedido_status' => trim($status),
                'pedido_email_entregador' => '',
                'pedido_valor' => trim($totalPrice),
                'pedido_pagamento' => trim($paymentType),
                'pedido_tipo' => trim($deliveryType),
                'pedido_cupom' => '',
                'pedido_desconto' => '0',
                'pedido_frete' => '0',
                'pedido_st_delivery' => '0',
                'pedido_st_validacao' => '0',
                'pedido_data_hora_captura' => date('Y-m-d H:i:s')
            ];
            
            $DB->Create('ze_pedido', $pedido_form);
            $json = ["id_pedido" => $orderNumber, "new_order" => true];
            echo json_encode($json);
        }
    }
    
    // Processar status "colocado" para delivery_data
    if (stripos($status, 'colocado') !== false) {
        $check_data = $DB->ReadComposta("SELECT * FROM delivery_data WHERE delivery_data_code = '" . trim($orderNumber) . "' LIMIT 1");
        if ($DB->NumQuery($check_data) == 0) {
            $pedido_form_dev = [
                'delivery_data_code' => trim($orderNumber),
                'delivery_data_hora_pedido' => date('Y-m-d H:i:s')
            ];
            $DB->Create('delivery_data', $pedido_form_dev);
        }
    }
}

