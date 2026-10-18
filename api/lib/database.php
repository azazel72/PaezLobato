<?php
declare(strict_types=1);

require_once __DIR__ . '/../config/aplicacion.php';

function fabricacionPdo(): PDO
{
    $pdo = new PDO(
        DB_DSN,
        DB_USER,
        DB_PASS,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]
    );
    $pdo->setAttribute(PDO::ATTR_EMULATE_PREPARES, false);
    return $pdo;
}

function fabricacionProcedimientoFilas(PDO $pdo, string $nombre, array $parametros = []): array
{
    if (!preg_match('/^[a-zA-Z0-9_]+$/', $nombre)) throw new InvalidArgumentException('Procedimiento no válido.');
    $marcadores = $parametros ? implode(',', array_fill(0, count($parametros), '?')) : '';
    $consulta = $pdo->prepare("CALL {$nombre}({$marcadores})");
    $consulta->execute(array_values($parametros));
    $filas = $consulta->fetchAll(PDO::FETCH_ASSOC);
    while ($consulta->nextRowset()) { }
    $consulta->closeCursor();
    return $filas;
}
