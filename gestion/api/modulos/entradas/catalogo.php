<?php
declare(strict_types=1);
function gEntradasCatalogo(): array
{
    return [
        'entradas' => ['title' => 'Entradas', 'soft' => 'is_deleted', 'fields' => [
            'numero' => gTexto('Número', 50, true), 'proveedor_id' => gReferencia('Proveedor', 'proveedores', true), 'fecha' => gCampo('Fecha', 'date'), 'entregado' => gSiNo('Entregado'), 'anulado' => gSiNo('Anulado'),
        ]],
        'lineas_entrada' => ['title' => 'Líneas de entrada', 'fields' => [
            'entrada_id' => gReferencia('Entrada', 'entradas', true), 'tipo_producto_id' => gReferencia('Tipo de producto', 'tipos_producto'), 'material_id' => gReferencia('Material', 'materiales'),
            'bultos' => gNumero('Bultos'), 'kilos' => gNumero('Kilos', 2, 0, 99999999.99), 'bultos_entregados' => gNumero('Bultos entregados'), 'verificado' => gSiNo('Verificado'),
        ]],
        'entradas_flejes' => ['title' => 'Entradas de flejes', 'soft' => 'is_deleted', 'fields' => [
            'fecha' => gCampo('Fecha', 'date', ['required' => true]), 'tipo_producto_id' => gReferencia('Tipo de fleje', 'tipos_producto', true, ['refTypes' => ['FLEJE']]),
            'lote' => gTexto('Lote', 120, true), 'peso' => gNumero('Peso', 2, 0, 99999999.99), 'consumido' => gNumero('Consumido', 2, 0, 99999999.99),
            'restante' => gNumero('Restante', 2) + ['readonly' => true], 'estado' => gReferencia('Estado', 'estados_flejes', true, ['min' => 0, 'default' => 0]),
        ]],
    ];
}
