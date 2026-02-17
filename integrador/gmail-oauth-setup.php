<?php
/**
 * Script para gerar refresh_token do Gmail OAuth
 * 
 * PASSO 1: Execute este script no navegador para obter o authorization code
 * PASSO 2: Cole o code e execute novamente para obter o refresh_token
 */

$CLIENT_ID = '471842038254-rp7fom0ns0vg9b15r4dp5llr8itp429s.apps.googleusercontent.com';
$CLIENT_SECRET = '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';
$REDIRECT_URI = 'urn:ietf:wg:oauth:2.0:oob'; // Para aplicações desktop

// Scopes necessários para ler emails
$SCOPES = [
    'https://www.googleapis.com/auth/gmail.readonly'
];

header('Content-Type: text/html; charset=utf-8');

// Se recebeu o code, trocar por tokens
if (isset($_GET['code']) || isset($argv[1])) {
    $code = isset($_GET['code']) ? $_GET['code'] : $argv[1];
    
    $postData = [
        'client_id' => $CLIENT_ID,
        'client_secret' => $CLIENT_SECRET,
        'code' => $code,
        'grant_type' => 'authorization_code',
        'redirect_uri' => $REDIRECT_URI
    ];
    
    $ch = curl_init('https://oauth2.googleapis.com/token');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => http_build_query($postData),
        CURLOPT_HTTPHEADER => ['Content-Type: application/x-www-form-urlencoded']
    ]);
    
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    
    $data = json_decode($response, true);
    
    if ($httpCode == 200 && isset($data['refresh_token'])) {
        echo "<h2>✅ SUCESSO!</h2>";
        echo "<p><strong>refresh_token:</strong></p>";
        echo "<pre style='background:#f0f0f0;padding:10px;'>" . htmlspecialchars($data['refresh_token']) . "</pre>";
        echo "<p>Cole este refresh_token no arquivo <code>ze_pedido_mail.php</code></p>";
        
        // Também mostrar access_token
        echo "<p><strong>access_token (válido por 1 hora):</strong></p>";
        echo "<pre style='background:#f0f0f0;padding:10px;font-size:10px;'>" . htmlspecialchars($data['access_token']) . "</pre>";
    } else {
        echo "<h2>❌ ERRO</h2>";
        echo "<pre>" . htmlspecialchars($response) . "</pre>";
    }
    exit;
}

// Gerar URL de autorização
$authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' . http_build_query([
    'client_id' => $CLIENT_ID,
    'redirect_uri' => $REDIRECT_URI,
    'response_type' => 'code',
    'scope' => implode(' ', $SCOPES),
    'access_type' => 'offline',
    'prompt' => 'consent' // Força a exibição do consent para garantir refresh_token
]);

?>
<!DOCTYPE html>
<html>
<head>
    <title>Gmail OAuth Setup</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
        .step { background: #f5f5f5; padding: 20px; margin: 20px 0; border-radius: 8px; }
        code { background: #e0e0e0; padding: 2px 6px; border-radius: 4px; }
        a.button { display: inline-block; padding: 15px 30px; background: #4285f4; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; }
        a.button:hover { background: #3367d6; }
        input[type="text"] { width: 100%; padding: 10px; font-size: 14px; }
    </style>
</head>
<body>
    <h1>🔐 Gmail OAuth Setup</h1>
    
    <div class="step">
        <h3>Passo 1: Autorizar acesso ao Gmail</h3>
        <p>Clique no botão abaixo para autorizar o acesso à conta <strong>gamataurize@gmail.com</strong>:</p>
        <p><a class="button" href="<?= htmlspecialchars($authUrl) ?>" target="_blank">Autorizar Gmail</a></p>
        <p><small>Certifique-se de estar logado com a conta correta antes de clicar.</small></p>
    </div>
    
    <div class="step">
        <h3>Passo 2: Colar o código de autorização</h3>
        <p>Após autorizar, você receberá um código. Cole-o aqui:</p>
        <form method="GET">
            <input type="text" name="code" placeholder="Cole o código de autorização aqui..." required>
            <br><br>
            <button type="submit" style="padding: 10px 20px; cursor: pointer;">Obter refresh_token</button>
        </form>
    </div>
    
    <div class="step">
        <h3>📋 Informações da Aplicação</h3>
        <p><strong>Client ID:</strong> <code><?= htmlspecialchars($CLIENT_ID) ?></code></p>
        <p><strong>Scopes:</strong> <code><?= htmlspecialchars(implode(', ', $SCOPES)) ?></code></p>
    </div>
</body>
</html>
