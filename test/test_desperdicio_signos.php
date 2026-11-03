<?php
declare(strict_types=1);
require_once __DIR__ . '/../api/servicios/cierre_semanal_lotes.php';
function comprobarDesperdicio(bool $ok, string $mensaje): void { if (!$ok) throw new RuntimeException($mensaje); }
$pdo = fabricacionPdo();
// Reproduce las cantidades notificadas exclusivamente en tablas temporales.
foreach (['a_lotes', 'a_movimientos', 'a_ajustes_consumo'] as $tabla) {
    $ddl = $pdo->query("SHOW CREATE TABLE `$tabla`")->fetch(PDO::FETCH_NUM)[1];
    $ddl = preg_replace('/^CREATE TABLE/', 'CREATE TEMPORARY TABLE', $ddl);
    $ddl = preg_replace('/^\s*CONSTRAINT .*FOREIGN KEY.*\n/m', '', $ddl);
    $ddl = preg_replace('/,\n\)/', "\n)", $ddl);
    $pdo->exec($ddl);
}
$pdo->exec("INSERT INTO a_lotes (id,codigo,objetivo,cubicaje,consumido,estado) VALUES
    (163,'70AA401','BOTAS',15.0180,20.7480,0), (172,'159AU409','BOTAS',16.0510,1.9940,1)");
$datos = ['lotes_originales'=>$pdo->query('SELECT * FROM a_lotes ORDER BY id')->fetchAll(), 'operaciones'=>[
    ['tipo'=>'desperdicio','origen_id'=>172,'cantidad'=>'14.0570'],
    ['tipo'=>'desperdicio','origen_id'=>163,'cantidad'=>'-5.7300'],
]];
try { $resultado = confirmarCambiosLotesCierre($pdo, $datos); }
catch (Throwable $e) {
    comprobarDesperdicio($pdo->query('SELECT * FROM a_lotes ORDER BY id')->fetchAll() === $datos['lotes_originales'], 'Rollback de ambos lotes');
    comprobarDesperdicio((int)$pdo->query('SELECT COUNT(*) FROM a_movimientos')->fetchColumn() === 0, 'Rollback del movimiento positivo anterior');
    throw $e;
}
foreach ($resultado['lotes'] as $lote) comprobarDesperdicio($lote['cubicaje'] === $lote['consumido'], 'Restante a cero');
comprobarDesperdicio((int)$pdo->query('SELECT COUNT(*) FROM a_movimientos')->fetchColumn() === 0, 'El desperdicio no genera movimientos materiales');
$ajustes = $pdo->query('SELECT * FROM a_ajustes_consumo ORDER BY orden')->fetchAll();
comprobarDesperdicio(count($ajustes) === 2 && array_column($ajustes,'tipo') === ['desperdicio','desperdicio'], 'Dos ajustes de desperdicio');
comprobarDesperdicio(array_column($ajustes,'cantidad') === ['14.0570','-5.7300'], 'Se conserva el signo del consumo');
comprobarDesperdicio(array_map('intval',array_column($ajustes,'origen_id')) === [172,163], 'Se conserva el lote afectado');
comprobarDesperdicio($ajustes[0]['destino_id'] === null && $ajustes[1]['destino_id'] === null, 'Sin lote destino ficticio');
comprobarDesperdicio(array_column($resultado['lotes'],'cubicaje') === ['15.0180','16.0510'], 'Cubicajes intactos');
// Si falla el registro de desperdicio, tampoco se confirma el consumido.
$pdo->exec('DELETE FROM a_ajustes_consumo');
$pdo->exec('UPDATE a_lotes SET consumido=20.7480 WHERE id=163');
$pdo->exec("ALTER TABLE a_ajustes_consumo ADD CONSTRAINT bloquear_desperdicio CHECK (tipo<>'desperdicio')");
$antes=$pdo->query('SELECT * FROM a_lotes ORDER BY id')->fetchAll();
try {
    confirmarCambiosLotesCierre($pdo,['lotes_originales'=>$antes,'operaciones'=>[['tipo'=>'desperdicio','origen_id'=>163,'cantidad'=>'-5.7300']]]);
    throw new RuntimeException('Se esperaba fallo del registro');
} catch (PDOException $e) {}
comprobarDesperdicio($pdo->query('SELECT * FROM a_lotes ORDER BY id')->fetchAll()===$antes,'Rollback del consumo si falla la auditoría');
comprobarDesperdicio((int)$pdo->query('SELECT COUNT(*) FROM a_ajustes_consumo')->fetchColumn()===0,'Sin auditoría parcial');
echo "OK: desperdicios de ambos signos auditados, sin movimientos y con restantes a cero; solo tablas temporales.\n";
