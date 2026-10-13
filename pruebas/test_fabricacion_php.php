<?php
declare(strict_types=1);
require_once __DIR__ . '/../api/fabricacion_crear_botas.php';

function comprobar(bool $condicion, string $mensaje): void
{
    if (!$condicion) throw new RuntimeException($mensaje);
}

$pdo = fabricacionPdo();
// Las tablas TEMPORARY ocultan las reales solo en esta conexión. Nunca se insertan
// productos de prueba en las tablas permanentes ni se llama a la impresora.
$tablas = ['productos', 'productos_operarios', 'fabricacion_semanal', 'pedidos',
    'a_lotes', 'a_trazabilidad_botas', 'a_trazabilidad_fondos',
    'tipos_producto', 'usuarios', 'consumos', 'entradas_flejes'];
foreach ($tablas as $tabla) {
    $ddl = $pdo->query("SHOW CREATE TABLE `$tabla`")->fetch(PDO::FETCH_NUM)[1];
    $ddl = preg_replace('/^CREATE TABLE/', 'CREATE TEMPORARY TABLE', $ddl);
    $ddl = preg_replace('/^\s*CONSTRAINT .*FOREIGN KEY.*\n/m', '', $ddl);
    $ddl = preg_replace('/,\n\)/', "\n)", $ddl);
    $pdo->exec($ddl);
}
$pdo->exec("INSERT INTO tipos_producto (id,codigo,tipo,descripcion) VALUES (1,'B','BOTA','Prueba'),(2,'D','DUELA','Prueba'),(3,'F','FONDO','Prueba'),(4,'FL40','FLEJE','Fleje 40'),(5,'FL70','FLEJE','Fleje 70')");
$pdo->exec("INSERT INTO usuarios (id,alias,nombre,activo) VALUES (7,'test','Test',1)");
$pdo->exec("INSERT INTO pedidos (id,cantidad,cantidad_fabricada) VALUES (1,20,4)");
$pdo->exec("INSERT INTO fabricacion_semanal (id,pedido_id,tipo_producto_id,cantidad,cantidad_fabricada,estado) VALUES (1,1,1,10,3,2)");
$pdo->exec("INSERT INTO a_lotes (id,codigo,objetivo,cubicaje,estado) VALUES (1,'LOTE0001','BOTAS',1,1),(2,'LOTE0002','BOTAS',1,1)");
$pdo->exec("INSERT INTO a_lotes (id,codigo,objetivo,cubicaje,estado) VALUES (3,'FONDOS','FONDOS',0,1)");
$pdo->exec("INSERT INTO consumos (bota_id,consumible_id,consumo) VALUES (1,2,0.1429),(1,3,0.0253),(1,4,10),(1,5,3)");
$pdo->exec("INSERT INTO entradas_flejes (id,fecha,tipo_producto_id,lote,peso,consumido,restante,estado) VALUES
    (1,'2026-01-01',4,'40-ANTIGUO',5,0,5,1),
    (2,'2026-01-02',4,'40-ULTIMO',10,0,10,1),
    (3,'2026-01-01',5,'70',20,0,20,0),
    (4,'2026-01-01',4,'NO-SELECCIONADO',20,0,20,0),
    (5,'2026-01-01',5,'ELIMINADO',20,0,20,1)");
$pdo->exec('UPDATE entradas_flejes SET is_deleted=1 WHERE id=5');
comprobar(count(listarEntradasFlejes($pdo)) === 4, 'Carga PHP excluye entradas eliminadas');
comprobar(seleccionarEntradaFleje($pdo, 3, 1)['estado'] === 1, 'Selección PHP de fleje 70');
comprobar(seleccionarEntradaFleje($pdo, 3, 0)['estado'] === 0, 'Deselección PHP');
seleccionarEntradaFleje($pdo, 3, 1);
$datos = ['fabricacion_semanal_id'=>1, 'lotes_botas_ids'=>[2,1], 'lote_fondos_id'=>3,
    'batidero'=>11, 'operarios_ids'=>[7], 'cantidad_etiquetas'=>2];
$respuesta = crearBotasFabricacion($pdo, $datos);
comprobar($respuesta['ok'] && count(array_unique($respuesta['codigos'])) === 2, 'Dos códigos distintos');
$fecha = new DateTimeImmutable('now', new DateTimeZone('Europe/Madrid'));
comprobar($respuesta['codigos'][0] === 'LOTE00010711X'.$fecha->format('ym').'00001', 'Formato de código original');
comprobar($pdo->query('SELECT consumido FROM a_lotes WHERE id=1')->fetchColumn() === '0.1430', 'Reparto con resto a cuatro decimales');
comprobar($pdo->query('SELECT consumido FROM a_lotes WHERE id=2')->fetchColumn() === '0.1428', 'Reparto exacto');
comprobar((int)$pdo->query('SELECT SUM(contador_botas) FROM a_lotes')->fetchColumn() === 4, 'Contadores de lotes de botas');
comprobar($pdo->query('SELECT consumido FROM a_lotes WHERE id=3')->fetchColumn() === '0.1012', 'Dos fondos por bota');
comprobar((int)$pdo->query('SELECT contador_fondos FROM a_lotes WHERE id=3')->fetchColumn() === 4, 'Contador de fondos por dos');
comprobar((int)$pdo->query('SELECT COUNT(*) FROM a_trazabilidad_fondos')->fetchColumn() === 2, 'Una sola traza de fondos por bota');
comprobar((int)$pdo->query('SELECT COUNT(*) FROM a_trazabilidad_fondos tf JOIN productos p ON p.id=tf.id_bota WHERE tf.cantidad=0.0506')->fetchColumn() === 2, 'Trazas vinculadas y cantidad doble');
comprobar((int)$pdo->query('SELECT COUNT(*) FROM a_trazabilidad_botas')->fetchColumn() === 4, 'Una traza de cada lote por bota');
comprobar((int)$pdo->query('SELECT cantidad_fabricada FROM fabricacion_semanal')->fetchColumn() === 5, 'Contador fabricación');
comprobar((int)$pdo->query('SELECT cantidad_fabricada FROM pedidos')->fetchColumn() === 6, 'Contador pedido');
comprobar($pdo->query('SELECT consumido FROM entradas_flejes WHERE id=1')->fetchColumn() === '5.00', 'Fleje 40 consume primero la entrada antigua');
comprobar((int)$pdo->query('SELECT estado FROM entradas_flejes WHERE id=1')->fetchColumn() === 2, 'Entrada antigua agotada cerrada');
comprobar($pdo->query('SELECT restante FROM entradas_flejes WHERE id=2')->fetchColumn() === '-5.00', 'Último fleje absorbe el consumo pendiente');
comprobar((int)$pdo->query('SELECT estado FROM entradas_flejes WHERE id=2')->fetchColumn() === 1, 'Última entrada sigue seleccionada');
comprobar($pdo->query('SELECT consumido FROM entradas_flejes WHERE id=3')->fetchColumn() === '6.00', 'Fleje 70 por dos botas');
comprobar($pdo->query('SELECT consumido FROM entradas_flejes WHERE id=4')->fetchColumn() === '0.00', 'Fleje no seleccionado intacto');
comprobar(count(listarEntradasFlejes($pdo)) === 3, 'Carga excluye flejes agotados');
try {
    seleccionarEntradaFleje($pdo, 1, 1);
    throw new RuntimeException('Se reactivó una entrada agotada');
} catch (InvalidArgumentException $error) { }
comprobar((int)$pdo->query('SELECT COUNT(*) FROM productos_operarios WHERE usuario_id=7 AND codigo_batidero=11')->fetchColumn() === 2, 'Operario y batidero registrados');

function estadoPrueba(PDO $pdo): array
{
    $estado=[];
    foreach (['productos','productos_operarios','a_lotes','a_trazabilidad_botas','a_trazabilidad_fondos','fabricacion_semanal','pedidos','entradas_flejes'] as $t) {
        $estado[$t]=$pdo->query("SELECT * FROM `$t`")->fetchAll(PDO::FETCH_ASSOC);
    }
    return $estado;
}

foreach ([['cantidad_etiquetas'=>0], ['cantidad_etiquetas'=>1.5], ['lotes_botas_ids'=>[1]], ['operarios_ids'=>[999]], ['batidero'=>99]] as $cambio) {
    $antes=estadoPrueba($pdo);
    try {
        crearBotasFabricacion($pdo, array_replace($datos, $cambio));
        throw new RuntimeException('Se aceptó una petición inválida');
    } catch (InvalidArgumentException $error) {
        comprobar(estadoPrueba($pdo) === $antes, 'Petición inválida sin efectos');
    }
}

// Sin fleje 70 seleccionado, se revierte también el descuento previo de fleje 40.
seleccionarEntradaFleje($pdo, 3, 0);
$antes = estadoPrueba($pdo);
try {
    crearBotasFabricacion($pdo, $datos);
    throw new RuntimeException('Se fabricó sin fleje 70 seleccionado');
} catch (InvalidArgumentException $error) {
    comprobar(estadoPrueba($pdo) === $antes, 'Falta de fleje revierte toda la fabricación');
}
seleccionarEntradaFleje($pdo, 3, 1);

// Forzar un fallo DESPUÉS de descontar flejes e insertar producto y trazas.
$pdo->exec("SET SESSION sql_mode='STRICT_ALL_TABLES'");
$pdo->exec('UPDATE a_lotes SET consumido=999999.9999 WHERE id=3');
$antes=estadoPrueba($pdo);
try {
    crearBotasFabricacion($pdo, $datos);
    throw new RuntimeException('Se esperaba un fallo de capacidad decimal');
} catch (PDOException $error) {
    comprobar(estadoPrueba($pdo) === $antes, 'Rollback completo ante fallo a mitad de fabricación');
}
$pdo->exec('UPDATE a_lotes SET consumido=0.1012 WHERE id=3');
$tercera=crearBotasFabricacion($pdo, array_replace($datos, ['cantidad_etiquetas'=>1]));
comprobar(str_ends_with($tercera['codigo'], '00003'), 'Numeración consecutiva después de rollback');
echo "OK: creación, reparto exacto, fondos x2, trazas, contadores, validación y rollback (tablas temporales).\n";
