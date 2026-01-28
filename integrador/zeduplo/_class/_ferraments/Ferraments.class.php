<?php

/**
 * Classe responsável pelas ferramentas do nosso framework
 *
 * @author Marques Junior
 */
class Ferraments extends Database {
    
    public function QtdEstoqueTotalProduto($IdProduto) {
        $DB = new Database();

        $read_getdados = $DB->ReadComposta("SELECT SUM(itens_entrada_quantidade) AS quantidade FROM itens_entrada INNER JOIN entrada ON entrada_id = itens_entrada_id_entrada WHERE itens_entrada_id_produto = '".$IdProduto."' AND itens_entrada_estoque = '1' AND ((itens_entrada_status_entrada IN(0,1)) OR (entrada_status IN(1,2))) LIMIT 1");
        if ($DB->NumQuery($read_getdados) > '0'):
            foreach ($read_getdados as $read_getdados_view):
                return $read_getdados_view['quantidade'];
            endforeach;
        endif;
    }
	
	
    public function QtdEstoqueTotalProdutoTotal($IdProduto) {
        $DB = new Database();

        $read_getdados = $DB->ReadComposta("SELECT SUM(itens_entrada_quantidade) AS quantidade FROM itens_entrada INNER JOIN entrada ON entrada_id = itens_entrada_id_entrada WHERE itens_entrada_id_produto = '".$IdProduto."' AND itens_entrada_estoque = '1' AND ((itens_entrada_status_entrada IN(1)) OR (entrada_status IN(2))) LIMIT 1");
        if ($DB->NumQuery($read_getdados) > '0'):
            foreach ($read_getdados as $read_getdados_view):
                return $read_getdados_view['quantidade'];
            endforeach;
        endif;
    }
	
    public function QtdEstoqueTotalProdutoTotalPrevisto($IdProduto) {
        $DB = new Database();

        $read_getdados = $DB->ReadComposta("SELECT SUM(itens_entrada_quantidade) AS quantidade FROM itens_entrada INNER JOIN entrada ON entrada_id = itens_entrada_id_entrada WHERE itens_entrada_id_produto = '".$IdProduto."' AND itens_entrada_estoque = '1' AND ((itens_entrada_status_entrada IN(0,1)) OR (entrada_status IN(1,2))) LIMIT 1");
        if ($DB->NumQuery($read_getdados) > '0'):
            foreach ($read_getdados as $read_getdados_view):
                return $read_getdados_view['quantidade'];
            endforeach;
        endif;
    }
	
    public function QtdEstoqueTotalProdutoEntrada($IdProduto, $IdEntrada) {
        $DB = new Database();

        $read_getdados = $DB->ReadComposta("SELECT SUM(itens_entrada_quantidade) AS quantidade FROM itens_entrada INNER JOIN entrada ON entrada_id = itens_entrada_id_entrada WHERE itens_entrada_id_produto = '".$IdProduto."' AND itens_entrada_id_entrada = '".$IdEntrada."' AND itens_entrada_estoque = '1' AND ((itens_entrada_status_entrada IN(0,1)) OR (entrada_status IN(1,2))) LIMIT 1");
        if ($DB->NumQuery($read_getdados) > '0'):
            foreach ($read_getdados as $read_getdados_view):
                return $read_getdados_view['quantidade'];
            endforeach;
        endif;
    }
	
    public function QtdEstoqueTotalProdutoCotacao($IdProduto, $IdEntrada) {
        $DB = new Database();

        $read_getdados = $DB->ReadComposta("SELECT SUM(itens_cotacao_quantidade) AS quantidade FROM itens_cotacao INNER JOIN cotacao ON cotacao_id = itens_cotacao_id_cotacao WHERE itens_cotacao_id_produto = '".$IdProduto."' AND itens_cotacao_id_entrada = '".$IdEntrada."' AND cotacao_status_novo = '0' AND itens_cotacao_tipo_estoque = '1' AND cotacao_status = '0' AND itens_cotacao_id_cotacao_status = '0' LIMIT 1");
        if ($DB->NumQuery($read_getdados) > '0'):
            foreach ($read_getdados as $read_getdados_view):
                return $read_getdados_view['quantidade'];
            endforeach;
        endif;
    }
	
    public function QtdEstoqueTotalProdutoVenda($IdProduto, $IdEntrada) {
        $DB = new Database();

        $read_getdados = $DB->ReadComposta("SELECT SUM(itens_cotacao_quantidade) AS quantidade FROM itens_cotacao INNER JOIN cotacao ON cotacao_id = itens_cotacao_id_cotacao WHERE itens_cotacao_id_produto = '".$IdProduto."' AND itens_cotacao_id_entrada = '".$IdEntrada."' AND cotacao_status_novo = '0' AND itens_cotacao_tipo_estoque = '1' AND cotacao_status = '1' AND itens_cotacao_id_cotacao_status = '0' LIMIT 1");
        if ($DB->NumQuery($read_getdados) > '0'):
            foreach ($read_getdados as $read_getdados_view):
                return $read_getdados_view['quantidade'];
            endforeach;
        endif;
    }
    
    public function MedioEstoqueTotalProduto($IdProduto) {
        $DB = new Database();

        $read_getdados = $DB->ReadComposta("SELECT COUNT(*) AS quantidade, SUM(itens_entrada_valor_unitario) AS valor_unitario FROM itens_entrada INNER JOIN entrada ON entrada_id = itens_entrada_id_entrada WHERE itens_entrada_id_produto = '".$IdProduto."' AND itens_entrada_estoque = '1' AND ((itens_entrada_status_entrada IN(0,1)) OR (entrada_status IN(1,2))) LIMIT 1");
        if ($DB->NumQuery($read_getdados) > '0'):
            foreach ($read_getdados as $read_getdados_view):
                return round($read_getdados_view['valor_unitario'] / $read_getdados_view['quantidade'],2);
            endforeach;
        endif;
    }

    public function GetDados($Table, $Indice, $IndicePrimario, $Value) {
        $DB = new Database();

        $read_getdados = $DB->ReadComposta("SELECT {$Indice} FROM {$Table} WHERE {$IndicePrimario} = '" . $Value . "' LIMIT 1");
        if ($DB->NumQuery($read_getdados) > '0'):
            foreach ($read_getdados as $read_getdados_view):
                return $read_getdados_view[$Indice];
            endforeach;
        endif;
    }
    
