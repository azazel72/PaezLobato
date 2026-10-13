<?php
declare(strict_types=1);
require_once __DIR__ . '/cierre_semanal_lotes.php';

function nombreDestinoProcesarStock(string $codigo): string
{
    return $codigo;
}

function listarStockProcesar(PDO $pdo): array
{
    $tipos = $pdo->query("SELECT id FROM tipos_producto WHERE UPPER(tipo) = 'DUELA'")->fetchAll(PDO::FETCH_COLUMN);
    $stock = array_values(array_filter(fabricacionProcedimientoFilas($pdo, 'pa_obtener_lotes_consumo_stock'),
        fn($lote) => in_array($lote['objetivo'], ['STOCK', 'ALMACENADO'], true) && in_array($lote['tipo_producto_id'], $tipos)
            && unidadesCierreLotes($lote['cubicaje']) > unidadesCierreLotes($lote['consumido'])));
    foreach ($stock as &$lote) $lote['codigo_destino'] = nombreDestinoProcesarStock($lote['codigo']);
    unset($lote);
    return ['ok' => true, 'stock' => $stock,
        'cubicajes' => fabricacionProcedimientoFilas($pdo, 'pa_obtener_cubicajes_consumo')];
}

function procesarStockPhp(PDO $pdo, array $datos): array
{
    $origenId = idCierreLotes($datos['origen_id'] ?? null);
    $ubicacionId = idCierreLotes($datos['ubicacion_id'] ?? null);
    $cantidad = unidadesCierreLotes($datos['cubicaje'] ?? null);
    $paquetes = is_bool($datos['paquetes'] ?? null) ? false : filter_var($datos['paquetes'] ?? 1, FILTER_VALIDATE_INT);
    if (!$paquetes || $paquetes < 1 || $cantidad <= 0 || $paquetes > intdiv(9999999999, $cantidad)) {
        throw new InvalidArgumentException('Cubicaje o paquetes no válidos.');
    }
    $cantidad *= $paquetes;
    $codigo = $datos['codigo_destino'] ?? '';
    if (!is_string($codigo) || trim($codigo) === '' || mb_strlen(trim($codigo)) > 60) {
        throw new InvalidArgumentException('Indica el nombre del lote destino (máximo 60 caracteres).');
    }
    $codigo = trim($codigo);
    $bloqueo = 'procesar_stock_' . substr(hash('sha256', $ubicacionId . ':' . mb_strtolower($codigo)), 0, 40);
    $lock = $pdo->prepare('SELECT GET_LOCK(?, 10)');
    $lock->execute([$bloqueo]);
    if ((int)$lock->fetchColumn() !== 1) throw new RuntimeException('Hay otro procesado en curso. Inténtalo de nuevo.');
    try {
        $pdo->beginTransaction();
        $validarUbicacion = $pdo->prepare("SELECT u.id FROM ubicaciones u JOIN instalaciones i ON i.id = u.instalacion_id
            WHERE u.id = ? AND (UPPER(TRIM(i.nombre)) = 'M' OR UPPER(TRIM(i.tipo)) = 'M')");
        $validarUbicacion->execute([$ubicacionId]);
        if (!$validarUbicacion->fetchColumn()) throw new InvalidArgumentException('Selecciona una ubicación de una instalación de madera (M).');
        $consulta = $pdo->prepare("SELECT l.*, (l.codigo = ?) AS mismo_nombre FROM a_lotes l JOIN tipos_producto tp ON tp.id = l.tipo_producto_id
            WHERE l.id = ? AND l.objetivo IN ('STOCK', 'ALMACENADO') AND l.estado < 2 AND l.is_deleted = 0 AND UPPER(tp.tipo) = 'DUELA' FOR UPDATE");
        $consulta->execute([$codigo, $origenId]);
        $origen = $consulta->fetch(PDO::FETCH_ASSOC);
        if (!$origen) throw new InvalidArgumentException('El lote de origen no está disponible.');
        if ((int)$origen['ubicacion_id'] === $ubicacionId && (int)$origen['mismo_nombre'] === 1) {
            throw new InvalidArgumentException('El lote de destino es el mismo que el de origen: coinciden el nombre y la ubicación. Cambia el nombre o la ubicación de destino.');
        }
        $consumido = unidadesCierreLotes($origen['consumido']) + $cantidad;
        if ($consumido > unidadesCierreLotes($origen['cubicaje'])) throw new InvalidArgumentException('La cantidad supera el restante del lote de stock.');
        // Mismo criterio que el cierre semanal: nombre y ubicación, activo y ALMACENADO.
        $buscar = $pdo->prepare("SELECT * FROM a_lotes WHERE objetivo = 'ALMACENADO' AND codigo = ? AND ubicacion_id = ? AND estado < 2 AND is_deleted = 0 FOR UPDATE");
        $buscar->execute([$codigo, $ubicacionId]);
        $destino = $buscar->fetch(PDO::FETCH_ASSOC);
        if (!$destino) {
            $pdo->prepare("INSERT INTO a_lotes (codigo, objetivo, linea_entrada_id, tipo_producto_id, material_id, cubicaje, consumido, estado, ubicacion_id)
                VALUES (?, 'ALMACENADO', ?, ?, ?, 0, 0, 0, ?)")
                ->execute([$codigo, $origen['linea_entrada_id'], $origen['tipo_producto_id'], $origen['material_id'], $ubicacionId]);
            $buscar->execute([$codigo, $ubicacionId]);
            $destino = $buscar->fetch(PDO::FETCH_ASSOC);
        }
        $cubicaje = unidadesCierreLotes($destino['cubicaje']) + $cantidad;
        if ($cubicaje > 9999999999) throw new InvalidArgumentException('El lote de destino superaría el cubicaje permitido.');
        $pdo->prepare('UPDATE a_lotes SET consumido = ? WHERE id = ?')->execute([decimalCierreLotes($consumido), $origenId]);
        $pdo->prepare('UPDATE a_lotes SET cubicaje = ? WHERE id = ?')->execute([decimalCierreLotes($cubicaje), $destino['id']]);
        $pdo->prepare("INSERT INTO a_movimientos (origen_id, situacion_origen, destino_id, situacion_destino, cantidad)
            VALUES (?, ?, ?, 'almacenado', ?)")
            ->execute([$origenId, strtolower($origen['objetivo']), $destino['id'], decimalCierreLotes($cantidad)]);
        $pdo->commit();
        return ['ok' => true, 'destino_id' => (int)$destino['id'], 'codigo_destino' => $codigo, 'cantidad' => decimalCierreLotes($cantidad)];
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    } finally {
        $pdo->prepare('SELECT RELEASE_LOCK(?)')->execute([$bloqueo]);
    }
}

if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) {
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
}
