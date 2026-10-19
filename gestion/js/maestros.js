'use strict';

const gestionMaestros = {
    recursos: ['proveedores', 'materiales', 'ubicaciones'],
    columns(entry, fields, remove, edit) {
        return [...fields.map(field => ({ ...field, headerFilter: 'input', headerFilterPlaceholder: 'Filtrar…',
            ...(field.editor ? { editable: cell => entry.editing && !entry.pending && !entry.loading && !cell.getElement().classList.contains('saving') } : {}),
        })), {
            title: 'Acciones', field: '_acciones', width: 95, frozen: true, headerSort: false,
            formatter: cell => {
                const group = document.createElement('div'); group.className = 'row-actions';
                const pencil = GestionUI.button('pencil', 'Editar registro', () => edit(cell.getRow().getData()));
                const button = GestionUI.button('trash', 'Eliminar registro', () => { if (!entry.pending && !entry.loading) void remove(cell.getRow()); });
                pencil.disabled = button.disabled = !!entry.pending || !!entry.loading;
                group.append(pencil, button); return group;
            },
        }];
    },
    attach(resource, entry, content) {
        entry.editing = false;
        const toolbar = content.querySelector('.window-toolbar');
        const actions = document.createElement('div'); actions.className = 'master-actions';
        actions.innerHTML = '<button type="button" class="icon-button master-create" aria-label="Crear registro" title="Crear registro"><i class="bi bi-plus-lg"></i></button><button type="button" class="icon-button master-filters" aria-label="Mostrar filtros por columna" title="Mostrar filtros por columna" aria-pressed="false"><i class="bi bi-funnel"></i></button><button type="button" class="icon-button master-lock" aria-label="Desbloquear edición" title="Desbloquear edición" aria-pressed="false"><i class="bi bi-lock-fill"></i></button>';
        toolbar.append(actions);
        const host = content.querySelector('.table-host');
        host.classList.add('filters-hidden');
        const filters = actions.querySelector('.master-filters');
        filters.addEventListener('click', () => {
            const visible = host.classList.contains('filters-hidden');
            if (!visible) entry.table.clearHeaderFilter();
            host.classList.toggle('filters-hidden', !visible);
            filters.setAttribute('aria-pressed', String(visible));
            const label = visible ? 'Ocultar y limpiar filtros por columna' : 'Mostrar filtros por columna';
            filters.title = label; filters.setAttribute('aria-label', label);
            filters.innerHTML = `<i class="bi bi-funnel${visible ? '-fill' : ''}"></i>`;
            entry.table.redraw(true);
        });
        const lock = actions.querySelector('.master-lock');
        const hint = content.querySelector('.table-hint');
        hint.textContent = 'Edición en tabla bloqueada';
        lock.addEventListener('click', () => {
            if (entry.pending || entry.loading) { notify('Espera a que termine la operación.'); return; }
            // Confirma o cancela el editor antes de cambiar el bloqueo.
            for (const row of entry.table.getRows()) for (const cell of row.getCells()) {
                if (cell.getElement().classList.contains('tabulator-editing')) cell.cancelEdit();
            }
            entry.editing = !entry.editing;
            lock.setAttribute('aria-pressed', String(entry.editing));
            const label = entry.editing ? 'Bloquear edición' : 'Desbloquear edición';
            lock.title = label; lock.setAttribute('aria-label', label);
            lock.innerHTML = `<i class="bi bi-${entry.editing ? 'unlock' : 'lock-fill'}"></i>`;
            hint.textContent = entry.editing ? 'Edición en tabla habilitada · Enter guarda, Esc cancela' : 'Edición en tabla bloqueada';
            entry.table.redraw(true);
        });
        actions.querySelector('.master-create').addEventListener('click', () => this.create(resource, entry));
    },
    async remove(resource, entry, row) {
        if (entry.pending || entry.loading) return;
        const data = row.getData();
        const name = String(data.nombre ?? data.descripcion);
        if (!window.confirm(`¿Eliminar «${name}» (ID ${data.id})? Esta acción no se puede deshacer.`)) return;
        entry.pending++; entry.table.redraw(true);
        try {
            await api(null, { accion: 'eliminar', recurso: resource, id: data.id, anterior: name });
            await row.delete(); notify('Registro eliminado.'); void loadOverview();
        } catch (error) { notify(error.message, true); }
        finally { entry.pending--; entry.table.redraw(true); }
    },
    create(resource, source) {
        if (source.loading) { notify('Espera a que se cargue el listado.'); return; }
        const key = `crear-${resource}`;
        if (windows.has(key)) { focusWindow(key); return; }
        const provider = resource === 'proveedores';
        const form = document.createElement('form'); form.className = 'provider-form master-form';
        form.innerHTML = `<label>${provider ? 'Nombre del proveedor' : 'Descripción'}<input name="texto" required maxlength="${provider ? 128 : 60}" autocomplete="off"></label>${resource === 'ubicaciones' ? '<label>Instalación<select name="instalacion_id" required><option value="">Selecciona una instalación</option></select></label><label>Orden<input name="orden" type="number" step="1" value="0" required></label>' : ''}<div class="form-actions"><button class="primary-button" type="submit">Crear</button><span class="form-status" role="status"></span></div>`;
        if (resource === 'ubicaciones') for (const item of source.instalaciones || []) {
            const option = document.createElement('option'); option.value = item.id; option.textContent = item.nombre;
            form.elements.instalacion_id.append(option);
        }
        const entry = createWindow(key, `Crear · ${definitions[resource].title}`, 'plus-circle', form, true);
        if (!entry) return;
        if (resource === 'ubicaciones') entry.panel.resize({ height: Math.min(440, desktop.clientHeight - 36) });
        form.addEventListener('submit', async event => {
            event.preventDefault(); if (entry.pending || !form.reportValidity()) return;
            const data = { accion: 'crear', recurso: resource, [provider ? 'nombre' : 'descripcion']: form.elements.texto.value.trim() };
            if (resource === 'ubicaciones') Object.assign(data, { instalacion_id: form.elements.instalacion_id.value, orden: form.elements.orden.value });
            entry.pending++; const button = form.querySelector('button'); button.disabled = true;
            const status = form.querySelector('.form-status'); status.textContent = 'Guardando…';
            try {
                await api(null, data); form.reset(); status.textContent = 'Registro creado'; notify('Registro creado.');
                await windows.get(resource)?.reload?.(); void loadOverview();
            } catch (error) { status.textContent = 'No se pudo guardar'; notify(error.message, true); }
            finally { entry.pending--; button.disabled = false; }
        });
        form.elements.texto.focus();
    },
    editLot(source, row) {
        if (source.pending || source.loading) return;
        const key = `editar-lote-${row.id}`;
        if (windows.has(key)) { focusWindow(key); return; }
        const previous = String(row.codigo);
        const form = document.createElement('form'); form.className = 'provider-form';
        form.innerHTML = '<label>Código del lote<input name="codigo" required maxlength="60" autocomplete="off"></label><div class="form-actions"><button type="submit" class="primary-button">Guardar cambios</button><span class="form-status" role="status"></span></div>';
        form.elements.codigo.value = previous;
        const child = createWindow(key, `Editar lote · ${previous}`, 'pencil', form, true); if (!child) return;
        form.addEventListener('submit', async event => {
            event.preventDefault(); if (child.pending || !form.reportValidity()) return;
            if (source.pending || source.loading) { notify('Espera a que termine la operación del listado.'); return; }
            child.pending++; const button = form.querySelector('button'); button.disabled = true;
            const status = form.querySelector('.form-status'); status.textContent = 'Guardando…';
            try {
                await api(null, { accion: 'editar', recurso: 'lotes', id: row.id, campo: 'codigo', anterior: previous, valor: form.elements.codigo.value.trim() });
                child.pending--; child.panel.close(); notify('Lote actualizado.');
                await windows.get('lotes')?.reload?.(); void loadOverview();
            } catch (error) { child.pending--; status.textContent = error.message; notify(error.message, true); }
            finally { button.disabled = false; }
        });
        form.elements.codigo.focus();
    },
};