    public function setCalcValueVenda($priceCusto, $freteDist, $freteClient){
        $margem = $this->GetParametro('parametro_margem_vendedor_padrao');
        
        $custo_unitario = $priceCusto + ($freteDist / 1) + ('0') + (0 / 1);
        $comissao_vendedor = (($this->GetParametro('parametro_comissao_vendedor') / 100) * $custo_unitario);
        $custo_unitario += $comissao_vendedor;
        $comissao_gerente = (($this->GetParametro('parametro_comissao_gerente') / 100) * $custo_unitario);
        $custo_unitario += $comissao_gerente;
        $premiacao = (($this->GetParametro('parametro_premiacao') / 100) * $custo_unitario);
        $custo_unitario += $premiacao;
        $marketing = (($this->GetParametro('parametro_marketing') / 100) * $custo_unitario);
        $custo_unitario += $marketing;
        $imposto = (($this->GetParametro('parametro_imposto') / 100) * $custo_unitario);
        $custo_unitario += $imposto;
        
        $valor_unitario = (($margem / 100) * $custo_unitario) + $custo_unitario;
        
        return $valor_unitario;
    }

    public function DiffDatas($DataInicial, $DataFinal) {
        $Diferenca = strtotime($DataFinal) - strtotime($DataInicial);
        $Dias = floor($Diferenca / (60 * 60 * 24));
        return $Dias;
    }

    public function sendMail($assunto, $mensagem, $remetente, $nomeRemetente, $destino, $nomeDestino, $reply = NULL, $replyNome = NULL, $anexo = NULL, $nomeAnexo = NULL, $anexo2 = NULL, $nomeAnexo2 = NULL) {

        require_once('mail/class.phpmailer.php'); //Include pasta/classe do PHPMailer

        $mail = new PHPMailer(); //INICIA A CLASSE
        $mail->IsSMTP(); //Habilita envio SMPT
        $mail->SMTPAuth = true; //Ativa email autenticado
        $mail->SMTPSecure = 'ssl'; // SSL REQUERIDO pelo GMail
        $mail->IsHTML(true);

        $mail->Host = $this->GetParametro('smtp_servidor'); //Servidor de envio
        $mail->Port = $this->GetParametro('smtp_porta'); //Porta de envio
        $mail->Username = $this->GetParametro('smtp_user'); //email para smtp autenticado
        $mail->Password = $this->GetParametro('smtp_senha'); //seleciona a porta de envio

        $mail->From = utf8_decode($remetente); //remtente
        $mail->FromName = utf8_decode($nomeRemetente); //remtetene nome

        if ($reply != NULL) {
            $mail->AddReplyTo(utf8_decode($reply), utf8_decode($replyNome));
        }
        if ($anexo != NULL) {
            $mail->AddAttachment($anexo, $nomeAnexo);
        }
        if ($anexo2 != NULL) {
            $mail->AddAttachment($anexo2, $nomeAnexo2);
        }

        $mail->Subject = utf8_decode($assunto); //assunto
        $mail->Body = utf8_decode($mensagem); //mensagem
        $mail->AddAddress(utf8_decode($destino), utf8_decode($nomeDestino)); //email e nome do destino

        if ($mail->Send()) {
            return true;
        } else {
            return false;
        }
    }
    
    public function sendMailCotacao($Host, $Porta, $Username, $Password, $assunto, $mensagem, $remetente, $nomeRemetente, $destino, $nomeDestino, $reply = NULL, $replyNome = NULL, array $anexo, array $nomeAnexo, $destino_copia = NULL, $nomeDestino_copia = NULL) {

        require_once('mail/class.phpmailer.php'); //Include pasta/classe do PHPMailer

        $mail = new PHPMailer(); //INICIA A CLASSE
        $mail->IsSMTP(); //Habilita envio SMPT
        $mail->SMTPAuth = true; //Ativa email autenticado
        $mail->SMTPSecure = 'ssl'; // SSL REQUERIDO pelo GMail
        $mail->IsHTML(true);

        $mail->Host = $Host; //Servidor de envio
        $mail->Port = $Porta; //Porta de envio
        $mail->Username = $Username; //email para smtp autenticado
        $mail->Password = $Password; //seleciona a porta de envio

        $mail->From = utf8_decode($remetente); //remtente
        $mail->FromName = utf8_decode($nomeRemetente); //remtetene nome

        if ($reply != NULL) {
            $mail->AddReplyTo(utf8_decode($reply), utf8_decode($replyNome));
        }
        if (count($anexo) > '0') {
            for($x=0;$x<count($anexo);$x++){
                if($anexo[$x] != ''){
                    $mail->AddAttachment($anexo[$x], $nomeAnexo[$x]);
                }
            }
        }
        
        

        $mail->Subject = utf8_decode($assunto); //assunto
        $mail->Body = utf8_decode($mensagem); //mensagem
        $mail->AddAddress(utf8_decode($destino), utf8_decode($nomeDestino)); //email e nome do destino
        if ($destino_copia != NULL) {
            $mail->AddCC(utf8_decode($destino_copia), utf8_decode($nomeDestino_copia)); // email e nome copia
        }

        if ($mail->Send()) {
            return true;
        } else {
            return false;
        }
    }
    
    public function sendMailCotacaoSemAnexo($Host, $Porta, $Username, $Password, $assunto, $mensagem, $remetente, $nomeRemetente, $destino, $nomeDestino, $reply = NULL, $replyNome = NULL, $destino_copia = NULL, $nomeDestino_copia = NULL) {

        require_once('mail/class.phpmailer.php'); //Include pasta/classe do PHPMailer

        $mail = new PHPMailer(); //INICIA A CLASSE
        $mail->IsSMTP(); //Habilita envio SMPT
        $mail->SMTPAuth = true; //Ativa email autenticado
        $mail->SMTPSecure = 'ssl'; // SSL REQUERIDO pelo GMail
        $mail->IsHTML(true);

        $mail->Host = $Host; //Servidor de envio
        $mail->Port = $Porta; //Porta de envio
        $mail->Username = $Username; //email para smtp autenticado
        $mail->Password = $Password; //seleciona a porta de envio

        $mail->From = utf8_decode($remetente); //remtente
        $mail->FromName = utf8_decode($nomeRemetente); //remtetene nome

        if ($reply != NULL) {
            $mail->AddReplyTo(utf8_decode($reply), utf8_decode($replyNome));
        }
        

        $mail->Subject = utf8_decode($assunto); //assunto
        $mail->Body = utf8_decode($mensagem); //mensagem
        $mail->AddAddress(utf8_decode($destino), utf8_decode($nomeDestino)); //email e nome do destino
        if ($destino_copia != NULL) {
            $mail->AddCC(utf8_decode($destino_copia), utf8_decode($nomeDestino_copia)); // email e nome copia
        }

        if ($mail->Send()) {
            return true;
        } else {
            return false;
        }
    }
    
