'use strict';

const GestionPlanificacionPedidos = {
    async open() {
        try {
            const parent = await GestionPaneles.create('planificacion_pedidos', 'Planificación de pedidos', 'diagram-3', 'planificacion-pedidos.html'); if (!parent) return;
            let selected = null, weeks;
            const select = row => {
                selected = row;
                parent.content.querySelector('[data-order="selection"]').textContent = row ? `${row.numero} · ${row.descripcion}` : 'Selecciona un pedido para consultar o planificar su fabricación';
                weeks?.applyFilters();
            };
            const orders = await GestionPaneles.rows(parent, 'pedidos', '[data-order="orders"]', {
                title: 'Pedidos',
                setup(entry) {
                    GestionOperaciones.filters(entry, { refs: ['cliente_id', 'estado', 'destino'], date: 'fecha' });
                    entry.table.on('rowClick', (event, row) => { if (!event.target.closest('button')) select(row.getData()); });
                },
                loaded(entry) { GestionOperaciones.refreshFilters(entry); if (selected) select(entry.table.getData().find(row => String(row.id) === String(selected.id)) || null); },
                rowActions(entry, row, group) { group.append(GestionUI.button('diagram-3', 'Seleccionar pedido y planificar', () => select(row))); },
            });
            weeks = await GestionPaneles.rows(parent, 'fabricacion_semanal', '[data-order="weeks"]', {
                title: 'Fabricación del pedido', defaults: () => ({ pedido_id: selected?.id ?? '' }),
                setup(entry) { entry.extraFilter = row => !!selected && String(row.pedido_id) === String(selected.id); },
                form(form, controls, row) { if (!row && !selected) { form.querySelector('[role="status"]').textContent = 'Selecciona un pedido en la tabla superior o en el formulario.'; } },
            });
            parent.reload = async () => { if (!parent.pending) { await orders.reload(); await weeks.reload(); } };
        } catch (error) { notify(error.message, true); }
    },
};
