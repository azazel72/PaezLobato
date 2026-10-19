'use strict';

const GestionProductos = {
    open() { return GestionOperaciones.open('productos', 'Productos', { icon: 'tags', refs: ['tipo', 'tipo_producto_id', 'estado', 'ubicacion_id'], rowActions(entry, row, group) { group.append(GestionUI.button('link-45deg', 'Ver trazabilidad de este producto', () => GestionTrazabilidadProducto.open(row.id))); } }); },
};
