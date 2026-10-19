<?php
declare(strict_types=1);

function gInforme(PDO $pdo, string $resource, array $params): array
{
    if ($resource === 'inventario_flejes') return ['rows' => $pdo->query('SELECT e.id, e.fecha, e.lote, COALESCE(t.descripcion, \'Sin tipo\') AS tipo_producto, e.peso, e.consumido, e.peso - e.consumido AS restante FROM entradas_flejes e LEFT JOIN tipos_producto t ON t.id = e.tipo_producto_id WHERE e.is_deleted = 0 ORDER BY e.fecha DESC, e.id DESC')->fetchAll()];
    if ($resource === 'inventario_maderas') return ['rows' => $pdo->query("SELECT MIN(p.id) AS id, COALESCE(t.descripcion, 'Sin tipo') AS tipo_producto, COALESCE(m.descripcion, 'Sin material') AS material, COALESCE(u.descripcion, 'Sin ubicación') AS ubicacion, COALESCE(i.nombre, 'Sin instalación') AS instalacion, COUNT(*) AS palets, SUM(p.cubicaje) AS cubicaje, SUM(p.consumido) AS consumido, SUM(p.cubicaje - p.consumido) AS restante FROM palets p LEFT JOIN tipos_producto t ON t.id = p.tipo_producto_id LEFT JOIN materiales m ON m.id = p.material_id LEFT JOIN ubicaciones u ON u.id = p.ubicacion_id LEFT JOIN instalaciones i ON i.id = u.instalacion_id WHERE p.is_deleted = 0 AND p.procesado = 0 AND UPPER(t.tipo) = 'DUELA' GROUP BY p.tipo_producto_id, t.descripcion, p.material_id, m.descripcion, p.ubicacion_id, u.descripcion, i.nombre ORDER BY t.descripcion, m.descripcion, u.descripcion")->fetchAll()];
    $periodo = $params['periodo'] ?? '';
    if (!is_string($periodo) || !preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $periodo)) throw new InvalidArgumentException('Selecciona un mes válido.');
    $inicio = gDate($periodo . '-01'); $fin = (new DateTimeImmutable($inicio))->modify('last day of this month')->format('Y-m-d');
    $q = $pdo->prepare('SELECT d.usuario_id, d.puesto_id, d.fecha FROM cuadrante_detalles d JOIN cuadrantes c ON c.id = d.cuadrante_id WHERE d.deleted = 0 AND c.deleted = 0 AND d.fecha BETWEEN ? AND ?'); $q->execute([$inicio, $fin]); $details = $q->fetchAll();
    $puestos = $pdo->query('SELECT id, nombre, listado, activo FROM puestos_trabajo WHERE deleted = 0 ORDER BY orden, nombre')->fetchAll();
    $byPuesto = array_column($puestos, null, 'id'); $counts = []; $used = [];
    foreach ($details as $d) {
        $u = $d['usuario_id']; $p = $d['puesto_id']; if (!isset($byPuesto[$p])) continue;
        if ($byPuesto[$p]['listado']) { $counts[$u]['puestos'][$p] = ($counts[$u]['puestos'][$p] ?? 0) + 1; $used[$p] = true; }
        else $counts[$u]['fechas'][$d['fecha']] = true;
    }
    $columns = array_values(array_filter($puestos, fn($p) => $p['listado'] && ($p['activo'] || isset($used[$p['id']]))));
    $rows = [];
    foreach ($pdo->query('SELECT id, codigo, nombre, alias, empleado FROM usuarios WHERE is_deleted = 0 ORDER BY codigo IS NULL, codigo, nombre, alias')->fetchAll() as $u) {
        $id = $u['id']; if (!$u['empleado'] && !isset($counts[$id])) continue;
        $row = ['id' => $id, 'codigo' => $u['codigo'], 'nombre' => $u['nombre'] ?: $u['alias'], 'asistencia' => count($counts[$id]['fechas'] ?? [])]; $total = $row['asistencia'];
        foreach ($columns as $p) { $value = $counts[$id]['puestos'][$p['id']] ?? 0; $row['puesto_' . $p['id']] = $value; $total += $value; }
        $row['total'] = $total; $rows[] = $row;
    }
    $q = $pdo->prepare('SELECT fecha FROM dias_festivos WHERE fecha BETWEEN ? AND ?'); $q->execute([$inicio, $fin]); $festivos = $q->fetchAll(PDO::FETCH_COLUMN);
    $laborables = 0;
    for ($d = new DateTimeImmutable($inicio); $d->format('Y-m-d') <= $fin; $d = $d->modify('+1 day')) if ($d->format('N') < 6 && !in_array($d->format('Y-m-d'), $festivos, true)) $laborables++;
    return ['rows' => $rows, 'puestos' => $columns, 'laborables' => $laborables, 'inicio' => $inicio, 'fin' => $fin];
}
