<?php
declare(strict_types=1);

// Misma impresora y puerto que servidor/impresion/imprimir_etiqueta.py.
// La dirección se configura en el servidor, nunca mediante el POST.
function configuracionImpresoraEtiquetas(): array
{
    return ['host' => '192.168.1.69', 'puerto' => 9100, 'timeout' => 5];
}
