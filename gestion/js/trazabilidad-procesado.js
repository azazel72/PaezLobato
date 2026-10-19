'use strict';

const GestionTrazabilidadProcesado = {
    open() { return GestionOperaciones.open('trazabilidad_procesado', 'Trazabilidad de procesado', { icon: 'arrow-left-right', refs: ['palet_origen_id', 'palet_destino_id'] }); },
};
