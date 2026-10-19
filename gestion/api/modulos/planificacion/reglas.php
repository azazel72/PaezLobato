<?php
declare(strict_types=1);
function gPlanificacionValores(PDO $pdo, string $resource, array $values, ?array $old): array
{
    $keys = ['plan_camiones' => ['año', 'proveedor_id'], 'plan_material' => ['año', 'tipo_material'], 'plan_facturacion' => ['año']][$resource] ?? null;
    if (!$keys) return $values;
    $where = implode(' AND ', array_map(fn($key) => "`$key` = ?", $keys));
    $q = $pdo->prepare("SELECT id FROM `$resource` WHERE $where AND id <> ? FOR UPDATE");
    $q->execute([...array_map(fn($key) => $values[$key], $keys), $old['id'] ?? 0]);
    if ($q->fetchColumn()) throw new InvalidArgumentException('Ya existe ese registro en la planificación del año.');
    return $values;
}
