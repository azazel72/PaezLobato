<?php
declare(strict_types=1);
require_once __DIR__ . '/../api/servicios/destino_resumen.php';
function comprobarDestino(bool $ok, string $msg): void { if (!$ok) throw new RuntimeException($msg); }
$pdo = fabricacionPdo();
foreach (['pedidos','fabricacion_semanal','productos','clientes','trazabilidad_producto','trazabilidad_fabricacion'] as $tabla) {
    $ddl = $pdo->query("SHOW CREATE TABLE `$tabla`")->fetch(PDO::FETCH_NUM)[1];
    $ddl = preg_replace('/^CREATE TABLE/', 'CREATE TEMPORARY TABLE', $ddl);
    $ddl = preg_replace('/^\s*CONSTRAINT .*FOREIGN KEY.*\n/m', '', $ddl);
    $ddl = preg_replace('/,\n\)/', "\n)", $ddl);
    $pdo->exec($ddl);
}
$pdo->exec("INSERT INTO pedidos (id,numero,destino,cantidad,cantidad_fabricada,estado) VALUES
    (1,'CLIENTE','C',10,4,2),(2,'ENVINADO','E',20,3,2),(3,'CERRADO','C',5,1,3),(4,'SIN PENDIENTES','C',2,2,2)");
$pdo->exec('INSERT INTO fabricacion_semanal (id,pedido_id,tipo_producto_id) VALUES (10,1,1),(11,1,1),(20,2,1),(30,0,1),(40,3,1)');
$pdo->exec("INSERT INTO productos (id,tipo,codigo,produccion_id,estado,is_deleted) VALUES
    (1,'BOTA','C1',10,1,0),(2,'BOTA','C2',11,2,0),(3,'BOTA','C3',10,6,0),
    (4,'BOTA','E1',20,3,0),(5,'BOTA','E2',20,4,0),(6,'BOTA','E3',20,1,0),
    (7,'BOTA','ANONIMO_CON_FABRICACION',30,1,0),(8,'BOTA','ANTIGUA',NULL,1,0),
    (9,'BOTA','SIN_VINCULO',NULL,2,0),(10,'BOTA','CERRADA',40,1,0),(11,'BOTA','BORRADA',10,1,1)");
$pdo->exec('INSERT INTO trazabilidad_fabricacion (id,fabricacion_semanal_id,palet_id) VALUES (1,11,1)');
$pdo->exec('INSERT INTO trazabilidad_producto (trazabilidad_fabricacion_id,producto_id) VALUES (1,8),(1,8)');
$pdo->exec('UPDATE productos SET pedido_id=CASE WHEN id IN(1,2,3,8,11) THEN 1 WHEN id IN(4,5,6) THEN 2 WHEN id=10 THEN 3 ELSE 0 END, pedido_fabricacion_id=CASE WHEN id IN(1,2,3,8,11) THEN 1 WHEN id IN(4,5,6) THEN 2 WHEN id=10 THEN 3 ELSE 0 END');
$result = listarResumenDestino($pdo);
$grupos = array_column($result['pedidos'], null, 'pedidoId');
comprobarDestino(count($grupos) === 4, 'Pedidos activos y anónimo, sin cerrado');
comprobarDestino(count($grupos[1]['codigos']) === 3, 'Agrupa varias fabricaciones del pedido y trazabilidad antigua sin duplicados');
comprobarDestino($grupos[1]['solicitadas'] === 10 && $grupos[1]['fabricadas'] === 4 && $grupos[1]['enviadasCliente'] === 1, 'Contadores de cliente');
comprobarDestino($grupos[2]['enviadasEnvinar'] === 2 && count($grupos[2]['codigos']) === 1, 'Pendientes y envinadas cuentan fuera de las botas disponibles');
comprobarDestino($grupos[2]['envinadas'] === 1, 'Solo estado 4 cuenta como ya envinada');
comprobarDestino($grupos[0]['fabricadas'] === 2 && count($grupos[0]['codigos']) === 2, 'Anónimo incluye botas sin pedido y sin vínculo');
comprobarDestino($grupos[0]['botas'][0]['fabricacion_semanal_id'] === 30, 'Se conserva fabricación de origen');
comprobarDestino($grupos[4]['codigos'] === [], 'Un pedido sin pendientes permanece visible');
$pdo->exec('UPDATE productos SET pedido_id=2 WHERE id=1');
$movido=array_column(listarResumenDestino($pdo)['pedidos'],null,'pedidoId');
comprobarDestino(count($movido[1]['codigos'])===2 && in_array('C1',$movido[2]['codigos'],true),'Destino usa pedido actual y no pedido de la fabricación');
comprobarDestino((int)$pdo->query('SELECT pedido_fabricacion_id FROM productos WHERE id=1')->fetchColumn()===1,'Pedido original conservado');
echo "OK: cantidades, estados, anónimo, fabricación de origen y trazabilidad antigua; solo tablas temporales.\n";
