<?php
declare(strict_types=1);
require_once __DIR__ . '/../lib/database.php';
require_once __DIR__ . '/../lib/php_log.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

try {
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        header('Allow: POST');
        http_response_code(405);
        throw new InvalidArgumentException('Utiliza POST.');
    }
    $datos = json_decode(file_get_contents('php://input'), true, 512, JSON_THROW_ON_ERROR);
    $id = filter_var($datos['id'] ?? null, FILTER_VALIDATE_INT);
    if ($id === false || $id < 1) throw new InvalidArgumentException('Lote no válido.');
    $pdo = fabricacionPdo();
    $pdo->beginTransaction();
    $consulta = $pdo->prepare("SELECT cubicaje, consumido FROM a_lotes WHERE id = ? AND objetivo = 'BOTAS' AND is_deleted = 0 AND estado < 2 FOR UPDATE");
    $consulta->execute([$id]);
    $lote = $consulta->fetch(PDO::FETCH_ASSOC);
    if (!$lote) throw new InvalidArgumentException('El lote no existe.');
    if (abs((float) $lote['cubicaje'] - (float) $lote['consumido']) > 0.0000001) throw new InvalidArgumentException('El lote aún no está completamente consumido.');
    $pdo->prepare("UPDATE a_lotes SET estado = 2 WHERE id = ? AND objetivo = 'BOTAS'")->execute([$id]);
    $pdo->commit();
    echo json_encode(['ok' => true, 'id' => (int) $id, 'estado' => 2], JSON_UNESCAPED_UNICODE);
} catch (Throwable $error) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    $esperado = $error instanceof InvalidArgumentException || $error instanceof JsonException;
    http_response_code($esperado ? 400 : 500);
    registrarLogPhp('[finalizar lote botas PHP] ' . $error->getMessage());
    echo json_encode(['ok' => false, 'error' => $esperado ? $error->getMessage() : 'No se pudo finalizar el lote.'], JSON_UNESCAPED_UNICODE);
}
