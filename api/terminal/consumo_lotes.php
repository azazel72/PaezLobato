<?php
declare(strict_types=1);
require_once __DIR__ . '/../servicios/consumo_lotes.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
try {
    $metodo = $_SERVER['REQUEST_METHOD'] ?? '';
    if ($metodo === 'GET') $resultado = listarLotesConsumo(fabricacionPdo());
    elseif ($metodo === 'POST') {
        $datos = json_decode(file_get_contents('php://input'), true, 512, JSON_THROW_ON_ERROR);
        if (!is_array($datos)) throw new InvalidArgumentException('Petición no válida.');
        $resultado = registrarConsumoLotes(fabricacionPdo(), $datos);
    } else {
        header('Allow: GET, POST');
        http_response_code(405);
        $resultado = ['ok' => false, 'error' => 'Utiliza GET o POST.'];
    }
    echo json_encode($resultado, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
} catch (Throwable $error) {
    $esperado = $error instanceof InvalidArgumentException || $error instanceof JsonException;
    http_response_code($esperado ? 400 : 500);
registrarLogPhp('[consumo lotes PHP] ' . $error->getMessage());
    echo json_encode(['ok' => false, 'error' => $esperado ? $error->getMessage() : 'No se pudo completar el consumo de lotes.'], JSON_UNESCAPED_UNICODE);
}
