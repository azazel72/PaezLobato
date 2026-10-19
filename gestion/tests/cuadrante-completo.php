<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/../api/router.php';
function ccCheck(bool $ok, string $message): void { if (!$ok) throw new RuntimeException($message); }
function ccReject(callable $fn, string $message): void { try { $fn(); } catch (InvalidArgumentException $e) { return; } throw new RuntimeException($message); }
$pdo = fabricacionPdo();
foreach (['cuadrantes', 'cuadrante_detalles', 'usuarios', 'puestos_trabajo', 'dias_festivos'] as $table) {
    $temp = 'cc_test_' . $table;
    $pdo->exec("CREATE TEMPORARY TABLE `$temp` LIKE `$table`"); $pdo->exec("ALTER TABLE `$temp` RENAME TO `$table`");
    ccCheck(str_contains($pdo->query("SHOW CREATE TABLE `$table`")->fetch(PDO::FETCH_NUM)[1], 'CREATE TEMPORARY TABLE'), 'Tabla no aislada');
    $pdo->exec("ALTER TABLE `$table` AUTO_INCREMENT = 2000000000");
}
$users = [];
foreach (['Ana', 'Benito', 'Carmen', 'Diego'] as $i => $name) {
    $pdo->prepare('INSERT INTO usuarios (alias, nombre, clave, empleado, activo, codigo) VALUES (?, ?, ?, 1, 1, ?)')->execute([$name, $name, 'solo_en_tabla_temporal', (string)($i + 1)]); $users[] = (int)$pdo->lastInsertId();
}
$positions = [];
foreach (['BATIDERO 1', 'BATIDERO 2', 'BATIDERO 3', 'Otro puesto'] as $i => $name) {
    $pdo->prepare('INSERT INTO puestos_trabajo (nombre, orden, listado, fabricacion, activo) VALUES (?, ?, 0, 1, 1)')->execute([$name, $i + 1]); $positions[] = (int)$pdo->lastInsertId();
}
$start = '2026-10-15';
$state = gDispatch($pdo, 'GET', 'cuadrante_completo', [], ['fecha' => '2026-10-18']);
ccCheck($state['head'] === null && $state['inicio'] === $start, 'GET crea o calcula mal la semana');
$mutate = function (array $payload) use ($pdo, $start): array { $state = gCCDataset($pdo, $start); return gDispatch($pdo, 'POST', 'cuadrante_completo', ['inicio' => $start, 'version' => $state['version']] + $payload); };
$assign = fn(int $u, int $p, string $date) => $mutate(['action' => 'assign', 'usuario_id' => $u, 'puesto_id' => $p, 'fecha' => $date]);
$oldVersion = $state['version']; $state = $assign($users[0], $positions[0], $start); $detail = $state['details'][0];
ccCheck(count($state['details']) === 1 && $state['head'] !== null, 'No crea asignación');
ccReject(fn() => gCCMutate($pdo, ['inicio' => $start, 'version' => $oldVersion, 'action' => 'clear']), 'Acepta versión obsoleta');
ccReject(fn() => $assign($users[0], $positions[0], $start), 'Duplica en la misma celda');
ccReject(fn() => $assign($users[0], $positions[1], $start), 'No pide confirmación de conflicto');
$state = $mutate(['action' => 'assign', 'usuario_id' => $users[0], 'puesto_id' => $positions[1], 'fecha' => '2026-10-16', 'detail_id' => $detail['id']]);
ccCheck(count($state['details']) === 1 && $state['details'][0]['id'] === $detail['id'] && $state['details'][0]['fecha'] === '2026-10-16', 'Mover pierde ID o duplica');
$state = $mutate(['action' => 'remove', 'detail_id' => $detail['id']]); ccCheck(count($state['details']) === 0, 'No quita asignación');
echo "OK: alta, traslado conservando ID, retirada, duplicados y conflictos\n";

$assign($users[0], $positions[0], $start); $assign($users[1], $positions[1], $start); $assign($users[2], $positions[3], $start);
$clone = ['action' => 'clone', 'from' => $start, 'to' => '2026-10-16'];
$state = $mutate($clone); ccCheck(count($state['details']) === 6, 'Clonado incompleto');
$state = $mutate($clone + ['keep' => true]); ccCheck(count($state['details']) === 6, 'Clonar conservando destino duplica');
$assign($users[3], $positions[3], '2026-10-16');
$state = $mutate($clone); ccCheck(count($state['details']) === 6, 'Clonar no reemplaza destino');
$mutate(['action' => 'assign', 'usuario_id' => $users[0], 'puesto_id' => $positions[3], 'fecha' => $start, 'allow_conflicts' => true]);
ccCheck(count(gCCDataset($pdo, $start)['details']) === 7, 'No permite duplicado confirmado en otro puesto');
// Volver a tres asignaciones origen para comprobar una rotación inequívoca.
$state = gCCDataset($pdo, $start); foreach ($state['details'] as $d) if ($d['fecha'] === $start && (int)$d['puesto_id'] === $positions[3] && (int)$d['usuario_id'] === $users[0]) $mutate(['action' => 'remove', 'detail_id' => $d['id']]);
$pdo->prepare('INSERT INTO dias_festivos (fecha) VALUES (?)')->execute(['2026-10-16']);
ccReject(fn() => $assign($users[3], $positions[0], '2026-10-16'), 'Asigna en festivo');
ccReject(fn() => $mutate($clone), 'Clona en festivo');
$state = $mutate(['action' => 'extend']);
$find = fn(string $date, int $user) => array_values(array_filter($state['details'], fn($d) => $d['fecha'] === $date && (int)$d['usuario_id'] === $user));
ccCheck((int)$find('2026-10-19', $users[0])[0]['puesto_id'] === $positions[1], 'Rotación lunes incorrecta al saltar festivo');
ccCheck((int)$find('2026-10-20', $users[0])[0]['puesto_id'] === $positions[2], 'Rotación martes incorrecta');
ccCheck((int)$find('2026-10-21', $users[0])[0]['puesto_id'] === $positions[0], 'Rotación miércoles incorrecta');
ccCheck(count(array_filter($state['details'], fn($d) => $d['fecha'] === '2026-10-16')) === 3, 'Extender modifica un festivo');
echo "OK: clonar combinando/reemplazando, festivos y rotación de tres batideros\n";

$oldView = gCuadrante($pdo, $start);
$assign($users[3], $positions[3], '2026-10-19');
ccReject(fn() => $mutate(['action' => 'metadata', 'titulo' => 'No se guarda']), 'Permite editar campos retirados');
ccReject(fn() => gCCMutate($pdo, ['inicio' => $start, 'version' => $oldView['version'], 'action' => 'clear']), 'Una ventana obsoleta puede sobrescribir cambios');
$state = $mutate(['action' => 'clear']); ccCheck(count($state['details']) === 0, 'Limpiar deja asignaciones');
ccCheck(!array_key_exists('titulo', $state['head']) && !array_key_exists('observaciones', $state['head']), 'Expone campos retirados');
$other = gCCDataset($pdo, '2026-10-22');
ccReject(fn() => gCCMutate($pdo, ['inicio' => $other['inicio'], 'version' => $other['version'], 'action' => 'assign', 'usuario_id' => 1, 'puesto_id' => $positions[0], 'fecha' => '2026-10-22']), 'Acepta empleado inexistente');
ccCheck(gCCDataset($pdo, '2026-10-22')['head'] === null, 'Un fallo deja creada una semana');
echo "OK: campos retirados, limpiar, rollback y concurrencia\n";
echo "Todas las escrituras se han realizado en tablas TEMPORARY de esta conexión.\n";
