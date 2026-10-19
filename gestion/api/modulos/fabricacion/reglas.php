<?php
declare(strict_types=1);
function gFabricacionValores(PDO $pdo, string $resource, array $values, ?array $old): array
{
    if ($resource === 'palets') {
        $changed = $old && (string)($old['linea_entrada_id'] ?? '') !== (string)($values['linea_entrada_id'] ?? '');
        if ($changed || (!$old && $values['linea_entrada_id'] && !$values['tipo_producto_id'] && !$values['material_id'])) {
            $line = $values['linea_entrada_id'] ? gRow($pdo, 'lineas_entrada', $values['linea_entrada_id']) : [];
            $values['tipo_producto_id'] = $line['tipo_producto_id'] ?? null;
            $values['material_id'] = $line['material_id'] ?? null;
        }
    }
    if ($resource === 'productos' && $values['tipo_producto_id']) {
        $type = gRow($pdo, 'tipos_producto', $values['tipo_producto_id']);
        if ($type['tipo'] !== $values['tipo']) throw new InvalidArgumentException('El tipo de producto no corresponde al tipo seleccionado.');
    }
    if ($resource === 'trazabilidad_procesado' && $values['palet_origen_id'] === $values['palet_destino_id']) throw new InvalidArgumentException('El palet origen y el destino deben ser diferentes.');
    if (in_array($resource, ['cubicaje', 'consumos', 'a_consumos'], true)) {
        $fields = $resource === 'consumos' ? ['bota_id', 'consumible_id'] : ['tipo_producto_id'];
        $where = implode(' AND ', array_map(fn($field) => "`$field` = ?", $fields));
        $q = $pdo->prepare("SELECT id FROM `$resource` WHERE $where AND id <> ? FOR UPDATE");
        $q->execute([...array_map(fn($field) => $values[$field], $fields), $old['id'] ?? 0]);
        if ($q->fetchColumn()) throw new InvalidArgumentException('Ya existe una configuración para este producto. Edita la existente.');
    }
    return $values;
}
