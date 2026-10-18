<?php
declare(strict_types=1);

require_once __DIR__ . '/../lib/database.php';

function listarEntradasFlejes(PDO $pdo): array
{
    return $pdo->query('SELECT ef.*, tp.descripcion AS tipo_producto_descripcion,
        tp.tipo AS tipo_producto_tipo, (ef.peso - ef.consumido) AS restante
        FROM entradas_flejes ef LEFT JOIN tipos_producto tp ON tp.id = ef.tipo_producto_id
        WHERE ef.is_deleted = 0 AND ef.estado < 2 ORDER BY ef.fecha, ef.id')->fetchAll();
}

function seleccionarEntradaFleje(PDO $pdo, int $id, int $estado): array
{
    if ($id < 1 || !in_array($estado, [0, 1], true)) {
        throw new InvalidArgumentException('Entrada o estado de fleje no válidos.');
    }
    $pdo->beginTransaction();
    try {
        $stmt = $pdo->prepare('SELECT estado FROM entradas_flejes WHERE id = ? AND is_deleted = 0 FOR UPDATE');
        $stmt->execute([$id]);
        $actual = $stmt->fetchColumn();
        if ($actual === false || !in_array((int) $actual, [0, 1], true)) {
            throw new InvalidArgumentException('La entrada de fleje ya no está disponible. Recarga la vista.');
        }
        $pdo->prepare('UPDATE entradas_flejes SET estado = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')->execute([$estado, $id]);
        $pdo->commit();
        return ['ok' => true, 'id' => $id, 'estado' => $estado];
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
}

// La última entrada seleccionada absorbe el consumo pendiente, incluso sin saldo.
function consumirFlejesSeleccionados(PDO $pdo, int $tipoId, string $consumo): void
{
    $stmt = $pdo->prepare('SELECT id, peso, consumido FROM entradas_flejes
        WHERE is_deleted = 0 AND estado = 1 AND tipo_producto_id = ? ORDER BY fecha, id FOR UPDATE');
    $stmt->execute([$tipoId]);
    $entradas = $stmt->fetchAll();
    if (!$entradas) throw new InvalidArgumentException("No hay flejes seleccionados para el tipo $tipoId.");
    // La tabla almacena centésimas de kg; usar enteros evita errores de coma flotante.
    $pendiente = (int) round((float) $consumo * 100);
    $update = $pdo->prepare('UPDATE entradas_flejes SET consumido = ?, restante = ?, estado = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    foreach ($entradas as $i => $entrada) {
        if ($pendiente <= 0) break;
        $ultima = $i === count($entradas) - 1;
        $peso = (int) round((float) $entrada['peso'] * 100);
        $consumido = (int) round((float) $entrada['consumido'] * 100);
        $delta = $ultima ? $pendiente : min(max($peso - $consumido, 0), $pendiente);
        $consumido += $delta;
        $update->execute([number_format($consumido / 100, 2, '.', ''),
            number_format(($peso - $consumido) / 100, 2, '.', ''),
            !$ultima && $consumido >= $peso ? 2 : 1, $entrada['id']]);
        $pendiente -= $delta;
    }
}