    public function sendMailCotacaoMaisArquivos($Host, $Porta, $Username, $Password, $assunto, $mensagem, $remetente, $nomeRemetente, $destino, $nomeDestino, $reply = NULL, $replyNome = NULL, array $anexo, array $nameAnexo, $destino_copia = NULL, $nomeDestino_copia = NULL) {

        require_once('mail/class.phpmailer.php'); //Include pasta/classe do PHPMailer

        $mail = new PHPMailer(); //INICIA A CLASSE
        $mail->IsSMTP(); //Habilita envio SMPT
        $mail->SMTPAuth = true; //Ativa email autenticado
        $mail->SMTPSecure = 'ssl'; // SSL REQUERIDO pelo GMail
        $mail->IsHTML(true);

        $mail->Host = $Host; //Servidor de envio
        $mail->Port = $Porta; //Porta de envio
        $mail->Username = $Username; //email para smtp autenticado
        $mail->Password = $Password; //seleciona a porta de envio

        $mail->From = utf8_decode($remetente); //remtente
        $mail->FromName = utf8_decode($nomeRemetente); //remtetene nome

        if ($reply != NULL) {
            $mail->AddReplyTo(utf8_decode($reply), utf8_decode($replyNome));
        }
        if (count($anexo) > '0') {
            for($x=0;$x<count($anexo);$x++){
                $mail->AddAttachment($anexo[$x], $nameAnexo[$x]);
            }
        }
        
        

        $mail->Subject = utf8_decode($assunto); //assunto
        $mail->Body = utf8_decode($mensagem); //mensagem
        $mail->AddAddress(utf8_decode($destino), utf8_decode($nomeDestino)); //email e nome do destino
        if ($destino_copia != NULL) {
            $mail->AddCC(utf8_decode($destino_copia), utf8_decode($nomeDestino_copia)); // email e nome copia
        }

        if ($mail->Send()) {
            return true;
        } else {
            return false;
        }
    }
    
    public function sendMailCopy($assunto, $mensagem, $remetente, $nomeRemetente, $destino, $nomeDestino, $reply = NULL, $replyNome = NULL, $destino_copia = NULL, $nomeDestino_copia = NULL) {

        require_once('mail/class.phpmailer.php'); //Include pasta/classe do PHPMailer

        $mail = new PHPMailer(); //INICIA A CLASSE
        $mail->IsSMTP(); //Habilita envio SMPT
        $mail->SMTPAuth = true; //Ativa email autenticado
        $mail->SMTPSecure = 'ssl'; // SSL REQUERIDO pelo GMail
        $mail->IsHTML(true);

        $mail->Host = 'smtplw.com.br'; //Servidor de envio
        $mail->Port = '465'; //Porta de envio
        $mail->Username = ''; //email para smtp autenticado
        $mail->Password = 'FeD468579!?'; //seleciona a porta de envio

        $mail->From = utf8_decode($remetente); //remtente
        $mail->FromName = utf8_decode($nomeRemetente); //remtetene nome

        if ($reply != NULL) {
            $mail->AddReplyTo(utf8_decode($reply), utf8_decode($replyNome));
        }

        $mail->Subject = utf8_decode($assunto); //assunto
        $mail->Body = utf8_decode($mensagem); //mensagem
        $mail->AddAddress(utf8_decode($destino), utf8_decode($nomeDestino)); //email e nome do destino
        if ($destino_copia != NULL) {
            $mail->AddCC(utf8_decode($destino_copia), utf8_decode($nomeDestino_copia)); // email e nome copia
        }
        if ($mail->Send()) {
            return true;
        } else {
            return false;
        }
    }

    //FAZ A PAGINAÇÃO DE RESULTADOS
    public function Paginator($Tabela, $Condicao, $Maximo, $Link, $Pag, $Width = NULL, $MaxLinks = 2) {
        $DB = new Database();

        $ReadPaginator = $DB->Read($Tabela, "{$Condicao}");
        $Total = $DB->NumQuery($ReadPaginator);

        if ($Total > $Maximo):
            $Paginas = ceil($Total / $Maximo);
            echo '<ul class="pagination">';
            echo '<li class="paginate_button page-item"><a href="' . $Link . '1" class="page-link">Primeira Pagina</a></li>';
            for ($i = $Pag - $MaxLinks; $i <= $Pag - 1; $i++):
                if ($i >= 1):
                    echo '<li class="paginate_button page-item"><a href="' . $Link . $i . '" class="page-link">' . $i . '</a></li>';
                endif;
            endfor;
            echo '<li class="paginate_button page-item active"><a href="#" class="page-link">' . $Pag . '</a></li>';
            for ($i = $Pag + 1; $i <= $Pag + $MaxLinks; $i++):
                if ($i <= $Paginas):
                    echo '<li class="paginate_button page-item"><a href="' . $Link . $i . '" class="page-link">' . $i . '</a></li>';
                endif;
            endfor;
            echo '<li class="paginate_button page-item"><a href="' . $Link . $Paginas . '" class="page-link">Ultima Pagina</a></li>';
            echo '</ul>';
        endif;
    }
    
    public function uploadFile($arquivo, $pasta, $tipos, $nome = null){
        if(isset($arquivo)){
            $infos = explode(".", $arquivo["name"]);

            if(!$nome){
                for($i = 0; $i < count($infos) - 1; $i++){
                    $nomeOriginal = $nomeOriginal . $infos[$i] . ".";
                }
            }
            else{
                $nomeOriginal = $nome . ".";
            }

            $tipoArquivo = $infos[count($infos) - 1];

            $tipoPermitido = false;
            foreach($tipos as $tipo){
                if(strtolower($tipoArquivo) == strtolower($tipo)){
                    $tipoPermitido = true;
                }
            }
            if(!$tipoPermitido){
                $retorno["erro"] = "Tipo não permitido";
            }else{
                $nome_arquivo = md5($nomeOriginal.rand(100,999));
                if(move_uploaded_file($arquivo['tmp_name'], $pasta . $nome_arquivo . '.' .$tipoArquivo)){
                    $retorno["caminho"] = $pasta . $nome_arquivo. '.' . $tipoArquivo;
                    $retorno["arquivo"] = $nome_arquivo;
                    $retorno["arquivoext"] = $nome_arquivo. '.' . $tipoArquivo;
                }else{
                    $retorno["erro"] = "Erro ao fazer upload - ".$arquivo["name"]["error"];
                }
            }
        }
        else{
            $retorno["erro"] = "Arquivo nao setado";
        }
        return $retorno;
    }

    public function GeraNossoNumero($nosso_numero) {
        $return = $this->formata_numero('1', 1, 0) . $this->formata_numero('4', 1, 0) . $this->formata_numero('000', 3, 0) . $this->formata_numero('000', 3, 0) . $this->formata_numero($nosso_numero, 9, 0);
        return $return;
    }

    private function digitoVerificador_nossonumero($numero) {
        $resto2 = $this->modulo_11($numero, 9, 1);
        $digito = 11 - $resto2;
        if ($digito == 10 || $digito == 11) {
            $dv = 0;
        } else {
            $dv = $digito;
        }
        return $dv;
    }

