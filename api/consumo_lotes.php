<?php
require_once __DIR__ . '/servicios/consumo_lotes.php';
if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) {
    require __DIR__ . '/terminal/consumo_lotes.php';
}
