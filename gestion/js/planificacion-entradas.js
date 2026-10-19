'use strict';

const GestionPlanificacionEntradas = {
    async open() {
        try {
            const parent = await GestionPaneles.create('planificacion_entradas', 'Planificación de entradas', 'calendar3', 'planificacion-entradas.html'); if (!parent) return;
            const year = parent.content.querySelector('[data-plan="year"]'); year.value = GestionUI.today().slice(0, 4);
            const status = parent.content.querySelector('[data-plan="status"]');
            const actions = parent.content.querySelector('[data-plan="actions"]');
            actions.append(GestionUI.button('arrow-clockwise', 'Actualizar planificación', () => parent.reload()), GestionUI.button('person-plus', 'Añadir proveedores y completar planificación del año', async () => {
                if (parent.pending || !year.reportValidity()) return;
                parent.pending++; status.textContent = 'Completando planificación…';
                try {
                    const result = await GestionUI.request('planificacion_entradas', { action: 'initialize', year: year.value });
                    status.textContent = `${result.created} registros añadidos`;
                } catch (error) { status.textContent = error.message; notify(error.message, true); }
                finally { parent.pending--; await parent.reload(); }
            }));
            year.addEventListener('change', () => {
                if (!year.reportValidity()) return;
                parent.parts.forEach(part => part.applyFilters?.()); status.textContent = `Planificación de ${year.value}`;
            });
            for (const [resource, selector, title] of [['plan_camiones', 'trucks', 'Camiones'], ['plan_material', 'materials', 'Materiales'], ['plan_facturacion', 'billing', 'Facturación']]) {
                await GestionPaneles.rows(parent, resource, `[data-plan="${selector}"]`, {
                    title, defaults: () => ({ año: year.value }),
                    setup(entry) { entry.extraFilter = row => String(row.año) === year.value; },
                    columns(columns, entry) {
                        const numeric = columns.map(column => ({ ...column, ...(entry.config.fields[column.field]?.type === 'number' ? { bottomCalc: 'sum' } : {}), ...(column.field === 'año' ? { visible: false, bottomCalc: false } : {}) }));
                        if (resource !== 'plan_camiones') return numeric;
                        const byField = Object.fromEntries(numeric.filter(column => column.field).map(column => [column.field, column]));
                        const months = [['ene', 'Enero'], ['feb', 'Febrero'], ['mar', 'Marzo'], ['abr', 'Abril'], ['may', 'Mayo'], ['jun', 'Junio'], ['jul', 'Julio'], ['ago', 'Agosto'], ['sep', 'Septiembre'], ['oct', 'Octubre'], ['nov', 'Noviembre'], ['dic', 'Diciembre']];
                        return ['id', 'año', 'proveedor_id', 'total_pactados', 'total_descontar', 'total_previstos', 'total_entregados'].map(field => byField[field]).concat(months.map(([key, title]) => ({ title, columns: ['previsto', 'confirmado'].map(kind => ({ ...byField[`${key}_${kind}`], titleDownload: byField[`${key}_${kind}`].title, title: kind === 'previsto' ? 'Previsto' : 'Confirmado', minWidth: 100 })) })), numeric.at(-1));
                    },
                    rowActions: resource === 'plan_camiones' ? (entry, row, group) => group.append(GestionUI.button('list-check', 'Ver entradas del proveedor y año', () => GestionEntradasPlanificadas.open(row.proveedor_id, row.año))) : undefined,
                    loaded(entry) { GestionPlanificacionEntradas.mark(entry); },
                });
            }
            parent.reload = async () => { if (parent.pending) return; for (const part of parent.parts) await part.reload(); };
            status.textContent = `Planificación de ${year.value}`;
        } catch (error) { notify(error.message, true); }
    },
    mark(entry) {
        if (entry.planMarked) return;
        entry.planMarked = true;
        entry.table.on('renderComplete', () => {
            if (!entry.config.fields.total_previstos) return;
            for (const row of entry.table.getRows()) {
                const data = row.getData();
                const planned = Object.keys(data).filter(key => key.endsWith('_previsto')).reduce((sum, key) => sum + Number(data[key] || 0), 0);
                const cell = row.getCell('total_previstos');
                if (cell && entry.config.fields.ene_previsto) { cell.getElement().classList.toggle('operation-mismatch', Number(data.total_previstos) !== planned); cell.getElement().title = 'Pactados menos descuentos; se resalta si no coincide con lo previsto en los meses'; }
            }
        });
    },
};
