<?php
declare(strict_types=1);
require_once __DIR__ . '/lib/flejes_db.php';
require_once __DIR__ . '/lib/php_log.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
try {
    $metodo = $_SERVER['REQUEST_METHOD'] ?? '';
    if ($metodo === 'GET') {
        $respuesta = ['ok' => true, 'inventario_flejes' => listarEntradasFlejes(fabricacionPdo())];
    } elseif ($metodo === 'POST') {
        $datos = json_decode(file_get_contents('php://input'), true, 512, JSON_THROW_ON_ERROR);
        $id = filter_var($datos['id'] ?? null, FILTER_VALIDATE_INT);
        $estado = filter_var($datos['estado'] ?? null, FILTER_VALIDATE_INT);
        if ($id === false || $estado === false || is_bool($datos['id'] ?? null) || is_bool($datos['estado'] ?? null)) {
            throw new InvalidArgumentException('Entrada o estado de fleje no válidos.');
        }
        $respuesta = seleccionarEntradaFleje(fabricacionPdo(), $id, $estado);
    } else {
        header('Allow: GET, POST');
        http_response_code(405);
        echo json_encode(['ok' => false, 'error' => 'Utiliza GET o POST.']);
        exit;
    }
    echo json_encode($respuesta, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
} catch (Throwable $error) {
    $validacion = $error instanceof InvalidArgumentException || $error instanceof JsonException;
    http_response_code($validacion ? 400 : 500);
    registrarLogPhp('[flejes PHP] ' . $error->getMessage());
    echo json_encode(['ok' => false, 'error' => $validacion ? $error->getMessage() : 'No se pudo completar la operación de flejes.'], JSON_UNESCAPED_UNICODE);
}
