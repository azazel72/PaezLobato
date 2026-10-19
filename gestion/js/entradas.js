'use strict';

const GestionEntradas = {
    open() { return GestionOperaciones.open('entradas', 'Entradas', { icon: 'bag-check', refs: ['proveedor_id', 'entregado', 'anulado'], date: 'fecha', defaults: () => ({ fecha: GestionUI.today() }), rowActions(entry, row, group) { group.append(GestionUI.button('list-check', 'Ver líneas de esta entrada', () => GestionLineasEntrada.open(row.id)), GestionUI.button('paperclip', 'Archivos de la entrada', () => GestionArchivosEntidad.open('entradas', row.id, row.numero))); } }); },
};
