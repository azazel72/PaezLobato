<?php
declare(strict_types=1);
require_once __DIR__ . '/lib/fabricacion_db.php';
require_once __DIR__ . '/lib/php_log.php';

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

function unidadesCierreLotesConSigno($valor): int
{
    if (is_string($valor) && str_starts_with(trim($valor), '-')) return -unidadesCierreLotes(substr(trim($valor), 1));
    return unidadesCierreLotes($valor);
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
        if (!is_array($op) || !in_array($op['tipo'] ?? '', ['consumo', 'procesado', 'desperdicio', 'finalizar'], true)) throw new InvalidArgumentException('Acción de lote no válida.');
        $tipo = $op['tipo'];
        $origen = idCierreLotes($op['origen_id'] ?? null);
        $destino = $tipo === 'consumo' ? idCierreLotes($op['destino_id'] ?? null) : 0;
        $cantidad = $tipo === 'finalizar'
            ? 0
            : (($tipo === 'desperdicio') ? unidadesCierreLotesConSigno($op['cantidad'] ?? null) : unidadesCierreLotes($op['cantidad'] ?? null));
        $codigo = $op['codigo_destino'] ?? '';
        $ubicacionId = $tipo === 'procesado' ? idCierreLotes($op['ubicacion_id'] ?? null) : 0;
        if (!is_string($codigo)) throw new InvalidArgumentException('Código de destino no válido.');
        $codigo = trim($codigo);
        if ($tipo === 'procesado' && ($codigo === '' || mb_strlen($codigo) > 60)) throw new InvalidArgumentException('Indica el nombre del lote de destino (máximo 60 caracteres).');
        if ($tipo === 'procesado') {
            $validarUbicacion = $pdo->prepare("SELECT u.id FROM ubicaciones u JOIN instalaciones i ON i.id = u.instalacion_id
                WHERE u.id = ? AND (UPPER(TRIM(i.nombre)) = 'M' OR UPPER(TRIM(i.tipo)) = 'M')");
            $validarUbicacion->execute([$ubicacionId]);
            if (!$validarUbicacion->fetchColumn()) throw new InvalidArgumentException('Selecciona una ubicación de una instalación de madera (M).');
        }
        if ($origen === $destino || ($tipo !== 'desperdicio' && $tipo !== 'finalizar' && $cantidad <= 0) || ($tipo === 'desperdicio' && $cantidad === 0)) throw new InvalidArgumentException('Selecciona una cantidad válida.');
        if (!isset($bases[$origen]) || ($tipo === 'consumo' && !isset($bases[$destino]))) throw new InvalidArgumentException('Faltan los valores originales de los lotes.');
        $normalizadas[] = compact('tipo', 'origen', 'destino', 'cantidad', 'codigo', 'ubicacionId');
        $ids[$origen] = $origen;
        if ($tipo === 'consumo') $ids[$destino] = $destino;
    }
    sort($ids, SORT_NUMERIC);
    $pdo->beginTransaction();
    try {
        $marcas = implode(',', array_fill(0, count($ids), '?'));
        $consulta = $pdo->prepare("SELECT * FROM a_lotes WHERE objetivo = 'BOTAS' AND estado < 2 AND is_deleted = 0 AND id IN ($marcas) ORDER BY id FOR UPDATE");
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
            if ((int) $lotes[$origen]['estado'] >= 2) {
                throw new InvalidArgumentException('No se puede modificar un lote que ya está finalizado.');
            }
            $consumoOrigen = unidadesCierreLotes($lotes[$origen]['consumido']);
        if ($op['tipo'] === 'finalizar') {
            $consumoOrigen = unidadesCierreLotes($lotes[$origen]['consumido']);
            $cubicajeOrigen = unidadesCierreLotes($lotes[$origen]['cubicaje']);
            if ($consumoOrigen !== $cubicajeOrigen) throw new InvalidArgumentException('El lote solo se puede finalizar cuando el restante es cero.');
            $lotes[$origen]['estado'] = 2;
            continue;
        }
        if ($op['tipo'] !== 'consumo') {
                $cubicajeOrigen = unidadesCierreLotes($lotes[$origen]['cubicaje']);
                if ($op['tipo'] === 'desperdicio') {
                    if ($consumoOrigen + $cantidad !== $cubicajeOrigen) throw new InvalidArgumentException('A desperdicio debe enviarse todo el restante para dejarlo a cero.');
                } elseif ($consumoOrigen + $cantidad > $cubicajeOrigen) throw new InvalidArgumentException('La cantidad supera el restante del lote.');
                $lotes[$origen]['consumido'] = decimalCierreLotes($consumoOrigen + $cantidad);
                continue;
            }
            $consumoDestino = unidadesCierreLotes($lotes[$destino]['consumido']);
            if ((int) $lotes[$destino]['estado'] >= 2) {
                throw new InvalidArgumentException('No se puede usar como destino un lote que ya está finalizado.');
            }
            if ($cantidad > $consumoOrigen) throw new InvalidArgumentException('No puedes quitar más consumo del registrado en el lote de origen.');
            if ($consumoDestino + $cantidad > unidadesCierreLotes($lotes[$destino]['cubicaje'])) {
                throw new InvalidArgumentException('El consumo dejaría el restante del lote receptor en negativo.');
            }
            $lotes[$origen]['consumido'] = decimalCierreLotes($consumoOrigen - $cantidad);
            $lotes[$destino]['consumido'] = decimalCierreLotes($consumoDestino + $cantidad);
        }
        $actualizar = $pdo->prepare("UPDATE a_lotes SET consumido = ?, estado = ? WHERE id = ? AND objetivo = 'BOTAS'");
        foreach ($lotes as $id => $lote) $actualizar->execute([$lote['consumido'], (int) $lote['estado'], $id]);
        $movimiento = $pdo->prepare("INSERT INTO a_movimientos (origen_id, situacion_origen, destino_id, situacion_destino, cantidad) VALUES (?, 'botas', ?, ?, ?)");
        foreach ($normalizadas as $op) {
            if ($op['tipo'] === 'finalizar') {
                continue;
            }
            if ($op['tipo'] !== 'consumo') {
                $destino = 0; // Desperdicio no tiene tabla de lotes destino.
                if ($op['tipo'] === 'procesado') {
                    $lote = $lotes[$op['origen']];
                    $buscar = $pdo->prepare("SELECT * FROM a_lotes WHERE objetivo = 'ALMACENADO' AND codigo = ? AND ubicacion_id = ? AND estado < 2 AND is_deleted = 0 FOR UPDATE");
                    $buscar->execute([$op['codigo'], $op['ubicacionId']]);
                    $procesado = $buscar->fetch(PDO::FETCH_ASSOC);
                    if (!$procesado) {
                        $crear = $pdo->prepare("INSERT INTO a_lotes (codigo, objetivo, linea_entrada_id, tipo_producto_id, material_id, cubicaje, consumido, estado, ubicacion_id) VALUES (?, 'ALMACENADO', ?, ?, ?, 0, 0, 0, ?)");
                        $crear->execute([$op['codigo'], $lote['linea_entrada_id'], $lote['tipo_producto_id'], $lote['material_id'], $op['ubicacionId']]);
                        $buscar->execute([$op['codigo'], $op['ubicacionId']]);
                        $procesado = $buscar->fetch(PDO::FETCH_ASSOC);
                    }
                    if (!$procesado || $procesado['is_deleted']) throw new InvalidArgumentException('El lote de procesado destino no está disponible.');
                    $cubicaje = unidadesCierreLotes($procesado['cubicaje']) + $op['cantidad'];
                    if ($cubicaje > 9999999999) throw new InvalidArgumentException('El lote de procesado superaría el cubicaje permitido.');
                    $destino = (int) $procesado['id'];
                    $pdo->prepare('UPDATE a_lotes SET cubicaje = ? WHERE id = ?')->execute([decimalCierreLotes($cubicaje), $destino]);
                }
                if ($op['tipo'] === 'desperdicio' && $op['cantidad'] < 0) {
                    // Un desperdicio negativo devuelve material: se invierte
                    // el sentido del movimiento y se conserva cantidad positiva.
                    $movimiento->execute([0, $op['origen'], 'desperdicio', 'botas', decimalCierreLotes(abs($op['cantidad']))]);
                } else {
                    $movimiento->execute([$op['origen'], $destino, $op['tipo'] === 'procesado' ? 'almacenado' : 'desperdicio', decimalCierreLotes(abs($op['cantidad']))]);
                }
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
        registrarLogPhp('[cierre semanal PHP] ' . $error->getMessage());
        echo json_encode(['ok' => false, 'error' => $esperado ? $error->getMessage() : 'No se pudieron confirmar los cambios de lotes.'], JSON_UNESCAPED_UNICODE);
    }
}