    private function modulo_11($num, $base = 9, $r = 0) {
        $soma = 0;
        $fator = 2;

        /* Separacao dos numeros */
        for ($i = strlen($num); $i > 0; $i--) {
            // pega cada numero isoladamente
            $numeros[$i] = substr($num, $i - 1, 1);
            // Efetua multiplicacao do numero pelo falor
            $parcial[$i] = $numeros[$i] * $fator;
            // Soma dos digitos
            $soma += $parcial[$i];
            if ($fator == $base) {
                // restaura fator de multiplicacao para 2 
                $fator = 1;
            }
            $fator++;
        }

        /* Calculo do modulo 11 */
        if ($r == 0) {
            $soma *= 10;
            $digito = $soma % 11;
            if ($digito == 10) {
                $digito = 0;
            }
            return $digito;
        } elseif ($r == 1) {
            $resto = $soma % 11;
            return $resto;
        }
    }

    public function GeraNossoNumeroCompleto($nosso_numero) {
        $var_nosso_numero = $this->formata_numero('1', 1, 0) . $this->formata_numero('4', 1, 0) . $this->formata_numero('000', 3, 0) . $this->formata_numero('000', 3, 0) . $this->formata_numero($nosso_numero, 9, 0);
        $return = $var_nosso_numero . $this->digitoVerificador_nossonumero($var_nosso_numero);
        return $return;
    }

    public function LmWord($Text, $Limit) {
        if (strlen($Text) <= $Limit):
            return $Text;
        else:
            return substr($Text, 0, $Limit) . '...';
        endif;
    }

    public function GetEmpresa($Indice, $IdEmpresa) {
        $DB = new Database();

        $read_empresa = $DB->ReadComposta("SELECT {$Indice} FROM empresa WHERE empresa_id = '".$IdEmpresa."' LIMIT 1");
        if ($DB->NumQuery($read_empresa) > '0'):
            foreach ($read_empresa as $read_empresa_view):
                return $read_empresa_view[$Indice];
            endforeach;
        else:
            return false;
        endif;
    }
    
    public function IBPTNCM($Ncm, $UF, $NI){
        
        $DB = new Database();
        
        $transform_uf = strtolower($UF);
        
        $tabela_ipbt = 'ibpt_'.$transform_uf;
        
        return false;
        /*
        $read_ibtp = $DB->Read($tabela_ipbt, "WHERE codigo = '".$Ncm."' LIMIT 1");
        if($DB->NumQuery($read_ibtp) > '0'):
            foreach($read_ibtp as $read_ibtp_view):
                if($NI == '1'):
                    $valor_tributos = $read_ibtp_view['importadosfederal'] + $read_ibtp_view['estadual'] + $read_ibtp_view['municipal'];
                else:
                    $valor_tributos = $read_ibtp_view['nacionalfederal'] + $read_ibtp_view['estadual'] + $read_ibtp_view['municipal'];
                endif;
            endforeach;
            return $valor_tributos;
        else:
            return false;
        endif;*/
    }

    public function IBPTNCMNOVO($Ncm){

        $DB = new Database();
        $read_ibtp = $DB->Read('ibpt', "WHERE codigo = '".$Ncm."' LIMIT 1");
        if($DB->NumQuery($read_ibtp) > '0'):
            foreach($read_ibtp as $read_ibtp_view):
                $valor_tributos = $read_ibtp_view['nacionalfederal'] + $read_ibtp_view['estadual'] + $read_ibtp_view['municipal'];
            endforeach;
            return $valor_tributos;
        else:
            return false;
        endif;
    }
    
    public function IPICalc($IDTributacao, $OvBC, $Quantidade = NULL){
        $DB = new Database();
        $OvIPI = '0';
        $read_tributacao_ipi = $DB->Read('tributacao_ipi', "WHERE tributacao_ipi_id_tributacao = '".$IDTributacao."' LIMIT 1");
        if($DB->NumQuery($read_tributacao_ipi) > '0'):
            foreach($read_tributacao_ipi as $read_tributacao_ipi_view):
                if($read_tributacao_ipi_view['OTipoCalc'] == '1'):
                    $OvIPI = $OvBC * ($read_tributacao_ipi_view['OpIPI'] / 100);
                else:
                    $OvIPI = $read_tributacao_ipi_view['OvUnid'] * $Quantidade;
                endif;
            endforeach;
            return number_format($OvIPI,2,".","");
        else:
            return number_format($OvIPI,2,".","");
        endif;
    }
    
    public function IPIBuscar($IDTributacao, $Indice){
        $DB = new Database();
        $read_tributacao_ipi = $DB->ReadComposta("SELECT $Indice FROM tributacao_ipi WHERE tributacao_ipi_id_tributacao = '".$IDTributacao."' LIMIT 1");
        if($DB->NumQuery($read_tributacao_ipi) > '0'):
            foreach($read_tributacao_ipi as $read_tributacao_ipi_view):
                return $read_tributacao_ipi_view[$Indice];
            endforeach;
        else:
            return false;
        endif;
    }
    
    public function PISCalc($IDTributacao, $RvBC, $Quantidade = NULL){
        $DB = new Database();
        $QvPIS = '0';
        $read_tributacao_pis = $DB->Read('tributacao_pis', "WHERE tributacao_pis_id_tributacao = '".$IDTributacao."' LIMIT 1");
        if($DB->NumQuery($read_tributacao_pis) > '0'):
            foreach($read_tributacao_pis as $read_tributacao_pis_view):
                if($read_tributacao_pis_view['QCST'] == '01' || $read_tributacao_pis_view['QCST'] == '02'):
                    $QvPIS = $RvBC * ($read_tributacao_pis_view['QpPIS'] / 100);
                elseif($read_tributacao_pis_view['QCST'] == '03'):
                    $QvPIS = $read_tributacao_pis_view['QvAliqProd'] * $Quantidade;
                elseif($read_tributacao_pis_view['QCST'] == '99'):
                    if($read_tributacao_pis_view['QTipoCalc'] == '1'):
                        $QvPIS = $RvBC * ($read_tributacao_pis_view['QpPIS'] / 100);
                    else:
                        $QvPIS = $read_tributacao_pis_view['QvAliqProd'] * $Quantidade;
                    endif;
                else:
                    $QvPIS = '0';
                endif;
            endforeach;
            return number_format($QvPIS,2,".","");
        else:
            return number_format($QvPIS,2,".","");
        endif;
    }
    
