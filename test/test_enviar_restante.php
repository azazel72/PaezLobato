<?php
declare(strict_types=1);
require_once __DIR__ . '/../api/servicios/cierre_semanal_lotes.php';

function comprobarEnvio(bool $ok, string $message): void { if (!$ok) throw new RuntimeException($message); }
$pdo = fabricacionPdo();
// Todas las escrituras quedan en tablas temporales de esta conexión.
foreach (['a_lotes', 'a_movimientos', 'a_ajustes_consumo'] as $table) {
    $ddl = $pdo->query("SHOW CREATE TABLE `$table`")->fetch(PDO::FETCH_NUM)[1];
    $ddl = preg_replace('/^CREATE TABLE/', 'CREATE TEMPORARY TABLE', $ddl);
    $ddl = preg_replace('/^\s*CONSTRAINT .*FOREIGN KEY.*\n/m', '', $ddl);
    $ddl = preg_replace('/,\n\)/', "\n)", $ddl);
    $pdo->exec($ddl);
}
$pdo->exec("INSERT INTO a_lotes (id,codigo,objetivo,cubicaje,consumido,contador_botas,estado) VALUES (1,'A','BOTAS',2,0.5,5,1),(2,'B','BOTAS',1,1.2,7,1)");
function basesEnvio(PDO $pdo): array { return $pdo->query('SELECT * FROM a_lotes ORDER BY id')->fetchAll(); }
function datosEnvio(PDO $pdo, string $amount): array {
    return ['lotes_originales'=>basesEnvio($pdo), 'operaciones'=>[['tipo'=>'restante','origen_id'=>1,'destino_id'=>2,'cantidad'=>$amount]]];
}
$antes = basesEnvio($pdo);
foreach (['-0.1','0','1.5001'] as $amount) {
    try { confirmarCambiosLotesCierre($pdo, datosEnvio($pdo, $amount)); throw new RuntimeException('Importe inválido aceptado'); }
    catch (InvalidArgumentException $error) {}
    comprobarEnvio(basesEnvio($pdo) === $antes, 'La validación no debe modificar los lotes');
}
$datos = datosEnvio($pdo, '0.5000');
$result = confirmarCambiosLotesCierre($pdo, $datos);
comprobarEnvio(array_column($result['lotes'], 'cubicaje') === ['1.5000','1.5000'], 'Se transfiere el cubicaje original');
comprobarEnvio(array_column($result['lotes'], 'consumido') === ['0.5000','1.2000'], 'Consumos intactos');
comprobarEnvio(array_map('intval', array_column($result['lotes'], 'contador_botas')) === [5,7], 'Contadores intactos');
comprobarEnvio((int)$pdo->query('SELECT COUNT(*) FROM a_ajustes_consumo')->fetchColumn() === 0, 'El envío material no genera ajuste de consumo');
$mov = $pdo->query('SELECT * FROM a_movimientos')->fetchAll();
comprobarEnvio(count($mov) === 1 && (int)$mov[0]['origen_id'] === 1 && (int)$mov[0]['destino_id'] === 2 && $mov[0]['cantidad'] === '0.5000', 'Movimiento material con dirección real');
try { confirmarCambiosLotesCierre($pdo, $datos); throw new RuntimeException('Se aceptó un borrador obsoleto'); }
catch (ConflictoLotesCierre $error) {}
// Forzar error de movimiento para comprobar rollback también del cubicaje.
$pdo->exec('DELETE FROM a_movimientos');
$pdo->exec('ALTER TABLE a_movimientos ADD CONSTRAINT solo_cero CHECK (cantidad = 0)');
$antes = basesEnvio($pdo);
try { confirmarCambiosLotesCierre($pdo, datosEnvio($pdo, '0.1000')); throw new RuntimeException('Se esperaba error de movimiento'); }
catch (PDOException $error) {}
comprobarEnvio(basesEnvio($pdo) === $antes, 'Rollback del cubicaje y de los consumos');
comprobarEnvio((int)$pdo->query('SELECT COUNT(*) FROM a_movimientos')->fetchColumn() === 0, 'Sin movimiento parcial');
echo "OK: transferencia material, límites, concurrencia y rollback; solo tablas temporales.\n";
