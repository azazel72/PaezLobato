<?php
declare(strict_types=1);
require_once __DIR__ . '/../lib/database.php';

function recursosGestion(): array
{
    return [
        'lotes' => ['tabla' => 'a_lotes', 'editables' => ['codigo' => 60], 'sql' => "SELECT l.id, l.codigo, l.objetivo, l.cubicaje, l.consumido, l.cubicaje - l.consumido AS restante, l.estado, m.descripcion AS material, u.descripcion AS ubicacion FROM a_lotes l LEFT JOIN materiales m ON m.id = l.material_id LEFT JOIN ubicaciones u ON u.id = l.ubicacion_id WHERE l.is_deleted = 0 ORDER BY l.id DESC"],
        'proveedores' => ['tabla' => 'proveedores', 'editables' => ['nombre' => 128], 'sql' => 'SELECT id, nombre FROM proveedores ORDER BY nombre'],
        'materiales' => ['tabla' => 'materiales', 'editables' => ['descripcion' => 60], 'sql' => 'SELECT id, descripcion FROM materiales ORDER BY descripcion'],
        'ubicaciones' => ['tabla' => 'ubicaciones', 'editables' => ['descripcion' => 60], 'sql' => 'SELECT u.id, u.descripcion, u.orden, i.nombre AS instalacion FROM ubicaciones u LEFT JOIN instalaciones i ON i.id = u.instalacion_id ORDER BY u.orden, u.id'],
    ];
}

function obtenerResumenGestion(PDO $pdo): array
{
    return [
        'distribucion' => $pdo->query("SELECT objetivo, COUNT(*) AS cantidad FROM a_lotes WHERE is_deleted = 0 AND estado < 2 GROUP BY objetivo ORDER BY objetivo")->fetchAll(),
        'volumen' => $pdo->query("SELECT COALESCE(SUM(cubicaje - consumido), 0) FROM a_lotes WHERE is_deleted = 0 AND estado < 2 AND objetivo IN ('STOCK','ALMACENADO')")->fetchColumn(),
        'proveedores' => (int)$pdo->query('SELECT COUNT(*) FROM proveedores')->fetchColumn(),
        'ubicaciones' => (int)$pdo->query('SELECT COUNT(*) FROM ubicaciones')->fetchColumn(),
    ];
}

function listarRecursoGestion(PDO $pdo, string $recurso): array
{
    if ($recurso === 'resumen') return obtenerResumenGestion($pdo);
    $config = recursosGestion()[$recurso] ?? null;
    if (!$config) throw new InvalidArgumentException('Listado no disponible.');
    return ['filas' => $pdo->query($config['sql'])->fetchAll()];
}

function crearProveedorGestion(PDO $pdo, array $datos): array
{
    $nombre = $datos['nombre'] ?? '';
    if (!is_string($nombre) || trim($nombre) === '' || mb_strlen(trim($nombre)) > 128) throw new InvalidArgumentException('Indica un nombre de hasta 128 caracteres.');
    $nombre = trim($nombre);
    $consulta = $pdo->prepare('SELECT id FROM proveedores WHERE nombre = ?');
    $consulta->execute([$nombre]);
    if ($consulta->fetchColumn()) throw new InvalidArgumentException('Ya existe un proveedor con ese nombre.');
    $pdo->prepare('INSERT INTO proveedores (nombre) VALUES (?)')->execute([$nombre]);
    return ['id' => (int)$pdo->lastInsertId(), 'nombre' => $nombre];
}

function editarRecursoGestion(PDO $pdo, string $recurso, array $datos): array
{
    $config = recursosGestion()[$recurso] ?? null;
    $campo = $datos['campo'] ?? '';
    if (!$config || !is_string($campo) || !isset($config['editables'][$campo])) throw new InvalidArgumentException('Este campo no se puede editar.');
    $id = is_bool($datos['id'] ?? null) ? false : filter_var($datos['id'] ?? null, FILTER_VALIDATE_INT);
    $valor = $datos['valor'] ?? null;
    $anterior = $datos['anterior'] ?? null;
    if (!$id || $id < 1 || !is_string($valor) || !is_string($anterior) || trim($valor) === '' || mb_strlen(trim($valor)) > $config['editables'][$campo]) throw new InvalidArgumentException('Valor no válido para este campo.');
    $tabla = $config['tabla'];
    $pdo->beginTransaction();
    try {
        $consulta = $pdo->prepare("SELECT `$campo` FROM `$tabla` WHERE id = ? FOR UPDATE");
        $consulta->execute([$id]);
        $fila = $consulta->fetch();
        if (!$fila) throw new InvalidArgumentException('El registro ya no existe.');
        if ((string)$fila[$campo] !== $anterior) throw new InvalidArgumentException('El registro ha cambiado. Actualiza el listado antes de editarlo.');
        $valor = trim($valor);
        $pdo->prepare("UPDATE `$tabla` SET `$campo` = ? WHERE id = ?")->execute([$valor, $id]);
        $pdo->commit();
        return ['valor' => $valor];
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $error;
    }
}
