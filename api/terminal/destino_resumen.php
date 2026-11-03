<?php
declare(strict_types=1);
require_once __DIR__ . '/../servicios/destino_resumen.php';
require_once __DIR__ . '/../lib/php_log.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
    header('Allow: GET'); http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Utiliza GET.']); exit;
}
try { echo json_encode(listarResumenDestino(fabricacionPdo()), JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR); }
catch (Throwable $error) {
    registrarLogPhp('[resumen destino PHP] ' . $error->getMessage()); http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'No se pudo cargar el resumen de destino.']);
}
