<?php
declare(strict_types=1);
require_once __DIR__ . '/../servicios/fabricacion_crear_botas.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    header('Allow: POST');
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Utiliza POST.']);
    exit;
}
try {
    $datos = json_decode(file_get_contents('php://input'), true, 512, JSON_THROW_ON_ERROR);
    if (!is_array($datos)) throw new InvalidArgumentException('Petición no válida.');
    echo json_encode(crearBotasFabricacion(fabricacionPdo(), $datos), JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
} catch (Throwable $error) {
    $validacion = $error instanceof InvalidArgumentException || $error instanceof JsonException;
    http_response_code($validacion ? 400 : 500);
    registrarLogPhp('[fabricacion PHP] ' . $error->getMessage());
    echo json_encode(['ok' => false, 'error' => $validacion ? $error->getMessage() : 'No se pudo completar la fabricación. No se ha confirmado la operación.'], JSON_UNESCAPED_UNICODE);
}
