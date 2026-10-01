<?php
declare(strict_types=1);

function fabricacionPdo(): PDO
{
    $pdo = new PDO(
        'mysql:host=localhost;port=3306;dbname=antoniopaezlobato;charset=utf8mb4',
        'rafa',
        'rafa',
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]
    );
    $pdo->setAttribute(PDO::ATTR_EMULATE_PREPARES, false);
    return $pdo;
}
