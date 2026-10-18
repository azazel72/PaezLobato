<?php
require_once __DIR__ . '/servicios/fabricacion_crear_botas.php';
if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) {
    require __DIR__ . '/terminal/fabricacion_crear_botas.php';
}
