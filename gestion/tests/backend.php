<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/../api/router.php';

function check(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}
function rejects(callable $action, string $message): void
{
    try { $action(); } catch (InvalidArgumentException $e) { return; }
    throw new RuntimeException($message);
}
function create(PDO $pdo, string $table, array $data): int { return gSave($pdo, $table, ['action' => 'create', 'data' => $data])['id']; }

$pdo = fabricacionPdo();
// Todas las escrituras usan tablas TEMPORARY de esta conexión; no modifican
// datos reales, secuencias reales ni el esquema permanente de la base de datos.
$tables = array_unique([...array_keys(gCatalogo()), 'cuadrantes', 'cuadrante_detalles', 'palets', 'entradas_flejes', 'a_lotes']);
foreach ($tables as $table) {
    $temporary = 'gestion_test_' . $table;
    $pdo->exec("CREATE TEMPORARY TABLE `$temporary` LIKE `$table`");
    $pdo->exec("ALTER TABLE `$temporary` RENAME TO `$table`");
    $definition = $pdo->query("SHOW CREATE TABLE `$table`")->fetch(PDO::FETCH_NUM)[1];
    check(str_contains($definition, 'CREATE TEMPORARY TABLE'), "Tabla no aislada: $table");
    $pdo->exec("ALTER TABLE `$table` AUTO_INCREMENT = 2000000000");
}

$client = create($pdo, 'clientes', ['nombre' => 'Cliente de prueba']);
$row = gDataset($pdo, 'clientes')['rows'][0];
rejects(fn() => gSave($pdo, 'clientes', ['action' => 'update', 'id' => $client, 'version' => 'obsoleta', 'data' => ['nombre' => 'Cambio']]), 'Aceptó una versión obsoleta');
$saved = gSave($pdo, 'clientes', ['action' => 'update', 'id' => $client, 'version' => $row['_version'], 'data' => ['nombre' => ' Cliente actualizado ']]);
check($saved['row']['nombre'] === 'Cliente actualizado' && $saved['row']['_version'] !== $row['_version'], 'No devuelve el valor normalizado con su versión nueva para la celda');
check(gList($pdo, 'clientes')[0]['nombre'] === 'Cliente actualizado', 'No actualizó cliente');
$row = gDataset($pdo, 'clientes')['rows'][0];
gSave($pdo, 'clientes', ['action' => 'delete', 'id' => $client, 'version' => $row['_version']]);
check(count(gList($pdo, 'clientes')) === 0, 'No eliminó cliente');
rejects(fn() => create($pdo, 'clientes', ['nombre' => ' ']), 'Aceptó nombre vacío');
rejects(fn() => create($pdo, 'clientes', ['nombre' => 'Nombre', 'tabla' => 'usuarios']), 'Aceptó campo arbitrario');
echo "OK: CRUD de maestros, validación y control de concurrencia\n";

$role = create($pdo, 'roles', ['nombre' => 'Prueba']);
$user = create($pdo, 'usuarios', ['alias' => 'empleado-prueba', 'nombre' => 'Empleado de prueba', 'codigo' => 'PR', 'rol_id' => $role, 'clave' => 'clave-solo-en-tabla-temporal']);
$users = gDataset($pdo, 'usuarios');
check(!array_key_exists('clave', $users['rows'][0]), 'Expone clave');
$hash = $pdo->query('SELECT clave FROM usuarios')->fetchColumn();
check(password_verify('clave-solo-en-tabla-temporal', $hash), 'No cifra correctamente');
$roleRow = gDataset($pdo, 'roles')['rows'][0];
rejects(fn() => gSave($pdo, 'roles', ['action' => 'delete', 'id' => $role, 'version' => $roleRow['_version']]), 'Permite eliminar un rol en uso');
echo "OK: contraseñas cifradas, respuestas sin hashes y bloqueo de borrados relacionados\n";

$client = create($pdo, 'clientes', ['nombre' => 'Cliente pedido']);
$type = create($pdo, 'tipos_producto', ['tipo' => 'BOTA', 'codigo' => 'PRUEBA', 'descripcion' => 'Tipo prueba']);
$material = create($pdo, 'materiales', ['descripcion' => 'Madera prueba']);
$toast = create($pdo, 'tostados', ['descripcion' => 'Tostado prueba']);
$state = create($pdo, 'estados_pedidos', ['descripcion' => 'Estado pedido prueba']);
$weekState = create($pdo, 'estados_fabricacion_semanal', ['descripcion' => 'Estado fabricación prueba']);
$pedidoData = ['numero' => 'P-TEST', 'destino' => 'C', 'cliente_id' => $client, 'descripcion' => 'Pedido temporal', 'tipo_producto_id' => $type, 'material_id' => $material, 'tostado_id' => $toast, 'cantidad' => 100, 'cantidad_fabricada' => 0, 'fecha' => '2026-10-18', 'fecha_finalizacion' => '', 'estado' => $state];
$pedido = create($pdo, 'pedidos', $pedidoData);
$weekData = ['pedido_id' => $pedido, 'fecha_inicio' => '2026-10-19', 'cantidad' => 50, 'cantidad_fabricada' => 0, 'estado' => $weekState];
$week = create($pdo, 'fabricacion_semanal', $weekData);
$line = gList($pdo, 'fabricacion_semanal')[0];
check((int)$line['tipo_producto_id'] === $type && (int)$line['material_id'] === $material && (int)$line['tostado_id'] === $toast, 'No deriva campos del pedido');
$badWeek = $weekData; $badWeek['fecha_inicio'] = '2026-10-20';
rejects(fn() => create($pdo, 'fabricacion_semanal', $badWeek), 'Acepta semana que no empieza lunes');
$toast2 = create($pdo, 'tostados', ['descripcion' => 'Tostado modificado']);
$pedidoData['tostado_id'] = $toast2; $pedidoRow = gDataset($pdo, 'pedidos')['rows'][0];
gSave($pdo, 'pedidos', ['action' => 'update', 'id' => $pedido, 'version' => $pedidoRow['_version'], 'data' => $pedidoData]);
check((int)gList($pdo, 'fabricacion_semanal')[0]['tostado_id'] === $toast2, 'No sincroniza tostado');
echo "OK: pedidos y fabricación semanal, campos derivados, lunes y sincronización de tostado\n";

