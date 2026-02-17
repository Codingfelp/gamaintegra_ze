<?php
/**
 * ze_pedido_mail.php - Leitura de código 2FA do Gmail via API OAuth 2.0
 * 
 * MIGRAÇÃO CONCLUÍDA: IMAP -> Gmail API
 * - Usa refresh_token para obter access_token automaticamente
 * - Busca emails do Zé Delivery via Gmail API REST
 * - Extrai código 2FA de 6 dígitos
 */

// Configurações
set_time_limit(60);
ini_set('default_socket_timeout', 30);
error_reporting(0);

header('Content-Type: application/json');

// Credenciais OAuth 2.0
$GMAIL_CONFIG = [
    'client_id'     => '471842038254-rp7fom0ns0vg9b15r4dp5llr8itp429s.apps.googleusercontent.com',
    'client_secret' => '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',
    'refresh_token' => '1//04mAHWQbx3-2dCgYIARAAGAQSNwF-L9Irjiziq8dxstUmEkfrtTNJobJUJ3jMjiK_GSpJeGb5YeyFjUdO55BfBWSZ_C3gz3J7_Ng',
    'token_url'     => 'https://oauth2.googleapis.com/token',
    'gmail_api_url' => 'https://gmail.googleapis.com/gmail/v1/users/me'
];

/**
 * Obtém access_token usando refresh_token
 */
function getAccessToken($config) {
    $postData = [
        'client_id'     => $config['client_id'],
        'client_secret' => $config['client_secret'],
        'refresh_token' => $config['refresh_token'],
        'grant_type'    => 'refresh_token'
    ];
    
    $ch = curl_init($config['token_url']);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => http_build_query($postData),
        CURLOPT_HTTPHEADER     => ['Content-Type: application/x-www-form-urlencoded'],
        CURLOPT_TIMEOUT        => 15,
        CURLOPT_SSL_VERIFYPEER => true
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);
    
    if ($curlError) {
        throw new Exception("cURL error: $curlError");
    }
    
    if ($httpCode !== 200) {
        $errorData = json_decode($response, true);
        $errorMsg = $errorData['error_description'] ?? $errorData['error'] ?? "HTTP $httpCode";
        throw new Exception("Token refresh failed: $errorMsg");
    }
    
    $data = json_decode($response, true);
    if (!isset($data['access_token'])) {
        throw new Exception("No access_token in response");
    }
    
    return $data['access_token'];
}

/**
 * Busca mensagens do Gmail via API
 * @param string $accessToken
 * @param string $query - Filtro de busca (Gmail search syntax)
 * @return array - Lista de message IDs
 */
function searchMessages($accessToken, $query, $config) {
    $url = $config['gmail_api_url'] . '/messages?' . http_build_query([
        'q' => $query,
        'maxResults' => 10
    ]);
    
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER     => ["Authorization: Bearer $accessToken"],
        CURLOPT_TIMEOUT        => 15,
        CURLOPT_SSL_VERIFYPEER => true
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpCode !== 200) {
        return [];
    }
    
    $data = json_decode($response, true);
    return $data['messages'] ?? [];
}

/**
 * Obtém detalhes de uma mensagem específica
 * @param string $accessToken
 * @param string $messageId
 * @return array|null
 */
function getMessage($accessToken, $messageId, $config) {
    $url = $config['gmail_api_url'] . "/messages/$messageId?" . http_build_query([
        'format' => 'full'
    ]);
    
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER     => ["Authorization: Bearer $accessToken"],
        CURLOPT_TIMEOUT        => 15,
        CURLOPT_SSL_VERIFYPEER => true
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    if ($httpCode !== 200) {
        return null;
    }
    
    return json_decode($response, true);
}

/**
 * Extrai o assunto de uma mensagem
 */
function getSubject($message) {
    $headers = $message['payload']['headers'] ?? [];
    foreach ($headers as $header) {
        if (strtolower($header['name']) === 'subject') {
            return $header['value'];
        }
    }
    return '';
}

/**
 * Extrai o corpo da mensagem (decodifica base64url)
 */
function getBody($message) {
    $payload = $message['payload'] ?? [];
    
    // Corpo direto no payload
    if (isset($payload['body']['data'])) {
        return base64UrlDecode($payload['body']['data']);
    }
    
    // Corpo em partes (multipart)
    if (isset($payload['parts'])) {
        foreach ($payload['parts'] as $part) {
            // Preferir text/plain
            if (($part['mimeType'] ?? '') === 'text/plain' && isset($part['body']['data'])) {
                return base64UrlDecode($part['body']['data']);
            }
        }
        // Fallback para text/html
        foreach ($payload['parts'] as $part) {
            if (($part['mimeType'] ?? '') === 'text/html' && isset($part['body']['data'])) {
                $html = base64UrlDecode($part['body']['data']);
                return strip_tags($html);
            }
        }
        // Tentar partes aninhadas
        foreach ($payload['parts'] as $part) {
            if (isset($part['parts'])) {
                foreach ($part['parts'] as $subpart) {
                    if (isset($subpart['body']['data'])) {
                        return base64UrlDecode($subpart['body']['data']);
                    }
                }
            }
        }
    }
    
    return '';
}

/**
 * Decodifica base64url (Gmail usa esse formato)
 */
function base64UrlDecode($data) {
    $data = str_replace(['-', '_'], ['+', '/'], $data);
    return base64_decode($data);
}

// ============= EXECUÇÃO PRINCIPAL =============

try {
    // 1. Obter access token
    $accessToken = getAccessToken($GMAIL_CONFIG);
    
    // 2. Buscar emails do Zé Delivery (tentando múltiplos filtros)
    // O email pode vir de diferentes remetentes e com diferentes assuntos
    $queries = [
        'is:unread from:noreply@ze.delivery subject:"Código de acesso" newer_than:2h',
        'is:unread from:nao-responda@ze.delivery subject:"código de verificação" newer_than:2h',
        'is:unread from:ze.delivery newer_than:1h',
        'from:ze.delivery subject:código newer_than:2h'
    ];
    
    $codigoEncontrado = null;
    
    foreach ($queries as $query) {
        if ($codigoEncontrado) break;
        
        $messages = searchMessages($accessToken, $query, $GMAIL_CONFIG);
        
        // 3. Processar mensagens (mais recente primeiro - já vem ordenado)
        foreach ($messages as $msgRef) {
            $message = getMessage($accessToken, $msgRef['id'], $GMAIL_CONFIG);
            if (!$message) continue;
            
            $subject = getSubject($message);
            $body = getBody($message);
            
            // Extrair código de 6 dígitos do corpo ou assunto
            if (preg_match('/\b(\d{6})\b/', $body, $matches)) {
                $codigoEncontrado = $matches[1];
                break;
            }
            if (preg_match('/\b(\d{6})\b/', $subject, $matches)) {
                $codigoEncontrado = $matches[1];
                break;
            }
        }
    }
    
    // 4. Retornar resultado (mesma interface do IMAP antigo)
    if ($codigoEncontrado) {
        echo json_encode(['codigo' => $codigoEncontrado]);
    } else {
        echo json_encode(['codigo' => 0]);
    }
    
} catch (Throwable $e) {
    // Retornar erro estruturado (mesma interface do IMAP antigo)
    echo json_encode([
        'codigo' => 0,
        'erro' => true,
        'msg' => $e->getMessage()
    ]);
    exit(1);
}
