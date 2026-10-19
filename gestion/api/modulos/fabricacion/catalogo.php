<?php
declare(strict_types=1);
require_once __DIR__ . '/consumos-producto.php';
function gFabricacionCatalogo(): array
{
    $c = [
        'analiticas' => ['title' => 'Analíticas de vino', 'fields' => [
            'fecha' => gCampo('Fecha', 'date', ['required' => true]), 'descripcion' => gTexto('Descripción', 255, true),
            'estado' => gCampo('Estado', 'select', ['options' => ['ACTIVA' => 'Activa', 'FINALIZADA' => 'Finalizada'], 'required' => true, 'default' => 'ACTIVA']),
        ]],
        'palets' => ['title' => 'Palets', 'soft' => 'is_deleted', 'computed' => ['restante' => 'cubicaje - consumido'], 'fields' => [
            'codigo' => gTexto('Código', 60, true), 'linea_entrada_id' => gReferencia('Línea de entrada', 'lineas_entrada'), 'ubicacion_id' => gReferencia('Ubicación', 'ubicaciones'),
            'tipo_producto_id' => gReferencia('Tipo de producto', 'tipos_producto'), 'material_id' => gReferencia('Material', 'materiales'),
            'cubicaje' => gNumero('Cubicaje (m³)', 3, 0, 9999999.999), 'consumido' => gNumero('Consumido (m³)', 3, 0, 9999999.999), 'restante' => gNumero('Restante (m³)', 3) + ['readonly' => true],
            'estado' => gReferencia('Estado', 'estados_palets'), 'procesado' => gSiNo('Procesado'),
        ]],
        'productos' => ['title' => 'Productos', 'soft' => 'is_deleted', 'fields' => [
            'tipo' => gCampo('Tipo', 'select', ['options' => ['FONDO' => 'Fondo', 'VASO' => 'Vaso', 'BOTA' => 'Bota'], 'required' => true]), 'codigo' => gTexto('Código', 60, true),
            'tipo_producto_id' => gReferencia('Tipo de producto', 'tipos_producto'), 'material_id' => gReferencia('Material', 'materiales'), 'tostado_id' => gReferencia('Tostado', 'tostados'), 'ubicacion_id' => gReferencia('Ubicación', 'ubicaciones'),
            'estado' => gReferencia('Estado', 'estados_productos'), 'produccion_id' => gReferencia('Producción', 'fabricacion_semanal'),
        ]],
        'trazabilidad_procesado' => ['title' => 'Trazabilidad de procesado', 'soft' => 'is_deleted', 'fields' => [
            'palet_origen_id' => gReferencia('Palet origen', 'palets', true), 'palet_destino_id' => gReferencia('Palet destino', 'palets', true),
        ]],
        'trazabilidad_fabricacion' => ['title' => 'Trazabilidad de fabricación', 'soft' => 'is_deleted', 'fields' => [
            'fabricacion_semanal_id' => gReferencia('Fabricación semanal', 'fabricacion_semanal'), 'palet_id' => gReferencia('Palet', 'palets', true), 'cantidad_fabricada' => gNumero('Cantidad fabricada'), 'estado' => gReferencia('Estado', 'estados_trazabilidad_fabricacion'),
        ]],
        'trazabilidad_producto' => ['title' => 'Trazabilidad de producto', 'soft' => 'is_deleted', 'fields' => [
            'trazabilidad_fabricacion_id' => gReferencia('Trazabilidad de fabricación', 'trazabilidad_fabricacion', true), 'producto_id' => gReferencia('Producto', 'productos', true),
        ]],
        'consumos' => ['title' => 'Consumos', 'fields' => [
            'bota_id' => gReferencia('Tipo de producto fabricado', 'tipos_producto', true, ['refTypes' => ['BOTA', 'FONDO']]), 'consumible_id' => gReferencia('Consumible', 'tipos_producto', true, ['refTypes' => ['FONDO', 'FLEJE', 'DUELA']]), 'consumo' => gNumero('Consumo por unidad', 4, 0, 9999.9999),
        ]],
        'cubicaje' => ['title' => 'Cubicaje estándar', 'fields' => [
            'tipo_producto_id' => gReferencia('Tipo de duela', 'tipos_producto', true, ['refTypes' => ['DUELA']]), 'cubicaje_estandar' => gNumero('Cubicaje estándar (m³)', 3, 0, 9999999.999),
        ]],
    ];
    foreach (['deposito' => 'Depósito', 'litros' => 'Litros', 'alcohol' => 'Alcohol', 'av' => 'AV', 'ph' => 'pH', 'ntu' => 'NTU', 'azucar' => 'Azúcar', 'numero_botas' => 'Número de botas', 'cliente' => 'Cliente', 'tipo_bota' => 'Tipo de bota', 'vo_at' => 'vo(@)', 'observaciones' => 'Observaciones'] as $key => $label) {
        $c['analiticas']['fields'][$key] = gTexto($label, in_array($key, ['deposito', 'cliente', 'tipo_bota', 'observaciones'], true) ? 255 : 64);
    }
    return $c + gConsumosProductoCatalogo();
}
