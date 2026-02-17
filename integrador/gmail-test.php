<?php
/**
 * Script de teste do Gmail OAuth
 */

header('Content-Type: application/json');

$GMAIL_CONFIG = [
    'client_id'     => '471842038254-rp7fom0ns0vg9b15r4dp5llr8itp429s.apps.googleusercontent.com',
    'client_secret' => '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',
    'refresh_token' => '1//04mAHWQbx3-2dCgYIARAAGAQSNwF-L9Irjiziq8dxstUmEkfrtTNJobJUJ3jMjiK_GSpJeGb5YeyFjUdO55BfBWSZ_C3gz3J7_Ng',
    'token_url'     => 'https://oauth2.googleapis.com/token',
    'gmail_api_url' => 'https://gmail.googleapis.com/gmail/v1/users/me'
];

// Testar obtenção de access_token
$postData = [
    'client_id'     => $GMAIL_CONFIG['client_id'],
    'client_secret' => $GMAIL_CONFIG['client_secret'],
    'refresh_token' => $GMAIL_CONFIG['refresh_token'],
    'grant_type'    => 'refresh_token'
];

$ch = curl_init($GMAIL_CONFIG['token_url']);
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

$result = [
    'step' => 'get_access_token',
    'http_code' => $httpCode,
    'curl_error' => $curlError ?: null
];

if ($httpCode !== 200) {
    $result['status'] = 'ERROR';
    $result['response'] = json_decode($response, true);
    echo json_encode($result, JSON_PRETTY_PRINT);
    exit(1);
}

$tokenData = json_decode($response, true);
$accessToken = $tokenData['access_token'] ?? null;

if (!$accessToken) {
    $result['status'] = 'ERROR';
    $result['message'] = 'No access_token in response';
    $result['response'] = $tokenData;
    echo json_encode($result, JSON_PRETTY_PRINT);
    exit(1);
}

$result['status'] = 'OK';
$result['access_token'] = substr($accessToken, 0, 20) . '...';

// Testar listagem de emails
$query = urlencode('from:nao-responda@ze.delivery subject:"Seu código de verificação" newer_than:1h');
$url = $GMAIL_CONFIG['gmail_api_url'] . "/messages?q={$query}&maxResults=5";

$ch = curl_init($url);
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER     => [
        "Authorization: Bearer {$accessToken}",
        'Accept: application/json'
    ],
    CURLOPT_TIMEOUT        => 15
]);

$messagesResponse = curl_exec($ch);
$messagesHttpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

$result['emails_step'] = [
    'http_code' => $messagesHttpCode,
    'query' => 'from:nao-responda@ze.delivery subject:"Seu código de verificação" newer_than:1h'
];

if ($messagesHttpCode === 200) {
    $messagesData = json_decode($messagesResponse, true);
    $result['emails_step']['status'] = 'OK';
    $result['emails_step']['messages_found'] = isset($messagesData['messages']) ? count($messagesData['messages']) : 0;
    $result['emails_step']['result_size_estimate'] = $messagesData['resultSizeEstimate'] ?? 0;
} else {
    $result['emails_step']['status'] = 'ERROR';
    $result['emails_step']['response'] = json_decode($messagesResponse, true);
}

echo json_encode($result, JSON_PRETTY_PRINT);
