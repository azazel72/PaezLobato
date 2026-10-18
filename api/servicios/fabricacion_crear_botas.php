<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/database.php';
require_once __DIR__ . '/flejes.php';
require_once __DIR__ . '/../lib/php_log.php';

// Trabajar en unidades de 0.0001 evita perder consumo al repartir varios lotes.
function fabricacionUnidades(string $cantidad): int
{
    if (!preg_match('/^(\d+)(?:\.(\d{1,4}))?$/D', $cantidad, $partes)) {
        throw new InvalidArgumentException('La receta contiene una cantidad no válida.');
    }
    return (int) $partes[1] * 10000 + (int) str_pad($partes[2] ?? '', 4, '0');
}

function fabricacionDecimal(int $unidades): string
{
    return intdiv($unidades, 10000) . '.' . str_pad((string) ($unidades % 10000), 4, '0', STR_PAD_LEFT);
}

function fabricacionEntero($valor, string $campo): int
{
    $numero = is_bool($valor) ? false : filter_var($valor, FILTER_VALIDATE_INT);
    if ($numero === false || $numero < 1) {
        throw new InvalidArgumentException("$campo debe ser un entero mayor que cero.");
    }
    return $numero;
}

function crearBotasFabricacion(PDO $pdo, array $datos): array
{
    $lineaId = fabricacionEntero($datos['fabricacion_semanal_id'] ?? null, 'Fabricación');
    $cantidad = fabricacionEntero($datos['cantidad_etiquetas'] ?? null, 'Cantidad de etiquetas');
    $batidero = fabricacionEntero($datos['batidero'] ?? null, 'Batidero');
    if (!in_array($batidero, [11,12,13,21,22,23,31,32,33,41,42,43,51,52,53], true)) {
        throw new InvalidArgumentException('Código de batidero no válido.');
    }
    $operarios = $datos['operarios_ids'] ?? [];
    $lotesIds = $datos['lotes_botas_ids'] ?? [];
    if (!is_array($operarios) || !$operarios || !is_array($lotesIds) || !$lotesIds) {
        throw new InvalidArgumentException('Selecciona operario de fondado y al menos un lote de botas.');
    }
    $operarios = array_values(array_unique(array_map(fn($id) => fabricacionEntero($id, 'Operario'), $operarios)));
    $lotesIds = array_values(array_unique(array_map(fn($id) => fabricacionEntero($id, 'Lote'), $lotesIds)));
    sort($lotesIds, SORT_NUMERIC);
    $fondoId = fabricacionEntero($datos['lote_fondos_id'] ?? null, 'Lote de fondos');

    // Serializar también entre distintas fabricaciones: comparten la numeración anual.
    $bloqueo = 'fabricacion_botas_' . $pdo->query('SELECT DATABASE()')->fetchColumn();
    $lock = $pdo->prepare('SELECT GET_LOCK(?, 10)');
    $lock->execute([$bloqueo]);
    if ((int) $lock->fetchColumn() !== 1) {
        throw new RuntimeException('Hay otra fabricación en curso. Inténtalo de nuevo.');
    }
    try {
        $pdo->beginTransaction();
        $stmt = $pdo->prepare('SELECT fs.*, tp.tipo FROM fabricacion_semanal fs
            JOIN tipos_producto tp ON tp.id = fs.tipo_producto_id
            WHERE fs.id = ? AND fs.is_deleted = 0 FOR UPDATE');
        $stmt->execute([$lineaId]);
        $linea = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$linea || (int) $linea['estado'] !== 2 || strtoupper($linea['tipo']) !== 'BOTA') {
            throw new InvalidArgumentException('La fabricación de botas ya no está activa.');
        }
        $pedidoId = (int) $linea['pedido_id'];
        if ($pedidoId) {
            $stmt = $pdo->prepare('SELECT id FROM pedidos WHERE id = ? AND is_deleted = 0 FOR UPDATE');
            $stmt->execute([$pedidoId]);
            if (!$stmt->fetchColumn()) throw new InvalidArgumentException('Pedido no encontrado.');
        }
        $stmt = $pdo->prepare('SELECT id FROM usuarios WHERE id = ? AND activo = 1 AND is_deleted = 0');
        foreach ($operarios as $id) {
            $stmt->execute([$id]);
            if (!$stmt->fetchColumn()) throw new InvalidArgumentException('Operario no válido.');
        }

        // JavaScript envía los lotes marcados como seleccionados (estado = 1).
        // Los lotes disponibles pero no seleccionados (estado = 0) no forman
        // parte de esta fabricación.
        $lotes = $pdo->query("SELECT id, codigo FROM a_lotes
            WHERE objetivo = 'BOTAS' AND estado = 1 AND is_deleted = 0 ORDER BY codigo, id FOR UPDATE")->fetchAll(PDO::FETCH_ASSOC);
        $actuales = array_map('intval', array_column($lotes, 'id'));
        sort($actuales, SORT_NUMERIC);
        if ($actuales !== $lotesIds) {
            throw new InvalidArgumentException('La selección de lotes de botas ha cambiado. Recarga la vista.');
        }
        $fondos = $pdo->query("SELECT id, codigo FROM a_lotes
            WHERE objetivo = 'FONDOS' AND estado = 1 AND is_deleted = 0 ORDER BY id FOR UPDATE")->fetchAll(PDO::FETCH_ASSOC);
        if (count($fondos) !== 1 || (int) $fondos[0]['id'] !== $fondoId) {
            throw new InvalidArgumentException('Debe haber un único lote de fondos seleccionado. Recarga la vista.');
        }
        $stmt = $pdo->prepare('SELECT c.consumo, c.consumible_id, tp.tipo FROM consumos c
            JOIN tipos_producto tp ON tp.id = c.consumible_id WHERE c.bota_id = ? ORDER BY c.id');
        $stmt->execute([$linea['tipo_producto_id']]);
        $duela = 0;
        $fondo = 0;
        $flejes = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $consumo) {
            $tipo = strtoupper($consumo['tipo']);
            if ($tipo === 'DUELA') $duela += fabricacionUnidades((string) $consumo['consumo']);
            if (in_array($tipo, ['FONDO', 'FONDOS'], true)) $fondo += fabricacionUnidades((string) $consumo['consumo']);
            if ($tipo === 'FLEJE') $flejes[] = $consumo;
        }
        if ($duela <= 0 || $fondo <= 0) {
            throw new InvalidArgumentException('La receta debe tener consumos positivos de duela y fondos.');
        }
        $fondosPorBota = fabricacionDecimal(2 * $fondo);
        $reparto = [];
        foreach ($lotes as $i => $lote) {
            $reparto[$i] = fabricacionDecimal(intdiv($duela, count($lotes)) + ($i < $duela % count($lotes) ? 1 : 0));
        }

        $fecha = new DateTimeImmutable('now', new DateTimeZone('Europe/Madrid'));
        $separador = count($lotes) > 1 ? 'X' : '-';
        $anio = $fecha->format('y');
        $stmt = $pdo->prepare('SELECT codigo FROM productos WHERE codigo LIKE ?');
        $stmt->execute(['%' . $separador . $anio . '_______']);
        $contador = 0;
        foreach ($stmt->fetchAll(PDO::FETCH_COLUMN) as $codigo) {
            $cola = substr($codigo, -10);
            if (str_starts_with($cola, $separador . $anio) && ctype_digit(substr($cola, -5))) {
                $contador = max($contador, (int) substr($cola, -5));
            }
        }
        if ($cantidad > 99999 - $contador) throw new InvalidArgumentException('Se supera la numeración anual de cinco dígitos.');
        $prefijo = mb_substr(trim($lotes[0]['codigo']), 0, 8, 'UTF-8');
        if ($prefijo === '') throw new InvalidArgumentException('El lote no tiene código.');
        $base = $prefijo . sprintf('%02d%02d', $operarios[0] % 100, $batidero) . $separador . $fecha->format('ym');

        $producto = $pdo->prepare("INSERT INTO productos
            (tipo, codigo, tipo_producto_id, material_id, tostado_id, produccion_id, estado)
            VALUES ('BOTA', ?, ?, ?, ?, ?, 1)");
        $operario = $pdo->prepare('INSERT INTO productos_operarios (producto_id, usuario_id, codigo_batidero) VALUES (?, ?, ?)');
        $trazaBota = $pdo->prepare('INSERT INTO a_trazabilidad_botas (id_botas, id_lote_botas, lote, cantidad) VALUES (?, ?, ?, ?)');
        $trazaFondo = $pdo->prepare('INSERT INTO a_trazabilidad_fondos (id_bota, id_lote_fondos, lote, cantidad) VALUES (?, ?, ?, ?)');
        $consumirBota = $pdo->prepare("UPDATE a_lotes SET consumido = consumido + ?, contador_botas = contador_botas + 1 WHERE id = ? AND objetivo = 'BOTAS' AND estado < 2");
        $consumirFondo = $pdo->prepare("UPDATE a_lotes SET consumido = consumido + ?, contador_fondos = contador_fondos + 2 WHERE id = ? AND objetivo = 'FONDOS' AND estado < 2");
        $codigos = [];
        $productoId = null;
        for ($n = 0; $n < $cantidad; $n++) {
            foreach ($flejes as $fleje) {
                consumirFlejesSeleccionados($pdo, (int) $fleje['consumible_id'], (string) $fleje['consumo']);
            }
            $codigo = $base . sprintf('%05d', ++$contador);
            $producto->execute([$codigo, $linea['tipo_producto_id'], $linea['material_id'], $linea['tostado_id'], $lineaId]);
            $productoId = (int) $pdo->lastInsertId();
            foreach ($operarios as $id) $operario->execute([$productoId, $id, $batidero]);
            foreach ($lotes as $i => $lote) {
                $consumirBota->execute([$reparto[$i], $lote['id']]);
                $trazaBota->execute([$productoId, $lote['id'], $lote['codigo'], $reparto[$i]]);
            }
            $consumirFondo->execute([$fondosPorBota, $fondoId]);
            // Una sola traza por bota, con el consumo de los dos fondos.
            $trazaFondo->execute([$productoId, $fondoId, $fondos[0]['codigo'], $fondosPorBota]);
            $codigos[] = $codigo;
        }
        $stmt = $pdo->prepare('UPDATE fabricacion_semanal SET cantidad_fabricada = COALESCE(cantidad_fabricada, 0) + ? WHERE id = ?');
        $stmt->execute([$cantidad, $lineaId]);
        if ($pedidoId) {
            $stmt = $pdo->prepare('UPDATE pedidos SET cantidad_fabricada = COALESCE(cantidad_fabricada, 0) + ? WHERE id = ?');
            $stmt->execute([$cantidad, $pedidoId]);
        }
        $pdo->commit();
        return ['ok' => true, 'producto_id' => $productoId, 'codigo' => end($codigos), 'codigos' => $codigos, 'cantidad' => $cantidad];
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    } finally {
        $pdo->prepare('SELECT RELEASE_LOCK(?)')->execute([$bloqueo]);
    }
}

// Permite probar la transacción con tablas temporales sin ejecutar el endpoint.
