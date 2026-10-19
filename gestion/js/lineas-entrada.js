'use strict';
const GestionLineasEntrada = {
    async open(entradaId) {
        const entry = await GestionOperaciones.open('lineas_entrada', 'Líneas de entrada', {
            icon: 'list-check', refs: ['entrada_id', 'tipo_producto_id', 'material_id'],
            defaults: () => ({ entrada_id: windows.get('lineas_entrada')?.operationFilters?.find(f => f.field === 'entrada_id')?.input.value || entradaId || '' }),
            rowActions(source, row, group) { group.append(GestionUI.button('paperclip', 'Archivos de la línea', () => GestionArchivosEntidad.open('lineas_entrada', row.id, `Línea ${row.id}`))); },
        });
        if (entradaId) await GestionOperaciones.filter(entry, 'entrada_id', entradaId);
        return entry;
    },
};
