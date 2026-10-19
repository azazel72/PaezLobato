<?php
declare(strict_types=1);
require_once __DIR__ . '/router.php';

try {
    $pdo = fabricacionPdo();
    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'GET') {
        $id = gId($_GET['id'] ?? null);
        $q = $pdo->prepare('SELECT nombre_archivo, nombre_original FROM archivos_subidos WHERE id = ? AND is_deleted = 0'); $q->execute([$id]); $row = $q->fetch();
        if (!$row) throw new InvalidArgumentException('Archivo no encontrado.');
        $name = basename($row['nombre_archivo']); $file = null;
        foreach ([__DIR__ . '/../archivos', __DIR__ . '/../../archivos'] as $dir) {
            $root = realpath($dir); $candidate = $root ? realpath($root . DIRECTORY_SEPARATOR . $name) : false;
            if ($candidate && is_file($candidate) && strcasecmp(dirname($candidate), $root) === 0) { $file = $candidate; break; }
        }
        if (!$file) throw new InvalidArgumentException('El archivo no está disponible en el servidor.');
        header('Content-Type: application/octet-stream'); header('X-Content-Type-Options: nosniff');
        header("Content-Disposition: attachment; filename*=UTF-8''" . rawurlencode(basename($row['nombre_original'])));
        header('Content-Length: ' . filesize($file)); readfile($file); exit;
    }
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') { header('Allow: GET, POST'); gRespond(['ok' => false, 'error' => 'Método no permitido.'], 405); exit; }
    gOrigin();
    $upload = $_FILES['archivo'] ?? null;
    if (!$upload || $upload['error'] !== UPLOAD_ERR_OK) throw new InvalidArgumentException('No se pudo subir el archivo. Comprueba su tamaño y el límite de PHP.');
    if ($upload['size'] > 15 * 1024 * 1024) throw new InvalidArgumentException('El archivo supera 15 MB.');
    $name = basename($upload['name']); $extension = strtolower(pathinfo($name, PATHINFO_EXTENSION));
    if (!in_array($extension, ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'txt', 'csv', 'xlsx', 'xls', 'docx', 'doc', 'odt', 'ods', 'zip'], true)) throw new InvalidArgumentException('Tipo de archivo no permitido.');
    if (mb_strlen($name) > 255) throw new InvalidArgumentException('El nombre del archivo es demasiado largo.');
    $data = ['titulo' => $_POST['titulo'] ?? '', 'entidad' => $_POST['entidad'] ?? 'gestion', 'entidad_id' => $_POST['entidad_id'] ?? 0];
    $values = gValidate($pdo, 'archivos_subidos', $data, true);
    $products = isset($_POST['producto_ids']) ? gDocumentosIds(json_decode($_POST['producto_ids'], true, 512, JSON_THROW_ON_ERROR)) : [];
    $stored = 'gestion_' . bin2hex(random_bytes(16)) . '.' . $extension;
    $path = __DIR__ . '/../archivos/' . $stored;
    if (!move_uploaded_file($upload['tmp_name'], $path)) throw new RuntimeException('No se pudo guardar el archivo.');
    try {
        $pdo->beginTransaction();
        $pdo->prepare('INSERT INTO archivos_subidos (titulo, entidad, entidad_id, nombre_original, nombre_archivo, extension) VALUES (?, ?, ?, ?, ?, ?)')->execute([$values['titulo'], $values['entidad'], $values['entidad_id'], $name, $stored, $extension]);
        $id = (int)$pdo->lastInsertId();
        if ($products) gVincularDocumentos($pdo, $products, [$id]);
        $pdo->commit();
    } catch (Throwable $e) { if ($pdo->inTransaction()) $pdo->rollBack(); unlink($path); throw $e; }
    gRespond(['ok' => true, 'id' => $id]);
} catch (Throwable $e) {
    $valid = $e instanceof InvalidArgumentException || $e instanceof JsonException;
    if (!$valid) error_log('[gestion archivos] ' . $e->getMessage());
    gRespond(['ok' => false, 'error' => $valid ? $e->getMessage() : 'No se pudo guardar el archivo.'], $valid ? 400 : 500);
}
