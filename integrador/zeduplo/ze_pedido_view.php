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

        // CORREÇÃO: O scraper envia:
        // - tags.preco = preço UNITÁRIO
        // - tags.precoTotal = preço TOTAL da linha (quantidade * unitário)
        // Não precisamos recalcular, apenas usar os valores corretos
        $produto_form['itens_pedido_qtd'] = trim($json[$x]['tags']['quantidade']);
        
        // Pegar preço unitário e total separadamente
        $precoUnitario = trim($json[$x]['tags']['preco'] ?? '0');
        $precoTotal = trim($json[$x]['tags']['precoTotal'] ?? '0');
        
        // Se precoTotal não foi enviado ou é 0, calcular a partir do unitário
        if (empty($precoTotal) || $precoTotal == '0' || $precoTotal == '') {
            $precoTotal = floatval($precoUnitario) * intval($produto_form['itens_pedido_qtd']);
        }
        
        // Armazenar valores corretamente
        $produto_form['itens_pedido_valor_total'] = $precoTotal;
        
        $read_pedido = $DB->ReadComposta("SELECT * FROM ze_pedido WHERE pedido_code = '" . trim($json[$x]['id']) . "' ORDER BY pedido_id DESC LIMIT 1");
        if ($DB->NumQuery($read_pedido) > '0') {
            // Processar valores financeiros - garantir que são numéricos
            $desconto = trim($json[$x]['desconto'] ?? '');
            if ($desconto == '' || $desconto == '-') {
                $desconto = 0;
            } else {
                $desconto = floatval(str_replace(',', '.', str_replace('R$ ', '', $desconto)));
            }
            
            $frete = trim($json[$x]['frete'] ?? '');
            if ($frete == '' || $frete == '-') {
                $frete = 0;
            } else {
                $frete = floatval(str_replace(',', '.', str_replace('R$ ', '', $frete)));
            }
            
            $cpfCliente = trim($json[$x]['cpfCliente'] ?? '');
            if ($cpfCliente == '' || $cpfCliente == '-') {
                $cpfCliente = '';
            }
            
            // Telefone do cliente
            $telefoneCliente = trim($json[$x]['telefoneCliente'] ?? '');
            if ($telefoneCliente == '' || $telefoneCliente == '-') {
                $telefoneCliente = '';
            }
            
            // Email do entregador
            $emailEntregador = trim($json[$x]['emailEntregador'] ?? '');
            if ($emailEntregador == '' || $emailEntregador == '-') {
                $emailEntregador = '';
            }
            
            // Nome do entregador
            $nomeEntregador = trim($json[$x]['entregador'] ?? '');
            if ($nomeEntregador == '' || $nomeEntregador == '-') {
                $nomeEntregador = '';
            }
            
            $enderecoRota = trim($json[$x]['enderecoRota'] ?? '');
            if ($enderecoRota == '' || $enderecoRota == '-') {
                $enderecoRota = '';
            }
            
            $enderecoComplemento = trim($json[$x]['enderecoComplemento'] ?? '');
            if ($enderecoComplemento == '' || $enderecoComplemento == '-') {
                $enderecoComplemento = '';
            }
            
            $enderecoCidadeUF = trim($json[$x]['enderecoCidadeUF'] ?? '');
            if ($enderecoCidadeUF == '' || $enderecoCidadeUF == '-') {
                $enderecoCidadeUF = '';
            }
            
            $enderecoCep = trim($json[$x]['enderecoCep'] ?? '');
            if ($enderecoCep == '' || $enderecoCep == '-') {
                $enderecoCep = '';
            }
            
            $enderecoBairro = trim($json[$x]['enderecoBairro'] ?? '');
            if ($enderecoBairro == '' || $enderecoBairro == '-') {
                $enderecoBairro = '';
            }
            
            // Troco - converter para número
            $troco = trim($json[$x]['troco'] ?? '');
            if ($troco == '' || $troco == '-') {
                $troco = 0;
            } else {
                $troco = floatval(str_replace(',', '.', str_replace('R$ ', '', $troco)));
            }
            
            $trocoCliente = trim($json[$x]['trocoCliente'] ?? '');
            if ($trocoCliente == '' || $trocoCliente == '-') {
                $trocoCliente = 0;
            } else {
                $trocoCliente = floatval(str_replace(',', '.', str_replace('R$ ', '', $trocoCliente)));
            }
            
            // Taxa de conveniência - converter para número
            $taxaConveniencia = trim($json[$x]['taxaConveniencia'] ?? '');
            if ($taxaConveniencia == '' || $taxaConveniencia == '-') {
                $taxaConveniencia = 0;
            } else {
                $taxaConveniencia = floatval(str_replace(',', '.', str_replace('R$ ', '', $taxaConveniencia)));
            }
            
            // Subtotal - converter para número
            $subTotal = trim($json[$x]['subTotal'] ?? '');
            if ($subTotal == '' || $subTotal == '-') {
                $subTotal = 0;
            } else {
                $subTotal = floatval(str_replace(',', '.', str_replace('R$ ', '', $subTotal)));
            }
            
            $codigoEntrega = trim($json[$x]['codigoEntrega'] ?? '');
            if ($codigoEntrega == '' || $codigoEntrega == '-') {
                $codigoEntrega = '';
            }
            
            $obsPedido = trim($json[$x]['obsPedido'] ?? '');
            if ($obsPedido == '' || $obsPedido == '-') {
                $obsPedido = '';
            }
            
            $statusPedido = trim($json[$x]['statusPedido'] ?? '');
            if ($statusPedido == '' || $statusPedido == '-') {
                $statusPedido = '';
            }
            $statusPedidoNovo = explode('-', $statusPedido);
            $statusPed = trim($statusPedidoNovo['0']);
            
            // Tipo de delivery (Comum, Turbo, Retirada)
            $tipoDelivery = trim($json[$x]['tipoDelivery'] ?? '');
            if ($tipoDelivery == '' || $tipoDelivery == '-') {
                $tipoDelivery = '';
            }
            
            // Descrição do cupom/desconto
            $cupomDescricao = trim($json[$x]['cupomDescricao'] ?? '');
            if ($cupomDescricao == '' || $cupomDescricao == '-') {
                $cupomDescricao = '';
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
            if ($cupomDescricao != '') {
                $up['pedido_desconto_descricao'] = $cupomDescricao;
            }

            $DB->Update('ze_pedido', $up, "WHERE pedido_code = '" . trim($json[$x]['id']) . "' AND pedido_st_validacao = '0' LIMIT 1");

            foreach ($read_pedido as $read_pedido_view) {
                // Inicializar array de atualização
                $upDev = [];
                
                // Só atualizar campos se o novo valor não for vazio
                // Isso preserva os dados que já foram capturados antes
                
                if ($cpfCliente != '') {
                    $upDev['delivery_cpf_cliente'] = $cpfCliente;
                }
                
                // Telefone do cliente
                if ($telefoneCliente != '') {
                    $upDev['delivery_telefone'] = $telefoneCliente;
                }
                
                // Email do entregador
                if ($emailEntregador != '') {
                    $upDev['delivery_email_entregador'] = $emailEntregador;
                }
                // Nome do entregador (concatena com email se existir)
                if ($nomeEntregador != '') {
                    if ($emailEntregador != '') {
                        $upDev['delivery_email_entregador'] = $nomeEntregador . ' | ' . $emailEntregador;
                    } else {
                        $upDev['delivery_email_entregador'] = $nomeEntregador;
                    }
                }
                
                // Preservar endereço se já existir no banco
                if ($enderecoRota != '') {
                    $upDev['delivery_endereco_rota'] = $enderecoRota;
                }
                if ($enderecoComplemento != '') {
                    $upDev['delivery_endereco_complemento'] = $enderecoComplemento;
                }
                if ($enderecoCidadeUF != '') {
                    $upDev['delivery_endereco_cidade_uf'] = $enderecoCidadeUF;
                }
                if ($enderecoCep != '') {
                    $upDev['delivery_endereco_cep'] = $enderecoCep;
                }
                if ($enderecoBairro != '') {
                    $upDev['delivery_endereco_bairro'] = $enderecoBairro;
                }
                
                // VALORES FINANCEIROS - SEMPRE ATUALIZAR (mesmo se zero, para registrar)
                // Usar valores numéricos já convertidos
                $upDev['delivery_desconto'] = $desconto;
                $upDev['delivery_frete'] = $frete;
                $upDev['delivery_troco_para'] = $troco;
                $upDev['delivery_troco'] = $trocoCliente;
                $upDev['delivery_taxa_conveniencia'] = $taxaConveniencia;
                $upDev['delivery_subtotal'] = $subTotal;
                
                // Descrição do cupom/desconto
                if ($cupomDescricao != '') {
                    $upDev['delivery_desconto_descricao'] = $cupomDescricao;
                }
                
                // Observações
                if ($obsPedido != '') {
                    $upDev['delivery_obs'] = $obsPedido;
                }
                
                // Tipo de pedido (priorizar tipoDelivery se disponível)
                if ($tipoDelivery != '') {
                    $upDev['delivery_tipo_pedido'] = $tipoDelivery;
                } elseif ($statusPed != '') {
                    $upDev['delivery_tipo_pedido'] = $statusPed;
                }
                
                // Código de entrega - só atualizar se não existir ou estiver vazio
                if ($read_pedido_view['delivery_codigo_entrega'] == '' || $read_pedido_view['delivery_codigo_entrega'] == '0' || $read_pedido_view['delivery_codigo_entrega'] == null) {
                    if ($codigoEntrega != '') {
                        $upDev['delivery_codigo_entrega'] = $codigoEntrega;
                    }
                }

                $cdPedidoNovo = trim($json[$x]['id']);
                $idPedidoNovo = $read_pedido_view['pedido_id'];

                // Atualizar delivery
                $DB->Update('delivery', $upDev, "WHERE delivery_code = '" . trim($json[$x]['id']) . "' LIMIT 1");

                // CORREÇÃO: Usar preço unitário e total corretamente
                // O scraper envia tags.preco = unitário, tags.precoTotal = total
                $produto_form['itens_pedido_id_pedido'] = $read_pedido_view['pedido_id'];
                $produto_form['itens_pedido_id_produto'] = $id_produto;
                $produto_form['itens_pedido_descricao_produto'] = trim($descricaoProduto);
                
                // Usar o preço unitário diretamente (não recalcular)
                $produto_form['itens_pedido_valor_unitario'] = floatval($precoUnitario);
                // Usar o preço total diretamente
                $produto_form['itens_pedido_valor_total'] = floatval($precoTotal);
                
                $produto_form['itens_pedido_st'] = '0';
                $DB->Create('ze_itens_pedido', $produto_form);
                unset($produto_form);
            }
        }
    }
    $uppedido['delivery_tem_itens'] = '1';
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
