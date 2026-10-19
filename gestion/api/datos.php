<?php
declare(strict_types=1);
require_once __DIR__ . '/catalogo.php';
require_once __DIR__ . '/modulos/reglas.php';
require_once __DIR__ . '/../../api/lib/database.php';

function gConfig(string $resource): array
{
    $c = gCatalogo()[$resource] ?? null;
    if (!$c) throw new InvalidArgumentException('Recurso no disponible.');
    return $c;
}

function gWhere(array $config): string { return isset($config['soft']) ? '`' . $config['soft'] . '` = 0' : '1=1'; }
function gColumns(array $config): array
{
    return array_merge(['id'], array_keys(array_filter($config['fields'], fn($f) => $f['type'] !== 'password')));
}
function gList(PDO $pdo, string $resource): array
{
    $config = gConfig($resource);
    $fields = implode(',', array_map(fn($f) => isset($config['computed'][$f]) ? '(' . $config['computed'][$f] . ") AS `$f`" : "`$f`", gColumns($config)));
    return $pdo->query("SELECT $fields FROM `$resource` WHERE " . gWhere($config) . ' ORDER BY id DESC')->fetchAll();
}
function gLookups(PDO $pdo, array $config): array
{
    $result = [];
    foreach ($config['fields'] as $f) if (isset($f['ref']) && !isset($result[$f['ref']])) {
        $ref = $f['ref']; $rows = gList($pdo, $ref);
        $result[$ref] = array_map(function ($row) use ($ref) {
            $label = $row['nombre'] ?? $row['descripcion'] ?? $row['alias'] ?? $row['codigo'] ?? $row['numero'] ?? (string)$row['id'];
            if ($ref === 'pedidos') $label = ($row['numero'] ?: '#' . $row['id']) . ' · ' . $row['descripcion'];
            if ($ref === 'fabricacion_semanal') $label = '#' . $row['id'] . ' · ' . ($row['fecha_inicio'] ?? '') . ' · Pedido #' . $row['pedido_id'];
            if ($ref === 'lineas_entrada') $label = '#' . $row['id'] . ' · Entrada #' . $row['entrada_id'];
            if ($ref === 'trazabilidad_fabricacion') $label = '#' . $row['id'] . ' · Palet #' . $row['palet_id'];
            return ['value' => $row['id'], 'label' => $label, 'data' => $row];
        }, $rows);
    }
    return $result;
}
function gDate($value): string
{
    if (!is_string($value)) throw new InvalidArgumentException('Fecha no válida.');
    $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value);
    if (!$date || $date->format('Y-m-d') !== $value) throw new InvalidArgumentException('Fecha no válida.');
    return $value;
}
function gId($value): int
{
    $id = is_bool($value) ? false : filter_var($value, FILTER_VALIDATE_INT);
    if (!$id || $id < 1) throw new InvalidArgumentException('Identificador no válido.');
    return $id;
}
function gValidate(PDO $pdo, string $resource, array $data, bool $create, ?array $old = null): array
{
    $config = gConfig($resource); $values = [];
    foreach ($data as $key => $_) if (!isset($config['fields'][$key])) throw new InvalidArgumentException('Campo no permitido: ' . $key);
    foreach ($config['fields'] as $key => $f) {
        if ($f['readonly'] ?? false) continue;
        $v = $data[$key] ?? ($create ? ($f['default'] ?? null) : null);
        if ($f['type'] === 'password' && !$create && ($v === '' || $v === null)) continue;
        if (is_array($v) || is_object($v)) throw new InvalidArgumentException($f['label'] . ': valor no válido.');
        if ($f['type'] === 'checkbox') {
            if (!in_array($v, [0, 1, '0', '1', true, false], true)) throw new InvalidArgumentException($f['label'] . ': valor no válido.');
            $values[$key] = (int)(bool)$v; continue;
        }
        if ($v === null || $v === '') {
            if (($f['required'] ?? false) || ($create && ($f['createRequired'] ?? false))) throw new InvalidArgumentException($f['label'] . ': campo obligatorio.');
            $values[$key] = null; continue;
        }
        if ($f['type'] === 'number' || isset($f['ref'])) {
            if (!isset($f['ref']) && ($f['precision'] ?? 0) > 0) {
                $n = is_bool($v) ? false : filter_var($v, FILTER_VALIDATE_FLOAT);
                if ($n === false || !is_finite($n) || $n < ($f['min'] ?? 0) || $n > ($f['maxValue'] ?? 2147483647)) throw new InvalidArgumentException($f['label'] . ': número no válido.');
                $rounded = round($n, $f['precision']);
                if (abs($n - $rounded) > 0.0000001) throw new InvalidArgumentException($f['label'] . ': admite hasta ' . $f['precision'] . ' decimales.');
                $values[$key] = $rounded; continue;
            }
            $n = is_bool($v) ? false : filter_var($v, FILTER_VALIDATE_INT);
            if ($n === false || $n < ($f['min'] ?? 1) || $n > ($f['maxValue'] ?? 2147483647)) throw new InvalidArgumentException($f['label'] . ': número no válido.');
            if (isset($f['ref'])) {
                $ref = $f['ref']; $refConfig = gConfig($ref);
                $q = $pdo->prepare("SELECT id FROM `$ref` WHERE id = ? AND " . gWhere($refConfig) . ' LOCK IN SHARE MODE'); $q->execute([$n]);
                if ($q->fetchColumn() === false) throw new InvalidArgumentException($f['label'] . ': el registro ya no existe.');
                if (isset($f['refTypes'])) {
                    $type = $pdo->prepare("SELECT tipo FROM `$ref` WHERE id = ?"); $type->execute([$n]);
                    if (!in_array($type->fetchColumn(), $f['refTypes'], true)) throw new InvalidArgumentException($f['label'] . ': tipo de producto no permitido.');
                }
            }
            $values[$key] = $n;
        } elseif ($f['type'] === 'date') $values[$key] = gDate($v);
        elseif (isset($f['options'])) {
            if ($resource === 'pedidos' && $key === 'destino') $v = ['CLIENTE' => 'C', 'ENVINADO' => 'E'][$v] ?? $v;
            if (!array_key_exists((string)$v, $f['options'])) throw new InvalidArgumentException($f['label'] . ': opción no válida.');
            $values[$key] = (string)$v;
        } else {
            $v = $f['type'] === 'password' ? (string)$v : trim((string)$v);
            if ((($f['required'] ?? false) || ($create && ($f['createRequired'] ?? false))) && trim($v) === '') throw new InvalidArgumentException($f['label'] . ': campo obligatorio.');
            if (mb_strlen($v) > ($f['max'] ?? 255) || ($f['type'] === 'password' && strlen($v) > 72)) throw new InvalidArgumentException($f['label'] . ': texto demasiado largo.');
            $values[$key] = $f['type'] === 'password' ? password_hash($v, PASSWORD_BCRYPT, ['cost' => 12]) : $v;
        }
    }
    if ($resource === 'pedidos' && $values['fecha'] && $values['fecha_finalizacion'] && $values['fecha_finalizacion'] < $values['fecha']) throw new InvalidArgumentException('La finalización no puede ser anterior a la fecha del pedido.');
    if ($resource === 'fabricacion_semanal') {
        if ((new DateTimeImmutable($values['fecha_inicio']))->format('N') !== '1') throw new InvalidArgumentException('La semana de fabricación debe comenzar en lunes.');
        $q = $pdo->prepare('SELECT tipo_producto_id, material_id, tostado_id FROM pedidos WHERE id = ? AND is_deleted = 0 FOR UPDATE'); $q->execute([$values['pedido_id']]);
        $pedido = $q->fetch();
        if (!$pedido || !$pedido['tipo_producto_id'] || !$pedido['tostado_id']) throw new InvalidArgumentException('El pedido necesita tipo de producto y tostado.');
        $values += $pedido;
    }
    return gReglasValores($pdo, $resource, $values, $old);
}
function gSnapshot(array $row, array $config): string
{
    $public = [];
    foreach (gColumns($config) as $key) $public[$key] = isset($row[$key]) ? (string)$row[$key] : null;
    return hash('sha256', json_encode($public, JSON_UNESCAPED_UNICODE));
}
function gRow(PDO $pdo, string $resource, int $id, bool $lock = false): array
{
    $config = gConfig($resource);
    $computed = '';
    foreach ($config['computed'] ?? [] as $field => $expression) $computed .= ", ($expression) AS `$field`";
    $q = $pdo->prepare("SELECT *$computed FROM `$resource` WHERE id = ? AND " . gWhere($config) . ($lock ? ' FOR UPDATE' : '')); $q->execute([$id]);
    $row = $q->fetch();
    if (!$row) throw new InvalidArgumentException('El registro ya no existe. Actualiza el listado.');
    return $row;
}
function gReferences(PDO $pdo, string $resource, int $id): void
{
    $q = $pdo->prepare('SELECT TABLE_NAME, COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE REFERENCED_TABLE_SCHEMA = DATABASE() AND REFERENCED_TABLE_NAME = ? AND REFERENCED_COLUMN_NAME = ?'); $q->execute([$resource, 'id']);
    $references = $q->fetchAll();
    // Algunas relaciones de la aplicación no están declaradas como FK en MySQL.
    foreach (gCatalogo() as $table => $config) foreach ($config['fields'] as $field => $definition) {
        if (($definition['ref'] ?? null) === $resource) $references[] = ['TABLE_NAME' => $table, 'COLUMN_NAME' => $field];
    }
    if ($resource === 'usuarios') $references[] = ['TABLE_NAME' => 'cuadrante_detalles', 'COLUMN_NAME' => 'usuario_id'];
    if ($resource === 'puestos_trabajo') $references[] = ['TABLE_NAME' => 'cuadrante_detalles', 'COLUMN_NAME' => 'puesto_id'];
    if ($resource === 'analiticas') $references[] = ['TABLE_NAME' => 'bota_envinada_analitica', 'COLUMN_NAME' => 'analitica_id'];
    if ($resource === 'productos') foreach (['bota_envinada_analitica', 'bota_envinada_archivo'] as $table) $references[] = ['TABLE_NAME' => $table, 'COLUMN_NAME' => 'producto_id'];
    if ($resource === 'archivos_subidos') $references[] = ['TABLE_NAME' => 'bota_envinada_archivo', 'COLUMN_NAME' => 'archivo_subido_id'];
    $checked = [];
    foreach ($references as $ref) {
        $key = $ref['TABLE_NAME'] . ':' . $ref['COLUMN_NAME'];
        if (isset($checked[$key])) continue;
        $checked[$key] = true;
        $table = str_replace('`', '``', $ref['TABLE_NAME']); $field = str_replace('`', '``', $ref['COLUMN_NAME']);
        $check = $pdo->prepare("SELECT 1 FROM `$table` WHERE `$field` = ? LIMIT 1"); $check->execute([$id]);
        if ($check->fetchColumn()) throw new InvalidArgumentException('No se puede eliminar: el registro está utilizado en otros datos.');
    }
}
function gSave(PDO $pdo, string $resource, array $payload): array
{
    $config = gConfig($resource); $action = $payload['action'] ?? '';
    if (!in_array($action, ['create', 'update', 'delete'], true)) throw new InvalidArgumentException('Acción no disponible.');
    if ($action === 'create' && ($config['upload'] ?? false)) throw new InvalidArgumentException('Utiliza la subida de archivos.');
    $create = $action === 'create';
    $id = $create ? 0 : (($config['zeroId'] ?? false) && in_array($payload['id'] ?? null, [0, '0'], true) ? 0 : gId($payload['id'] ?? null));
    $pdo->beginTransaction();
    try {
        if (!$create) {
            $old = gRow($pdo, $resource, $id, true);
            if (!is_string($payload['version'] ?? null) || !hash_equals(gSnapshot($old, $config), $payload['version'])) throw new InvalidArgumentException('Otro usuario ha modificado el registro. Actualiza antes de continuar.');
        }
        if ($action === 'delete') {
            gReferences($pdo, $resource, $id);
            if (isset($config['soft'])) $pdo->prepare("UPDATE `$resource` SET `{$config['soft']}` = 1, deleted_at = CURRENT_TIMESTAMP WHERE id = ?")->execute([$id]);
            else $pdo->prepare("DELETE FROM `$resource` WHERE id = ?")->execute([$id]);
        } else {
            if (!is_array($payload['data'] ?? null)) throw new InvalidArgumentException('Datos no válidos.');
            $values = gValidate($pdo, $resource, $payload['data'], $create, $old ?? null);
            if ($create && ($config['manualId'] ?? false)) {
                $last = $pdo->query("SELECT id FROM `$resource` ORDER BY id DESC LIMIT 1 FOR UPDATE")->fetchColumn();
                $id = $last === false ? 1 : (int)$last + 1;
                $values = ['id' => $id] + $values;
            }
            $keys = array_keys($values);
            if ($create) {
                $columns = implode(',', array_map(fn($k) => "`$k`", $keys)); $marks = implode(',', array_fill(0, count($keys), '?'));
                $pdo->prepare("INSERT INTO `$resource` ($columns) VALUES ($marks)")->execute(array_values($values));
                if (!($config['manualId'] ?? false)) $id = (int)$pdo->lastInsertId();
            } else {
                $assignments = implode(',', array_map(fn($k) => "`$k` = ?", $keys));
                $pdo->prepare("UPDATE `$resource` SET $assignments WHERE id = ?")->execute([...array_values($values), $id]);
            }
            if ($resource === 'pedidos') {
                // El tostado del pedido se aplica también a sus líneas de fabricación.
                $pdo->prepare('UPDATE fabricacion_semanal SET tostado_id = ? WHERE pedido_id = ? AND is_deleted = 0')->execute([$values['tostado_id'], $id]);
            }
        }
        $result = ['id' => $id];
        if ($action !== 'delete') {
            $saved = gRow($pdo, $resource, $id);
            $result['row'] = array_intersect_key($saved, array_flip(gColumns($config)));
            $result['row']['_version'] = gSnapshot($saved, $config);
        }
        $pdo->commit(); return $result;
    } catch (Throwable $e) { if ($pdo->inTransaction()) $pdo->rollBack(); throw $e; }
}
function gDataset(PDO $pdo, string $resource): array
{
    $config = gConfig($resource); $rows = gList($pdo, $resource);
    foreach ($rows as &$row) $row['_version'] = gSnapshot($row, $config);
    return ['config' => $config, 'rows' => $rows, 'lookups' => gLookups($pdo, $config)];
}
