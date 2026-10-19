'use strict';

const GestionListadosExportar = {
    attach(entry, filename, title) {
        entry.exportTitle = title;
        for (const [format, icon, label] of [['xls', 'file-earmark-excel', 'Exportar Excel (.xls)'], ['csv', 'filetype-csv', 'Exportar CSV'], ['pdf', 'filetype-pdf', 'Exportar PDF']]) {
            entry.actions.append(GestionUI.button(icon, label, () => {
                try { this.export(entry, filename, format); } catch (error) { notify(error.message, true); }
            }));
        }
        entry.actions.append(GestionUI.button('printer', 'Imprimir listado', () => {
            const html = this.html(entry);
            const frame = document.createElement('iframe'); frame.hidden = true; frame.title = entry.exportTitle;
            frame.onload = () => { frame.contentWindow.addEventListener('afterprint', () => frame.remove(), { once: true }); frame.contentWindow.focus(); frame.contentWindow.print(); };
            frame.srcdoc = html; entry.content.append(frame);
        }));
    },
    tableSnapshot(entry) {
        const components = entry.table.getColumns().filter(column => {
            const definition = column.getDefinition();
            return definition.field && definition.field !== '_acciones' && definition.visible !== false && (!column.isVisible || column.isVisible());
        });
        const columns = components.map(column => {
            const definition = column.getDefinition();
            const field = entry.config?.fields?.[definition.field];
            return { title: definition.titleDownload || definition.title, field: definition.field, reportNumber: definition.sorter === 'number' || field?.type === 'number' };
        });
        const rows = entry.table.getData('active').map(row => ({ summary: false, values: columns.map(column => {
            const raw = row[column.field];
            const value = entry.label ? entry.label(column.field, raw) : raw;
            if (column.reportNumber && value !== '' && value != null && Number.isFinite(Number(value))) return Number(value);
            return value ?? '';
        }) }));
        return { columns, leading: 1, rows, title: entry.title || entry.config?.title || 'Listado', legend: '' };
    },
    attachTable(entry, filename) {
        for (const [format, icon, label] of [['xls', 'file-earmark-excel', 'Exportar Excel (.xls)'], ['pdf', 'filetype-pdf', 'Exportar PDF']]) {
            entry.actions.append(GestionUI.button(icon, label, () => {
                try { this.exportSnapshot(this.tableSnapshot(entry), filename, format); } catch (error) { notify(error.message, true); }
            }));
        }
    },
    snapshot(entry) {
        const columns = entry.reportColumns;
        const leading = Math.max(1, columns.findIndex(column => column.reportNumber));
        const groups = new Map();
        for (const row of entry.table.getData('active')) {
            const key = GestionListados.groupKey(entry, row);
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(row);
        }
        const rows = [];
        for (const [title, items] of groups) {
            const sums = GestionListados.totals(columns, items);
            rows.push({ summary: true, values: columns.map((column, index) => index === 0 ? title : column.reportNumber ? sums[column.field] : '') });
            for (const item of items) rows.push({ summary: false, values: columns.map(column => column.reportNumber ? Number(item[column.field]) || 0 : item[column.field] ?? '') });
        }
        return { columns, leading, rows, title: entry.exportTitle, legend: entry.legend || '' };
    },
    escapeHTML(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); },
    display(snapshot, values) { return values.map((value, index) => value === '' || value == null ? '' : snapshot.columns[index].reportNumber ? numberFormat.format(Number(value) || 0) : String(value)); },
    export(entry, filename, format) {
        const snapshot = this.snapshot(entry);
        return this.exportSnapshot(snapshot, filename, format);
    },
    exportSnapshot(snapshot, filename, format) {
        if (format === 'xlsx' || format === 'xls') {
            if (!globalThis.XLSX) throw new Error('No se ha cargado la librería de Excel. Recarga la página.');
            const top = [[snapshot.title], ...(snapshot.legend ? [[snapshot.legend]] : []), [], snapshot.columns.map(c => c.title)];
            const sheet = XLSX.utils.aoa_to_sheet([...top, ...snapshot.rows.map(row => row.values)]);
            sheet['!merges'] = snapshot.rows.flatMap((row, index) => row.summary && snapshot.leading > 1 ? [{ s: { r: top.length + index, c: 0 }, e: { r: top.length + index, c: snapshot.leading - 1 } }] : []);
            sheet['!cols'] = snapshot.columns.map(c => ({ wch: c.reportNumber ? 17 : 27 }));
            for (let r = top.length; r < top.length + snapshot.rows.length; r++) snapshot.columns.forEach((column, c) => {
                const cell = sheet[XLSX.utils.encode_cell({ r, c })]; if (cell && column.reportNumber) cell.z = '#,##0.####';
            });
            const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, sheet, 'Listado');
            XLSX.writeFile(book, `${filename}.${format}`, { bookType: format === 'xls' ? 'biff8' : 'xlsx' }); return;
        }
        if (format === 'csv') {
            const escape = value => '"' + (typeof value === 'number' ? String(value) : String(value ?? '').replace(/^[=+@\-\t\r]/, "'$&")).replace(/"/g, '""') + '"';
            const rows = [[snapshot.title], ...(snapshot.legend ? [[snapshot.legend]] : []), snapshot.columns.map(c => c.title), ...snapshot.rows.map(row => row.values)];
            const url = URL.createObjectURL(new Blob(['\uFEFF' + rows.map(row => row.map(escape).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
            const a = document.createElement('a'); a.href = url; a.download = `${filename}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); return;
        }
        if (format === 'pdf') {
            if (!globalThis.jspdf?.jsPDF || !globalThis.jspdf.jsPDF.API.autoTable) throw new Error('No se ha cargado la librería de PDF. Recarga la página.');
            const pdf = new jspdf.jsPDF({ orientation: 'landscape', format: snapshot.columns.length > 12 ? 'a3' : 'a4' });
            pdf.setFontSize(15); pdf.text(snapshot.title, 14, 16);
            if (snapshot.legend) { pdf.setFontSize(10); pdf.text(snapshot.legend, 14, 23); }
            const body = snapshot.rows.map(row => {
                const values = this.display(snapshot, row.values);
                return row.summary ? [{ content: values[0], colSpan: snapshot.leading, styles: { fontStyle: 'bold', fillColor: [232, 239, 225] } }, ...values.slice(snapshot.leading).map(content => ({ content, styles: { fontStyle: 'bold', fillColor: [232, 239, 225], halign: 'right' } }))] : values;
            });
            pdf.autoTable({ startY: snapshot.legend ? 29 : 23, head: [snapshot.columns.map(c => c.title)], body, styles: { fontSize: 8, overflow: 'linebreak' }, headStyles: { fillColor: [36, 93, 78] }, columnStyles: Object.fromEntries(snapshot.columns.flatMap((column, i) => column.reportNumber ? [[i, { halign: 'right' }]] : [])) });
            pdf.save(`${filename}.pdf`); return;
        }
        throw new Error('Formato no disponible.');
    },
    html(entry) {
        const snapshot = this.snapshot(entry); const escape = this.escapeHTML;
        return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${escape(snapshot.title)}</title><style>@page{size:A4 landscape;margin:12mm}body{font:11px Arial;color:#233536}h1{font-size:19px}table{width:100%;border-collapse:collapse}th,td{padding:7px;border-bottom:1px solid #dce4d6;text-align:left}th,.summary{background:#e8efe1;font-weight:bold}.number{text-align:right}thead{display:table-header-group}tr{break-inside:avoid}</style></head><body><h1>${escape(snapshot.title)}</h1>${snapshot.legend ? `<p>${escape(snapshot.legend)}</p>` : ''}<table><thead><tr>${snapshot.columns.map(c => `<th>${escape(c.title)}</th>`).join('')}</tr></thead><tbody>${snapshot.rows.map(row => {
            const values = this.display(snapshot, row.values);
            return row.summary ? `<tr class="summary"><td colspan="${snapshot.leading}">${escape(values[0])}</td>${values.slice(snapshot.leading).map(value => `<td class="number">${escape(value)}</td>`).join('')}</tr>` : `<tr>${values.map((value, index) => `<td${snapshot.columns[index].reportNumber ? ' class="number"' : ''}>${escape(value)}</td>`).join('')}</tr>`;
        }).join('')}</tbody></table></body></html>`;
    },
};
