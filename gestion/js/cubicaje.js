'use strict';

const GestionCubicaje = {
    open() { return GestionOperaciones.open('cubicaje', 'Cubicaje estándar', { icon: 'rulers', refs: ['tipo_producto_id'] }); },
};
