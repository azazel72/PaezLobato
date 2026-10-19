'use strict';

const GestionEntradasPlanificadas = {
    async open(provider, selectedYear) {
        const existing = windows.get('entradas_planificadas');
        if (existing) { focusWindow('entradas_planificadas'); existing.setContext(provider, selectedYear); return; }
        try {
            const parent = await GestionPaneles.create('entradas_planificadas', 'Entradas del proveedor y año', 'list-check', 'entradas-planificadas.html'); if (!parent) return;
            const year = parent.content.querySelector('[data-entry="year"]'); year.value = selectedYear || GestionUI.today().slice(0, 4);
            let selected = null, lines;
            const select = row => { selected = row; lines?.applyFilters(); parent.content.querySelector('[data-entry="selection"]').textContent = row ? `Entrada ${row.numero}` : 'Selecciona una entrada para consultar sus líneas'; };
            const headers = await GestionPaneles.rows(parent, 'entradas', '[data-entry="headers"]', {
                title: 'Entradas del proveedor', defaults: () => ({ proveedor_id: headers.operationFilters[0].input.value, fecha: `${year.value}-01-01` }),
                setup(entry) {
                    GestionOperaciones.filters(entry, { refs: ['proveedor_id', 'entregado', 'anulado'] });
                    const base = entry.extraFilter; entry.extraFilter = row => base(row) && String(row.fecha || '').slice(0, 4) === year.value;
                    entry.table.on('rowClick', (event, row) => { if (!event.target.closest('button')) select(row.getData()); });
                },
                loaded(entry) { GestionOperaciones.refreshFilters(entry); if (selected) select(entry.table.getData().find(row => String(row.id) === String(selected.id)) || null); },
                rowActions(entry, row, group) { group.append(GestionUI.button('list-check', 'Ver líneas', () => select(row)), GestionUI.button('paperclip', 'Ver archivos', () => GestionArchivosEntidad.open('entradas', row.id, row.numero))); },
            });
            lines = await GestionPaneles.rows(parent, 'lineas_entrada', '[data-entry="lines"]', {
                title: 'Líneas de la entrada', defaults: () => ({ entrada_id: selected?.id ?? '' }),
                setup(entry) { entry.extraFilter = row => !!selected && String(row.entrada_id) === String(selected.id); },
                rowActions(entry, row, group) { group.append(GestionUI.button('paperclip', 'Ver archivos', () => GestionArchivosEntidad.open('lineas_entrada', row.id, `Línea ${row.id}`))); },
            });
            parent.setContext = (providerId, value) => { if (value) year.value = value; if (providerId) GestionOperaciones.filter(headers, 'proveedor_id', providerId); select(null); headers.applyFilters(); };
            year.addEventListener('change', () => { if (year.reportValidity()) parent.setContext(null, year.value); });
            parent.reload = async () => { if (!parent.pending) { await headers.reload(); await lines.reload(); } };
            parent.setContext(provider, selectedYear);
        } catch (error) { notify(error.message, true); }
    },
};