    public function PISCalcST($IDTributacao, $OQvPIS, $RvBC = NULL, $Quantidade = NULL){
        $DB = new Database();
        $RvPIS = '0';
        $read_tributacao_pis = $DB->Read('tributacao_pis', "WHERE tributacao_pis_id_tributacao = '".$IDTributacao."' LIMIT 1");
        if($DB->NumQuery($read_tributacao_pis) > '0'):
            foreach($read_tributacao_pis as $read_tributacao_pis_view):
                if($read_tributacao_pis_view['RTipoCalc'] == '0'):
                    $RvPIS = '0';
                elseif($read_tributacao_pis_view['RTipoCalc'] == '1'):
                    $valor_calculado = (($RvBC * ($read_tributacao_pis_view['RpPIS'] / 100)) - $OQvPIS);
                    if($valor_calculado <= '0'):
                        $RvPIS = '0';
                    else:
                        $RvPIS = $valor_calculado;
                    endif;
                else:
                    $valor_calculado = (($read_tributacao_pis_view['RvAliqProd'] * $Quantidade) - $OQvPIS);
                    if($valor_calculado <= '0'):
                        $RvPIS = '0';
                    else:
                        $RvPIS = $valor_calculado;
                    endif;
                endif;
            endforeach;
            return number_format($RvPIS,2,".","");
        else:
            return number_format($RvPIS,2,".","");
        endif;
    }
    
    public function PISBuscar($IDTributacao, $Indice){
        $DB = new Database();
        $read_tributacao_pis = $DB->ReadComposta("SELECT $Indice FROM tributacao_pis WHERE tributacao_pis_id_tributacao = '".$IDTributacao."' LIMIT 1");
        if($DB->NumQuery($read_tributacao_pis) > '0'):
            foreach($read_tributacao_pis as $read_tributacao_pis_view):
                return $read_tributacao_pis_view[$Indice];
            endforeach;
        else:
            return false;
        endif;
    }
    
    public function COFINSCalc($IDTributacao, $RvBC, $Quantidade = NULL){
        $DB = new Database();
        $QvPIS = '0';
        $read_tributacao_cofins = $DB->Read('tributacao_cofins', "WHERE tributacao_cofins_id_tributacao = '".$IDTributacao."' LIMIT 1");
        if($DB->NumQuery($read_tributacao_cofins) > '0'):
            foreach($read_tributacao_cofins as $read_tributacao_cofins_view):
                if($read_tributacao_cofins_view['SCST'] == '01' || $read_tributacao_cofins_view['SCST'] == '02'):
                    $QvPIS = $RvBC * ($read_tributacao_cofins_view['SpCOFINS'] / 100);
                elseif($read_tributacao_cofins_view['SCST'] == '03'):
                    $QvPIS = $read_tributacao_cofins_view['SvAliqProd'] * $Quantidade;
                elseif($read_tributacao_cofins_view['SCST'] == '99'):
                    if($read_tributacao_cofins_view['STipoCalc'] == '1'):
                        $QvPIS = $RvBC * ($read_tributacao_cofins_view['SpCOFINS'] / 100);
                    else:
                        $QvPIS = $read_tributacao_cofins_view['SvAliqProd'] * $Quantidade;
                    endif;
                else:
                    $QvPIS = '0';
                endif;
            endforeach;
            return number_format($QvPIS,2,".","");
        else:
            return number_format($QvPIS,2,".","");
        endif;
    }
    
    public function COFINSCalcST($IDTributacao, $OQvPIS, $RvBC = NULL, $Quantidade = NULL){
        $DB = new Database();
        $RvPIS = '0';
        $read_tributacao_cofins = $DB->Read('tributacao_cofins', "WHERE tributacao_cofins_id_tributacao = '".$IDTributacao."' LIMIT 1");
        if($DB->NumQuery($read_tributacao_cofins) > '0'):
            foreach($read_tributacao_cofins as $read_tributacao_cofins_view):
                if($read_tributacao_cofins_view['TTipoCalc'] == '0'):
                    $RvPIS = '0';
                elseif($read_tributacao_cofins_view['TTipoCalc'] == '1'):
                    $valor_calculado = (($RvBC * ($read_tributacao_cofins_view['TpCOFINS'] / 100)) - $OQvPIS);
                    if($valor_calculado <= '0'):
                        $RvPIS = '0';
                    else:
                        $RvPIS = $valor_calculado;
                    endif;
                else:
                    $valor_calculado = (($read_tributacao_cofins_view['TvAliqProd'] * $Quantidade) - $OQvPIS);
                    if($valor_calculado <= '0'):
                        $RvPIS = '0';
                    else:
                        $RvPIS = $valor_calculado;
                    endif;
                endif;
            endforeach;
            return number_format($RvPIS,2,".","");
        else:
            return number_format($RvPIS,2,".","");
        endif;
    }
    
    public function COFINSBuscar($IDTributacao, $Indice){
        $DB = new Database();
        $read_tributacao_cofins = $DB->ReadComposta("SELECT $Indice FROM tributacao_cofins WHERE tributacao_cofins_id_tributacao = '".$IDTributacao."' LIMIT 1");
        if($DB->NumQuery($read_tributacao_cofins) > '0'):
            foreach($read_tributacao_cofins as $read_tributacao_cofins_view):
                return $read_tributacao_cofins_view[$Indice];
            endforeach;
        else:
            return false;
        endif;
    }
    
