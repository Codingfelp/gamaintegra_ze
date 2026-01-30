<?php

/**
 * Classe responsável pelo gerenciamento dos bancos de dados
 *
 * @author Marques Junior
 */
class Database {

    //FAZ A CONEXÃO COM O BANCO DE DADOS (Railway Cloud mainline)
    public function Conn() {
        $Host = 'mainline.proxy.rlwy.net';
        $User = 'root';
        $Pass = 'eHeoVCebYyaJVBEBtCLfYNHgRCrxWVXU';
        $Dbsa = 'railway';
        $MyConn = "";
        $MyConn = mysqli_connect($Host, $User, $Pass, $Dbsa, '52996');
        return $MyConn;
    }

    public function tirarAcentos($string) {
        return preg_replace(array("/(á|à|ã|â|ä)/", "/(Á|À|Ã|Â|Ä)/", "/(é|è|ê|ë)/", "/(É|È|Ê|Ë)/", "/(í|ì|î|ï)/", "/(Í|Ì|Î|Ï)/", "/(ó|ò|õ|ô|ö)/", "/(Ó|Ò|Õ|Ô|Ö)/", "/(ú|ù|û|ü)/", "/(Ú|Ù|Û|Ü)/", "/(ñ)/", "/(Ñ)/", "/(ç)/", "/(Ç)/"), explode(" ", "a A e E i I o O u U n N c C"), $string);
    }

    //FAZ O CADASTRO
    public function Create($Tabela, array $Dados) {
        foreach ($Dados as $Key => $ValuesKey) {
            $Dados[$Key] = addslashes($ValuesKey);
        }
        $Campos = implode(',', array_keys($Dados));
        $Fields = "'" . implode("','", array_values($Dados)) . "'";
        $SqlCreate = "INSERT INTO {$Tabela} ({$Campos}) VALUES({$Fields})";
        $QuerySqlCreate = mysqli_query($this->Conn(), $SqlCreate);
        if ($QuerySqlCreate) :
            return true;
        else :
            echo $SqlCreate;
            return false;
        endif;
    }

    //FAZ LEITURA
    public function Read($Tabela, $Condicao = NULL) {
        $SqlRead = "SELECT * FROM {$Tabela} {$Condicao}";
        $QueryRead = mysqli_query($this->Conn(), $SqlRead);
        if ($QueryRead) :
            return $QueryRead;
        else :
            //echo $SqlRead;
            return false;
        endif;
    }

    //FAZ LEITURA COM INNER JOIN
    public function ReadComposta($Query) {
        $QueryRead = mysqli_query($this->Conn(), $Query);
        if ($QueryRead) :
            return $QueryRead;
        else :
            //echo $Query;
            return false;
        endif;
    }

    public function QueryInfo($Query) {
        $conn = $this->Conn(); // pega a conexão

        $result = mysqli_query($conn, $Query);

        if ($result) {
            // Se for um SELECT, retorna o resultado normalmente
            if (stripos(trim($Query), 'SELECT') === 0) {
                return $result;
            }

            // Para INSERT, UPDATE, DELETE: retorna número de linhas afetadas
            return [
                'success' => true,
                'affected_rows' => mysqli_affected_rows($conn),
                'insert_id' => mysqli_insert_id($conn)
            ];
        } else {
            // Retorna erro detalhado
            return [
                'success' => false,
                'error' => mysqli_error($conn),
                'query' => $Query
            ];
        }
    }

    //FAZ EDIÇÃO
    public function Update($Tabela, array $Dados, $Condicao = NULL) {
        foreach ($Dados as $Keys => $ValuesKeys) {
            $ValuesKeys = addslashes($this->tirarAcentos($ValuesKeys));
            $CamposFields[] = "$Keys = '$ValuesKeys'";
        }

        $CamposFields = implode(", ", $CamposFields);
        $SqlUpdate = "UPDATE {$Tabela} SET {$CamposFields} {$Condicao}";

        $QueryUpdate = mysqli_query($this->Conn(), $SqlUpdate);



        if ($QueryUpdate) :
            return true;
        else :
            echo $SqlUpdate;
            return false;
        endif;
    }

    //FAZ DELETE
    public function Delete($Tabela, $Condicao = NULL) {
        $SqlDelete = "DELETE FROM {$Tabela} {$Condicao}";

        $QueryDelete = mysqli_query($this->Conn(), $SqlDelete);

        if ($QueryDelete) :
            return true;
        else :
            //echo $SqlDelete;
            return false;
        endif;
    }

    //BUSCA QUANTIDADE DE LINHAS
    public function NumQuery($Query) {
        $CountQuery = mysqli_num_rows($Query);
        return $CountQuery;
    }
}
