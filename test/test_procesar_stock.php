<?php
declare(strict_types=1);
require_once __DIR__ . '/../api/procesar_stock.php';
function verificarProcesar(bool $ok, string $mensaje): void { if (!$ok) throw new RuntimeException($mensaje); }
$pdo = fabricacionPdo();
// Todas las escrituras se aíslan en tablas temporales de esta conexión.
foreach (['a_lotes','a_movimientos','tipos_producto','ubicaciones','materiales','cubicaje'] as $tabla) {
    $ddl = $pdo->query("SHOW CREATE TABLE $tabla")->fetch(PDO::FETCH_NUM)[1];
    $ddl = preg_replace('/^CREATE TABLE/', 'CREATE TEMPORARY TABLE', $ddl);
    $ddl = preg_replace('/^\s*CONSTRAINT .*FOREIGN KEY.*\n/m', '', $ddl);
    $ddl = preg_replace('/,\n\)/', "\n)", $ddl);
    $pdo->exec($ddl);
}
$pdo->exec("INSERT INTO tipos_producto (id,codigo,tipo,descripcion) VALUES (1,'D','DUELA','Duela'),(2,'F','FONDO','Fondo')");
$pdo->exec("INSERT INTO materiales (id,descripcion) VALUES (1,'Roble')");
$pdo->exec("INSERT INTO ubicaciones (id,descripcion,instalacion_id) VALUES (1,'Origen',1),(2,'Otro destino',1)");
$pdo->exec("INSERT INTO cubicaje (tipo_producto_id,cubicaje_estandar) VALUES (1,0.1234)");
$pdo->exec("INSERT INTO a_lotes (id,codigo,objetivo,tipo_producto_id,material_id,cubicaje,consumido,estado,ubicacion_id) VALUES
    (1,'ABCDEFGH-extra#000001','STOCK',1,1,2,0,0,1),
    (2,'PROCESADO','ALMACENADO',1,1,2,0,0,1),
    (3,'CERRADO','STOCK',1,1,2,0,2,1),
    (4,'SIN-SALDO','STOCK',1,1,2,2,0,1),
    (5,'FONDO','STOCK',2,1,2,0,0,1),
    (6,'ABCDEFGH','ALMACENADO',1,1,5,0,0,2)");
$lista = listarStockProcesar($pdo);
verificarProcesar(array_column($lista['stock'],'id') == [1], 'Solo stock de duela activo con saldo');
verificarProcesar($lista['stock'][0]['codigo_destino'] === 'ABCDEFGH', 'Nombre propuesto por PHP, ocho caracteres');
verificarProcesar(nombreDestinoProcesarStock('LOTE#00001') === 'LOTE', 'Nombre antes del separador');
verificarProcesar($lista['stock'][0]['ubicacion_id'] == 1, 'Carga ubicación real del origen');
$datos = ['origen_id'=>1,'ubicacion_id'=>1,'codigo_destino'=>'ABCDEFGH','cubicaje'=>'0.1234','paquetes'=>2];
$primera = procesarStockPhp($pdo,$datos);
$segunda = procesarStockPhp($pdo,$datos);
verificarProcesar($primera['destino_id'] === $segunda['destino_id'], 'Acumula en el mismo lote');
verificarProcesar($pdo->query('SELECT cubicaje FROM a_lotes WHERE id='.$primera['destino_id'])->fetchColumn() === '0.4936', 'Acumula cubicaje exacto por paquetes');
verificarProcesar($pdo->query('SELECT consumido FROM a_lotes WHERE id=1')->fetchColumn() === '0.4936', 'Descuenta del origen');
verificarProcesar($pdo->query('SELECT cubicaje FROM a_lotes WHERE id=6')->fetchColumn() === '5.0000', 'Mismo nombre en otra ubicación intacto');
$otro = procesarStockPhp($pdo,array_replace($datos,['ubicacion_id'=>2]));
verificarProcesar($otro['destino_id'] === 6, 'Ubicación alternativa acumula en su propio lote');
$movimientos = $pdo->query('SELECT * FROM a_movimientos')->fetchAll();
verificarProcesar(array_column($movimientos,'situacion_origen') === ['stock','stock','stock'], 'Movimiento desde stock');
verificarProcesar(array_column($movimientos,'situacion_destino') === ['almacenado','almacenado','almacenado'], 'Movimiento hacia almacenado');
function estadoProcesar(PDO $pdo): array {
    return [$pdo->query('SELECT * FROM a_lotes ORDER BY id')->fetchAll(),$pdo->query('SELECT * FROM a_movimientos ORDER BY id')->fetchAll()];
}
foreach ([['ubicacion_id'=>999],['codigo_destino'=>''],['cubicaje'=>'2'],['paquetes'=>1.5],['paquetes'=>true],['origen_id'=>2],['origen_id'=>3],['origen_id'=>4],['origen_id'=>5]] as $cambio) {
    $antes = estadoProcesar($pdo);
    try { procesarStockPhp($pdo,array_replace($datos,$cambio)); throw new RuntimeException('Aceptó una operación inválida'); }
    catch (InvalidArgumentException $error) { verificarProcesar(estadoProcesar($pdo) === $antes,'Validación sin efectos'); }
}
// Forzar fallo tras crear el destino y descontar el origen.
$ddl = $pdo->query('SHOW CREATE TABLE a_movimientos')->fetch(PDO::FETCH_NUM)[1];
$pdo->exec('DROP TEMPORARY TABLE a_movimientos');
$pdo->exec(str_replace('PRIMARY KEY (`id`)', 'CHECK (`cantidad` = 0), PRIMARY KEY (`id`)', preg_replace('/^CREATE TABLE/', 'CREATE TEMPORARY TABLE', $ddl)));
$antes = estadoProcesar($pdo);
try { procesarStockPhp($pdo,array_replace($datos,['codigo_destino'=>'ROLLBACK'])); throw new RuntimeException('Aceptó un movimiento inválido'); }
catch (PDOException $error) { verificarProcesar(estadoProcesar($pdo) === $antes,'Rollback de origen, destino y movimiento'); }
echo "OK: carga PHP, nombre, crear/acumular por ubicación, cubicaje, movimientos, validaciones y rollback (tablas temporales).\n";
