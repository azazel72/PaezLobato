<?php
declare(strict_types=1);

// Operaciones del cuadrante. No se editan título ni observaciones.
function gCCDays(string $inicio): array
{
    $d = new DateTimeImmutable($inicio);
    return array_map(fn($n) => $d->modify("+$n days")->format('Y-m-d'), [0, 1, 4, 5, 6]);
}
function gCCDataset(PDO $pdo, string $fecha): array
{
    $state = gCuadrante($pdo, $fecha);
    if ($state['head']) unset($state['head']['titulo'], $state['head']['observaciones']);
    return $state;
}
function gCCDate($value, array $days, array $festivos): string
{
    $date = gDate($value);
    if (!in_array($date, $days, true)) throw new InvalidArgumentException('Selecciona un día de trabajo de esta semana.');
    if (in_array($date, $festivos, true)) throw new InvalidArgumentException('No se puede asignar ni clonar en un día festivo.');
    return $date;
}
function gCCDelete(PDO $pdo, int $id, ?string $fecha = null): void
{
    $sql = 'UPDATE cuadrante_detalles SET deleted = 1, deleted_at = CURRENT_TIMESTAMP WHERE cuadrante_id = ? AND deleted = 0';
    $values = [$id];
    if ($fecha !== null) { $sql .= ' AND fecha = ?'; $values[] = $fecha; }
    $pdo->prepare($sql)->execute($values);
}
function gCCInsert(PDO $pdo, int $id, string $fecha, int $puesto, int $usuario, int $orden): void
{
    if ($orden < 1 || $orden > 255) throw new InvalidArgumentException('No caben más asignaciones en este puesto.');
    $pdo->prepare('INSERT INTO cuadrante_detalles (cuadrante_id, fecha, puesto_id, usuario_id, orden_en_puesto) VALUES (?, ?, ?, ?, ?)')->execute([$id, $fecha, $puesto, $usuario, $orden]);
}
function gCCMutate(PDO $pdo, array $data): array
{
    $inicio = gDate($data['inicio'] ?? '');
    if (gJueves($inicio) !== $inicio) throw new InvalidArgumentException('La semana debe comenzar en jueves.');
    $action = $data['action'] ?? '';
    if (!in_array($action, ['assign', 'remove', 'clone', 'extend', 'clear'], true)) throw new InvalidArgumentException('Acción no disponible.');
    $lock = 'gestion_cuadrante_' . $inicio;
    $q = $pdo->prepare('SELECT GET_LOCK(?, 5)'); $q->execute([$lock]);
    if ((int)$q->fetchColumn() !== 1) throw new InvalidArgumentException('El cuadrante está ocupado. Vuelve a intentarlo.');
    try {
        $pdo->beginTransaction();
        $state = gEstadoCuadrante($pdo, $inicio, true);
        if (!is_string($data['version'] ?? null) || !hash_equals($state['version'], $data['version'])) throw new InvalidArgumentException('El cuadrante ha cambiado en otra ventana. Actualiza antes de continuar.');
        $days = gCCDays($inicio); $fin = (new DateTimeImmutable($inicio))->modify('+6 days')->format('Y-m-d');
        $q = $pdo->prepare('SELECT fecha FROM dias_festivos WHERE fecha BETWEEN ? AND ?'); $q->execute([$inicio, $fin]); $festivos = $q->fetchAll(PDO::FETCH_COLUMN);
        $details = $state['details']; $id = $state['head'] ? (int)$state['head']['id'] : 0;
        // Una semana vacía solo se crea cuando se guarda una asignación.
        if (!$id && $action === 'assign') {
            $pdo->prepare('INSERT INTO cuadrantes (fecha_inicio, fecha_fin, titulo, observaciones) VALUES (?, ?, ?, ?)')->execute([$inicio, $fin, '', '']); $id = (int)$pdo->lastInsertId();
        }
        if ($action === 'assign') {
            $date = gCCDate($data['fecha'] ?? '', $days, $festivos);
            $puesto = gId($data['puesto_id'] ?? null); $usuario = gId($data['usuario_id'] ?? null);
            $origin = null;
            if (!empty($data['detail_id'])) {
                $detailId = gId($data['detail_id']);
                foreach ($details as $d) if ((int)$d['id'] === $detailId) $origin = $d;
                if (!$origin || (int)$origin['usuario_id'] !== $usuario) throw new InvalidArgumentException('La asignación de origen ya no existe.');
            }
            $usedPuestos = array_map('intval', array_column($details, 'puesto_id')); $usedUsers = array_map('intval', array_column($details, 'usuario_id'));
            $q = $pdo->prepare('SELECT activo FROM puestos_trabajo WHERE id = ? AND deleted = 0'); $q->execute([$puesto]); $p = $q->fetch();
            $q = $pdo->prepare('SELECT activo, empleado FROM usuarios WHERE id = ? AND is_deleted = 0'); $q->execute([$usuario]); $u = $q->fetch();
            if (!$p || (!$p['activo'] && !in_array($puesto, $usedPuestos, true))) throw new InvalidArgumentException('El puesto no está disponible.');
            if (!$u || (!$u['empleado'] && !in_array($usuario, $usedUsers, true)) || (!$u['activo'] && !in_array($usuario, $usedUsers, true))) throw new InvalidArgumentException('El empleado no está disponible.');
            $same = false; $conflict = false; $order = 0;
            foreach ($details as $d) {
                if ($d['fecha'] !== $date) continue;
                if ((int)$d['puesto_id'] === $puesto) $order = max($order, (int)$d['orden_en_puesto']);
                if ((int)$d['usuario_id'] !== $usuario) continue;
                if ((int)$d['puesto_id'] === $puesto) $same = true;
                elseif (!$origin || (int)$d['id'] !== (int)$origin['id']) $conflict = true;
            }
            if ($same) throw new InvalidArgumentException('El empleado ya está asignado a esta celda.');
            if ($conflict && ($data['allow_conflicts'] ?? false) !== true) throw new InvalidArgumentException('El empleado ya está en otro puesto ese día. Confirma la asignación adicional.');
            if ($order >= 255) throw new InvalidArgumentException('No caben más asignaciones en este puesto.');
            if ($origin) $pdo->prepare('UPDATE cuadrante_detalles SET fecha = ?, puesto_id = ?, orden_en_puesto = ? WHERE id = ?')->execute([$date, $puesto, $order + 1, $origin['id']]);
            else gCCInsert($pdo, $id, $date, $puesto, $usuario, $order + 1);
        } elseif ($action === 'remove') {
            $detailId = gId($data['detail_id'] ?? null);
            if (!in_array($detailId, array_map('intval', array_column($details, 'id')), true)) throw new InvalidArgumentException('La asignación ya no existe.');
            $pdo->prepare('UPDATE cuadrante_detalles SET deleted = 1, deleted_at = CURRENT_TIMESTAMP WHERE id = ? AND cuadrante_id = ?')->execute([$detailId, $id]);
        } elseif ($action === 'clone') {
            $from = gCCDate($data['from'] ?? '', $days, $festivos); $to = gCCDate($data['to'] ?? '', $days, $festivos);
            if ($from === $to) throw new InvalidArgumentException('Elige días diferentes.');
            if (!$id) throw new InvalidArgumentException('El cuadrante está vacío.');
            $merge = ($data['keep'] ?? false) === true; $signatures = [];
            if (!$merge) gCCDelete($pdo, $id, $to);
            else foreach ($details as $d) if ($d['fecha'] === $to) $signatures[$d['puesto_id'] . ':' . $d['usuario_id']] = true;
            foreach ($details as $d) if ($d['fecha'] === $from && !isset($signatures[$d['puesto_id'] . ':' . $d['usuario_id']])) {
                gCCInsert($pdo, $id, $to, (int)$d['puesto_id'], (int)$d['usuario_id'], max(1, (int)$d['orden_en_puesto'])); $signatures[$d['puesto_id'] . ':' . $d['usuario_id']] = true;
            }
        } elseif ($action === 'extend') {
            gCCDate($inicio, $days, $festivos);
            $source = array_values(array_filter($details, fn($d) => $d['fecha'] === $inicio));
            if (!$source) throw new InvalidArgumentException('El jueves no tiene asignaciones.');
            $batideros = $pdo->query("SELECT id FROM puestos_trabajo WHERE deleted = 0 AND UPPER(TRIM(nombre)) LIKE 'BATIDERO%' ORDER BY orden, id")->fetchAll(PDO::FETCH_COLUMN);
            $batideros = array_map('intval', $batideros); $index = array_flip($batideros);
            $destinations = array_values(array_filter(array_slice($days, 1), fn($d) => !in_array($d, $festivos, true)));
            foreach ($destinations as $i => $to) {
                gCCDelete($pdo, $id, $to);
                foreach ($source as $d) {
                    $puesto = (int)$d['puesto_id'];
                    if (isset($index[$puesto])) $puesto = $batideros[($index[$puesto] + $i + 1) % count($batideros)];
                    gCCInsert($pdo, $id, $to, $puesto, (int)$d['usuario_id'], max(1, (int)$d['orden_en_puesto']));
                }
            }
        } elseif ($action === 'clear') {
            if ($id) gCCDelete($pdo, $id);
        }
        // Devuelve la misma instantánea que se ha guardado, antes de liberar el bloqueo.
        $result = gCCDataset($pdo, $inicio); $pdo->commit(); return $result;
    } catch (Throwable $e) { if ($pdo->inTransaction()) $pdo->rollBack(); throw $e; }
    finally { $q = $pdo->prepare('SELECT RELEASE_LOCK(?)'); $q->execute([$lock]); }
}
