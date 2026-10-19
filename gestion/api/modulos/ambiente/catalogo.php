<?php
declare(strict_types=1);
function gAmbienteCatalogo(): array
{
    $fields = ['fecha' => gCampo('Fecha', 'date', ['required' => true])];
    foreach ([1 => '7:00', 2 => '10:00', 3 => '14:00'] as $index => $hour) {
        $fields['temperatura_' . $index] = gNumero('Temperatura ' . $hour . ' (°C)', 2, -100, 100);
        $fields['humedad_' . $index] = gNumero('Humedad ' . $hour . ' (%)', 2, 0, 100);
    }
    return ['ambientes' => ['title' => 'Ambiente', 'fields' => $fields]];
}
