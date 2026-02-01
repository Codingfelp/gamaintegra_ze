<?php
/**
 * ze_pedido_mail.php - Leitura de código 2FA do Gmail via IMAP
 * 
 * HARDENED: Validação de extensão, timeout, tratamento de erro
 */

// Configurações de segurança
set_time_limit(60);
ini_set('default_socket_timeout', 60);
error_reporting(0);

header('Content-Type: application/json');

try {
    // 1. Validar extensão IMAP ANTES de qualquer coisa
    if (!extension_loaded('imap')) {
        throw new Exception('IMAP extension not loaded');
    }
    
    // 2. Configurações Gmail
    $hostname = '{imap.gmail.com:993/imap/ssl}INBOX';
    $username = 'gamataurize@gmail.com';
    $password = 'kiks yhiw dxaf vwuw';
    
    // 3. Conectar com timeout
    $inbox = @imap_open($hostname, $username, $password, 0, 3);
    
    if (!$inbox) {
        $error = imap_last_error();
        throw new Exception('IMAP connection failed: ' . ($error ?: 'unknown'));
    }
    
    // 4. Buscar e-mails não lidos
    $emails = @imap_search($inbox, 'UNSEEN');
    $assuntoFiltro = 'Zé Delivery - Código de acesso';
    $codigoEncontrado = null;
    
    if ($emails && is_array($emails)) {
        rsort($emails);
        
        foreach ($emails as $email_number) {
            $overview = @imap_fetch_overview($inbox, $email_number, 0);
            if (!$overview || !isset($overview[0])) continue;
            
            $overview = $overview[0];
            $body = @imap_fetchbody($inbox, $email_number, 1);
            
            // Decodificar assunto
            $assuntoParts = @imap_mime_header_decode($overview->subject ?? '');
            $assuntoDecodificado = '';
            if (is_array($assuntoParts)) {
                foreach ($assuntoParts as $part) {
                    $assuntoDecodificado .= $part->text ?? '';
                }
            }
            
            // Verificar se é email do Zé Delivery
            if (stripos($assuntoDecodificado, $assuntoFiltro) !== false) {
                $bodyDecoded = quoted_printable_decode($body);
                
                // Extrair código de 6 dígitos
                if (preg_match('/\b\d{6}\b/', $bodyDecoded, $matches)) {
                    $codigoEncontrado = $matches[0];
                    break;
                }
            }
        }
    }
    
    // 5. SEMPRE fechar conexão
    @imap_close($inbox);
    
    // 6. Retornar resultado
    if ($codigoEncontrado) {
        echo json_encode(['codigo' => $codigoEncontrado]);
    } else {
        echo json_encode(['codigo' => 0]);
    }
    
} catch (Throwable $e) {
    // Garantir que conexão seja fechada mesmo em erro
    if (isset($inbox) && $inbox) {
        @imap_close($inbox);
    }
    
    // Retornar erro estruturado
    echo json_encode([
        'codigo' => 0,
        'erro' => true,
        'msg' => $e->getMessage()
    ]);
    exit(1);
}
