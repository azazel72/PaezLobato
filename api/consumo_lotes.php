<?php
declare(strict_types=1);
require_once __DIR__ . '/cierre_semanal_lotes.php';

function listarLotesConsumo(PDO $pdo): array
{
    $leer = static function (string $tabla, string $filtro) use ($pdo): array {
        return $pdo->query("SELECT l.*, tp.descripcion AS tipo_descripcion, m.descripcion AS material_descripcion, u.descripcion AS ubicacion_descripcion
            FROM $tabla l LEFT JOIN tipos_producto tp ON tp.id = l.tipo_producto_id
            LEFT JOIN materiales m ON m.id = l.material_id
            LEFT JOIN ubicaciones u ON u.id = l.ubicacion_id
            WHERE l.is_deleted = 0 $filtro ORDER BY l.codigo")->fetchAll(PDO::FETCH_ASSOC);
    };
    return ['ok' => true,
        'stock' => $leer('a_lotes_stock', 'AND l.cubicaje > l.consumido'),
        'botas' => $leer('a_lotes_botas', 'AND l.estado < 2'),
        'fondos' => $leer('a_lotes_fondos', 'AND l.estado < 2'),
        'cubicajes' => $pdo->query('SELECT tipo_producto_id, cubicaje_estandar FROM cubicaje ORDER BY tipo_producto_id')->fetchAll(PDO::FETCH_ASSOC),
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
    $tabla = $destino === 'botas' ? 'a_lotes_botas' : 'a_lotes_fondos';
    $pdo->beginTransaction();
    try {
        $consulta = $pdo->prepare('SELECT * FROM a_lotes_stock WHERE id = ? FOR UPDATE');
        $consulta->execute([$origenId]);
        $origen = $consulta->fetch(PDO::FETCH_ASSOC);
        if (!$origen || $origen['is_deleted']) throw new InvalidArgumentException('El lote de stock no está disponible.');
        $consumido = unidadesCierreLotes($origen['consumido']) + $cantidad;
        if ($consumido > unidadesCierreLotes($origen['cubicaje'])) throw new InvalidArgumentException('La cantidad supera el restante del lote de stock.');
        if ($destino === 'botas') {
            // La clave única de código evita crear lotes duplicados incluso con peticiones simultáneas.
            $crear = $pdo->prepare("INSERT INTO a_lotes_botas (codigo, linea_entrada_id, tipo_producto_id, material_id, cubicaje, estado, ubicacion_id)
                VALUES (?, ?, ?, ?, 0, 0, ?) ON DUPLICATE KEY UPDATE id = id");
            $crear->execute([$codigo, $origen['linea_entrada_id'], $origen['tipo_producto_id'], $origen['material_id'], $origen['ubicacion_id']]);
        }
        $buscar = $pdo->prepare("SELECT * FROM $tabla WHERE codigo = ? FOR UPDATE");
        $buscar->execute([$codigo]);
        $lote = $buscar->fetch(PDO::FETCH_ASSOC);
        if (!$lote || $lote['is_deleted'] || ($destino === 'fondos' && ($lote['estado'] === null || (int)$lote['estado'] >= 2))) throw new InvalidArgumentException('Selecciona un lote de destino disponible y activo para fondos.');
        $cubicaje = unidadesCierreLotes($lote['cubicaje']) + $cantidad;
        if ($cubicaje > 9999999999) throw new InvalidArgumentException('El cubicaje del destino supera el límite permitido.');
        $pdo->prepare('UPDATE a_lotes_stock SET consumido = ? WHERE id = ?')->execute([decimalCierreLotes($consumido), $origenId]);
        $pdo->prepare("UPDATE $tabla SET cubicaje = ? WHERE id = ?")->execute([decimalCierreLotes($cubicaje), $lote['id']]);
        $pdo->prepare("INSERT INTO a_movimientos (origen_id, situacion_origen, destino_id, situacion_destino, cantidad) VALUES (?, 'stock', ?, ?, ?)")
            ->execute([$origenId, $lote['id'], $destino, decimalCierreLotes($cantidad)]);
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
        error_log('[consumo lotes PHP] ' . $error->getMessage());
        echo json_encode(['ok' => false, 'error' => $esperado ? $error->getMessage() : 'No se pudo completar el consumo de lotes.'], JSON_UNESCAPED_UNICODE);
    }
}
