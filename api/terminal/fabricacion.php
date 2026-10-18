<?php
declare(strict_types=1);
require_once __DIR__ . '/../lib/database.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

try {
    $fabricaciones = fabricacionProcedimientoFilas(fabricacionPdo(), 'pa_obtener_fabricaciones_semanales_activas');

    echo json_encode([
        'ok' => true,
        'fabricaciones' => $fabricaciones,
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
} catch (Throwable $error) {
    http_response_code(500);
    echo json_encode([
        'ok' => false,
        'error' => 'No se pudo cargar la información de fabricación.',
    ], JSON_UNESCAPED_UNICODE);
}
