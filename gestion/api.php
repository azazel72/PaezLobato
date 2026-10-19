<?php
declare(strict_types=1);
// Compatibilidad con el endpoint original de esta aplicación.
require_once __DIR__ . '/api/router.php';
gHandleRequest(null, true);
