<?php
require_once __DIR__ . '/servicios/procesar_stock.php';
if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) {
    require __DIR__ . '/terminal/procesar_stock.php';
}
