<?php
require_once __DIR__ . '/servicios/cierre_semanal_lotes.php';
if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) {
    require __DIR__ . '/terminal/cierre_semanal_lotes.php';
}
