<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

try {
    $pdo = new PDO(
        'mysql:host=localhost;port=3306;dbname=antoniopaezlobato;charset=utf8mb4',
        'rafa',
        'rafa',
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]
    );

    $fabricaciones = $pdo->query(
        "SELECT
            fs.id,
            fs.pedido_id,
            fs.fecha_inicio,
            fs.tipo_producto_id,
            fs.material_id,
            fs.tostado_id,
            fs.cantidad,
            fs.cantidad_fabricada,
            fs.estado,
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
        WHERE fs.estado = 2
          AND UPPER(COALESCE(tp.tipo, '')) = 'BOTA'
        ORDER BY fs.fecha_inicio DESC, fs.id DESC"
    )->fetchAll();

    echo json_encode([
        'ok' => true,
        'fabricaciones' => $fabricaciones,
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
} catch (Throwable $error) {
    http_response_code(500);
    echo json_encode([
        'ok' => false,
        'error' => 'No se pudo cargar la información de fabricación.',
    ], JSON_UNESCAPED_UNICODE);
}
