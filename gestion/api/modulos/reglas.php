<?php
declare(strict_types=1);
require_once __DIR__ . '/entradas/reglas.php';
require_once __DIR__ . '/fabricacion/reglas.php';
require_once __DIR__ . '/planificacion/reglas.php';
function gReglasValores(PDO $pdo, string $resource, array $values, ?array $old): array
{
    $values = gEntradasValores($pdo, $resource, $values);
    $values = gFabricacionValores($pdo, $resource, $values, $old);
    return gPlanificacionValores($pdo, $resource, $values, $old);
}