    public function ICMS($IDTributacao, $NvBC, $OvIPI = '0'){
        $DB = new Database();
        
        $read_tributacao_icms = $DB->Read('tributacao_icms', "WHERE tributacao_icms_id_tributacao = '".$IDTributacao."' LIMIT 1");
        if($DB->NumQuery($read_tributacao_icms) > '0'):
            foreach($read_tributacao_icms as $read_tributacao_icms_view):
                $ret_trib_icms['NCST']      = $read_tributacao_icms_view['NCST'];
                $ret_trib_icms['Norig']     = $read_tributacao_icms_view['Norig'];
                
                if($read_tributacao_icms_view['NCST'] == '00'):
                    $ret_trib_icms['NmodBC']    = $read_tributacao_icms_view['NmodBC'];
                    $ret_trib_icms['NvBC']      = $NvBC;
                    $ret_trib_icms['NpICMS']    = $read_tributacao_icms_view['NpICMS'];
                    $ret_trib_icms['NvICMS']    = ($NvBC * ($read_tributacao_icms_view['NpICMS'] / 100));
                    $ret_trib_icms['NpFCP']     = $read_tributacao_icms_view['NpFCP'];
                    $ret_trib_icms['NvFCP']     = ($NvBC * ($read_tributacao_icms_view['NpFCP'] / 100));
                elseif($read_tributacao_icms_view['NCST'] == '10'):
                    $ret_trib_icms['NmodBC']    = $read_tributacao_icms_view['NmodBC'];
                    $ret_trib_icms['NvBC']      = $NvBC;
                    $ret_trib_icms['NpICMS']    = $read_tributacao_icms_view['NpICMS'];
                    $ret_trib_icms['NvICMS']    = ($NvBC * ($read_tributacao_icms_view['NpICMS'] / 100));
                    
                    $ret_trib_icms['NmodBCST']      = $read_tributacao_icms_view['NmodBCST'];
                    $ret_trib_icms['NpMVAST']       = $read_tributacao_icms_view['NpMVAST'];
                    $ret_trib_icms['meuPautaST']    = $read_tributacao_icms_view['meuPautaST'];
                    $ret_trib_icms['NpRedBCST']     = $read_tributacao_icms_view['NpRedBCST'];
                    $ret_trib_icms['NpICMSST']      = $read_tributacao_icms_view['NpICMSST'];
                    $ret_trib_icms['NvBCST']        = $NvBC;
                    
                    //CALC ST
                    $result_mva = ($NvBC + ($NvBC * ($read_tributacao_icms_view['NpMVAST'] / 100)));
                    $result_mva_redbc = ($result_mva - ($result_mva * ($read_tributacao_icms_view['NpRedBCST'] / 100)));
                    $result = ($result_mva_redbc * ($read_tributacao_icms_view['NpICMSST'] / 100));
                    
                    $NvICMSST = $result - $ret_trib_icms['NvICMS'];
                    if($NvICMSST <= '0'):
                        $NvICMSSTTot = '0';
                    else:
                        $NvICMSSTTot = $NvICMSST;
                    endif;
                    //FIM CALC ST
                    $ret_trib_icms['NvICMSST']      = $NvICMSSTTot;
                    $ret_trib_icms['NvBCFCPST']     = $NvBC;
                    $ret_trib_icms['NvFCPST']       = ($NvBC * ($read_tributacao_icms_view['NpFCPST'] / 100));
                    $ret_trib_icms['NpFCPST']       = $read_tributacao_icms_view['NpFCPST'];
                elseif($read_tributacao_icms_view['NCST'] == '20'):
                    $ret_trib_icms['NmodBC']        = $read_tributacao_icms_view['NmodBC'];
                    $ret_trib_icms['NpRedBC']       = $read_tributacao_icms_view['NpRedBC'];
                    $ret_trib_icms['NvBC']          = $NvBC;
                    $ret_trib_icms['NpICMS']        = $read_tributacao_icms_view['NpICMS'];
                    $ret_trib_icms['NvICMS']        = ($NvBC * ($read_tributacao_icms_view['NpICMS'] / 100));
                    $ret_trib_icms['NvBCFCP']       = $NvBC;
                    $ret_trib_icms['NpFCP']         = $read_tributacao_icms_view['NpFCP'];
                    $ret_trib_icms['NvFCP']         = ($NvBC * ($read_tributacao_icms_view['NpFCP'] / 100));
                    $ret_trib_icms['NvICMSDeson']   = '0';
                    $ret_trib_icms['NmotDesICMS']   = $read_tributacao_icms_view['NmotDesICMS'];
                elseif($read_tributacao_icms_view['NCST'] == '30'):
                    $ret_trib_icms['NmodBC']        = $read_tributacao_icms_view['NmodBC'];
                    $ret_trib_icms['NmodBCST']      = $read_tributacao_icms_view['NmodBCST'];
                    $ret_trib_icms['NpMVAST']       = $read_tributacao_icms_view['NpMVAST'];
                    $ret_trib_icms['meuPautaST']    = $read_tributacao_icms_view['meuPautaST'];
                    $ret_trib_icms['NpRedBCST']     = $read_tributacao_icms_view['NpRedBCST'];
                    $ret_trib_icms['NvBCST']        = $NvBC;
                    $ret_trib_icms['NpICMSST']      = $read_tributacao_icms_view['NpICMSST'];
                    //CALC ST
                    $result_mva = ($NvBC + ($NvBC * ($read_tributacao_icms_view['NpMVAST'] / 100)));
                    $result_mva_redbc = ($result_mva - ($result_mva * ($read_tributacao_icms_view['NpRedBCST'] / 100)));
                    $result = ($result_mva_redbc * ($read_tributacao_icms_view['NpICMSST'] / 100));
                    
                    $NvICMSST = $result;
                    if($NvICMSST <= '0'):
                        $NvICMSSTTot = '0';
                    else:
                        $NvICMSSTTot = $NvICMSST;
                    endif;
                    //FIM CALC ST
                    $ret_trib_icms['NvICMSST']      = $NvICMSSTTot;
                    $ret_trib_icms['NvBCFCPST']     = $NvBC;
                    $ret_trib_icms['NpFCPST']       = $read_tributacao_icms_view['NpFCPST'];
                    $ret_trib_icms['NvFCPST']       = ($NvBC * ($read_tributacao_icms_view['NpFCPST'] / 100));
                    $ret_trib_icms['NvICMSDeson']   = '0';
                    $ret_trib_icms['NmotDesICMS']   = $read_tributacao_icms_view['NmotDesICMS'];
                elseif($read_tributacao_icms_view['NCST'] == '40' || $read_tributacao_icms_view['NCST'] == '41' || $read_tributacao_icms_view['NCST'] == '50'):
                    $ret_trib_icms['NvICMSDeson'] = '0';
                    $ret_trib_icms['NmotDesICMS'] = $read_tributacao_icms_view['NmotDesICMS'];
                elseif($read_tributacao_icms_view['NCST'] == '51'):
                    $ret_trib_icms['NmodBC']    = $read_tributacao_icms_view['NmodBC'];
                    $ret_trib_icms['NpRedBC']   = $read_tributacao_icms_view['NpRedBC'];
                    $ret_trib_icms['NvBC']      = $NvBC;
                    $ret_trib_icms['NpICMS']    = $read_tributacao_icms_view['NpICMS'];
                    $ret_trib_icms['NvICMS']    = ($NvBC * ($read_tributacao_icms_view['NpICMS'] / 100));
                    $ret_trib_icms['NvICMSOp']  = $ret_trib_icms['NvICMS'];
                    $ret_trib_icms['NpDif']     = '0';
                    $ret_trib_icms['NvICMSDif'] = '0';
                    $ret_trib_icms['NvBCFCP']   = $NvBC;
                    $ret_trib_icms['NpFCP']     = $read_tributacao_icms_view['NpFCP'];
                    $ret_trib_icms['NvFCP']     = ($NvBC * ($read_tributacao_icms_view['NpFCP'] / 100));
                elseif($read_tributacao_icms_view['NCST'] == '70' || $read_tributacao_icms_view['NCST'] == '90'):
                    $ret_trib_icms['NmodBC']        = $read_tributacao_icms_view['NmodBC'];
                    $ret_trib_icms['NpRedBC']       = $read_tributacao_icms_view['NpRedBC'];
                    $ret_trib_icms['NvBC']          = $NvBC;
                    $ret_trib_icms['NpICMS']        = $read_tributacao_icms_view['NpICMS'];
                    $ret_trib_icms['NvICMS']        = ($NvBC * ($read_tributacao_icms_view['NpICMS'] / 100));
                    $ret_trib_icms['NvBCFCP']       = $NvBC;
                    $ret_trib_icms['NpFCP']         = $read_tributacao_icms_view['NpFCP'];
                    $ret_trib_icms['NvFCP']         = ($NvBC * ($read_tributacao_icms_view['NpFCP'] / 100));
                    $ret_trib_icms['NmodBCST']      = $read_tributacao_icms_view['NmodBCST'];
                    $ret_trib_icms['NpMVAST']       = $read_tributacao_icms_view['NpMVAST'];
                    $ret_trib_icms['NpRedBCST']     = $read_tributacao_icms_view['NpRedBCST'];
                    $ret_trib_icms['NvBCST']        = $NvBC;
                    $ret_trib_icms['meuPautaST']    = $read_tributacao_icms_view['meuPautaST'];
                    $ret_trib_icms['NpICMSST']      = $read_tributacao_icms_view['NpICMSST'];
                    //CALC ST
                    $result_mva = ($NvBC + ($NvBC * ($read_tributacao_icms_view['NpMVAST'] / 100)));
                    $result_mva_redbc = ($result_mva - ($result_mva * ($read_tributacao_icms_view['NpRedBCST'] / 100)));
                    $result = ($result_mva_redbc * ($read_tributacao_icms_view['NpICMSST'] / 100));
                    
                    $NvICMSST = $result - $ret_trib_icms['NvICMS'];
                    if($NvICMSST <= '0'):
                        $NvICMSSTTot = '0';
                    else:
                        $NvICMSSTTot = $NvICMSST;
                    endif;
                    //FIM CALC ST
                    $ret_trib_icms['NvICMSST']      = $NvICMSSTTot;
                    $ret_trib_icms['NvICMSDeson']   = '0';
                    $ret_trib_icms['NmotDesICMS']   = $read_tributacao_icms_view['NmotDesICMS'];
                    $ret_trib_icms['NvBCFCPST']     = $NvBC;
                    $ret_trib_icms['NpFCPST']       = $read_tributacao_icms_view['NpFCPST'];
                    $ret_trib_icms['NvFCPST']       = ($NvBC * ($read_tributacao_icms_view['NpFCPST'] / 100));
                elseif($read_tributacao_icms_view['NCST'] == '101'):
                    $ret_trib_icms['NpCredSN'] = $read_tributacao_icms_view['NpCredSN'];
                    $ret_trib_icms['NvCredICMSSN'] = ($NvBC * ($read_tributacao_icms_view['NpCredSN'] / 100));
                elseif($read_tributacao_icms_view['NCST'] == '201'):
                    $ret_trib_icms['NpCredSN']      = $read_tributacao_icms_view['NpCredSN'];
                    $ret_trib_icms['NvCredICMSSN']  = ($NvBC * ($read_tributacao_icms_view['NpCredSN'] / 100));
                    $ret_trib_icms['NmodBCST']      = $read_tributacao_icms_view['NmodBCST'];
                    $ret_trib_icms['NpMVAST']       = $read_tributacao_icms_view['NpMVAST'];
                    $ret_trib_icms['NpRedBCST']     = $read_tributacao_icms_view['NpRedBCST'];
                    $ret_trib_icms['meuPautaST']    = $read_tributacao_icms_view['meuPautaST'];
                    $ret_trib_icms['NvBCST']        = $NvBC;
                    //CALC ST
                    $result_mva = ($NvBC + ($NvBC * ($read_tributacao_icms_view['NpMVAST'] / 100)));
                    $result_mva_redbc = ($result_mva - ($result_mva * ($read_tributacao_icms_view['NpRedBCST'] / 100)));
                    $result = ($result_mva_redbc * ($read_tributacao_icms_view['NpICMSST'] / 100)) + $OvIPI;
                    
                    $NvICMSST = $result - $ret_trib_icms['NvICMS'];
                    if($NvICMSST <= '0'):
                        $NvICMSSTTot = '0';
                    else:
                        $NvICMSSTTot = $NvICMSST;
                    endif;
                    //FIM CALC ST
                    $ret_trib_icms['NvICMSST']      = $NvICMSSTTot;
                    $ret_trib_icms['NvBCFCPST']     = $NvBC;
                    $ret_trib_icms['NpFCPST']       = $read_tributacao_icms_view['NpFCPST'];
                    $ret_trib_icms['NvFCPST']       = ($NvBC * ($read_tributacao_icms_view['NpFCPST'] / 100));
                elseif($read_tributacao_icms_view['NCST'] == '202' || $read_tributacao_icms_view['NCST'] == '203'):
                    $ret_trib_icms['NmodBCST']      = $read_tributacao_icms_view['NmodBCST'];
                    $ret_trib_icms['NpMVAST']       = $read_tributacao_icms_view['NpMVAST'];
                    $ret_trib_icms['NpRedBCST']     = $read_tributacao_icms_view['NpRedBCST'];
                    $ret_trib_icms['meuPautaST']    = $read_tributacao_icms_view['meuPautaST'];
                    $ret_trib_icms['NvBCST']        = $NvBC;
                    $ret_trib_icms['NpICMSST']      = $read_tributacao_icms_view['NpICMSST'];
                    //CALC ST
                    $result_mva = ($NvBC + ($NvBC * ($read_tributacao_icms_view['NpMVAST'] / 100)));
                    $result_mva_redbc = ($result_mva - ($result_mva * ($read_tributacao_icms_view['NpRedBCST'] / 100)));
                    $result = ($result_mva_redbc * ($read_tributacao_icms_view['NpICMSST'] / 100));
                    
                    $NvICMSST = $result;
                    if($NvICMSST <= '0'):
                        $NvICMSSTTot = '0';
                    else:
                        $NvICMSSTTot = $NvICMSST;
                    endif;
                    //FIM CALC ST
                    $ret_trib_icms['NvICMSST']      = $NvICMSSTTot;
                    $ret_trib_icms['NvBCFCPST']     = $NvBC;
                    $ret_trib_icms['NpFCPST']       = $read_tributacao_icms_view['NpFCPST'];
                    $ret_trib_icms['NvFCPST']       = ($NvBC * ($read_tributacao_icms_view['NpFCPST'] / 100));
                elseif($read_tributacao_icms_view['NCST'] == '900'):
                    $ret_trib_icms['NmodBC']        = $read_tributacao_icms_view['NmodBC'];
                    $ret_trib_icms['NpRedBC']       = $read_tributacao_icms_view['NpRedBC'];
                    $ret_trib_icms['NvBC']          = $NvBC;
                    $ret_trib_icms['NpICMS']        = $read_tributacao_icms_view['NpICMS'];
                    $ret_trib_icms['NvICMS']        = ($NvBC * ($read_tributacao_icms_view['NpICMS'] / 100));
                    $ret_trib_icms['NpCredSN']      = $read_tributacao_icms_view['NpCredSN'];
                    $ret_trib_icms['NvCredICMSSN']  = ($NvBC * ($read_tributacao_icms_view['NpCredSN'] / 100));
                    $ret_trib_icms['NmodBCST']      = $read_tributacao_icms_view['NmodBCST'];
                    $ret_trib_icms['NpMVAST']       = $read_tributacao_icms_view['NpMVAST'];
                    $ret_trib_icms['NpRedBCST']     = $read_tributacao_icms_view['NpRedBCST'];
                    $ret_trib_icms['NvBCST']        = $NvBC;
                    $ret_trib_icms['meuPautaST']    = $read_tributacao_icms_view['meuPautaST'];
                    $ret_trib_icms['NpICMSST']      = $read_tributacao_icms_view['NpICMSST'];
                    //CALC ST
                    $result_mva = ($NvBC + ($NvBC * ($read_tributacao_icms_view['NpMVAST'] / 100)));
                    $result_mva_redbc = ($result_mva - ($result_mva * ($read_tributacao_icms_view['NpRedBCST'] / 100)));
                    $result = ($result_mva_redbc * ($read_tributacao_icms_view['NpICMSST'] / 100));
                    
                    $NvICMSST = $result - $ret_trib_icms['NvICMS'];
                    if($NvICMSST <= '0'):
                        $NvICMSSTTot = '0';
                    else:
                        $NvICMSSTTot = $NvICMSST;
                    endif;
                    //FIM CALC ST
                    $ret_trib_icms['NvICMSST']      = $NvICMSSTTot;
                    $ret_trib_icms['NvBCFCPST']     = $NvBC;
                    $ret_trib_icms['NpFCPST']       = $read_tributacao_icms_view['NpFCPST'];
                    $ret_trib_icms['NvFCPST']       = ($NvBC * ($read_tributacao_icms_view['NpFCPST'] / 100));
                elseif($read_tributacao_icms_view['NCST'] == '10Part' || $read_tributacao_icms_view['NCST'] == '90Part'):
                    $ret_trib_icms['NmodBC']        = $read_tributacao_icms_view['NmodBC'];
                    $ret_trib_icms['NpRedBC']       = $read_tributacao_icms_view['NpRedBC'];
                    $ret_trib_icms['NvBC']          = $NvBC;
                    $ret_trib_icms['NpICMS']        = $read_tributacao_icms_view['NpICMS'];
                    $ret_trib_icms['NvICMS']        = ($NvBC * ($read_tributacao_icms_view['NpICMS'] / 100));
                    $ret_trib_icms['NmodBCST']      = $read_tributacao_icms_view['NmodBCST'];
                    $ret_trib_icms['NpMVAST']       = $read_tributacao_icms_view['NpMVAST'];
                    $ret_trib_icms['NpRedBCST']     = $read_tributacao_icms_view['NpRedBCST'];
                    $ret_trib_icms['NvBCST']        = $NvBC;
                    $ret_trib_icms['meuPautaST']    = $read_tributacao_icms_view['meuPautaST'];
                    $ret_trib_icms['NpICMSST']      = $read_tributacao_icms_view['NpICMSST'];
                    //CALC ST
                    $result_mva = ($NvBC + ($NvBC * ($read_tributacao_icms_view['NpMVAST'] / 100)));
                    $result_mva_redbc = ($result_mva - ($result_mva * ($read_tributacao_icms_view['NpRedBCST'] / 100)));
                    $result = ($result_mva_redbc * ($read_tributacao_icms_view['NpICMSST'] / 100));
                    
                    $NvICMSST = $result - $ret_trib_icms['NvICMS'];
                    if($NvICMSST <= '0'):
                        $NvICMSSTTot = '0';
                    else:
                        $NvICMSSTTot = $NvICMSST;
                    endif;
                    //FIM CALC ST
                    $ret_trib_icms['NvICMSST']      = $NvICMSSTTot;
                    $ret_trib_icms['NpBCOp']        = $read_tributacao_icms_view['NpBCOp'];
                    $ret_trib_icms['NUFST']         = $read_tributacao_icms_view['NUFST'];
                endif;
                return $ret_trib_icms;
            endforeach;
        endif;
    }
    
    
    public function NextNFe($Ambiente, $Serie, $IdEmpresa){
        $DB = new Database();
        
        
        $read_next_nfe = $DB->Read('nfe', "WHERE nfe_ambiente = '".$Ambiente."' AND serie = '".$Serie."' AND id_empresa = '".$IdEmpresa."' ORDER BY BnNF DESC LIMIT 1");
        if($DB->NumQuery($read_next_nfe) > '0'):
            foreach($read_next_nfe as $read_next_nfe_view):
                $UltNFe = $read_next_nfe_view['BnNF'] + 1;
            endforeach;
        else:
            $UltNFe = '1';
        endif;
        return $UltNFe;
    }
    
