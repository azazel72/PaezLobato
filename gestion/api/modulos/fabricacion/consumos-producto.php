<?php
declare(strict_types=1);

function gConsumosProductoCatalogo(): array
{
    return ['a_consumos' => ['title' => 'Consumos por producto', 'fields' => [
        'tipo_producto_id' => gReferencia('Tipo de producto', 'tipos_producto', true),
        'consumo_duelas' => gNumero('Consumo duelas', 4, 0, 99999999.9999),
        'consumo_fleje_40' => gNumero('Consumo fleje 40', 4, 0, 99999999.9999),
        'consumo_fleje_70' => gNumero('Consumo fleje 70', 4, 0, 99999999.9999),
        'consumo_fondo' => gNumero('Consumo fondo', 4, 0, 99999999.9999),
    ]]];
}
