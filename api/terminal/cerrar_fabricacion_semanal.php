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
    $id = filter_var($datos['fabricacion_semanal_id'] ?? null, FILTER_VALIDATE_INT);
    if ($id === false || $id < 1) throw new InvalidArgumentException('Fabricación semanal no válida.');
    $pdo = fabricacionPdo();
    $pdo->beginTransaction();
    $estado = $pdo->query("SELECT id FROM estados_fabricacion_semanal WHERE UPPER(descripcion) = 'FINALIZADO' ORDER BY id LIMIT 1")->fetchColumn();
    if ($estado === false) throw new InvalidArgumentException('No existe el estado Finalizado.');
    $actualizar = $pdo->prepare('UPDATE fabricacion_semanal SET estado = ? WHERE id = ? AND estado = 2');
    $actualizar->execute([(int) $estado, $id]);
    if ($actualizar->rowCount() !== 1) throw new InvalidArgumentException('La fabricación no está activa o no existe.');
    $pdo->commit();
    echo json_encode(['ok' => true, 'fabricacion_semanal_id' => $id, 'estado_id' => (int) $estado], JSON_UNESCAPED_UNICODE);
} catch (Throwable $error) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    $esperado = $error instanceof InvalidArgumentException || $error instanceof JsonException;
    http_response_code($esperado ? 400 : 500);
    registrarLogPhp('[cerrar fabricación semanal PHP] ' . $error->getMessage());
    echo json_encode(['ok' => false, 'error' => $esperado ? $error->getMessage() : 'No se pudo cerrar la fabricación semanal.'], JSON_UNESCAPED_UNICODE);
}
