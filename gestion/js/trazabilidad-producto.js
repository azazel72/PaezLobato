'use strict';
const GestionTrazabilidadProducto = {
    async open(productoId) {
        const entry = await GestionOperaciones.open('trazabilidad_producto', 'Trazabilidad de producto', {
            icon: 'link-45deg', refs: ['producto_id', 'trazabilidad_fabricacion_id'],
            defaults: () => ({ producto_id: windows.get('trazabilidad_producto')?.operationFilters?.find(f => f.field === 'producto_id')?.input.value || productoId || '' }),
        });
        if (productoId) await GestionOperaciones.filter(entry, 'producto_id', productoId);
        return entry;
    },
};
