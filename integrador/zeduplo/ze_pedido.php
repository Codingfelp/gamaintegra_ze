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
                // VERIFICAR SE ATUALIZAÇÃO É VÁLIDA (progressão de status)
                // Ordem natural: Pendente (0) → Aceito (2) → A Caminho (3) → Entregue (1)
                // "Entregue" só pode vir de "A Caminho" (3) ou de status menor
                $check_status = $DB->ReadComposta("SELECT delivery_status FROM delivery WHERE delivery_code = '" . trim($read_pedido_view['pedido_code']) . "' LIMIT 1");
                $can_update = true;
                
                if ($DB->NumQuery($check_status) > 0) {
                    foreach ($check_status as $status_row) {
                        $current_status = intval($status_row['delivery_status']);
                        // Se está em "Aceito" (2), NÃO pode pular direto para "Entregue" (1)
                        // Deve primeiro ir para "A Caminho" (3)
                        if ($current_status == 2) {
                            $can_update = false;
                            $json = ["id_pedido" => trim(str_replace(' ', '', $orderNumber)), "skipped" => true, "reason" => "must_be_acaminho_first"];
                            echo json_encode($json);
                            continue 2;
                        }
                        // Se já está "Entregue" (1), "Cancelado" (4,5), não precisa atualizar
                        if ($current_status == 1 || $current_status == 4 || $current_status == 5) {
                            $can_update = false;
                            $json = ["id_pedido" => trim(str_replace(' ', '', $orderNumber)), "skipped" => true, "reason" => "already_final"];
                            echo json_encode($json);
                            continue 2;
                        }
                        break;
                    }
                }
                
                if (!$can_update) continue;
                
                // Atualizar status na tabela delivery
                $UpdateStatusPedido['delivery_status'] = '1';
                $updateResult = $DB->Update('delivery', $UpdateStatusPedido, "WHERE delivery_code = '" . trim($read_pedido_view['pedido_code']) . "' AND delivery_ide_hub_delivery = '" . $read_pedido_view['pedido_ide'] . "' LIMIT 1");
                
                // IMPORTANTE: Também atualizar status na tabela ze_pedido
                $UpdateZePedido['pedido_status'] = 'Entregue';
                $DB->Update('ze_pedido', $UpdateZePedido, "WHERE pedido_code = '" . trim($read_pedido_view['pedido_code']) . "' LIMIT 1");
                
                // Log para debug
                error_log("[ZE_PEDIDO] UPDATE Entregue: pedido=" . $read_pedido_view['pedido_code'] . " result=" . ($updateResult ? 'true' : 'false'));
                $json = [
                    "id_pedido" => trim(str_replace(' ', '', $orderNumber)),
                    "status_updated" => $updateResult ? true : false
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
                // PROTEÇÃO COMPLETA: Não reverter status se já avançou na progressão
                // Ordem: Pendente (0) → Aceito (2) → A Caminho (3) → Entregue (1) / Cancelado (4,5)
                $check_status = $DB->ReadComposta("SELECT delivery_status FROM delivery WHERE delivery_code = '" . trim($read_pedido_view['pedido_code']) . "' LIMIT 1");
                if ($DB->NumQuery($check_status) > 0) {
                    foreach ($check_status as $status_row) {
                        $current_status = intval($status_row['delivery_status']);
                        // Status 1 (Entregue), 3 (A Caminho), 4, 5 (Cancelado) NÃO podem regredir para Aceito (2)
                        if (in_array($current_status, [1, 3, 4, 5])) {
                            $json = ["id_pedido" => trim(str_replace(' ', '', $orderNumber)), "skipped" => true, "reason" => "status_protection", "current" => $current_status];
                            echo json_encode($json);
                            continue 2;
                        }
                        // Se já está Aceito (2), não precisa atualizar novamente
                        if ($current_status == 2) {
                            $json = ["id_pedido" => trim(str_replace(' ', '', $orderNumber)), "skipped" => true, "reason" => "already_aceito"];
                            echo json_encode($json);
                            continue 2;
                        }
                        break;
                    }
                }
                
                $UpdateStatusPedido['delivery_status'] = '2';
                $DB->Update('delivery', $UpdateStatusPedido, "WHERE delivery_code = '" . trim($read_pedido_view['pedido_code']) . "' AND delivery_ide_hub_delivery = '" . $read_pedido_view['pedido_ide'] . "' LIMIT 1");
                
                // Atualizar ze_pedido
                $UpdateZePedido['pedido_status'] = 'Aceito';
                $DB->Update('ze_pedido', $UpdateZePedido, "WHERE pedido_code = '" . trim($read_pedido_view['pedido_code']) . "' LIMIT 1");

                $UpdateDataPedido['delivery_data_hora_aceite'] = date('Y-m-d H:i:s', strtotime('-10 seconds'));
                $DB->Update('delivery_data', $UpdateDataPedido, "WHERE delivery_data_code = '" . trim($read_pedido_view['pedido_code']) . "' AND delivery_data_hora_aceite IS NULL LIMIT 1");
                $json = [
                    "id_pedido" => trim(str_replace(' ', '', $orderNumber)),
                    "updated_to" => "Aceito"
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
                // PROTEÇÃO: Não atualizar se já está Entregue (1) ou Cancelado (4, 5)
                // "A Caminho" (3) é o penúltimo status antes de Entregue
                $check_status = $DB->ReadComposta("SELECT delivery_status FROM delivery WHERE delivery_code = '" . trim($read_pedido_view['pedido_code']) . "' LIMIT 1");
                if ($DB->NumQuery($check_status) > 0) {
                    foreach ($check_status as $status_row) {
                        $current_status = intval($status_row['delivery_status']);
                        // Status 1 (Entregue), 4, 5 (Cancelado) são finais - não podem regredir
                        if (in_array($current_status, [1, 4, 5])) {
                            $json = ["id_pedido" => trim(str_replace(' ', '', $orderNumber)), "skipped" => true, "reason" => "already_final", "current" => $current_status];
                            echo json_encode($json);
                            continue 2;
                        }
                        // Se já está "A Caminho" (3), não precisa atualizar novamente
                        if ($current_status == 3) {
                            $json = ["id_pedido" => trim(str_replace(' ', '', $orderNumber)), "skipped" => true, "reason" => "already_acaminho"];
                            echo json_encode($json);
                            continue 2;
                        }
                        break;
                    }
                }
                
                $UpdateStatusPedido['delivery_status'] = '3';
                $DB->Update('delivery', $UpdateStatusPedido, "WHERE delivery_code = '" . trim($read_pedido_view['pedido_code']) . "' AND delivery_ide_hub_delivery = '" . $read_pedido_view['pedido_ide'] . "' LIMIT 1");
                
                // Atualizar ze_pedido
                $UpdateZePedido['pedido_status'] = trim($status);
                $DB->Update('ze_pedido', $UpdateZePedido, "WHERE pedido_code = '" . trim($read_pedido_view['pedido_code']) . "' LIMIT 1");
                
                $json = [
                    "id_pedido" => trim(str_replace(' ', '', $orderNumber)),
                    "updated_to" => "A Caminho"
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
                $DB->Update('delivery', $UpdateStatusPedido, "WHERE delivery_code = '" . trim($read_pedido_view['pedido_code']) . "' AND delivery_ide_hub_delivery = '" . $read_pedido_view['pedido_ide'] . "' LIMIT 1");
                
                // Atualizar ze_pedido
                $UpdateZePedido['pedido_status'] = 'Cancelado';
                $DB->Update('ze_pedido', $UpdateZePedido, "WHERE pedido_code = '" . trim($read_pedido_view['pedido_code']) . "' LIMIT 1");
                
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
    } else {
        $json = [
            "id_pedido" => 'SEM PEDIDO'
        ];
        echo json_encode($json);
    }
}
