'use strict';

const GestionConsumos = {
    open() { return GestionOperaciones.open('consumos', 'Consumos', { icon: 'bezier2', refs: ['bota_id', 'consumible_id'] }); },
};
