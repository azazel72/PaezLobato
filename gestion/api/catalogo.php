<?php
declare(strict_types=1);
require_once __DIR__ . '/modulos/catalogos.php';

// Catálogo exclusivo de la nueva gestión. No carga código del frontend anterior.
function gCampo(string $label, string $type = 'text', array $extra = []): array
{
    return ['label' => $label, 'type' => $type] + $extra;
}

function gCatalogo(): array
{
    $texto = fn(string $label, int $max = 100) => gCampo($label, 'text', ['required' => true, 'max' => $max]);
    $ref = fn(string $label, string $table, bool $required = false) => gCampo($label, 'select', ['ref' => $table, 'required' => $required]);
    $bool = fn(string $label, int $default = 0) => gCampo($label, 'checkbox', ['default' => $default]);
    $integer = fn(string $label, int $default = 0) => gCampo($label, 'number', ['default' => $default, 'min' => 0, 'required' => true]);
    $c = [
        'proveedores' => ['title' => 'Proveedores', 'fields' => ['nombre' => $texto('Nombre', 128)]],
        'clientes' => ['title' => 'Clientes', 'fields' => ['nombre' => $texto('Nombre', 128)]],
        'materiales' => ['title' => 'Materiales', 'fields' => ['descripcion' => $texto('Descripción', 60)]],
        'tostados' => ['title' => 'Tostados', 'fields' => ['descripcion' => $texto('Descripción')]],
        'instalaciones' => ['title' => 'Instalaciones', 'fields' => ['nombre' => $texto('Nombre', 60), 'tipo' => gCampo('Tipo', 'select', ['required' => true, 'options' => ['M' => 'Maderas', 'B' => 'Botas']])]],
        'ubicaciones' => ['title' => 'Ubicaciones', 'fields' => ['descripcion' => $texto('Descripción', 60), 'instalacion_id' => $ref('Instalación', 'instalaciones', true), 'orden' => $integer('Orden')]],
        'dias_festivos' => ['title' => 'Días festivos', 'fields' => ['fecha' => gCampo('Fecha', 'date', ['required' => true])]],
        'puestos_trabajo' => ['title' => 'Puestos de trabajo', 'soft' => 'deleted', 'fields' => ['nombre' => $texto('Nombre', 50), 'orden' => $integer('Orden'), 'listado' => $bool('Incluir en listados'), 'fabricacion' => $bool('Fabricación'), 'activo' => $bool('Activo', 1)]],
        'roles' => ['title' => 'Roles', 'fields' => ['nombre' => $texto('Nombre', 20)]],
        'usuarios' => ['title' => 'Usuarios', 'soft' => 'is_deleted', 'fields' => ['alias' => $texto('Alias', 64), 'nombre' => gCampo('Nombre', 'text', ['max' => 128]), 'codigo' => gCampo('Código', 'text', ['max' => 2]), 'rol_id' => $ref('Rol', 'roles', true), 'empleado' => $bool('Empleado', 1), 'activo' => $bool('Activo', 1), 'clave' => gCampo('Contraseña', 'password', ['max' => 72, 'createRequired' => true])]],
        'tipos_producto' => ['title' => 'Tipos de producto', 'soft' => 'is_deleted', 'fields' => ['tipo' => gCampo('Tipo', 'select', ['required' => true, 'options' => ['FONDO' => 'Fondo', 'VASO' => 'Vaso', 'BOTA' => 'Bota', 'FLEJE' => 'Fleje', 'DUELA' => 'Duela']]), 'codigo' => $texto('Código', 60), 'descripcion' => $texto('Descripción', 150)]],
        'archivos_subidos' => ['title' => 'Archivos subidos', 'soft' => 'is_deleted', 'upload' => true, 'fields' => ['titulo' => $texto('Título', 150), 'nombre_original' => gCampo('Archivo original', 'text', ['readonly' => true]), 'extension' => gCampo('Extensión', 'text', ['readonly' => true]), 'entidad' => gCampo('Entidad', 'text', ['max' => 80, 'default' => 'gestion', 'required' => true]), 'entidad_id' => $integer('ID de entidad')]],
        'pedidos' => ['title' => 'Pedidos', 'soft' => 'is_deleted', 'fields' => [
            'numero' => $texto('Número', 50), 'destino' => gCampo('Destino', 'select', ['required' => true, 'options' => ['C' => 'Cliente', 'E' => 'Envinado'], 'default' => 'C']),
            'cliente_id' => $ref('Cliente', 'clientes'), 'descripcion' => $texto('Descripción', 120), 'tipo_producto_id' => $ref('Tipo de producto', 'tipos_producto', true), 'material_id' => $ref('Material', 'materiales'), 'tostado_id' => $ref('Tostado', 'tostados', true),
            'cantidad' => $integer('Cantidad'), 'cantidad_fabricada' => $integer('Cantidad fabricada'), 'fecha' => gCampo('Fecha', 'date'), 'fecha_finalizacion' => gCampo('Finalización', 'date'), 'estado' => $ref('Estado', 'estados_pedidos', true),
        ]],
        'fabricacion_semanal' => ['title' => 'Fabricación semanal', 'soft' => 'is_deleted', 'fields' => [
            'pedido_id' => $ref('Pedido', 'pedidos', true), 'fecha_inicio' => gCampo('Inicio de semana (lunes)', 'date', ['required' => true, 'weekStart' => 1]),
            'tipo_producto_id' => $ref('Tipo de producto', 'tipos_producto') + ['readonly' => true], 'material_id' => $ref('Material', 'materiales') + ['readonly' => true], 'tostado_id' => $ref('Tostado', 'tostados') + ['readonly' => true],
            'cantidad' => $integer('Cantidad'), 'cantidad_fabricada' => $integer('Cantidad fabricada'), 'estado' => $ref('Estado', 'estados_fabricacion_semanal', true),
        ]],
    ];
    foreach (['planificacion' => 'Planificación', 'recepcion' => 'Recepción', 'ubicacion' => 'Ubicación', 'fabricacion' => 'Fabricación', 'expedicion' => 'Expedición', 'trazabilidad' => 'Trazabilidad', 'administrador' => 'Administrador'] as $key => $title) $c['roles']['fields'][$key] = $bool($title);
    foreach (['pedidos' => 'pedidos', 'fabricacion_semanal' => 'fabricación semanal', 'productos' => 'productos', 'flejes' => 'flejes', 'trazabilidad_fabricacion' => 'trazabilidad de fabricación', 'palets' => 'palets'] as $key => $title) $c['estados_' . $key] = ['title' => 'Estados de ' . $title, 'fields' => ['descripcion' => $texto('Descripción')]];
    // Este catálogo histórico usa ID 0 y no dispone de AUTO_INCREMENT.
    $c['estados_flejes']['manualId'] = true;
    $c['estados_flejes']['zeroId'] = true;
    return $c + gCatalogosOperaciones();
}