    public function GetSMTP($Indice){
        $DB = new Database();
        
        $read_smtp = $DB->ReadComposta("SELECT {$Indice} FROM smtp WHERE smtp_id = '1' LIMIT 1");
        if($DB->NumQuery($read_smtp) > '0'):
            foreach($read_smtp as $read_smtp_view):
                return $read_smtp_view[$Indice];
            endforeach;
        else:
            return false;
        endif;
    }
    
    public function GetConfigNFe($Indice, $IdEmpresa){
        $DB = new Database();
        
        $read_empresa = $DB->ReadComposta("SELECT {$Indice} FROM config_nfe WHERE config_nfe_id_empresa = '".$IdEmpresa."' LIMIT 1");
        if($DB->NumQuery($read_empresa) > '0'):
            foreach($read_empresa as $read_empresa_view):
                return $read_empresa_view[$Indice];
            endforeach;
        else:
            return false;
        endif;
    }
    
    public function FinanceiroCode($operacao){
        $DB = new Database();
        
        $read_financeiro = $DB->ReadComposta("SELECT financeiro_codigo FROM financeiro WHERE financeiro_tipo = '".$operacao."' ORDER BY financeiro_id DESC LIMIT 1");
        if($DB->NumQuery($read_financeiro) > '0'):
            foreach($read_financeiro as $read_financeiro_view):
                return $read_financeiro_view['financeiro_codigo'];
            endforeach;
        else:
            return '0';
        endif;
    }
    
    public function GetParametro($Indice){
        $DB = new Database();
        
        $read_parametro = $DB->ReadComposta("SELECT {$Indice} FROM parametros WHERE parametro_id = '1' LIMIT 1");
        if($DB->NumQuery($read_parametro) > '0'):
            foreach($read_parametro as $read_parametro_view):
                return $read_parametro_view[$Indice];
            endforeach;
        else:
            return false;
        endif;
    }
}
