<?php
declare(strict_types=1);
require_once __DIR__ . '/../lib/database.php';

header('Content-Type: application/json; charset=utf-8');

try {
    $payload = json_decode(file_get_contents('php://input'), true) ?: [];
    $id = filter_var($payload['id'] ?? null, FILTER_VALIDATE_INT);
    if (!$id) {
        throw new InvalidArgumentException('Lote de fondo no válido.');
    }

    $pdo = fabricacionPdo();
    $pdo->beginTransaction();
    $pdo->exec("UPDATE a_lotes SET estado = 0, updated_at = CURRENT_TIMESTAMP WHERE objetivo = 'FONDOS'");
    $stmt = $pdo->prepare("UPDATE a_lotes SET estado = 1, updated_at = CURRENT_TIMESTAMP WHERE id = :id AND objetivo = 'FONDOS'");
    $stmt->execute(['id' => $id]);
    $pdo->commit();

    echo json_encode(['ok' => true, 'id' => $id, 'estado' => 1]);
} catch (Throwable $error) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code($error instanceof InvalidArgumentException ? 400 : 500);
    echo json_encode(['ok' => false, 'error' => $error->getMessage()], JSON_UNESCAPED_UNICODE);
}
