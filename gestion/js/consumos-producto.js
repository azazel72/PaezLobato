'use strict';

const GestionConsumosProducto = {
    open() {
        return GestionOperaciones.open('a_consumos', 'Consumos por producto', {
            icon: 'clipboard-data', refs: ['tipo_producto_id'],
        });
    },
};
