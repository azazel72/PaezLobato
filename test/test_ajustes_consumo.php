<?php
declare(strict_types=1);
require_once __DIR__ . '/../api/servicios/cierre_semanal_lotes.php';
function verificarAjuste(bool $ok, string $mensaje): void { if (!$ok) throw new RuntimeException($mensaje); }
$pdo = fabricacionPdo();
// Aislar todas las tablas en las que escribe el servicio antes de ejecutarlo.
foreach (['a_lotes', 'a_movimientos', 'a_ajustes_consumo'] as $tabla) {
    $ddl = $pdo->query("SHOW CREATE TABLE `$tabla`")->fetch(PDO::FETCH_NUM)[1];
    $ddl = preg_replace('/^CREATE TABLE/', 'CREATE TEMPORARY TABLE', $ddl);
    $ddl = preg_replace('/^\s*CONSTRAINT .*FOREIGN KEY.*\n/m', '', $ddl);
    $ddl = preg_replace('/,\n\)/', "\n)", $ddl);
    $pdo->exec($ddl);
}
$pdo->exec("INSERT INTO a_lotes (id,codigo,objetivo,cubicaje,consumido,contador_botas,estado) VALUES (1,'A','BOTAS',1,1.2,8,1),(2,'B','BOTAS',1,0.2,5,1),(3,'C','BOTAS',0.5,0,0,1)");
function basesAjuste(PDO $pdo): array { return $pdo->query('SELECT * FROM a_lotes ORDER BY id')->fetchAll(); }
function snapshotAjuste(PDO $pdo): array {
    return [basesAjuste($pdo), $pdo->query('SELECT * FROM a_ajustes_consumo ORDER BY id')->fetchAll(), $pdo->query('SELECT * FROM a_movimientos ORDER BY id')->fetchAll()];
}
$datos = ['lotes_originales'=>basesAjuste($pdo), 'operaciones'=>[
    ['tipo'=>'consumo','origen_id'=>1,'destino_id'=>2,'cantidad'=>'0.2000','motivo'=>'Corrección de asignación'],
    ['tipo'=>'consumo','origen_id'=>2,'destino_id'=>3,'cantidad'=>'0.1000'],
]];
$res = confirmarCambiosLotesCierre($pdo, $datos);
$audit = $pdo->query('SELECT * FROM a_ajustes_consumo ORDER BY orden')->fetchAll();
verificarAjuste(count($audit) === 2, 'Un registro por ajuste');
verificarAjuste($audit[0]['grupo'] === $audit[1]['grupo'], 'Agrupación por confirmación');
verificarAjuste(array_column($audit, 'consumido_origen_antes') === ['1.2000','0.4000'], 'Valores anteriores secuenciales');
verificarAjuste(array_column($audit, 'consumido_origen_despues') === ['1.0000','0.3000'], 'Valores posteriores secuenciales');
verificarAjuste(array_column($audit, 'consumido_destino_antes') === ['0.2000','0.0000'], 'Consumo receptor antes');
verificarAjuste(array_column($audit, 'consumido_destino_despues') === ['0.4000','0.1000'], 'Consumo receptor después');
verificarAjuste($audit[0]['codigo_origen'] === 'A' && $audit[0]['codigo_destino'] === 'B', 'Códigos históricos');
verificarAjuste($audit[0]['motivo'] === 'Corrección de asignación' && $audit[0]['usuario_id'] === null && $audit[0]['created_at'], 'Motivo, fecha y usuario sin identificar');
verificarAjuste((int)$pdo->query('SELECT COUNT(*) FROM a_movimientos')->fetchColumn() === 0, 'Ningún movimiento material por consumo');
verificarAjuste(array_column($res['lotes'], 'cubicaje') === ['1.0000','1.0000','0.5000'], 'Cubicajes intactos');
$antes = snapshotAjuste($pdo);
try { confirmarCambiosLotesCierre($pdo, $datos); throw new RuntimeException('Aceptó datos obsoletos'); } catch (ConflictoLotesCierre $e) {}
verificarAjuste(snapshotAjuste($pdo) === $antes, 'Conflicto sin registros nuevos');
// El PA también rechaza importes y balances inválidos si se invoca directamente.
$call = $pdo->prepare('CALL pa_registrar_ajuste_consumo(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
foreach ([0, -0.1, 0.3] as $cantidadInvalida) {
    try {
        $call->execute([str_repeat('a', 32), 1, 1, 2, 'A', 'B', $cantidadInvalida, 1.2, 1.0, 0.2, 0.4, null, 'Prueba de validación']);
        throw new RuntimeException('El PA aceptó un balance inválido');
    } catch (PDOException $e) { verificarAjuste($e->getCode() === '45000', 'Validación explícita en el PA'); }
    $call->closeCursor();
}
verificarAjuste(snapshotAjuste($pdo) === $antes, 'PA inválido sin efectos');
// El PA también rechaza importes y balances inválidos si se invoca directamente.
$call = $pdo->prepare('CALL pa_registrar_ajuste_consumo(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
foreach ([0, -0.1, 0.3] as $cantidadInvalida) {
    try {
        $call->execute([str_repeat('a', 32), 1, 1, 2, 'A', 'B', $cantidadInvalida, 1.2, 1.0, 0.2, 0.4, null, 'Prueba de validación']);
        throw new RuntimeException('El PA aceptó un balance inválido');
    } catch (PDOException $e) { verificarAjuste($e->getCode() === '45000', 'Validación explícita en el PA'); }
    $call->closeCursor();
}
verificarAjuste(snapshotAjuste($pdo) === $antes, 'PA inválido sin efectos');
// El envío material y el ajuste de consumo se distinguen en un mismo borrador.
$datos = ['lotes_originales'=>basesAjuste($pdo), 'operaciones'=>[
    ['tipo'=>'restante','origen_id'=>2,'destino_id'=>3,'cantidad'=>'0.1000'],
    ['tipo'=>'consumo','origen_id'=>2,'destino_id'=>3,'cantidad'=>'0.1000'],
]];
confirmarCambiosLotesCierre($pdo, $datos, 42);
verificarAjuste((int)$pdo->query('SELECT COUNT(*) FROM a_movimientos')->fetchColumn() === 1, 'Solo el envío material genera movimiento');
verificarAjuste((int)$pdo->query('SELECT usuario_id FROM a_ajustes_consumo ORDER BY id DESC LIMIT 1')->fetchColumn() === 42, 'Actor recibido desde contexto servidor');
// Si falla el registro del ajuste, se revierten también los consumos y cubicajes.
$pdo->exec("ALTER TABLE a_ajustes_consumo ADD CONSTRAINT impedir_nuevo CHECK (cantidad >= 0.1000)");
$antes = snapshotAjuste($pdo);
$datos = ['lotes_originales'=>basesAjuste($pdo), 'operaciones'=>[
    ['tipo'=>'restante','origen_id'=>2,'destino_id'=>3,'cantidad'=>'0.0100'],
    ['tipo'=>'consumo','origen_id'=>2,'destino_id'=>3,'cantidad'=>'0.0001'],
]];
try { confirmarCambiosLotesCierre($pdo, $datos); throw new RuntimeException('Se esperaba fallo del registro'); } catch (PDOException $e) {}
verificarAjuste(snapshotAjuste($pdo) === $antes, 'Rollback íntegro de lotes, ajustes y movimientos');
echo "OK: ajustes auditados, sin movimientos materiales, valores secuenciales, actor, concurrencia y rollback; solo tablas temporales.\n";
