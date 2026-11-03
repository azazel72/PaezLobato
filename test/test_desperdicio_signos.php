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
$mov = $pdo->query('SELECT origen_id,destino_id,situacion_origen,situacion_destino,cantidad FROM a_movimientos ORDER BY id')->fetchAll();
comprobarDesperdicio(count($mov) === 2, 'Dos movimientos');
comprobarDesperdicio((int)$mov[0]['origen_id'] === 172 && (int)$mov[0]['destino_id'] === 0 && $mov[0]['situacion_origen'] === 'botas' && $mov[0]['situacion_destino'] === 'desperdicio' && $mov[0]['cantidad'] === '14.0570', 'Salida positiva a desperdicio');
comprobarDesperdicio((int)$mov[1]['origen_id'] === 0 && (int)$mov[1]['destino_id'] === 163 && $mov[1]['situacion_origen'] === 'desperdicio' && $mov[1]['situacion_destino'] === 'botas' && $mov[1]['cantidad'] === '5.7300', 'Corrección negativa con sentido inverso e importe positivo');
echo "OK: ambos desperdicios notificados, restantes a cero y movimientos con sentido correcto; solo tablas temporales.\n";
