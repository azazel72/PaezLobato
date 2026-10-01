<?php
declare(strict_types=1);
require_once __DIR__ . '/lib/fabricacion_db.php';

class ConflictoLotesCierre extends RuntimeException {}

function unidadesCierreLotes($valor): int
{
    if (!is_string($valor) && !is_int($valor) && !is_float($valor)) {
        throw new InvalidArgumentException('Cantidad no válida.');
    }
    if (!preg_match('/^(\d{1,6})(?:\.(\d{1,4}))?$/D', (string) $valor, $partes)) {
        throw new InvalidArgumentException('La cantidad debe tener un máximo de cuatro decimales.');
    }
    return (int) $partes[1] * 10000 + (int) str_pad($partes[2] ?? '', 4, '0');
}

function decimalCierreLotes(int $unidades): string
{
    return intdiv($unidades, 10000) . '.' . str_pad((string) ($unidades % 10000), 4, '0', STR_PAD_LEFT);
}

function idCierreLotes($valor): int
{
    $id = is_bool($valor) ? false : filter_var($valor, FILTER_VALIDATE_INT);
    if ($id === false || $id < 1) throw new InvalidArgumentException('Lote no válido.');
    return $id;
}

function confirmarCambiosLotesCierre(PDO $pdo, array $datos): array
{
    $operaciones = $datos['operaciones'] ?? null;
    $originales = $datos['lotes_originales'] ?? null;
    if (!is_array($operaciones) || !$operaciones || !is_array($originales) || !$originales) {
        throw new InvalidArgumentException('No hay cambios de lotes para confirmar.');
    }
    $bases = [];
    foreach ($originales as $original) {
        if (!is_array($original)) throw new InvalidArgumentException('Lote original no válido.');
        $id = idCierreLotes($original['id'] ?? null);
        if (isset($bases[$id])) throw new InvalidArgumentException('Lote original duplicado.');
        $bases[$id] = [
            'cubicaje' => unidadesCierreLotes($original['cubicaje'] ?? null),
            'consumido' => unidadesCierreLotes($original['consumido'] ?? null),
        ];
    }
    $normalizadas = [];
    $ids = [];
    foreach ($operaciones as $op) {
        if (!is_array($op) || !in_array($op['tipo'] ?? '', ['consumo', 'procesado', 'desperdicio'], true)) throw new InvalidArgumentException('Acción de lote no válida.');
        $tipo = $op['tipo'];
        $origen = idCierreLotes($op['origen_id'] ?? null);
        $destino = $tipo === 'consumo' ? idCierreLotes($op['destino_id'] ?? null) : 0;
        $cantidad = unidadesCierreLotes($op['cantidad'] ?? null);
        $codigo = $op['codigo_destino'] ?? '';
        if (!is_string($codigo)) throw new InvalidArgumentException('Código de destino no válido.');
        $codigo = trim($codigo);
        if ($tipo === 'procesado' && ($codigo === '' || mb_strlen($codigo) > 60)) throw new InvalidArgumentException('Indica el nombre del lote de destino (máximo 60 caracteres).');
        if ($origen === $destino || $cantidad <= 0) throw new InvalidArgumentException('Selecciona lotes distintos y una cantidad mayor que cero.');
        if (!isset($bases[$origen]) || ($tipo === 'consumo' && !isset($bases[$destino]))) throw new InvalidArgumentException('Faltan los valores originales de los lotes.');
        $normalizadas[] = compact('tipo', 'origen', 'destino', 'cantidad', 'codigo');
        $ids[$origen] = $origen;
        if ($tipo === 'consumo') $ids[$destino] = $destino;
    }
    sort($ids, SORT_NUMERIC);
    $pdo->beginTransaction();
    try {
        $marcas = implode(',', array_fill(0, count($ids), '?'));
        $consulta = $pdo->prepare("SELECT * FROM a_lotes_botas WHERE id IN ($marcas) ORDER BY id FOR UPDATE");
        $consulta->execute($ids);
        $lotes = [];
        foreach ($consulta->fetchAll(PDO::FETCH_ASSOC) as $lote) {
            $id = (int) $lote['id'];
            if (unidadesCierreLotes($lote['cubicaje']) !== $bases[$id]['cubicaje'] || unidadesCierreLotes($lote['consumido']) !== $bases[$id]['consumido']) {
                throw new ConflictoLotesCierre('Los lotes han cambiado desde que abriste la vista. Restablece los cambios y vuelve a entrar para recargar los datos.');
            }
            $lotes[$id] = $lote;
        }
        if (count($lotes) !== count($ids)) throw new ConflictoLotesCierre('Alguno de los lotes ya no existe. Recarga la vista.');

        // Reproducir y validar todo el borrador antes de escribir.
        foreach ($normalizadas as $op) {
            $origen = $op['origen'];
            $destino = $op['destino'];
            $cantidad = $op['cantidad'];
            $consumoOrigen = unidadesCierreLotes($lotes[$origen]['consumido']);
            if ($op['tipo'] !== 'consumo') {
                if ($consumoOrigen + $cantidad > unidadesCierreLotes($lotes[$origen]['cubicaje'])) throw new InvalidArgumentException('La cantidad supera el restante del lote.');
                $lotes[$origen]['consumido'] = decimalCierreLotes($consumoOrigen + $cantidad);
                continue;
            }
            $consumoDestino = unidadesCierreLotes($lotes[$destino]['consumido']);
            if ($cantidad > $consumoOrigen) throw new InvalidArgumentException('No puedes quitar más consumo del registrado en el lote de origen.');
            if ($consumoDestino + $cantidad > unidadesCierreLotes($lotes[$destino]['cubicaje'])) {
                throw new InvalidArgumentException('El consumo dejaría el restante del lote receptor en negativo.');
            }
            $lotes[$origen]['consumido'] = decimalCierreLotes($consumoOrigen - $cantidad);
            $lotes[$destino]['consumido'] = decimalCierreLotes($consumoDestino + $cantidad);
        }
        $actualizar = $pdo->prepare('UPDATE a_lotes_botas SET consumido = ? WHERE id = ?');
        foreach ($lotes as $id => $lote) $actualizar->execute([$lote['consumido'], $id]);
        $movimiento = $pdo->prepare("INSERT INTO a_movimientos (origen_id, situacion_origen, destino_id, situacion_destino, cantidad) VALUES (?, 'botas', ?, ?, ?)");
        foreach ($normalizadas as $op) {
            if ($op['tipo'] !== 'consumo') {
                $destino = 0; // Desperdicio no tiene tabla de lotes destino.
                if ($op['tipo'] === 'procesado') {
                    $lote = $lotes[$op['origen']];
                    $crear = $pdo->prepare('INSERT INTO a_lotes_procesados (codigo, linea_entrada_id, tipo_producto_id, material_id, cubicaje) VALUES (?, ?, ?, ?, 0) ON DUPLICATE KEY UPDATE id = id');
                    $crear->execute([$op['codigo'], $lote['linea_entrada_id'], $lote['tipo_producto_id'], $lote['material_id']]);
                    $buscar = $pdo->prepare('SELECT * FROM a_lotes_procesados WHERE codigo = ? FOR UPDATE');
                    $buscar->execute([$op['codigo']]);
                    $procesado = $buscar->fetch(PDO::FETCH_ASSOC);
                    if (!$procesado || $procesado['is_deleted']) throw new InvalidArgumentException('El lote de procesado destino no está disponible.');
                    $cubicaje = unidadesCierreLotes($procesado['cubicaje']) + $op['cantidad'];
                    if ($cubicaje > 9999999999) throw new InvalidArgumentException('El lote de procesado superaría el cubicaje permitido.');
                    $destino = (int) $procesado['id'];
                    $pdo->prepare('UPDATE a_lotes_procesados SET cubicaje = ? WHERE id = ?')->execute([decimalCierreLotes($cubicaje), $destino]);
                }
                $movimiento->execute([$op['origen'], $destino, $op['tipo'], decimalCierreLotes($op['cantidad'])]);
                continue;
            }
            // El borrador expresa la cesión de consumo. En a_movimientos el
            // origen es quien aumenta su consumido y disminuye su restante.
            $origenMovimiento = $op['destino'];
            $destinoMovimiento = $op['origen'];
            $movimiento->execute([$origenMovimiento, $destinoMovimiento, 'botas', decimalCierreLotes($op['cantidad'])]);
        }
        $consulta->execute($ids);
        $resultado = $consulta->fetchAll(PDO::FETCH_ASSOC);
        $pdo->commit();
        return ['ok' => true, 'lotes' => $resultado, 'operaciones_guardadas' => count($normalizadas)];
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
}

if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) {
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
        error_log('[cierre semanal PHP] ' . $error->getMessage());
        echo json_encode(['ok' => false, 'error' => $esperado ? $error->getMessage() : 'No se pudieron confirmar los cambios de lotes.'], JSON_UNESCAPED_UNICODE);
    }
}
