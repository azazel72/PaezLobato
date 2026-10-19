'use strict';

const GestionTrazabilidadFabricacion = {
    open() { return GestionOperaciones.open('trazabilidad_fabricacion', 'Trazabilidad de fabricación', { icon: 'diagram-3', refs: ['fabricacion_semanal_id', 'palet_id', 'estado'] }); },
};
