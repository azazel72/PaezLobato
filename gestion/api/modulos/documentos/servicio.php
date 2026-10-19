<?php
declare(strict_types=1);

function gDocumentosEnvinados(PDO $pdo, array $params): array
{
    if (isset($params['producto_id'])) {
        $product = gId($params['producto_id']);
        $q = $pdo->prepare('SELECT a.id, a.titulo, a.nombre_original, a.extension, a.created_at FROM bota_envinada_archivo r JOIN archivos_subidos a ON a.id = r.archivo_subido_id AND a.is_deleted = 0 WHERE r.producto_id = ? ORDER BY a.id DESC');
        $q->execute([$product]); return ['rows' => $q->fetchAll()];
    }
    $sql = "SELECT p.id, p.codigo, CONCAT_WS(' · ', i.nombre, u.descripcion) AS ubicacion,
        pe.numero AS pedido_numero, c.nombre AS cliente_nombre, a.descripcion AS analitica_descripcion,
        (SELECT COUNT(*) FROM bota_envinada_archivo r JOIN archivos_subidos ar ON ar.id = r.archivo_subido_id AND ar.is_deleted = 0 WHERE r.producto_id = p.id) AS documentos_count
        FROM productos p
        LEFT JOIN ubicaciones u ON u.id = p.ubicacion_id LEFT JOIN instalaciones i ON i.id = u.instalacion_id
        LEFT JOIN fabricacion_semanal fs ON fs.id = COALESCE(p.produccion_id,
            (SELECT tf.fabricacion_semanal_id FROM trazabilidad_producto tp JOIN trazabilidad_fabricacion tf ON tf.id = tp.trazabilidad_fabricacion_id AND tf.is_deleted = 0 WHERE tp.producto_id = p.id AND tp.is_deleted = 0 ORDER BY tp.id DESC LIMIT 1))
        LEFT JOIN pedidos pe ON pe.id = fs.pedido_id LEFT JOIN clientes c ON c.id = pe.cliente_id
        LEFT JOIN bota_envinada_analitica ba ON ba.producto_id = p.id LEFT JOIN analiticas a ON a.id = ba.analitica_id
        WHERE p.tipo = 'BOTA' AND p.estado = 4 AND p.is_deleted = 0 ORDER BY p.codigo, p.id";
    return ['rows' => $pdo->query($sql)->fetchAll()];
}
function gDocumentosIds($values): array
{
    if (!is_array($values) || !$values || count($values) > 1000) throw new InvalidArgumentException('Selecciona entre 1 y 1000 registros.');
    return array_values(array_unique(array_map('gId', $values)));
}
function gComprobarBotas(PDO $pdo, array $ids): void
{
    $q = $pdo->prepare('SELECT id FROM productos WHERE id = ? AND tipo = \'BOTA\' AND estado = 4 AND is_deleted = 0 FOR UPDATE');
    foreach ($ids as $id) { $q->execute([$id]); if (!$q->fetchColumn()) throw new InvalidArgumentException('Alguna bota ya no está envinada o no existe. Actualiza el listado.'); }
}
function gVincularDocumentos(PDO $pdo, array $products, array $files): int
{
    gComprobarBotas($pdo, $products); $created = 0;
    $fileQuery = $pdo->prepare('SELECT id FROM archivos_subidos WHERE id = ? AND is_deleted = 0 LOCK IN SHARE MODE');
    foreach ($files as $file) { $fileQuery->execute([$file]); if (!$fileQuery->fetchColumn()) throw new InvalidArgumentException('Algún archivo ya no existe.'); }
    $exists = $pdo->prepare('SELECT id FROM bota_envinada_archivo WHERE producto_id = ? AND archivo_subido_id = ?');
    $insert = $pdo->prepare('INSERT INTO bota_envinada_archivo (producto_id, archivo_subido_id) VALUES (?, ?)');
    foreach ($products as $product) foreach ($files as $file) { $exists->execute([$product, $file]); if (!$exists->fetchColumn()) { $insert->execute([$product, $file]); $created++; } }
    return $created;
}
function gGuardarDocumentos(PDO $pdo, array $payload): array
{
    $action = $payload['action'] ?? '';
    if (!in_array($action, ['attach', 'detach'], true)) throw new InvalidArgumentException('Acción no disponible.');
    $products = gDocumentosIds($payload['producto_ids'] ?? null); $files = gDocumentosIds($payload['archivo_ids'] ?? null);
    $pdo->beginTransaction();
    try {
        if ($action === 'attach') $count = gVincularDocumentos($pdo, $products, $files);
        else {
            gComprobarBotas($pdo, $products); $count = 0;
            $q = $pdo->prepare('DELETE FROM bota_envinada_archivo WHERE producto_id = ? AND archivo_subido_id = ?');
            foreach ($products as $product) foreach ($files as $file) { $q->execute([$product, $file]); $count += $q->rowCount(); }
        }
        $pdo->commit(); return ['changed' => $count];
    } catch (Throwable $e) { if ($pdo->inTransaction()) $pdo->rollBack(); throw $e; }
}
