<?php
declare(strict_types=1);
require_once __DIR__ . '/../servicios/cierre_semanal_lotes.php';

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
    echo json_encode(confirmarCambiosLotesCierre(fabricacionPdo(), $datos), JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
} catch (Throwable $error) {
    $esperado = $error instanceof InvalidArgumentException || $error instanceof JsonException || $error instanceof ConflictoLotesCierre;
    http_response_code($error instanceof ConflictoLotesCierre ? 409 : ($esperado ? 400 : 500));
    registrarLogPhp('[cierre semanal PHP] ' . $error->getMessage());
    echo json_encode(['ok' => false, 'error' => $esperado ? $error->getMessage() : 'No se pudieron confirmar los cambios de lotes.'], JSON_UNESCAPED_UNICODE);
}
