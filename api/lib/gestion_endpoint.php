<?php
declare(strict_types=1);
// Adaptador de las rutas antiguas; toda la petición se atiende en gestion/.
require_once __DIR__ . '/../../gestion/api/router.php';

function atenderPeticionGestion(?string $recurso = null): void
{
    gHandleRequest($recurso, true);
}
