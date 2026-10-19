'use strict';

const GestionAnaliticas = {
    open() { return GestionOperaciones.open('analiticas', 'Analíticas de vino', { icon: 'clipboard2-pulse', refs: ['estado'], date: 'fecha', defaults: () => ({ fecha: GestionUI.today() }), rowActions(entry, row, group) { group.append(GestionUI.button('paperclip', 'Archivos de la analítica', () => GestionArchivosEntidad.open('analiticas', row.id, row.descripcion))); } }); },
};
