<?php
declare(strict_types=1);
require_once __DIR__ . '/cierre_semanal_lotes.php';
require_once __DIR__ . '/lib/fabricacion_db.php';
require_once __DIR__ . '/lib/php_log.php';

function listarLotesConsumo(PDO $pdo): array
{
    return ['ok' => true,
        'stock' => fabricacionProcedimientoFilas($pdo, 'pa_obtener_lotes_consumo_stock'),
        'botas' => fabricacionProcedimientoFilas($pdo, 'pa_obtener_lotes_consumo_botas'),
        'fondos' => fabricacionProcedimientoFilas($pdo, 'pa_obtener_lotes_consumo_fondos'),
        'cubicajes' => fabricacionProcedimientoFilas($pdo, 'pa_obtener_cubicajes_consumo'),
    ];
}

function registrarConsumoLotes(PDO $pdo, array $datos): array
{
    $destino = $datos['destino'] ?? '';
    if (!in_array($destino, ['botas', 'fondos'], true)) throw new InvalidArgumentException('Destino no válido.');
    $origenId = idCierreLotes($datos['origen_id'] ?? null);
    $cantidad = unidadesCierreLotes($datos['cubicaje'] ?? null);
    $paquetes = filter_var($datos['paquetes'] ?? 1, FILTER_VALIDATE_INT);
    if (!$paquetes || $paquetes < 1 || $cantidad <= 0 || $paquetes > intdiv(9999999999, $cantidad)) throw new InvalidArgumentException('Cubicaje o paquetes no válidos.');
    $cantidad *= $paquetes;
    $codigo = $datos['codigo_destino'] ?? '';
    if (!is_string($codigo) || trim($codigo) === '' || mb_strlen(trim($codigo)) > 60) throw new InvalidArgumentException('Indica el nombre del lote destino (máximo 60 caracteres).');
    $codigo = trim($codigo);
    $pdo->beginTransaction();
    try {
        $consulta = $pdo->prepare("SELECT * FROM a_lotes WHERE id = ? AND objetivo IN ('STOCK','ALMACENADO') AND estado < 2 AND is_deleted = 0 FOR UPDATE");
        $consulta->execute([$origenId]);
        $origen = $consulta->fetch(PDO::FETCH_ASSOC);
        if (!$origen) throw new InvalidArgumentException('El lote de origen no está disponible.');
        $consumido = unidadesCierreLotes($origen['consumido']) + $cantidad;
        if ($consumido > unidadesCierreLotes($origen['cubicaje'])) throw new InvalidArgumentException('La cantidad supera el restante del lote de stock.');
        $objetivoDestino = $destino === 'botas' ? 'BOTAS' : 'FONDOS';
        $buscar = $pdo->prepare('SELECT * FROM a_lotes WHERE objetivo = ? AND codigo = ? AND estado < 2 AND is_deleted = 0 FOR UPDATE');
        $buscar->execute([$objetivoDestino, $codigo]);
        $lote = $buscar->fetch(PDO::FETCH_ASSOC);
        if (!$lote && $destino === 'botas') {
            $crear = $pdo->prepare("INSERT INTO a_lotes (codigo, objetivo, linea_entrada_id, tipo_producto_id, material_id, cubicaje, estado, ubicacion_id)
                VALUES (?, 'BOTAS', ?, ?, ?, 0, 0, ?)");
            $crear->execute([$codigo, $origen['linea_entrada_id'], $origen['tipo_producto_id'], $origen['material_id'], $origen['ubicacion_id']]);
            $buscar->execute([$objetivoDestino, $codigo]);
            $lote = $buscar->fetch(PDO::FETCH_ASSOC);
        }
        if (!$lote) throw new InvalidArgumentException('Selecciona un lote de destino disponible y activo.');
        $cubicaje = unidadesCierreLotes($lote['cubicaje']) + $cantidad;
        if ($cubicaje > 9999999999) throw new InvalidArgumentException('El cubicaje del destino supera el límite permitido.');
        $pdo->prepare('UPDATE a_lotes SET consumido = ? WHERE id = ?')->execute([decimalCierreLotes($consumido), $origenId]);
        $pdo->prepare('UPDATE a_lotes SET cubicaje = ? WHERE id = ?')->execute([decimalCierreLotes($cubicaje), $lote['id']]);
        $pdo->prepare("INSERT INTO a_movimientos (origen_id, situacion_origen, destino_id, situacion_destino, cantidad) VALUES (?, ?, ?, ?, ?)")
            ->execute([$origenId, strtolower($origen['objetivo']), $lote['id'], $destino, decimalCierreLotes($cantidad)]);
        $pdo->commit();
        return ['ok' => true, 'destino_id' => (int)$lote['id'], 'cantidad' => decimalCierreLotes($cantidad)];
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
}

if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) {
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
}