$puesto = create($pdo, 'puestos_trabajo', ['nombre' => 'Puesto prueba']);
$initial = gCuadrante($pdo, '2026-10-18');
check($initial['head'] === null && $initial['inicio'] === '2026-10-15', 'La lectura crea cuadrantes o calcula mal la semana');
$payload = ['inicio' => $initial['inicio'], 'version' => $initial['version'], 'action' => 'assign', 'fecha' => '2026-10-15', 'puesto_id' => $puesto, 'usuario_id' => $user];
gCCMutate($pdo, $payload);
$current = gCCDataset($pdo, '2026-10-18'); check(count($current['details']) === 1, 'No guarda asignacion');
rejects(fn() => gCCMutate($pdo, $payload), 'Acepta cuadrante obsoleto');
$payload['version'] = $current['version'];
rejects(fn() => gCCMutate($pdo, $payload), 'Acepta asignacion duplicada');
$payload['fecha'] = '2026-10-16';
create($pdo, 'dias_festivos', ['fecha' => '2026-10-16']);
rejects(fn() => gCCMutate($pdo, $payload), 'Acepta asignaciones nuevas en festivo');
check(count(gCCDataset($pdo, '2026-10-18')['details']) === 1, 'Un fallo destruye asignaciones anteriores');
$attendance = gInforme($pdo, 'asistencias_mensuales', ['periodo' => '2026-10']);
check($attendance['rows'][0]['asistencia'] === 1, 'Asistencia mensual incorrecta');
echo "OK: cuadrantes, guardado atómico, conflictos, festivos y asistencia mensual\n";

// Contrato de los primeros listados, ahora servido por el mismo router.
$provider = gDispatch($pdo, 'POST', 'proveedores', ['accion' => 'crear', 'nombre' => 'Proveedor migrado'], [], true)['id'];
$providers = gDispatch($pdo, 'GET', 'proveedores', [], [], true);
check($providers['filas'][0]['nombre'] === 'Proveedor migrado', 'Cambió el contrato del listado de proveedores');
$change = gDispatch($pdo, 'POST', 'proveedores', ['accion' => 'editar', 'id' => $provider, 'campo' => 'nombre', 'anterior' => 'Proveedor migrado', 'valor' => 'Proveedor editado'], [], true);
check($change['valor'] === 'Proveedor editado', 'No guarda edición de celda');
rejects(fn() => gDispatch($pdo, 'POST', 'proveedores', ['accion' => 'editar', 'id' => $provider, 'campo' => 'nombre', 'anterior' => 'Proveedor migrado', 'valor' => 'Conflicto'], [], true), 'Acepta versión obsoleta de celda');
gDispatch($pdo, 'POST', 'proveedores', ['accion' => 'eliminar', 'id' => $provider, 'anterior' => 'Proveedor editado'], [], true);
check(count(gDispatch($pdo, 'GET', 'proveedores', [], [], true)['filas']) === 0, 'No elimina proveedor migrado');
$installation = create($pdo, 'instalaciones', ['nombre' => 'Instalación migrada', 'tipo' => 'M']);
gDispatch($pdo, 'POST', 'ubicaciones', ['accion' => 'crear', 'descripcion' => 'Ubicación migrada', 'instalacion_id' => $installation, 'orden' => 1], [], true);
$locations = gDispatch($pdo, 'GET', 'ubicaciones', [], [], true);
check($locations['filas'][0]['instalacion'] === 'Instalación migrada' && count($locations['instalaciones']) === 1, 'No conserva los datos de instalaciones');
$pdo->prepare('INSERT INTO a_lotes (codigo, objetivo, cubicaje, consumido, estado) VALUES (?, ?, ?, ?, ?)')->execute(['LOTE-TEMPORAL', 'STOCK', 10, 3, 0]);
$lot = gDispatch($pdo, 'GET', 'lotes')['filas'][0];
check((float)$lot['restante'] === 7.0, 'Saldo incorrecto de lotes');
gDispatch($pdo, 'POST', 'lotes', ['accion' => 'editar', 'id' => $lot['id'], 'campo' => 'codigo', 'anterior' => 'LOTE-TEMPORAL', 'valor' => 'LOTE-EDITADO'], [], true);
check(gDispatch($pdo, 'GET', 'lotes')['filas'][0]['codigo'] === 'LOTE-EDITADO', 'No edita lotes migrados');
$summary = gDispatch($pdo, 'GET', 'resumen');
check((float)$summary['volumen'] === 7.0 && $summary['ubicaciones'] === 1, 'Resumen migrado incorrecto');
echo "OK: router común para altas, edición, borrado, ubicaciones, lotes y resumen\n";
echo "Pruebas terminadas. Las tablas temporales se eliminan al cerrar la conexión.\n";
