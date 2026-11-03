<?php
declare(strict_types=1);

// Endpoint independiente: no se conecta a la interfaz todavía.
require_once __DIR__ . '/../servicios/imprimir_etiquetas.php';
require_once __DIR__ . '/../lib/php_log.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Utiliza POST.'], JSON_UNESCAPED_UNICODE);
    exit;
}

try {
    $datos = json_decode(file_get_contents('php://input'), true, 512, JSON_THROW_ON_ERROR);
    if (!is_array($datos)) {
        throw new InvalidArgumentException('Petición no válida.');
    }
    echo json_encode(imprimirEtiquetasBotas(fabricacionPdo(), $datos), JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
} catch (Throwable $error) {
    $validacion = $error instanceof InvalidArgumentException || $error instanceof JsonException;
    http_response_code($validacion ? 400 : 500);
    registrarLogPhp('[imprimir etiquetas PHP] ' . $error->getMessage());
    echo json_encode([
        'ok' => false,
        'error' => $validacion ? $error->getMessage() : 'No se pudo confirmar el envío a la impresora. Algunas etiquetas pueden haberse enviado; compruébalo antes de reintentar.',
    ], JSON_UNESCAPED_UNICODE);
}
