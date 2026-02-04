<?php
/**
 * Session Cookies Manager - PHP Script
 * Gerencia cookies de sessão no banco de dados MySQL
 */
error_reporting(0);
header('Content-Type: application/json; charset=utf-8');

require_once '_class/AutoLoad.php';

$DB = new Database();

// Receber ação e dados
$action = isset($_GET['action']) ? $_GET['action'] : (isset($_POST['action']) ? $_POST['action'] : '');
$profile = isset($_GET['profile']) ? addslashes($_GET['profile']) : (isset($_POST['profile']) ? addslashes($_POST['profile']) : '');
$cookies = isset($_POST['cookies']) ? $_POST['cookies'] : '';

$response = ['success' => false, 'message' => '', 'data' => null];

try {
    switch ($action) {
        case 'init':
            // Criar tabela se não existir
            $sql = "CREATE TABLE IF NOT EXISTS ze_session_cookies (
                id INT AUTO_INCREMENT PRIMARY KEY,
                profile_name VARCHAR(100) NOT NULL UNIQUE,
                cookies_json LONGTEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                is_valid TINYINT(1) DEFAULT 1,
                last_check DATETIME DEFAULT NULL,
                INDEX idx_profile (profile_name)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";
            
            $result = $DB->Query($sql);
            $response['success'] = true;
            $response['message'] = 'Tabela verificada/criada';
            break;
            
        case 'save':
            // Salvar cookies
            if (empty($profile) || empty($cookies)) {
                $response['message'] = 'Profile e cookies são obrigatórios';
                break;
            }
            
            $cookiesEscaped = addslashes($cookies);
            
            $sql = "INSERT INTO ze_session_cookies (profile_name, cookies_json, is_valid, last_check)
                    VALUES ('$profile', '$cookiesEscaped', 1, NOW())
                    ON DUPLICATE KEY UPDATE 
                        cookies_json = '$cookiesEscaped',
                        is_valid = 1,
                        last_check = NOW(),
                        updated_at = NOW()";
            
            $result = $DB->Query($sql);
            $response['success'] = true;
            $response['message'] = 'Cookies salvos com sucesso';
            break;
            
        case 'load':
            // Carregar cookies
            if (empty($profile)) {
                $response['message'] = 'Profile é obrigatório';
                break;
            }
            
            $sql = "SELECT cookies_json, is_valid, updated_at 
                    FROM ze_session_cookies 
                    WHERE profile_name = '$profile' 
                    AND is_valid = 1
                    LIMIT 1";
            
            $result = $DB->QueryInfo($sql);
            
            if ($result && count($result) > 0) {
                $response['success'] = true;
                $response['message'] = 'Cookies carregados';
                $response['data'] = [
                    'cookies_json' => $result[0]['cookies_json'],
                    'is_valid' => $result[0]['is_valid'],
                    'updated_at' => $result[0]['updated_at']
                ];
            } else {
                $response['message'] = 'Nenhum cookie encontrado para este profile';
            }
            break;
            
        case 'invalidate':
            // Invalidar sessão
            if (empty($profile)) {
                $response['message'] = 'Profile é obrigatório';
                break;
            }
            
            $sql = "UPDATE ze_session_cookies 
                    SET is_valid = 0, updated_at = NOW() 
                    WHERE profile_name = '$profile'";
            
            $result = $DB->Query($sql);
            $response['success'] = true;
            $response['message'] = 'Sessão invalidada';
            break;
            
        case 'check':
            // Verificar última atualização
            if (empty($profile)) {
                $response['message'] = 'Profile é obrigatório';
                break;
            }
            
            $sql = "SELECT is_valid, updated_at, last_check 
                    FROM ze_session_cookies 
                    WHERE profile_name = '$profile'
                    LIMIT 1";
            
            $result = $DB->QueryInfo($sql);
            
            if ($result && count($result) > 0) {
                $response['success'] = true;
                $response['data'] = $result[0];
            } else {
                $response['message'] = 'Profile não encontrado';
            }
            break;
            
        case 'update_check':
            // Atualizar last_check
            if (empty($profile)) {
                $response['message'] = 'Profile é obrigatório';
                break;
            }
            
            $sql = "UPDATE ze_session_cookies 
                    SET last_check = NOW() 
                    WHERE profile_name = '$profile'";
            
            $result = $DB->Query($sql);
            $response['success'] = true;
            $response['message'] = 'Last check atualizado';
            break;
            
        default:
            $response['message'] = 'Ação inválida. Ações disponíveis: init, save, load, invalidate, check, update_check';
    }
} catch (Exception $e) {
    $response['message'] = 'Erro: ' . $e->getMessage();
}

echo json_encode($response, JSON_UNESCAPED_UNICODE);
