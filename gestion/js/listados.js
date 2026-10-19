'use strict';

const GestionListados = {
    titles: { inventario_flejes: 'Inventario de flejes', inventario_maderas: 'Inventario de maderas', asistencias_mensuales: 'Asistencias mensuales' },
    async open(resource) {
        const entry = GestionUI.shell(resource, this.titles[resource], 'bar-chart'); if (!entry) return;
        entry.content.classList.add('report-window');
        entry.hint('Listado de consulta'); const options = entry.content.querySelector('.data-options');
        entry.groupFields = resource === 'asistencias_mensuales' ? [] : ['tipo_producto'];
        let periodo, zeros;
        if (resource === 'asistencias_mensuales') {
            const label = document.createElement('label'); label.textContent = 'Mes'; periodo = document.createElement('input'); periodo.type = 'month'; periodo.value = GestionUI.today().slice(0, 7); label.append(periodo); options.append(label);
        } else {
            const label = document.createElement('label'); label.className = 'inline-check'; zeros = document.createElement('input'); zeros.type = 'checkbox'; label.append(zeros, document.createTextNode('Ocultar restante 0')); options.append(label);
            const groupBox = document.createElement('fieldset'); groupBox.className = 'report-group-options';
            const legend = document.createElement('legend'); legend.textContent = 'Agrupar por'; groupBox.append(legend);
            const groups = resource === 'inventario_maderas' ? [['tipo_producto', 'Tipo de duela'], ['material', 'Madera'], ['instalacion', 'Instalación']] : [['tipo_producto', 'Tipo de producto']];
            for (const [value, text] of groups) {
                const groupLabel = document.createElement('label'); const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.value = value; checkbox.checked = entry.groupFields.includes(value);
                groupLabel.append(checkbox, document.createTextNode(text)); groupBox.append(groupLabel);
                checkbox.addEventListener('change', () => {
                    entry.groupFields = [...groupBox.querySelectorAll('input:checked')].map(input => input.value);
                    if (entry.table) entry.table.setGroupBy(row => this.groupKey(entry, row));
                });
            }
            options.append(groupBox);
        }
        const refresh = GestionUI.button('arrow-clockwise', 'Actualizar listado', () => entry.reload()); entry.actions.append(refresh);
        entry.reload = async () => {
            if (entry.loading) return; entry.loading = true; refresh.disabled = true; entry.status('Cargando…');
            try {
                if (periodo && !periodo.value) throw new Error('Selecciona un mes.');
                const result = await GestionUI.request(resource, null, periodo ? { periodo: periodo.value } : {});
                if (windows.get(resource) !== entry) return;
                const columns = this.columns(resource, result);
                const tableColumns = columns.map(({ reportNumber, ...column }) => column);
                entry.reportColumns = columns;
                entry.legend = periodo ? this.attendanceLegend(result) : '';
                if (!entry.table) {
                    GestionUI.table(entry, tableColumns, {
                        printAsHtml: true,
                        groupBy: row => this.groupKey(entry, row), groupStartOpen: true, groupToggleElement: 'header',
                        groupHeader: (value, count, data, group) => this.groupHeader(entry, value, data, group),
                        groupHeaderPrint: (value, count, data) => this.groupText(entry, value, data),
                    }); await entry.ready;
                    entry.actions.append(GestionUI.button('arrows-collapse', 'Replegar todos los grupos', () => this.setAllGroups(entry, false)));
                    entry.actions.append(GestionUI.button('arrows-expand', 'Desplegar todos los grupos', () => this.setAllGroups(entry, true)));
                    GestionUI.filters(entry); GestionListadosExportar.attach(entry, resource, this.titles[resource]);
                    entry.table.on('columnResized', () => this.alignGroups(entry));
                    entry.table.on('renderComplete', () => this.alignGroups(entry));
                    entry.table.on('groupVisibilityChanged', group => this.updateArrow(group));
                    if (zeros) { entry.extraFilter = row => !zeros.checked || Number(row.restante) !== 0; zeros.addEventListener('change', entry.applyFilters); }
                } else entry.table.setColumns(tableColumns);
                await entry.table.replaceData(result.rows); entry.applyFilters();
                if (periodo) entry.hint(entry.legend);
                entry.status('Datos actualizados'); GestionUI.stamp(entry.content);
            } catch (error) { entry.status('Error de carga'); notify(error.message, true); }
            finally { entry.loading = false; refresh.disabled = false; }
        };
        periodo?.addEventListener('change', () => entry.reload()); await entry.reload();
    },
    groupKey(entry, row) { return entry.groupFields.length ? entry.groupFields.map(field => String(row[field] ?? '').trim() || 'Sin especificar').join(' | ') : 'Total'; },
    totals(columns, rows) {
        const sums = {};
        for (const column of columns) if (column.reportNumber) sums[column.field] = rows.reduce((sum, row) => sum + (Number(row[column.field]) || 0), 0);
        return sums;
    },
    attendanceLegend(result) {
        const [year, month] = result.inicio.split('-');
        const name = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'][Number(month) - 1];
        const date = value => value.split('-').reverse().join('/');
        return `${name} ${year} · ${date(result.inicio)} a ${date(result.fin)} · Laborables: ${result.laborables}`;
    },
    groupText(entry, title, rows) {
        const sums = this.totals(entry.reportColumns, rows);
        const text = [title, ...entry.reportColumns.filter(c => c.reportNumber).map(c => `${c.title}: ${numberFormat.format(sums[c.field])}`)].join(' · ');
        return GestionUI.text(text).innerHTML;
    },
    groupHeader(entry, title, rows, group) {
        const line = document.createElement('div'); line.className = 'report-group-line';
        const columns = entry.reportColumns; const leading = columns.findIndex(c => c.reportNumber);
        const label = document.createElement('div'); label.className = 'report-group-title'; label.style.gridColumn = `1 / span ${Math.max(1, leading)}`;
        label.title = title;
        const arrow = document.createElement('i'); arrow.className = `bi bi-chevron-${group?.isVisible() === false ? 'right' : 'down'} report-group-arrow`; arrow.setAttribute('aria-hidden', 'true');
        label.append(arrow, document.createTextNode(title)); line.append(label);
        const sums = this.totals(columns, rows);
        columns.forEach((column, index) => {
            if (!column.reportNumber) return;
            const cell = document.createElement('div'); cell.className = 'report-group-number'; cell.style.gridColumn = String(index + 1); cell.textContent = numberFormat.format(sums[column.field]); cell.title = `${column.title}: ${cell.textContent}`; line.append(cell);
        });
        return line;
    },
    alignGroups(entry) {
        const widths = entry.table.getColumns().map(column => column.getWidth());
        for (const line of entry.content.querySelectorAll('.report-group-line')) { line.style.gridTemplateColumns = widths.map(width => `${width}px`).join(' '); line.style.width = `${widths.reduce((a, b) => a + b, 0)}px`; }
    },
    updateArrow(group) { const arrow = group.getElement()?.querySelector?.('.report-group-arrow'); if (arrow) arrow.className = `bi bi-chevron-${group.isVisible() ? 'down' : 'right'} report-group-arrow`; },
    setAllGroups(entry, visible) {
        if (!entry.table || entry.loading || entry.pending) return;
        const table = entry.table;
        table.blockRedraw();
        try {
            table.setGroupStartOpen(visible);
            const paths = [];
            const collect = (groups, parent = []) => {
                for (const group of groups) {
                    const path = [...parent, group.getKey()]; paths.push(path);
                    collect(group.getSubGroups(), path);
                }
            };
            collect(table.getGroups());
            // hide/show reconstruye los grupos. Resuelve cada ruta contra la
            // tabla actual en lugar de seguir usando componentes ya sustituidos.
            for (const path of paths) {
                let groups = table.getGroups(); let current;
                for (const key of path) { current = groups.find(group => group.getKey() === key); if (!current) break; groups = current.getSubGroups(); }
                if (current && current.isVisible() !== visible) visible ? current.show() : current.hide();
            }
        } finally { table.restoreRedraw(); }
        const arrows = groups => { for (const group of groups) { this.updateArrow(group); arrows(group.getSubGroups()); } };
        arrows(table.getGroups()); this.alignGroups(entry);
    },
    columns(resource, result) {
        const text = (title, field) => ({ title, field, minWidth: 130 });
        const number = (title, field) => ({ title, field, reportNumber: true, hozAlign: 'right', sorter: 'number', minWidth: 110, formatter: cell => GestionUI.text(numberFormat.format(Number(cell.getValue() || 0))) });
        if (resource === 'inventario_flejes') return [text('Fecha', 'fecha'), text('Lote', 'lote'), text('Tipo de producto', 'tipo_producto'), number('Peso', 'peso'), number('Consumido', 'consumido'), number('Restante', 'restante')];
        if (resource === 'inventario_maderas') return [text('Tipo de duela', 'tipo_producto'), text('Madera', 'material'), text('Ubicación', 'ubicacion'), text('Instalación', 'instalacion'), number('Palets', 'palets'), number('Cubicaje', 'cubicaje'), number('Consumido', 'consumido'), number('Restante', 'restante')];
        return [text('Código', 'codigo'), text('Empleado', 'nombre'), number('Asistencia', 'asistencia'), ...(result.puestos || []).map(p => ({ ...number(p.nombre, `puesto_${p.id}`), titleFormatter: () => GestionUI.text(p.nombre) })), number('Total', 'total')];
    },
};
