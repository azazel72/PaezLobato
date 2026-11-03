<?php
declare(strict_types=1);
require_once __DIR__ . '/../api/servicios/cierre_semanal_lotes.php';
function verificarAlmacenado(bool $ok, string $msg): void { if (!$ok) throw new RuntimeException($msg); }
$pdo = fabricacionPdo();
foreach (['a_lotes','a_movimientos','a_ajustes_consumo'] as $tabla) {
    $ddl=$pdo->query("SHOW CREATE TABLE `$tabla`")->fetch(PDO::FETCH_NUM)[1];
    $ddl=preg_replace('/^CREATE TABLE/','CREATE TEMPORARY TABLE',$ddl);
    $ddl=preg_replace('/^\s*CONSTRAINT .*FOREIGN KEY.*\n/m','',$ddl);
    $ddl=preg_replace('/,\n\)/',"\n)",$ddl); $pdo->exec($ddl);
}
$pdo->exec('CREATE TEMPORARY TABLE instalaciones (id INT, nombre VARCHAR(10), tipo VARCHAR(1))');
$pdo->exec('CREATE TEMPORARY TABLE ubicaciones (id INT, instalacion_id INT)');
$pdo->exec("INSERT INTO instalaciones VALUES (1,'M','M')");
$pdo->exec('INSERT INTO ubicaciones VALUES (1,1)');
$pdo->exec("INSERT INTO a_lotes (id,codigo,objetivo,cubicaje,consumido,estado) VALUES (1,'ORIGEN','BOTAS',2,0.5,1)");
function basesAlmacenado(PDO $p): array { return $p->query("SELECT * FROM a_lotes WHERE objetivo='BOTAS' ORDER BY id")->fetchAll(); }
$datos=['lotes_originales'=>basesAlmacenado($pdo),'operaciones'=>[
    ['tipo'=>'procesado','origen_id'=>1,'cantidad'=>'0.4000','codigo_destino'=>'DESTINO','ubicacion_id'=>1],
    ['tipo'=>'procesado','origen_id'=>1,'cantidad'=>'0.3000','codigo_destino'=>'DESTINO','ubicacion_id'=>1],
]];
$res=confirmarCambiosLotesCierre($pdo,$datos);
verificarAlmacenado($res['lotes'][0]['cubicaje']==='1.3000' && $res['lotes'][0]['consumido']==='0.5000','Restar cubicaje, sin aumentar consumo');
verificarAlmacenado($pdo->query("SELECT cubicaje FROM a_lotes WHERE objetivo='ALMACENADO'")->fetchColumn()==='0.7000','Sumar cubicaje acumulado al destino');
$mov=$pdo->query('SELECT * FROM a_movimientos ORDER BY id')->fetchAll();
verificarAlmacenado(count($mov)===2 && array_column($mov,'situacion_origen')===['botas','botas'] && array_column($mov,'situacion_destino')===['almacenado','almacenado'],'Mismo registro material');
verificarAlmacenado((int)$pdo->query('SELECT COUNT(*) FROM a_ajustes_consumo')->fetchColumn()===0,'Almacenado no genera consumo');
$datos=['lotes_originales'=>basesAlmacenado($pdo),'operaciones'=>[
    ['tipo'=>'procesado','origen_id'=>1,'cantidad'=>'0.8001','codigo_destino'=>'DESTINO','ubicacion_id'=>1],
]];
try { confirmarCambiosLotesCierre($pdo,$datos); throw new RuntimeException('Exceso aceptado'); } catch (InvalidArgumentException $e) {}
// Almacenado seguido de desperdicio en la misma confirmación.
$datos['operaciones']=[
    ['tipo'=>'procesado','origen_id'=>1,'cantidad'=>'0.3000','codigo_destino'=>'DESTINO','ubicacion_id'=>1],
    ['tipo'=>'desperdicio','origen_id'=>1,'cantidad'=>'0.5000'],
];
$res=confirmarCambiosLotesCierre($pdo,$datos);
verificarAlmacenado($res['lotes'][0]['cubicaje']==='1.0000' && $res['lotes'][0]['consumido']==='1.0000','Operaciones secuenciales coherentes');
verificarAlmacenado((int)$pdo->query('SELECT COUNT(*) FROM a_movimientos')->fetchColumn()===3,'Solo almacenado genera movimientos');
verificarAlmacenado((int)$pdo->query('SELECT COUNT(*) FROM a_ajustes_consumo')->fetchColumn()===1,'Solo desperdicio genera ajuste');
echo "OK: almacenado reduce cubicaje, conserva consumo y combina con desperdicio auditado; solo tablas temporales.\n";
