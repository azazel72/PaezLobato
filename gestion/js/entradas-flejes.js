'use strict';

const GestionEntradasFlejes = {
    open() { return GestionOperaciones.open('entradas_flejes', 'Entradas de flejes', { icon: 'bounding-box-circles', refs: ['tipo_producto_id', 'estado'], date: 'fecha', defaults: () => ({ fecha: GestionUI.today() }) }); },
};
