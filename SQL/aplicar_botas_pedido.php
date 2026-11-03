<?php
declare(strict_types=1);
// Instalador CLI específico. Nunca se sirve como endpoint web.
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require_once __DIR__ . '/../api/lib/database.php';
$pdo = fabricacionPdo();
$dir = __DIR__ . '/backup/botas_pedido_' . date('Ymd_His');
if (!mkdir($dir, 0775, true)) throw new RuntimeException('No se pudo crear la copia previa.');
foreach (['productos','pedidos','fabricacion_semanal'] as $tabla) {
    file_put_contents($dir . '/' . $tabla . '_schema.sql', $pdo->query("SHOW CREATE TABLE `$tabla`")->fetch(PDO::FETCH_NUM)[1] . ";\n");
}
file_put_contents($dir . '/productos_antes.json', json_encode($pdo->query("SELECT * FROM productos WHERE tipo='BOTA'")->fetchAll(), JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR));
foreach (['20261103_botas_pedido.sql','20261103_pa_botas_pedido.sql'] as $file) {
    $delimiter = ';'; $statement = '';
    foreach (file(__DIR__ . '/actualizaciones/' . $file) as $line) {
        if (preg_match('/^DELIMITER\s+(\S+)/i', trim($line), $m)) { $delimiter=$m[1]; continue; }
        $statement .= $line;
        if (str_ends_with(rtrim($statement), $delimiter)) {
            $pdo->exec(substr(rtrim($statement), 0, -strlen($delimiter))); $statement='';
        }
    }
    if (trim($statement) !== '') throw new RuntimeException('SQL incompleto en ' . $file);
}
echo "OK: migración y PA instalados. Copia previa: " . basename($dir) . "\n";
