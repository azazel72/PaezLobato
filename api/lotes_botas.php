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

    $lotes = $pdo->query(
        "SELECT id, codigo, tipo_producto_id, material_id, cubicaje, consumido, contador_botas,
                estado, ubicacion_id, created_at, updated_at
         FROM a_lotes_botas
         ORDER BY codigo"
    )->fetchAll();

    echo json_encode([
        'ok' => true,
        'lotes' => $lotes,
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
} catch (Throwable $error) {
    http_response_code(500);
    echo json_encode([
        'ok' => false,
        'error' => 'No se pudieron cargar los lotes de botas.',
    ], JSON_UNESCAPED_UNICODE);
}
