<?php

$hostname = '{imap.gmail.com:993/imap/ssl}INBOX';
$username = 'gamataurize@gmail.com';
$password = 'kiks yhiw dxaf vwuw'; // Use senha de app ou OAuth2

$inbox = imap_open($hostname, $username, $password) or die('Erro ao conectar: ' . imap_last_error());

// Busca e-mails não lidos
$emails = imap_search($inbox, 'UNSEEN');

$assuntoFiltro = 'Zé Delivery - Código de acesso';

if ($emails) {
    rsort($emails);

    foreach ($emails as $email_number) {
        $overview = imap_fetch_overview($inbox, $email_number, 0)[0];
        $body = imap_fetchbody($inbox, $email_number, 1);

        // 1. Decodificar o assunto
        $assuntoParts = imap_mime_header_decode($overview->subject);
        $assuntoDecodificado = '';
        foreach ($assuntoParts as $part) {
            $assuntoDecodificado .= $part->text;
        }

        // 2. Verificar se o assunto contém "Zé Delivery - Código de acesso"
        if (stripos($assuntoDecodificado, $assuntoFiltro) !== false) {
            // 3. Decodificar o corpo, se necessário
            $bodyDecoded = quoted_printable_decode($body);

            // 4. Extrair o código de verificação (6 dígitos)
            preg_match('/\b\d{6}\b/', $bodyDecoded, $matches);
            $codigoAcesso = $matches[0] ?? 'Não encontrado';

            echo json_encode(['codigo' => $codigoAcesso]);
            break;
        }
    }
} else {
    echo json_encode(['codigo' => 0]);
}

imap_close($inbox);
