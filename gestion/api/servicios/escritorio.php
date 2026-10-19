<?php
declare(strict_types=1);
require_once __DIR__ . '/../../../api/lib/database.php';

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
    $resultado = ['filas' => $pdo->query($config['sql'])->fetchAll()];
    if ($recurso === 'ubicaciones') $resultado['instalaciones'] = $pdo->query('SELECT id, nombre FROM instalaciones ORDER BY nombre')->fetchAll();
    return $resultado;
}

function crearMaestroGestion(PDO $pdo, string $recurso, array $datos): array
{
    if ($recurso === 'proveedores') return crearProveedorGestion($pdo, $datos);
    if (!in_array($recurso, ['materiales', 'ubicaciones'], true)) throw new InvalidArgumentException('Alta no disponible.');
    $descripcion = $datos['descripcion'] ?? null;
    if (!is_string($descripcion) || trim($descripcion) === '' || mb_strlen(trim($descripcion)) > 60) throw new InvalidArgumentException('Indica una descripción de hasta 60 caracteres.');
    $descripcion = trim($descripcion);
    $consulta = $pdo->prepare("SELECT id FROM `$recurso` WHERE descripcion = ?");
    $consulta->execute([$descripcion]);
    if ($consulta->fetchColumn()) throw new InvalidArgumentException('Ya existe un registro con esa descripción.');
    if ($recurso === 'ubicaciones') {
        $instalacion = filter_var($datos['instalacion_id'] ?? null, FILTER_VALIDATE_INT);
        $orden = filter_var($datos['orden'] ?? null, FILTER_VALIDATE_INT);
        if (!$instalacion || $instalacion < 1 || $orden === false) throw new InvalidArgumentException('Selecciona una instalación y un orden entero.');
        $consulta = $pdo->prepare('SELECT id FROM instalaciones WHERE id = ?');
        $consulta->execute([$instalacion]);
        if (!$consulta->fetchColumn()) throw new InvalidArgumentException('La instalación ya no existe.');
        $pdo->prepare('INSERT INTO ubicaciones (descripcion, instalacion_id, orden) VALUES (?, ?, ?)')->execute([$descripcion, $instalacion, $orden]);
    } else {
        $pdo->prepare('INSERT INTO materiales (descripcion) VALUES (?)')->execute([$descripcion]);
    }
    return ['id' => (int)$pdo->lastInsertId(), 'descripcion' => $descripcion];
}

function eliminarMaestroGestion(PDO $pdo, string $recurso, array $datos): array
{
    if (!in_array($recurso, ['proveedores', 'materiales', 'ubicaciones'], true)) throw new InvalidArgumentException('Eliminación no disponible.');
    $id = is_bool($datos['id'] ?? null) ? false : filter_var($datos['id'] ?? null, FILTER_VALIDATE_INT);
    $campo = $recurso === 'proveedores' ? 'nombre' : 'descripcion';
    $anterior = $datos['anterior'] ?? null;
    if (!$id || $id < 1 || !is_string($anterior)) throw new InvalidArgumentException('Registro no válido.');
    $pdo->beginTransaction();
    try {
        $consulta = $pdo->prepare("SELECT `$campo` FROM `$recurso` WHERE id = ? FOR UPDATE");
        $consulta->execute([$id]);
        $fila = $consulta->fetch();
        if (!$fila || (string)$fila[$campo] !== $anterior) throw new InvalidArgumentException('El registro ha cambiado o ya no existe. Actualiza el listado.');
        // Comprueba referencias incluso si una relación tiene borrado en cascada.
        $referencias = $pdo->prepare('SELECT TABLE_NAME, COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE REFERENCED_TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME = ? AND REFERENCED_COLUMN_NAME = ?');
        $referencias->execute([$recurso, 'id']);
        foreach ($referencias->fetchAll() as $referencia) {
            $tabla = str_replace('`', '``', $referencia['TABLE_NAME']);
            $columna = str_replace('`', '``', $referencia['COLUMN_NAME']);
            $uso = $pdo->prepare("SELECT 1 FROM `$tabla` WHERE `$columna` = ? LIMIT 1");
            $uso->execute([$id]);
            if ($uso->fetchColumn()) throw new InvalidArgumentException('No se puede eliminar: el registro está utilizado en otros datos.');
        }
        $pdo->prepare("DELETE FROM `$recurso` WHERE id = ?")->execute([$id]);
        $pdo->commit();
        return ['id' => $id];
    } catch (Throwable $error) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        if ($error instanceof PDOException && $error->getCode() === '23000') throw new InvalidArgumentException('No se puede eliminar: el registro está utilizado en otros datos.');
        throw $error;
    }
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
