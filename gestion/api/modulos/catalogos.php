<?php
declare(strict_types=1);
require_once __DIR__ . '/campos.php';
require_once __DIR__ . '/ambiente/catalogo.php';
require_once __DIR__ . '/entradas/catalogo.php';
require_once __DIR__ . '/fabricacion/catalogo.php';
require_once __DIR__ . '/planificacion/catalogo.php';
function gCatalogosOperaciones(): array { return gAmbienteCatalogo() + gEntradasCatalogo() + gFabricacionCatalogo() + gPlanificacionCatalogo(); }
