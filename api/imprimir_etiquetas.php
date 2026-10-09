<?php
declare(strict_types=1);

// Endpoint independiente. No está enlazado a ninguna vista todavía.
// PHP valida la lista; cuando se conecte al flujo, el cliente enviará estos
// códigos por WebSocket al servidor Python, que conserva la plantilla ZPL.
require_once __DIR__ . '/lib/fabricacion_db.php';
require_once __DIR__ . '/lib/php_log.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function listaCodigosEtiqueta(array $datos): array
{
    $codigos = $datos['codigos'] ?? null;
    if (!is_array($codigos) || !$codigos) {
        throw new InvalidArgumentException('Debes indicar una lista de códigos.');
    }
    if (count($codigos) > 500) {
        throw new InvalidArgumentException('No se pueden solicitar más de 500 etiquetas en una petición.');
    }

    $resultado = [];
    foreach ($codigos as $codigo) {
        if (!is_string($codigo)) {
            throw new InvalidArgumentException('Todos los códigos deben ser texto.');
        }
        $codigo = trim($codigo);
        if ($codigo === '' || mb_strlen($codigo, 'UTF-8') > 60) {
            throw new InvalidArgumentException('La lista contiene un código no válido.');
        }
        // Se conserva cada aparición: una aparición equivale a una etiqueta.
        $resultado[] = $codigo;
    }
    return $resultado;
}

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
    $codigos = listaCodigosEtiqueta($datos);

    $pdo = fabricacionPdo();
    $marcadores = implode(',', array_fill(0, count($codigos), '?'));
    $consulta = $pdo->prepare("SELECT codigo FROM productos
        WHERE tipo = 'BOTA' AND is_deleted = 0 AND codigo IN ($marcadores)");
    $consulta->execute($codigos);
    $existentes = array_fill_keys($consulta->fetchAll(PDO::FETCH_COLUMN), true);
    $faltantes = array_values(array_unique(array_filter(
        $codigos,
        static fn(string $codigo): bool => !isset($existentes[$codigo])
    )));
    if ($faltantes) {
        throw new InvalidArgumentException(
            'No existen estas botas: ' . implode(', ', $faltantes)
        );
    }

    echo json_encode([
        'ok' => true,
        'codigos' => $codigos,
        'cantidad' => count($codigos),
        'impresion' => 'pendiente_socket',
    ], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
} catch (Throwable $error) {
    $validacion = $error instanceof InvalidArgumentException || $error instanceof JsonException;
    http_response_code($validacion ? 400 : 500);
    registrarLogPhp('[imprimir etiquetas PHP] ' . $error->getMessage());
    echo json_encode([
        'ok' => false,
        'error' => $validacion ? $error->getMessage() : 'No se pudo preparar la impresión.',
    ], JSON_UNESCAPED_UNICODE);
}
