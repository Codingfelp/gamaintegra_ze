<?php
/**
 * Script de teste de conexao com o banco de dados
 * Acesse via: /api/debug/db-test
 */

header('Content-Type: application/json');

// Carregar configuracao
$Host = getenv('MYSQL_HOST') ?: 'mainline.proxy.rlwy.net';
$User = getenv('MYSQL_USER') ?: 'root';
$Pass = getenv('MYSQL_PASSWORD') ?: 'eHeoVCebYyaJVBEBtCLfYNHgRCrxWVXU';
$Dbsa = getenv('MYSQL_DATABASE') ?: 'railway';
$Port = getenv('MYSQL_PORT') ?: '52996';

$result = [
    'timestamp' => date('Y-m-d H:i:s'),
    'config' => [
        'host' => $Host,
        'user' => $User,
        'database' => $Dbsa,
        'port' => $Port,
        'password' => '***' . substr($Pass, -4)
    ]
];

// Testar conexao
$conn = @mysqli_connect($Host, $User, $Pass, $Dbsa, $Port);

if (!$conn) {
    $result['status'] = 'ERROR';
    $result['error'] = mysqli_connect_error();
    $result['errno'] = mysqli_connect_errno();
    echo json_encode($result, JSON_PRETTY_PRINT);
    exit;
}

$result['status'] = 'CONNECTED';
$result['server_info'] = mysqli_get_server_info($conn);

// Listar tabelas
$tables_query = mysqli_query($conn, "SHOW TABLES");
$tables = [];
while ($row = mysqli_fetch_array($tables_query)) {
    $tables[] = $row[0];
}
$result['tables'] = $tables;
$result['table_count'] = count($tables);

// Verificar tabelas importantes
$important_tables = ['ze_pedido', 'delivery', 'ze_pedido_itens'];
$missing_tables = [];
foreach ($important_tables as $table) {
    if (!in_array($table, $tables)) {
        $missing_tables[] = $table;
    }
}
$result['missing_important_tables'] = $missing_tables;

// Testar query em ze_pedido
if (in_array('ze_pedido', $tables)) {
    $count_query = mysqli_query($conn, "SELECT COUNT(*) as total FROM ze_pedido");
    if ($count_query) {
        $row = mysqli_fetch_assoc($count_query);
        $result['ze_pedido_count'] = $row['total'];
    }
}

// Testar query em delivery
if (in_array('delivery', $tables)) {
    $count_query = mysqli_query($conn, "SELECT COUNT(*) as total FROM delivery");
    if ($count_query) {
        $row = mysqli_fetch_assoc($count_query);
        $result['delivery_count'] = $row['total'];
    }
}

mysqli_close($conn);

echo json_encode($result, JSON_PRETTY_PRINT);
