'use strict';

const GestionUI = {
    async request(resource, data, params = {}) {
        const query = new URLSearchParams({ resource, ...params });
        const response = await fetch(`api/router.php?${query}`, {
            credentials: 'same-origin', cache: 'no-store', method: data ? 'POST' : 'GET',
            ...(data ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) } : {}),
        });
        let result;
        try { result = await response.json(); } catch { throw new Error('El servidor no devolvió una respuesta válida.'); }
        if (!response.ok || !result.ok) throw new Error(result.error || 'No se pudo completar la operación.');
        return result;
    },
    button(icon, label, action, className = '') {
        const button = document.createElement('button'); button.type = 'button'; button.className = `icon-button ${className}`;
        button.title = label; button.setAttribute('aria-label', label); button.innerHTML = `<i class="bi bi-${icon}"></i>`;
        if (action) button.addEventListener('click', action);
        return button;
    },
    text(value) { const el = document.createElement('span'); el.textContent = value ?? ''; return el; },
    today() { return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); },
    stamp(content) {
        const now = new Date(); const label = content.querySelector('.last-updated');
        label.textContent = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(now);
        label.title = `Última carga correcta: ${new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', dateStyle: 'full', timeStyle: 'long' }).format(now)}`;
    },
    shell(key, title, icon = 'table') {
        if (windows.has(key)) { focusWindow(key); return null; }
        const content = document.createElement('div'); content.className = 'window-content data-window';
        content.innerHTML = '<div class="window-toolbar data-toolbar"><input class="search-input" type="search" placeholder="Buscar en el listado…" aria-label="Buscar en el listado"><div class="data-actions"></div></div><div class="data-options"></div><div class="table-host filters-hidden"></div><div class="window-footer"><span class="row-count">Cargando…</span><span class="table-hint"></span><span class="footer-status"><span class="save-state" role="status"></span><span class="last-updated"></span></span></div>';
        const entry = createWindow(key, title, icon, content); if (!entry) return null;
        entry.content = content; entry.editing = false; entry.loading = false;
        entry.status = text => { content.querySelector('.save-state').textContent = text; };
        entry.hint = text => { content.querySelector('.table-hint').textContent = text; };
        entry.actions = content.querySelector('.data-actions');
        return entry;
    },
    filters(entry) {
        const button = this.button('funnel', 'Mostrar filtros por columna', () => {
            const host = entry.content.querySelector('.table-host'); const visible = host.classList.contains('filters-hidden');
            if (!visible) entry.table.clearHeaderFilter();
            host.classList.toggle('filters-hidden', !visible);
            button.setAttribute('aria-pressed', String(visible));
            button.title = visible ? 'Ocultar y limpiar filtros por columna' : 'Mostrar filtros por columna'; button.setAttribute('aria-label', button.title);
            button.innerHTML = `<i class="bi bi-funnel${visible ? '-fill' : ''}"></i>`; entry.table.redraw(true);
        }); button.setAttribute('aria-pressed', 'false'); entry.actions.append(button);
    },
    lock(entry) {
        entry.hint('Edición en tabla bloqueada');
        const button = this.button('lock-fill', 'Desbloquear edición', () => {
            if (entry.pending || entry.loading) { notify('Espera a que termine la operación.'); return; }
            for (const row of entry.table.getRows()) for (const cell of row.getCells()) {
                if (cell.getElement().classList.contains('tabulator-editing')) cell.cancelEdit();
            }
            entry.editing = !entry.editing; button.setAttribute('aria-pressed', String(entry.editing));
            button.title = entry.editing ? 'Bloquear edición' : 'Desbloquear edición'; button.setAttribute('aria-label', button.title);
            button.innerHTML = `<i class="bi bi-${entry.editing ? 'unlock' : 'lock-fill'}"></i>`;
            entry.hint(entry.editing ? (entry.config ? 'Edición en tabla habilitada · Enter guarda, Esc cancela' : 'Edición habilitada · Pulsa un puesto para asignar empleados') : 'Edición en tabla bloqueada'); entry.table.redraw(true);
        }, 'master-lock'); button.setAttribute('aria-pressed', 'false'); entry.actions.append(button);
    },
    table(entry, columns, options = {}) {
        entry.tableReady = false;
        const table = new Tabulator(entry.content.querySelector('.table-host'), {
            height: '100%', layout: 'fitColumns', editTriggerEvent: 'click', index: 'id', placeholder: 'No hay registros.',
            columnDefaults: { formatter: 'plaintext', resizable: true, minWidth: 100, headerFilter: 'input', headerFilterPlaceholder: 'Filtrar…' },
            columns, ...options,
        }); entry.table = table;
        table.on('dataFiltered', (_, rows) => { entry.content.querySelector('.row-count').textContent = `${rows.length} registros`; });
        entry.applyFilters = () => {
            const normalize = v => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
            const text = normalize(entry.content.querySelector('.search-input').value.trim());
            table.setFilter(row => (!entry.extraFilter || entry.extraFilter(row)) && (!text || table.getColumns().some(column => {
                const col = column.getDefinition();
                return col.field && normalize(entry.label ? entry.label(col.field, row[col.field]) : row[col.field]).includes(text);
            })));
        };
        entry.content.querySelector('.search-input').addEventListener('input', entry.applyFilters);
        entry.observer = new ResizeObserver(() => { if (entry.tableReady && table.element?.isConnected && (entry.isCurrent ? entry.isCurrent() : windows.get(entry.panel.id.replace('window-', '')) === entry) && entry.panel.status !== 'minimized') table.redraw(); });
        entry.observer.observe(entry.content.querySelector('.table-host'));
        entry.ready = new Promise(resolve => table.on('tableBuilt', () => { entry.tableReady = true; resolve(); })); return table;
    },
    label(entry, key, value) {
        const field = entry.config.fields[key]; if (!field) return value;
        if (field.ref) return entry.lookups[field.ref]?.find(item => String(item.value) === String(value))?.label ?? value ?? '';
        if (field.options) return field.options[value] ?? value ?? '';
        if (field.type === 'checkbox') return Number(value) ? 'Sí' : 'No';
        return value ?? '';
    },
    choices(entry, field) {
        if (field.type === 'checkbox') return [{ value: 0, label: 'No' }, { value: 1, label: 'Sí' }];
        const choices = field.ref ? entry.lookups[field.ref] || [] : Object.entries(field.options || {}).map(([value, label]) => ({ value, label }));
        return field.refTypes ? choices.filter(choice => field.refTypes.includes(choice.data?.tipo)) : choices;
    },
    current(resource, entry) { return entry.isCurrent ? entry.isCurrent() : windows.get(resource) === entry; },
    cellEditor(entry, key, field, cell, onRendered, success, cancel) {
        const select = field.type === 'select' || field.type === 'checkbox';
        const input = document.createElement(select ? 'select' : 'input');
        input.className = 'data-cell-editor'; input.setAttribute('aria-label', field.label);
        let value = cell.getValue() ?? '';
        if (key === 'destino') value = { CLIENTE: 'C', ENVINADO: 'E' }[value] ?? value;
        if (select) {
            const choices = field.type === 'checkbox' ? [{ value: 0, label: 'No' }, { value: 1, label: 'Sí' }] : this.choices(entry, field);
            if (!field.required && field.type !== 'checkbox') { const blank = document.createElement('option'); blank.value = ''; blank.textContent = 'Sin seleccionar'; input.append(blank); }
            for (const choice of choices) { const option = document.createElement('option'); option.value = choice.value; option.textContent = choice.label; input.append(option); }
            if (value !== '' && !choices.some(choice => String(choice.value) === String(value))) {
                const current = document.createElement('option'); current.value = value; current.textContent = entry.label(key, value); input.append(current);
            }
        } else {
            input.type = field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text';
            if (field.max) input.maxLength = field.max;
            if (field.min !== undefined) input.min = field.min;
            if (field.type === 'number') { input.step = String(field.step ?? 1); if (field.maxValue !== undefined) input.max = field.maxValue; }
            if (field.weekStart === 1) { input.min = '0001-01-01'; input.step = '7'; }
        }
        input.required = !!field.required; input.value = String(value);
        let finished = false;
        const commit = () => {
            if (finished) return;
            if (!input.checkValidity() || (field.required && !input.value.trim())) { input.reportValidity(); return; }
            finished = true; success(input.value);
        };
        const abort = () => { if (!finished) { finished = true; cancel(); } };
        input.addEventListener('keydown', event => {
            if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); abort(); }
            else if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); commit(); }
        });
        if (select) input.addEventListener('change', commit);
        input.addEventListener('blur', () => { if (input.checkValidity() && (!field.required || input.value.trim())) commit(); else abort(); });
        onRendered(() => { input.focus(); if (input.type === 'text') input.select(); });
        return input;
    },
    async saveCell(resource, entry, cell) {
        if (entry.restoring?.has(cell)) return;
        const before = cell.getOldValue(); const after = cell.getValue();
        if (String(before ?? '') === String(after ?? '')) return;
        const row = cell.getRow(); const current = row.getData(); const data = {};
        for (const [key, field] of Object.entries(entry.config.fields)) if (!field.readonly && field.type !== 'password') data[key] = current[key] ?? '';
        entry.pending++; cell.getElement().classList.add('saving'); entry.status('Guardando…');
        try {
            const result = await this.request(resource, { action: 'update', id: current.id, version: current._version, data });
            await row.update(result.row); entry.applyFilters(); entry.status('Cambio guardado');
            void loadOverview();
            if (resource === 'pedidos') void windows.get('fabricacion_semanal')?.reload?.();
        } catch (error) {
            entry.restoring ??= new Set(); entry.restoring.add(cell);
            try { cell.restoreOldValue(); } finally { entry.restoring.delete(cell); }
            entry.status('Cambio no guardado'); notify(error.message, true);
        } finally { entry.pending--; cell.getElement().classList.remove('saving'); entry.table.redraw(true); }
    },
    async open(resource, title, options = {}) {
        const entry = options.entry || this.shell(resource, title, options.icon); if (!entry) return;
        entry.formDefaults = options.defaults;
        entry.label = (key, value) => this.label(entry, key, value);
        const refresh = this.button('arrow-clockwise', 'Actualizar listado', () => entry.reload()); entry.actions.append(refresh);
        entry.reload = async () => {
            if (entry.pending || entry.loading) return;
            entry.loading = true; refresh.disabled = true; entry.status('Cargando…');
            try {
                const result = await this.request(resource); if (!this.current(resource, entry)) return;
                entry.config = result.config; entry.lookups = result.lookups;
                if (!entry.table) {
                    let columns = [{ title: 'ID', field: 'id', width: 65, minWidth: 65, widthShrink: 0 }, ...Object.entries(entry.config.fields).filter(([, f]) => f.type !== 'password').map(([key, f]) => ({
                        title: f.label, field: key, minWidth: f.type === 'checkbox' ? 100 : 140, widthGrow: ['text', 'select'].includes(f.type) ? 2 : 1,
                        formatter: cell => this.text(entry.label(key, cell.getValue())),
                        headerFilterFunc: (text, value) => String(entry.label(key, value)).toLocaleLowerCase('es').includes(String(text).toLocaleLowerCase('es')),
                        ...(!f.readonly ? { editor: (cell, rendered, success, cancel) => this.cellEditor(entry, key, f, cell, rendered, success, cancel), editable: () => entry.editing && !entry.pending && !entry.loading } : {}),
                    })), { title: 'Acciones', width: options.rowActions || resource === 'archivos_subidos' || resource === 'pedidos' ? 160 : 90, minWidth: 90, widthShrink: 0, headerSort: false, headerFilter: false, frozen: true,
                        formatter: cell => {
                            const row = cell.getRow().getData(); const group = document.createElement('div'); group.className = 'row-actions';
                            const edit = this.button('pencil', 'Editar registro', () => this.form(resource, entry, row, options));
                            const remove = this.button('trash', 'Eliminar registro', () => this.remove(resource, entry, row));
                            edit.disabled = remove.disabled = !!entry.pending || entry.loading; group.append(edit, remove);
                            if (resource === 'archivos_subidos') group.append(this.button('download', 'Descargar archivo', () => { window.location.href = `api/router.php?resource=archivos&id=${encodeURIComponent(row.id)}`; }));
                            if (resource === 'pedidos') group.append(this.button('calendar-week', 'Ver fabricación de este pedido', () => GestionFabricacion.open(row.id)));
                            if (options.rowActions) options.rowActions(entry, row, group);
                            return group;
                        },
                    }];
                    if (options.columns) columns = options.columns(columns, entry);
                    this.table(entry, columns); entry.table.on('cellEdited', cell => this.saveCell(resource, entry, cell)); await entry.ready;
                    entry.actions.append(this.button('plus-lg', entry.config.upload ? 'Subir archivo' : 'Crear registro', () => this.form(resource, entry, null, options)));
                    this.filters(entry); this.lock(entry); this.exports(entry, resource);
                    if (options.setup) options.setup(entry);
                }
                await entry.table.replaceData(result.rows); entry.status('Datos actualizados'); this.stamp(entry.content);
                if (options.loaded) options.loaded(entry);
                entry.applyFilters();
            } catch (error) { entry.status('Error de carga'); notify(error.message, true); }
            finally { entry.loading = false; refresh.disabled = false; if (this.current(resource, entry)) entry.table?.redraw(true); }
        };
        await entry.reload(); return entry;
    },
    form(resource, source, row, options = {}) {
        if (source.loading || source.pending) return;
        row = row ? { ...row } : null;
        const key = `${resource}-${row ? row.id : 'crear'}`;
        if (windows.has(key)) { focusWindow(key); return; }
        const form = document.createElement('form'); form.className = 'data-form';
        const heading = document.createElement('h2'); heading.textContent = `${row ? 'Editar' : 'Crear'} · ${source.config.title}`; form.append(heading);
        const grid = document.createElement('div'); grid.className = 'data-form-grid'; form.append(grid);
        const controls = {};
        for (const [name, f] of Object.entries(source.config.fields)) {
            if (f.readonly && resource !== 'fabricacion_semanal') continue;
            const label = document.createElement('label'); label.append(document.createTextNode(f.label));
            const input = document.createElement(f.type === 'select' ? 'select' : 'input'); input.name = name;
            if (f.type === 'select') {
                const blank = document.createElement('option'); blank.value = ''; blank.textContent = 'Selecciona…'; input.append(blank);
                const choices = this.choices(source, f);
                for (const choice of choices) { const option = document.createElement('option'); option.value = choice.value; option.textContent = choice.label; input.append(option); }
                if (row?.[name] != null && !choices.some(choice => String(choice.value) === String(row[name]))) {
                    const current = document.createElement('option'); current.value = row[name]; current.textContent = source.label(name, row[name]); input.append(current);
                }
            } else input.type = f.type === 'number' ? 'number' : f.type === 'password' ? 'password' : f.type === 'checkbox' ? 'checkbox' : f.type === 'date' ? 'date' : 'text';
            const defaults = typeof source.formDefaults === 'function' ? source.formDefaults() : source.formDefaults;
            let value = row?.[name] ?? (!row ? defaults?.[name] : undefined) ?? f.default ?? '';
            if (resource === 'pedidos' && name === 'destino') value = { CLIENTE: 'C', ENVINADO: 'E' }[value] ?? value;
            if (f.type === 'checkbox') { input.checked = !!Number(value); label.className = 'check-label'; }
            else { input.value = f.type === 'password' ? '' : value; input.required = !!f.required || (!row && !!f.createRequired); }
            if (f.max) input.maxLength = f.max;
            if (f.min !== undefined) input.min = f.min;
            if (f.type === 'number') { input.step = String(f.step ?? 1); if (f.maxValue !== undefined) input.max = f.maxValue; }
            if (f.weekStart === 1) { input.min = '0001-01-01'; input.step = '7'; }
            if (f.type === 'password') { input.autocomplete = 'new-password'; if (row) input.placeholder = 'Dejar vacía para conservarla'; }
            input.disabled = !!f.readonly; controls[name] = input; label.append(input); grid.append(label);
        }
        if (!row && source.config.upload) {
            const label = document.createElement('label'); label.textContent = 'Archivo (hasta 15 MB; sujeto al límite de PHP)'; label.className = 'full-width';
            const file = document.createElement('input'); file.type = 'file'; file.name = 'archivo'; file.required = true; label.append(file); grid.append(label);
        }
        if (resource === 'fabricacion_semanal') {
            const sync = () => {
                const pedido = source.lookups.pedidos?.find(p => String(p.value) === controls.pedido_id.value)?.data;
                for (const name of ['tipo_producto_id', 'material_id', 'tostado_id']) controls[name].value = pedido?.[name] ?? '';
            };
            controls.pedido_id.addEventListener('change', sync); if (!row) sync();
        }
        const footer = document.createElement('div'); footer.className = 'data-form-actions';
        const save = document.createElement('button'); save.type = 'submit'; save.className = 'primary-button'; save.textContent = row ? 'Guardar cambios' : source.config.upload ? 'Subir archivo' : 'Crear';
        const status = document.createElement('span'); status.setAttribute('role', 'status'); footer.append(save, status); form.append(footer);
        const entry = createWindow(key, heading.textContent, 'pencil-square', form); if (!entry) return;
        form.addEventListener('submit', async event => {
            event.preventDefault(); if (entry.pending || !form.reportValidity()) return;
            if (source.loading || source.pending) { status.textContent = 'Espera a que termine la operación del listado.'; return; }
            entry.pending++; save.disabled = true; status.textContent = 'Guardando…';
            try {
                if (!row && source.config.upload) {
                    const response = await fetch('api/router.php?resource=archivos', { method: 'POST', body: new FormData(form), credentials: 'same-origin' }); const result = await response.json();
                    if (!response.ok || !result.ok) throw new Error(result.error || 'No se pudo subir el archivo.');
                } else {
                    const data = {};
                    for (const [name, input] of Object.entries(controls)) if (!input.disabled) data[name] = input.type === 'checkbox' ? Number(input.checked) : input.value;
                    await this.request(resource, { action: row ? 'update' : 'create', id: row?.id, version: row?._version, data });
                }
                entry.pending--; notify(row ? 'Cambios guardados.' : 'Registro creado.'); entry.panel.close();
                if (this.current(resource, source)) await source.reload(); void loadOverview();
                if (resource === 'pedidos') void windows.get('fabricacion_semanal')?.reload?.();
            } catch (error) { entry.pending--; status.textContent = error.message; notify(error.message, true); }
            finally { save.disabled = false; }
        });
        if (options.form) options.form(form, controls, row);
        form.querySelector('input:not([disabled]), select:not([disabled])')?.focus();
    },
    async remove(resource, entry, row) {
        if (entry.pending || entry.loading) return;
        const name = row.nombre ?? row.descripcion ?? row.numero ?? row.alias ?? row.titulo ?? row.fecha ?? row.id;
        if (!window.confirm(`¿Eliminar «${name}» (ID ${row.id})?`)) return;
        entry.pending++; entry.table.redraw(true); entry.status('Eliminando…');
        try {
            await this.request(resource, { action: 'delete', id: row.id, version: row._version });
            entry.pending--; await entry.reload(); notify('Registro eliminado.'); void loadOverview();
        } catch (error) { entry.pending--; entry.status('No se pudo eliminar'); notify(error.message, true); }
        finally { entry.table.redraw(true); }
    },
    exports(entry, filename) {
        GestionListadosExportar.attachTable(entry, filename);
        entry.actions.append(this.button('filetype-csv', 'Exportar listado filtrado a CSV', () => this.csv(entry, filename)));
        entry.actions.append(this.button('printer', 'Imprimir listado filtrado / Guardar como PDF', () => entry.table.print(false, true)));
    },
    async editOriginal(resource, source, row) {
        if (source.loading || source.pending) return;
        source.pending++;
        let fresh;
        try {
            const result = await this.request(resource);
            fresh = result.rows.find(item => String(item.id) === String(row.id));
            if (!fresh) throw new Error('El registro ya no existe. Actualiza el listado.');
            source.config = result.config; source.lookups = result.lookups;
        } catch (error) { notify(error.message, true); }
        finally { source.pending--; }
        if (fresh && windows.get(resource) === source) this.form(resource, source, fresh);
    },
    csv(entry, filename) {
        try { GestionListadosExportar.exportSnapshot(GestionListadosExportar.tableSnapshot(entry), filename, 'csv'); }
        catch (error) { notify(error.message, true); }
    },
};
