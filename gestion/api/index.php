<?php
declare(strict_types=1);
// Compatibilidad con las URL anteriores. La entrada oficial es router.php.
require_once __DIR__ . '/router.php';
if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) gHandleRequest();
