<?php
declare(strict_types=1);
require_once __DIR__ . '/../lib/database.php';

header('Content-Type: application/json; charset=utf-8');

try {
    $payload = json_decode(file_get_contents('php://input'), true) ?: [];
    $id = filter_var($payload['id'] ?? null, FILTER_VALIDATE_INT);
    $estado = filter_var($payload['estado'] ?? null, FILTER_VALIDATE_INT);
    if (!$id || !in_array($estado, [0, 1], true)) {
        throw new InvalidArgumentException('Lote o estado no válidos.');
    }

    $pdo = fabricacionPdo();
    $stmt = $pdo->prepare("UPDATE a_lotes SET estado = :estado, updated_at = CURRENT_TIMESTAMP WHERE id = :id AND objetivo = 'BOTAS'");
    $stmt->execute(['id' => $id, 'estado' => $estado]);

    echo json_encode(['ok' => true, 'id' => $id, 'estado' => $estado]);
} catch (Throwable $error) {
    http_response_code($error instanceof InvalidArgumentException ? 400 : 500);
    echo json_encode(['ok' => false, 'error' => $error->getMessage()], JSON_UNESCAPED_UNICODE);
}
