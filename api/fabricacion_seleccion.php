<?php
declare(strict_types=1);
require_once __DIR__ . '/lib/fabricacion_db.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

try {
    $fabricacionId = filter_input(INPUT_GET, 'id', FILTER_VALIDATE_INT);
    if (!$fabricacionId) {
        throw new InvalidArgumentException('Fabricación no válida.');
    }

    $pdo = fabricacionPdo();

    $stmt = $pdo->prepare(
        "SELECT fs.id, fs.pedido_id, fs.tipo_producto_id, fs.material_id, fs.tostado_id,
                fs.cantidad, fs.cantidad_fabricada,
                p.cantidad AS pedido_cantidad,
                p.cantidad_fabricada AS pedido_cantidad_fabricada,
                COALESCE(p.descripcion, CONCAT('Pedido ', fs.pedido_id)) AS pedido_descripcion,
                tp.descripcion AS tipo_descripcion,
                m.descripcion AS material_descripcion,
                t.descripcion AS tostado_descripcion
         FROM fabricacion_semanal fs
         LEFT JOIN pedidos p ON p.id = fs.pedido_id
         LEFT JOIN tipos_producto tp ON tp.id = fs.tipo_producto_id
         LEFT JOIN materiales m ON m.id = fs.material_id
         LEFT JOIN tostados t ON t.id = fs.tostado_id
         WHERE fs.id = :id
         LIMIT 1"
    );
    $stmt->execute(['id' => $fabricacionId]);
    $fabricacion = $stmt->fetch();
    if (!$fabricacion) {
        throw new RuntimeException('Fabricación no encontrada.');
    }

    $stmt = $pdo->prepare(
        "SELECT po.codigo_batidero
         FROM productos_operarios po
         INNER JOIN productos p ON p.id = po.producto_id
         WHERE p.tipo_producto_id = :tipo_producto_id
           AND po.codigo_batidero IS NOT NULL
         ORDER BY po.created_at DESC, po.producto_id DESC
         LIMIT 1"
    );
    $stmt->execute(['tipo_producto_id' => $fabricacion['tipo_producto_id']]);
    $codigoBatidero = $stmt->fetchColumn();

    $stmt = $pdo->query(
        "SELECT cd.usuario_id, COALESCE(u.nombre, u.alias, CONCAT('Operario ', cd.usuario_id)) AS nombre
         FROM cuadrante_detalles cd
         INNER JOIN puestos_trabajo pt ON pt.id = cd.puesto_id
         INNER JOIN usuarios u ON u.id = cd.usuario_id
         WHERE UPPER(pt.nombre) = 'FONDAR'
           AND u.empleado = 1
           AND cd.fecha >= CURRENT_DATE - INTERVAL 2 DAY
         ORDER BY cd.fecha DESC, cd.orden_en_puesto ASC, cd.usuario_id ASC
         LIMIT 1"
    );
    $operario = $stmt->fetch() ?: null;

    echo json_encode([
        'ok' => true,
        'fabricacion' => $fabricacion,
        'codigo_batidero' => $codigoBatidero !== false ? (int) $codigoBatidero : null,
        'operario_fondado' => $operario,
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
} catch (Throwable $error) {
    http_response_code($error instanceof InvalidArgumentException ? 400 : 500);
    echo json_encode([
        'ok' => false,
        'error' => $error->getMessage(),
    ], JSON_UNESCAPED_UNICODE);
}
