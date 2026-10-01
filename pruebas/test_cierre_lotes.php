<?php
declare(strict_types=1);
require_once __DIR__ . '/../api/cierre_semanal_lotes.php';
function verificarCierre(bool $ok, string $mensaje): void { if (!$ok) throw new RuntimeException($mensaje); }
$pdo = fabricacionPdo();
$ddl = $pdo->query('SHOW CREATE TABLE a_lotes_botas')->fetch(PDO::FETCH_NUM)[1];
$pdo->exec(preg_replace('/^CREATE TABLE/', 'CREATE TEMPORARY TABLE', $ddl));
$pdo->exec('CREATE TEMPORARY TABLE a_lotes_procesados LIKE a_lotes_botas');
// Validar también el CREATE nuevo, con '' y desperdicio, sin tocar la tabla real.
$sql = file_get_contents(__DIR__ . '/../SQL/versiones/v3_0/DDL/001_v3_0_lotes_y_movimientos.sql');
preg_match('/CREATE TABLE IF NOT EXISTS `a_movimientos`[\s\S]*?;/', $sql, $m);
$movimientosDdl = str_replace('CREATE TABLE IF NOT EXISTS', 'CREATE TEMPORARY TABLE', $m[0]);
$pdo->exec($movimientosDdl);
$pdo->exec("INSERT INTO a_movimientos (origen_id,situacion_origen,destino_id,situacion_destino,cantidad) VALUES (0,'',0,'desperdicio',0)");
verificarCierre($pdo->query('SELECT situacion_origen+0 FROM a_movimientos')->fetchColumn() == 5, 'Cadena vacía como miembro real del ENUM');
$pdo->exec('DELETE FROM a_movimientos');
$pdo->exec("INSERT INTO a_lotes_botas (id,codigo,cubicaje,consumido,contador_botas) VALUES (1,'A',1,1.2,8),(2,'B',1,0.2,5),(3,'C',0.5,0,0)");
function capturaCierre(PDO $pdo): array {
    return [$pdo->query('SELECT * FROM a_lotes_botas ORDER BY id')->fetchAll(),$pdo->query('SELECT * FROM a_movimientos ORDER BY id')->fetchAll()];
}
$datos = ['lotes_originales'=>[
    ['id'=>1,'cubicaje'=>'1.0000','consumido'=>'1.2000'],
    ['id'=>2,'cubicaje'=>'1.0000','consumido'=>'0.2000'],
    ['id'=>3,'cubicaje'=>'0.5000','consumido'=>'0.0000'],
], 'operaciones'=>[
    ['tipo'=>'consumo','origen_id'=>1,'destino_id'=>2,'cantidad'=>'0.2000'],
    ['tipo'=>'consumo','origen_id'=>2,'destino_id'=>3,'cantidad'=>'0.1000'],
]];
$resultado = confirmarCambiosLotesCierre($pdo,$datos);
verificarCierre(array_column($resultado['lotes'],'consumido') === ['1.0000','0.3000','0.1000'],'Consumos finales');
verificarCierre(array_column($resultado['lotes'],'cubicaje') === ['1.0000','1.0000','0.5000'],'Cubicajes intactos');
verificarCierre(array_map('intval',array_column($resultado['lotes'],'contador_botas')) === [8,5,0],'Contadores intactos');
verificarCierre((int)$pdo->query('SELECT COUNT(*) FROM a_movimientos')->fetchColumn()===2,'Movimientos confirmados');
$movimientos = $pdo->query('SELECT origen_id,destino_id,situacion_origen,situacion_destino,cantidad FROM a_movimientos ORDER BY id')->fetchAll();
verificarCierre(array_map('intval',array_column($movimientos,'origen_id')) === [2,3], 'Origen: lote que aumenta consumo');
verificarCierre(array_map('intval',array_column($movimientos,'destino_id')) === [1,2], 'Destino: lote que reduce consumo');
verificarCierre(array_column($movimientos,'cantidad') === ['0.2000','0.1000'], 'Cantidades positivas a cuatro decimales');
verificarCierre(array_column($movimientos,'situacion_origen') === ['botas','botas'] && array_column($movimientos,'situacion_destino') === ['botas','botas'], 'Movimientos entre lotes de botas');
$antes = capturaCierre($pdo);
try { confirmarCambiosLotesCierre($pdo,$datos); throw new RuntimeException('Se aceptó un borrador obsoleto'); }
catch (ConflictoLotesCierre $e) { verificarCierre(capturaCierre($pdo)===$antes,'Conflicto sin efectos'); }
$datos['lotes_originales']=$resultado['lotes'];
$datos['operaciones']=[['tipo'=>'consumo','origen_id'=>1,'destino_id'=>3,'cantidad'=>'0.4001']];
try { confirmarCambiosLotesCierre($pdo,$datos); throw new RuntimeException('Se aceptó restante negativo'); }
catch (InvalidArgumentException $e) { verificarCierre(capturaCierre($pdo)===$antes,'Receptor protegido'); }
// Salidas a desperdicio y procesado, incluido un destino que ya existe.
$datos['operaciones'] = [
    ['tipo'=>'desperdicio','origen_id'=>2,'cantidad'=>'0.1000'],
    ['tipo'=>'procesado','origen_id'=>3,'cantidad'=>'0.1000','codigo_destino'=>'PROCESADO-TEST'],
    ['tipo'=>'procesado','origen_id'=>3,'cantidad'=>'0.1000','codigo_destino'=>'PROCESADO-TEST'],
];
$resultado = confirmarCambiosLotesCierre($pdo, $datos);
verificarCierre(array_column($resultado['lotes'],'consumido') === ['0.4000','0.3000'], 'Salidas aumentan consumo');
verificarCierre($pdo->query('SELECT cubicaje FROM a_lotes_procesados')->fetchColumn() === '0.2000', 'Acumulación en procesado');
$salidas = $pdo->query('SELECT * FROM a_movimientos ORDER BY id DESC LIMIT 3')->fetchAll();
verificarCierre(array_column($salidas,'situacion_destino') === ['procesado','procesado','desperdicio'], 'Situaciones de salida');
verificarCierre((int)$salidas[2]['destino_id'] === 0 && (int)$salidas[2]['origen_id'] === 2, 'Origen y destino desperdicio');
$datos['lotes_originales'] = $pdo->query('SELECT * FROM a_lotes_botas ORDER BY id')->fetchAll();
$antes = capturaCierre($pdo);
$datos['operaciones'] = [['tipo'=>'desperdicio','origen_id'=>3,'cantidad'=>'0.2001']];
try { confirmarCambiosLotesCierre($pdo,$datos); throw new RuntimeException('Se aceptó desperdicio excesivo'); }
catch (InvalidArgumentException $e) { verificarCierre(capturaCierre($pdo)===$antes,'Restante protegido en salidas'); }
// Forzar un fallo al registrar movimientos después del UPDATE: rollback de todo.
$pdo->exec('DROP TEMPORARY TABLE a_movimientos');
$pdo->exec(str_replace('PRIMARY KEY (`id`)', 'CHECK (`cantidad` = 0), PRIMARY KEY (`id`)', $movimientosDdl));
$datos['operaciones']=[['tipo'=>'consumo','origen_id'=>1,'destino_id'=>3,'cantidad'=>'0.1000']];
$antes = capturaCierre($pdo);
try { confirmarCambiosLotesCierre($pdo,$datos); throw new RuntimeException('Se esperaba fallo de escritura'); }
catch (PDOException $e) { verificarCierre(capturaCierre($pdo)===$antes,'Rollback de consumos y movimientos'); }
$datos['operaciones']=[['tipo'=>'procesado','origen_id'=>2,'cantidad'=>'0.1000','codigo_destino'=>'NUEVO-ROLLBACK']];
try { confirmarCambiosLotesCierre($pdo,$datos); throw new RuntimeException('Se esperaba fallo de escritura de salida'); }
catch (PDOException $e) {
    verificarCierre(capturaCierre($pdo)===$antes,'Rollback de salida');
    verificarCierre((int)$pdo->query('SELECT COUNT(*) FROM a_lotes_procesados')->fetchColumn()===1,'Rollback del nuevo lote procesado');
}
echo "OK: ENUM, consumos, validación, conflicto concurrente y rollback; solo tablas temporales.\n";
