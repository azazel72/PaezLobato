'use strict';

const GestionPedidos = {
    open() {
        return GestionUI.open('pedidos', 'Pedidos', {
            icon: 'clipboard-check',
            setup(entry) {
                GestionOperaciones.filters(entry, { refs: ['cliente_id', 'estado', 'destino'], date: 'fecha' });
                const filter = entry.extraFilter;
                entry.extraFilter = row => filter({ ...row, destino: ({ CLIENTE: 'C', ENVINADO: 'E' }[row.destino] ?? row.destino) });
            },
            loaded(entry) { GestionOperaciones.refreshFilters(entry); },
        });
    },
};
