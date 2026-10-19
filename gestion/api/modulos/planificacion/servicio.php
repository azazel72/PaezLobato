<?php
declare(strict_types=1);
function gInicializarPlan(PDO $pdo, array $payload): array
{
    if (($payload['action'] ?? '') !== 'initialize') throw new InvalidArgumentException('Acción no disponible.');
    $year = filter_var($payload['year'] ?? null, FILTER_VALIDATE_INT);
    if ($year === false || $year < 1970 || $year > 2155) throw new InvalidArgumentException('Año no válido (1970 a 2155).');
    $pdo->beginTransaction();
    try {
        // Bloqueo común a las altas del año para evitar duplicados concurrentes.
        $providers = $pdo->query('SELECT id FROM proveedores ORDER BY id FOR UPDATE')->fetchAll(PDO::FETCH_COLUMN);
        $q = $pdo->prepare('SELECT proveedor_id FROM plan_camiones WHERE `año` = ? FOR UPDATE'); $q->execute([$year]);
        $existing = $q->fetchAll(PDO::FETCH_COLUMN); $created = 0;
        $insert = $pdo->prepare('INSERT INTO plan_camiones (`año`, proveedor_id) VALUES (?, ?)');
        foreach ($providers as $provider) if (!in_array($provider, $existing)) { $insert->execute([$year, $provider]); $created++; }
        $q = $pdo->prepare('SELECT tipo_material FROM plan_material WHERE `año` = ? FOR UPDATE'); $q->execute([$year]); $existing = $q->fetchAll(PDO::FETCH_COLUMN);
        $insert = $pdo->prepare('INSERT INTO plan_material (`año`, tipo_material) VALUES (?, ?)');
        foreach (['FLEJE', 'REMACHES', 'PUNTAFITAS'] as $material) if (!in_array($material, $existing, true)) { $insert->execute([$year, $material]); $created++; }
        $q = $pdo->prepare('SELECT id FROM plan_facturacion WHERE `año` = ? FOR UPDATE'); $q->execute([$year]);
        if (!$q->fetchColumn()) { $pdo->prepare('INSERT INTO plan_facturacion (`año`) VALUES (?)')->execute([$year]); $created++; }
        $pdo->commit(); return ['created' => $created];
    } catch (Throwable $e) { if ($pdo->inTransaction()) $pdo->rollBack(); throw $e; }
}
