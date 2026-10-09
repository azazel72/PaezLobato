<?php
declare(strict_types=1);
require_once __DIR__ . '/lib/fabricacion_db.php';
require_once __DIR__ . '/lib/php_log.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    header('Allow: GET');
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Utiliza GET.'], JSON_UNESCAPED_UNICODE);
    exit;
}

try {
    $pdo = fabricacionPdo();
    $ubicaciones = $pdo->query('SELECT id, descripcion FROM ubicaciones ORDER BY orden, id')->fetchAll(PDO::FETCH_ASSOC);
    $lotes = $pdo->query("SELECT codigo, ubicacion_id FROM a_lotes
        WHERE objetivo = 'ALMACENADO' AND estado < 2 AND is_deleted = 0
        ORDER BY ubicacion_id, codigo")->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode(['ok' => true, 'ubicaciones' => $ubicaciones, 'lotes' => $lotes], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
} catch (Throwable $error) {
    http_response_code(500);
    registrarLogPhp('[opciones procesado PHP] ' . $error->getMessage());
    echo json_encode(['ok' => false, 'error' => 'No se pudieron cargar las opciones de procesado.'], JSON_UNESCAPED_UNICODE);
}
