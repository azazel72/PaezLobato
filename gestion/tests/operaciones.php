<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/../api/router.php';
function opCheck(bool $ok, string $message): void { if (!$ok) throw new RuntimeException($message); }
function opReject(callable $fn): void { try { $fn(); } catch (InvalidArgumentException $e) { return; } throw new RuntimeException('Se aceptó una operación inválida.'); }
function opCreate(PDO $pdo, string $resource, array $data): array { return gDispatch($pdo, 'POST', $resource, ['action' => 'create', 'data' => $data])['row']; }
function opData(string $resource, array $row): array { return array_intersect_key($row, array_filter(gConfig($resource)['fields'], fn($field) => !($field['readonly'] ?? false))); }
function opUpdate(PDO $pdo, string $resource, array $row, array $changes): array { return gDispatch($pdo, 'POST', $resource, ['action' => 'update', 'id' => $row['id'], 'version' => $row['_version'], 'data' => array_replace(opData($resource, $row), $changes)])['row']; }

$pdo = fabricacionPdo();
// CREATE TEMPORARY ... LIKE no copia triggers; solo se escriben copias de esta conexión.
$tables = [...array_keys(gCatalogo()), 'bota_envinada_archivo', 'bota_envinada_analitica'];
foreach (array_unique($tables) as $table) {
    $temp = 'gestion_op_' . $table;
    $pdo->exec("CREATE TEMPORARY TABLE `$temp` LIKE `$table`"); $pdo->exec("ALTER TABLE `$temp` RENAME TO `$table`");
    opCheck(str_contains($pdo->query("SHOW CREATE TABLE `$table`")->fetch(PDO::FETCH_NUM)[1], 'CREATE TEMPORARY TABLE'), 'Tabla no aislada.');
    $pdo->exec("ALTER TABLE `$table` AUTO_INCREMENT = 1800000000");
}
$provider = opCreate($pdo, 'proveedores', ['nombre' => 'Prueba']);
$material = opCreate($pdo, 'materiales', ['descripcion' => 'Roble temporal']);
$duela = opCreate($pdo, 'tipos_producto', ['tipo' => 'DUELA', 'codigo' => 'D-TEST', 'descripcion' => 'Duela temporal']);
$fleje = opCreate($pdo, 'tipos_producto', ['tipo' => 'FLEJE', 'codigo' => 'F-TEST', 'descripcion' => 'Fleje temporal']);
$bota = opCreate($pdo, 'tipos_producto', ['tipo' => 'BOTA', 'codigo' => 'B-TEST', 'descripcion' => 'Bota temporal']);
$state = opCreate($pdo, 'estados_flejes', ['descripcion' => 'Activo']);
$pdo->exec("INSERT INTO estados_flejes (id, descripcion) VALUES (0, 'Disponible')");
$zeroState = gDataset($pdo, 'estados_flejes')['rows'][1];
opCheck((int)$zeroState['id'] === 0, 'No lee el estado histórico con ID cero.');
$zeroState = opUpdate($pdo, 'estados_flejes', $zeroState, ['descripcion' => 'Disponible temporal']);
opCheck($zeroState['descripcion'] === 'Disponible temporal', 'No edita el estado cero.');
$ambient = opCreate($pdo, 'ambientes', ['fecha' => '2026-10-19', 'temperatura_1' => '-1.25', 'humedad_1' => '82.50']);
opCheck((float)$ambient['temperatura_1'] === -1.25, 'Pierde decimales negativos.');
opReject(fn() => opUpdate($pdo, 'ambientes', $ambient, ['humedad_1' => 101]));
opReject(fn() => opUpdate($pdo, 'ambientes', $ambient, ['temperatura_1' => 1.234]));
opReject(fn() => opUpdate($pdo, 'ambientes', $ambient, ['temperatura_1' => 'NaN']));
$entry = opCreate($pdo, 'entradas', ['numero' => 'E-TEST', 'proveedor_id' => $provider['id'], 'fecha' => '2026-10-19']);
$line = opCreate($pdo, 'lineas_entrada', ['entrada_id' => $entry['id'], 'tipo_producto_id' => $duela['id'], 'material_id' => $material['id'], 'bultos' => 3, 'kilos' => '1234.56']);
$hoop = opCreate($pdo, 'entradas_flejes', ['fecha' => '2026-10-19', 'tipo_producto_id' => $fleje['id'], 'lote' => 'F-TEST', 'peso' => '100.25', 'consumido' => '30.10', 'estado' => $state['id']]);
opCheck((float)$hoop['restante'] === 70.15, 'Restante de flejes incorrecto.');
$hoop = opUpdate($pdo, 'entradas_flejes', $hoop, ['consumido' => '40.25']); opCheck((float)$hoop['restante'] === 60.0, 'No recalcula restante al editar.');
$hoop = opUpdate($pdo, 'entradas_flejes', $hoop, ['estado' => 0]); opCheck((int)$hoop['estado'] === 0, 'No admite el estado de flejes cero.');
opReject(fn() => opUpdate($pdo, 'entradas_flejes', $hoop, ['tipo_producto_id' => $duela['id']]));
$pallet = opCreate($pdo, 'palets', ['codigo' => 'P-TEST', 'linea_entrada_id' => $line['id'], 'cubicaje' => '1.234', 'consumido' => '0.123']);
opCheck((int)$pallet['material_id'] === (int)$material['id'] && (int)$pallet['tipo_producto_id'] === (int)$duela['id'], 'No deriva campos del palet.');
opCheck((float)$pallet['restante'] === 1.111, 'Restante del palet incorrecto.');
opCheck(hash_equals($pallet['_version'], gDataset($pdo, 'palets')['rows'][0]['_version']), 'Versiones distintas entre fila y listado.');
$pallet = opUpdate($pdo, 'palets', $pallet, ['cubicaje' => '1.500']);
opCheck((float)$pallet['restante'] === 1.377, 'No devuelve campos calculados al editar.');
echo "OK: ambiente y decimales, entradas y líneas, flejes y restantes, palets y campos derivados.\n";

