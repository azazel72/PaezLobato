<?php
declare(strict_types=1);

function registrarLogPhp(string $mensaje): void
{
    $directorio = dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'logs';
    if (!is_dir($directorio)) {
        @mkdir($directorio, 0775, true);
    }
    $archivo = $directorio . DIRECTORY_SEPARATOR . 'php-' . date('Y-m-d') . '.log';
    $linea = sprintf("[%s] %s\n", date('Y-m-d H:i:s'), $mensaje);
    @file_put_contents($archivo, $linea, FILE_APPEND | LOCK_EX);
}
