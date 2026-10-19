<?php
declare(strict_types=1);
function gEntradasValores(PDO $pdo, string $resource, array $values): array
{
    if ($resource === 'entradas_flejes') $values['restante'] = round($values['peso'] - $values['consumido'], 2);
    if ($resource === 'lineas_entrada') {
        $q = $pdo->prepare('SELECT anulado FROM entradas WHERE id = ? AND is_deleted = 0 LOCK IN SHARE MODE'); $q->execute([$values['entrada_id']]);
        if ((int)$q->fetchColumn() === 1) throw new InvalidArgumentException('La entrada está anulada.');
    }
    return $values;
}
