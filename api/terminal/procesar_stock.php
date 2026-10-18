<?php
declare(strict_types=1);
require_once __DIR__ . '/../servicios/procesar_stock.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
try {
    $metodo = $_SERVER['REQUEST_METHOD'] ?? '';
    if ($metodo === 'GET') $resultado = listarStockProcesar(fabricacionPdo());
    elseif ($metodo === 'POST') {
        $datos = json_decode(file_get_contents('php://input'), true, 512, JSON_THROW_ON_ERROR);
        if (!is_array($datos)) throw new InvalidArgumentException('Petición no válida.');
        $resultado = procesarStockPhp(fabricacionPdo(), $datos);
    } else {
        header('Allow: GET, POST');
        http_response_code(405);
        $resultado = ['ok' => false, 'error' => 'Utiliza GET o POST.'];
    }
    echo json_encode($resultado, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
} catch (Throwable $error) {
    $validacion = $error instanceof InvalidArgumentException || $error instanceof JsonException;
    http_response_code($validacion ? 400 : 500);
    registrarLogPhp('[procesar stock PHP] ' . $error->getMessage());
    echo json_encode(['ok' => false, 'error' => $validacion ? $error->getMessage() : 'No se pudo procesar el stock.'], JSON_UNESCAPED_UNICODE);
}
