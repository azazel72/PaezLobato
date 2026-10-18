<?php
declare(strict_types=1);
require_once __DIR__ . '/../lib/database.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

try {
    $lotes = fabricacionProcedimientoFilas(fabricacionPdo(), 'pa_obtener_lotes_fondos');

    echo json_encode([
        'ok' => true,
        'lotes' => $lotes,
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
} catch (Throwable $error) {
    http_response_code(500);
    echo json_encode([
        'ok' => false,
        'error' => 'No se pudieron cargar los lotes de fondos.',
    ], JSON_UNESCAPED_UNICODE);
}
