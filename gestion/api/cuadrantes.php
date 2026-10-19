<?php
declare(strict_types=1);

function gJueves(string $fecha): string
{
    $d = new DateTimeImmutable(gDate($fecha));
    $offset = ((int)$d->format('N') - 4 + 7) % 7;
    return $d->modify("-$offset days")->format('Y-m-d');
}
function gEstadoCuadrante(PDO $pdo, string $inicio, bool $lock = false): array
{
    $q = $pdo->prepare('SELECT id, fecha_inicio, fecha_fin, titulo, observaciones FROM cuadrantes WHERE fecha_inicio = ? AND deleted = 0 ORDER BY id LIMIT 1' . ($lock ? ' FOR UPDATE' : '')); $q->execute([$inicio]);
    $head = $q->fetch() ?: null; $details = [];
    if ($head) {
        $q = $pdo->prepare('SELECT id, fecha, puesto_id, usuario_id, orden_en_puesto FROM cuadrante_detalles WHERE cuadrante_id = ? AND deleted = 0 ORDER BY fecha, puesto_id, orden_en_puesto, id' . ($lock ? ' FOR UPDATE' : '')); $q->execute([$head['id']]); $details = $q->fetchAll();
    }
    return ['head' => $head, 'details' => $details, 'version' => hash('sha256', json_encode([$head, $details], JSON_UNESCAPED_UNICODE))];
}
function gCuadrante(PDO $pdo, string $fecha): array
{
    $inicio = gJueves($fecha); $fin = (new DateTimeImmutable($inicio))->modify('+6 days')->format('Y-m-d');
    $q = $pdo->prepare('SELECT fecha FROM dias_festivos WHERE fecha BETWEEN ? AND ?'); $q->execute([$inicio, $fin]);
    $state = gEstadoCuadrante($pdo, $inicio);
    $puestos = $pdo->query('SELECT id, nombre, orden, activo FROM puestos_trabajo WHERE deleted = 0 ORDER BY orden, nombre')->fetchAll();
    $usuarios = $pdo->query('SELECT id, codigo, alias, nombre, activo, empleado FROM usuarios WHERE is_deleted = 0 ORDER BY codigo, nombre, alias')->fetchAll();
    return $state + ['inicio' => $inicio, 'fin' => $fin, 'puestos' => $puestos, 'usuarios' => $usuarios, 'festivos' => $q->fetchAll(PDO::FETCH_COLUMN)];
}