$first = gDispatch($pdo, 'POST', 'planificacion_entradas', ['action' => 'initialize', 'year' => 2026]);
opCheck($first['created'] === 5, 'No crea proveedor, materiales y facturación.');
opCheck(gInicializarPlan($pdo, ['action' => 'initialize', 'year' => 2026])['created'] === 0, 'Inicializar duplica registros.');
$plan = gDataset($pdo, 'plan_camiones')['rows'][0];
$plan = opUpdate($pdo, 'plan_camiones', $plan, ['total_pactados' => 10, 'total_descontar' => 2, 'ene_previsto' => 8, 'ene_confirmado' => 3]);
opCheck((int)$plan['total_previstos'] === 8 && (int)$plan['total_entregados'] === 3, 'Totales anuales incorrectos.');
opReject(fn() => opCreate($pdo, 'plan_camiones', ['año' => 2026, 'proveedor_id' => $provider['id']]));
opReject(fn() => gInicializarPlan($pdo, ['action' => 'initialize', 'year' => 3000]));
$cube = opCreate($pdo, 'cubicaje', ['tipo_producto_id' => $duela['id'], 'cubicaje_estandar' => '0.123']);
opReject(fn() => opCreate($pdo, 'cubicaje', ['tipo_producto_id' => $fleje['id'], 'cubicaje_estandar' => '0.123']));
opReject(fn() => opCreate($pdo, 'cubicaje', ['tipo_producto_id' => $duela['id'], 'cubicaje_estandar' => '0.100']));
$consumption = opCreate($pdo, 'consumos', ['bota_id' => $bota['id'], 'consumible_id' => $duela['id'], 'consumo' => '0.1234']);
$recipe = opCreate($pdo, 'a_consumos', ['tipo_producto_id' => $bota['id'], 'consumo_duelas' => '0.1234', 'consumo_fleje_40' => '1.2500', 'consumo_fleje_70' => '2.5000', 'consumo_fondo' => '0.0250']);
opCheck((float)$recipe['consumo_duelas'] === 0.1234 && (float)$recipe['consumo_fleje_70'] === 2.5, 'Pierde decimales de la receta.');
opReject(fn() => opCreate($pdo, 'a_consumos', ['tipo_producto_id' => $bota['id']]));
opReject(fn() => opUpdate($pdo, 'a_consumos', $recipe, ['consumo_fondo' => -1]));
opReject(fn() => opUpdate($pdo, 'a_consumos', $recipe, ['consumo_duelas' => '0.12345']));
$recipe = opUpdate($pdo, 'a_consumos', $recipe, ['consumo_fleje_40' => '1.5000']);
opCheck((float)$recipe['consumo_fleje_40'] === 1.5, 'No edita el consumo de fleje 40.');
gDispatch($pdo, 'POST', 'a_consumos', ['action' => 'delete', 'id' => $recipe['id'], 'version' => $recipe['_version']]);
opCheck(count(gList($pdo, 'a_consumos')) === 0, 'No elimina la receta.');
echo "OK: a_consumos, cuatro consumos decimales, tipo único, validación, edición y borrado.\n";
opReject(fn() => opCreate($pdo, 'consumos', ['bota_id' => $fleje['id'], 'consumible_id' => $duela['id'], 'consumo' => '0.1000']));
echo "OK: planificación anual idempotente y totales, referencias por tipo, consumos y cubicaje.\n";

