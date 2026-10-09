<?php
declare(strict_types=1);
require_once __DIR__ . '/../api/consumo_lotes.php';
function comprobarConsumo(bool $ok, string $mensaje): void { if (!$ok) throw new RuntimeException($mensaje); }
$pdo = fabricacionPdo();
foreach (['a_lotes', 'a_movimientos'] as $tabla) {
    $ddl = $pdo->query("SHOW CREATE TABLE $tabla")->fetch(PDO::FETCH_NUM)[1];
    $pdo->exec(preg_replace('/^CREATE TABLE/', 'CREATE TEMPORARY TABLE', $ddl));
}
$pdo->exec("INSERT INTO a_lotes (id,codigo,objetivo,cubicaje,consumido,estado) VALUES (1,'STOCK','STOCK',2,0,0),(2,'F0','FONDOS',1,0,0),(3,'F1','FONDOS',1,0,1),(4,'F2','FONDOS',1,0,2),(5,'FN','FONDOS',1,0,NULL)");
$lista = listarLotesConsumo($pdo);
comprobarConsumo(array_column($lista['fondos'],'codigo') === ['F0','F1'], 'Activos: estados menores de 2');
$datos = ['destino'=>'botas','origen_id'=>1,'codigo_destino'=>'BOTA','cubicaje'=>'0.1000','paquetes'=>2];
registrarConsumoLotes($pdo,$datos);
registrarConsumoLotes($pdo,$datos);
comprobarConsumo((int)$pdo->query("SELECT COUNT(*) FROM a_lotes WHERE objetivo='BOTAS'")->fetchColumn() === 1, 'Reutiliza el lote sin correlativo');
comprobarConsumo($pdo->query("SELECT cubicaje FROM a_lotes WHERE objetivo='BOTAS'")->fetchColumn() === '0.4000', 'Acumula cubicaje por paquetes');
$datos['destino']='fondos'; $datos['codigo_destino']='F0';
registrarConsumoLotes($pdo,$datos);
$datos['codigo_destino']='F1';
registrarConsumoLotes($pdo,$datos);
comprobarConsumo($pdo->query("SELECT consumido FROM a_lotes WHERE objetivo='STOCK'")->fetchColumn() === '0.8000', 'Consumo en stock');
comprobarConsumo($pdo->query("SELECT cubicaje FROM a_lotes WHERE objetivo='STOCK'")->fetchColumn() === '2.0000', 'Stock original intacto');
$movimientos = $pdo->query('SELECT * FROM a_movimientos ORDER BY id')->fetchAll(PDO::FETCH_ASSOC);
comprobarConsumo(array_column($movimientos,'situacion_origen') === ['stock','stock','stock','stock'], 'Origen stock');
comprobarConsumo(array_column($movimientos,'situacion_destino') === ['botas','botas','fondos','fondos'], 'Destinos correctos');
comprobarConsumo(array_column($movimientos,'cantidad') === ['0.2000','0.2000','0.2000','0.2000'], 'Cantidades positivas');
foreach ([['codigo_destino'=>'F2'],['codigo_destino'=>'FN'],['codigo_destino'=>'NO-EXISTE'],['cubicaje'=>'1.0000'],['cubicaje'=>'-1'],['paquetes'=>0]] as $cambio) {
    try { registrarConsumoLotes($pdo,array_replace($datos,$cambio)); throw new RuntimeException('Aceptó datos inválidos'); }
    catch (InvalidArgumentException $e) {}
}
comprobarConsumo($pdo->query("SELECT consumido FROM a_lotes WHERE objetivo='STOCK'")->fetchColumn() === '0.8000', 'Fallos sin descontar stock');
$ddl = $pdo->query('SHOW CREATE TABLE a_movimientos')->fetch(PDO::FETCH_NUM)[1];
$pdo->exec('DROP TEMPORARY TABLE a_movimientos');
$pdo->exec(str_replace('PRIMARY KEY (`id`)', 'CHECK (`cantidad` = 0), PRIMARY KEY (`id`)', preg_replace('/^CREATE TABLE/', 'CREATE TEMPORARY TABLE', $ddl)));
$datos['destino']='botas'; $datos['codigo_destino']='ROLLBACK';
try { registrarConsumoLotes($pdo,$datos); throw new RuntimeException('Aceptó movimiento que debía fallar'); }
catch (PDOException $e) {}
comprobarConsumo((int)$pdo->query("SELECT COUNT(*) FROM a_lotes WHERE objetivo='BOTAS'")->fetchColumn() === 1, 'Rollback del lote creado');
comprobarConsumo($pdo->query("SELECT consumido FROM a_lotes WHERE objetivo='STOCK'")->fetchColumn() === '0.8000', 'Rollback del stock');
echo "OK: crear/acumular botas, fondos activos 0/1, cantidades, límites y rollback (tablas temporales).\n";
