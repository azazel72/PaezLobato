<?php
declare(strict_types=1);
require_once __DIR__ . '/../api/servicios/trasladar_botas_pedido.php';
function comprobarTraslado(bool $ok,string $msg): void { if (!$ok) throw new RuntimeException($msg); }
$pdo=fabricacionPdo();
foreach (['productos','pedidos','fabricacion_semanal'] as $tabla) {
    $ddl=$pdo->query("SHOW CREATE TABLE `$tabla`")->fetch(PDO::FETCH_NUM)[1];
    $ddl=preg_replace('/^CREATE TABLE/','CREATE TEMPORARY TABLE',$ddl);
    $ddl=preg_replace('/^\s*CONSTRAINT .*FOREIGN KEY.*\n/m','',$ddl);
    $ddl=preg_replace('/,\n\)/',"\n)",$ddl); $pdo->exec($ddl);
}
$pdo->exec("INSERT INTO pedidos(id,numero,destino,cantidad_fabricada,estado) VALUES (1,'ORIGEN','C',7,2),(2,'DESTINO','E',0,2),(3,'CERRADO','C',0,3)");
$pdo->exec('INSERT INTO fabricacion_semanal(id,pedido_id,tipo_producto_id) VALUES(10,1,1)');
$pdo->exec("INSERT INTO productos(id,tipo,codigo,produccion_id,pedido_id,pedido_fabricacion_id,estado) VALUES
    (1,'BOTA','A',10,1,1,1),(2,'BOTA','B',10,1,1,2),(3,'BOTA','PENDIENTE_ENVINAR',10,1,1,3),
    (4,'BOTA','ENVINADA',10,1,1,4),(5,'BOTA','EXPEDIDA',10,1,1,6),(6,'BOTA','ANONIMA',10,0,1,1)");
function estadoTraslado(PDO $p): array { return $p->query('SELECT * FROM productos ORDER BY id')->fetchAll(); }
function enviarTraslado(PDO $p,int $origen,int $destino,array $codigos): array {
    return trasladarBotasPedido($p,['origen_id'=>$origen,'destino_id'=>$destino,'codigos'=>$codigos]);
}
foreach ([[1,2,['A','ENVINADA']],[1,2,['PENDIENTE_ENVINAR']],[1,2,['EXPEDIDA']],[0,2,['A']],[1,3,['A']],[1,1,['A']],[1,2,['A','A']],[1,2,['NO EXISTE']]] as [$o,$d,$codes]) {
    $antes=estadoTraslado($pdo);
    try { enviarTraslado($pdo,$o,$d,$codes); throw new RuntimeException('Traslado inválido aceptado'); } catch (InvalidArgumentException $e) {}
    comprobarTraslado(estadoTraslado($pdo)===$antes,'Error sin traslado parcial ni historial');
}
$res=enviarTraslado($pdo,1,2,['A','B']);
comprobarTraslado($res['cantidad']===2,'Dos botas trasladadas');
comprobarTraslado((int)$pdo->query('SELECT COUNT(*) FROM productos WHERE pedido_id=2')->fetchColumn()===2,'Pedido actual nuevo');
comprobarTraslado((int)$pdo->query('SELECT COUNT(*) FROM productos WHERE pedido_fabricacion_id=1 AND produccion_id=10')->fetchColumn()===6,'Origen de fabricación intacto');
comprobarTraslado((int)$pdo->query('SELECT cantidad_fabricada FROM pedidos WHERE id=1')->fetchColumn()===7,'No se altera la producción histórica');
$antes=estadoTraslado($pdo);
try { enviarTraslado($pdo,1,2,['A','B']); throw new RuntimeException('Origen obsoleto aceptado'); } catch (InvalidArgumentException $e) {}
comprobarTraslado(estadoTraslado($pdo)===$antes,'Un reintento con origen antiguo no modifica nada');
enviarTraslado($pdo,2,0,['A']); enviarTraslado($pdo,0,1,['A','ANONIMA']);
comprobarTraslado((int)$pdo->query('SELECT pedido_id FROM productos WHERE id=1')->fetchColumn()===1,'Solo conserva la última asignación');
$pdo->exec("ALTER TABLE productos ADD CONSTRAINT impedir_prueba CHECK(NOT(codigo='A' AND pedido_id=2))");
$antes=estadoTraslado($pdo);
try { enviarTraslado($pdo,1,2,['A','ANONIMA']); throw new RuntimeException('Debió fallar la actualización'); } catch (PDOException $e) {}
comprobarTraslado(estadoTraslado($pdo)===$antes,'Fallo de actualización revierte el lote completo');
echo "OK: pedido original/actual, estados, códigos/origen, anónimo y rollback; sin tabla de historial.\n";