$pallet2 = opCreate($pdo, 'palets', ['codigo' => 'P-TEST-2']);
$process = opCreate($pdo, 'trazabilidad_procesado', ['palet_origen_id' => $pallet['id'], 'palet_destino_id' => $pallet2['id']]);
opReject(fn() => opUpdate($pdo, 'trazabilidad_procesado', $process, ['palet_destino_id' => $pallet['id']]));
$trace = opCreate($pdo, 'trazabilidad_fabricacion', ['palet_id' => $pallet['id'], 'cantidad_fabricada' => 3]);
$pdo->exec("INSERT INTO estados_productos (id, descripcion) VALUES (4, 'Envinada')");
$product = opCreate($pdo, 'productos', ['tipo' => 'BOTA', 'tipo_producto_id' => $bota['id'], 'codigo' => 'B-TEST', 'estado' => 4]);
opReject(fn() => opUpdate($pdo, 'productos', $product, ['tipo_producto_id' => $duela['id']]));
$traceProduct = opCreate($pdo, 'trazabilidad_producto', ['trazabilidad_fabricacion_id' => $trace['id'], 'producto_id' => $product['id']]);
$analysis = opCreate($pdo, 'analiticas', ['fecha' => '2026-10-19', 'descripcion' => 'Analítica temporal', 'ph' => '3.50', 'observaciones' => 'Texto <literal>']);
$pdo->prepare('INSERT INTO bota_envinada_analitica (producto_id, analitica_id) VALUES (?, ?)')->execute([$product['id'], $analysis['id']]);
$pdo->prepare("INSERT INTO archivos_subidos (titulo, nombre_original, nombre_archivo, extension, entidad, entidad_id) VALUES ('Prueba', 'prueba.pdf', 'no-es-un-fichero-real.pdf', 'pdf', 'productos_envinados', ?)")->execute([$product['id']]);
$file = (int)$pdo->lastInsertId();
$payload = ['action' => 'attach', 'producto_ids' => [$product['id']], 'archivo_ids' => [$file]];
opCheck(gDispatch($pdo, 'POST', 'documentos_envinados', $payload)['changed'] === 1, 'No vincula documento.');
opCheck(gGuardarDocumentos($pdo, $payload)['changed'] === 0, 'Duplica documentos.');
opCheck(count(gDocumentosEnvinados($pdo, ['producto_id' => $product['id']])['rows']) === 1, 'No lista archivos.');
$summary = gDispatch($pdo, 'GET', 'documentos_envinados')['rows'][0];
opCheck((int)$summary['documentos_count'] === 1 && $summary['analitica_descripcion'] === 'Analítica temporal', 'Resumen de documentos incorrecto.');
opReject(fn() => gGuardarDocumentos($pdo, ['action' => 'attach', 'producto_ids' => [$product['id'], 1], 'archivo_ids' => [$file]]));
opCheck(count(gDocumentosEnvinados($pdo, ['producto_id' => $product['id']])['rows']) === 1, 'No revierte lote inválido.');
opReject(fn() => gSave($pdo, 'productos', ['action' => 'delete', 'id' => $product['id'], 'version' => $product['_version']]));
opCheck(gGuardarDocumentos($pdo, array_replace($payload, ['action' => 'detach']))['changed'] === 1, 'No desvincula documento.');
opCheck((int)$pdo->query('SELECT COUNT(*) FROM archivos_subidos')->fetchColumn() === 1, 'Desvincular elimina el archivo.');
opReject(fn() => gDispatch($pdo, 'POST', 'consumos', ['action' => 'update', 'id' => $consumption['id'], 'version' => 'obsoleta', 'data' => opData('consumos', $consumption)]));
gDispatch($pdo, 'POST', 'trazabilidad_producto', ['action' => 'delete', 'id' => $traceProduct['id'], 'version' => $traceProduct['_version']]);
opCheck(count(gList($pdo, 'trazabilidad_producto')) === 0, 'No aplica baja lógica.');
echo "OK: productos, analíticas, tres trazabilidades, documentos, atomicidad, versiones y borrados relacionados.\n";
foreach (array_keys(gCatalogosOperaciones()) as $resource) opCheck(isset(gDispatch($pdo, 'GET', $resource)['rows']), 'Recurso no disponible: ' . $resource);
echo "OK: todos los nuevos recursos consultables por el router. Solo se han escrito tablas temporales.\n";
