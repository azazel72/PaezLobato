'use strict';
const desktop = document.getElementById('desktop');
const windows = new Map();
let activeKey = null;
const numberFormat = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 4 });
const definitions = {
    lotes: { title: 'Lotes', icon: 'box-seam', hint: 'Clic en el nombre para editar · Cantidades de consulta', fields: [
        { title: 'ID', field: 'id', width: 65 },
        { title: 'Lote', field: 'codigo', editor: 'input', minWidth: 200, widthGrow: 2 },
        { title: 'Destino', field: 'objetivo', width: 125, formatter: cell => { const tag = document.createElement('span'); tag.className = 'type-tag'; tag.dataset.type = cell.getValue(); tag.textContent = cell.getValue(); return tag; } },
        { title: 'Madera', field: 'material', minWidth: 130 },
        { title: 'Ubicación', field: 'ubicacion', minWidth: 130 },
        ...['cubicaje', 'consumido', 'restante'].map((field, index) => ({ title: ['M³ total', 'M³ consumido', 'M³ restante'][index], field, hozAlign: 'right', minWidth: 115, sorter: 'number', formatter: cell => { const span = document.createElement('span'); span.textContent = numberFormat.format(Number(cell.getValue())); if (Number(cell.getValue()) < 0) span.className = 'negative'; return span; } })),
        { title: 'Estado', field: 'estado', width: 105, formatter: cell => ({ 0: 'Disponible', 1: 'Seleccionado', 2: 'Finalizado' })[cell.getValue()] || 'Sin estado' },
    ] },
    proveedores: { title: 'Proveedores', icon: 'buildings', hint: 'Clic en el nombre para editar · Enter guarda, Esc cancela', fields: [
        { title: 'ID', field: 'id', width: 80 }, { title: 'Nombre del proveedor', field: 'nombre', editor: 'input', minWidth: 300, widthGrow: 3 },
    ] },
    materiales: { title: 'Materiales', icon: 'layers', hint: 'Clic en la descripción para editar · Enter guarda, Esc cancela', fields: [
        { title: 'ID', field: 'id', width: 80 }, { title: 'Descripción', field: 'descripcion', editor: 'input', minWidth: 250, widthGrow: 3 },
    ] },
    ubicaciones: { title: 'Ubicaciones', icon: 'geo-alt', hint: 'Clic en la descripción para editar · Enter guarda, Esc cancela', fields: [
        { title: 'ID', field: 'id', width: 70 }, { title: 'Ubicación', field: 'descripcion', editor: 'input', minWidth: 240, widthGrow: 2 },
        { title: 'Instalación', field: 'instalacion', minWidth: 120 }, { title: 'Orden', field: 'orden', width: 80 },
    ] },
};

async function api(resource, data) {
    const target = data ? (data.accion === 'crear_proveedor' ? 'proveedores' : data.recurso) : resource;
    const response = await fetch(`../api/gestion/${encodeURIComponent(target)}.php`, {
        method: data ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store',
        ...(data ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) } : {}),
    });
    let result;
    try { result = await response.json(); }
    catch { throw new Error('PHP no devolvió una respuesta válida.'); }
    if (!response.ok || !result.ok) throw new Error(result.error || 'No se pudo completar la operación.');
    return result;
}

function notify(message, error = false) {
    const notice = document.createElement('div');
    notice.className = `notification${error ? ' error' : ''}`;
    notice.textContent = message;
    document.getElementById('notifications').append(notice);
    setTimeout(() => notice.remove(), error ? 9000 : 4500);
}

async function loadOverview() {
    const refresh = document.getElementById('refresh-home');
    refresh.disabled = true;
    try {
        const data = await api('resumen');
        const total = data.distribucion.reduce((sum, item) => sum + Number(item.cantidad), 0);
        for (const [id, value] of [['stat-lotes', total], ['nav-lotes', total], ['stat-volumen', data.volumen], ['stat-proveedores', data.proveedores], ['stat-ubicaciones', data.ubicaciones]]) document.getElementById(id).textContent = numberFormat.format(Number(value));
        const distribution = document.getElementById('distribution');
        distribution.replaceChildren();
        const labels = { STOCK: 'Stock', BOTAS: 'Botas', FONDOS: 'Fondos', ALMACENADO: 'Almacenado' };
        for (const item of data.distribucion) {
            const row = document.createElement('div'); row.className = 'distribution-row';
            const label = document.createElement('div'); label.className = 'distribution-label';
            const name = document.createElement('span'); name.textContent = labels[item.objetivo] || item.objetivo;
            const count = document.createElement('span'); count.textContent = `${item.cantidad} lotes`;
            label.append(name, count);
            const track = document.createElement('div'); track.className = 'bar-track';
            const fill = document.createElement('div'); fill.className = 'bar-fill'; fill.dataset.type = item.objetivo; fill.style.width = `${total ? Number(item.cantidad) / total * 100 : 0}%`;
            track.append(fill); row.append(label, track); distribution.append(row);
        }
        if (!data.distribucion.length) distribution.textContent = 'No hay lotes activos.';
    } catch (error) {
        document.getElementById('distribution').textContent = 'No se pudo cargar el inventario. Pulsa actualizar para volver a intentarlo.';
        notify(error.message, true);
    } finally { refresh.disabled = false; }
}

function updateTaskbar() {
    const tabs = document.getElementById('window-tabs'); tabs.replaceChildren();
    for (const [key, entry] of windows) {
        const button = document.createElement('button'); button.type = 'button';
        button.classList.toggle('active', key === activeKey && entry.panel.status !== 'minimized');
        button.textContent = entry.title; button.addEventListener('click', () => focusWindow(key)); tabs.append(button);
    }
    document.getElementById('window-count').textContent = `${windows.size} ${windows.size === 1 ? 'abierta' : 'abiertas'}`;
    document.querySelectorAll('.nav-item').forEach(button => button.classList.toggle('active', activeKey ? button.dataset.table === activeKey || button.dataset.form === activeKey : button.hasAttribute('data-home')));
    document.getElementById('current-title').textContent = windows.get(activeKey)?.title || 'Vista general';
}

function focusWindow(key) {
    const entry = windows.get(key); if (!entry) return;
    if (entry.panel.status === 'minimized') entry.panel.normalize();
    entry.panel.front(); activeKey = key; updateTaskbar();
}

function createWindow(key, title, icon, content, narrow = false) {
    if (windows.has(key)) { focusWindow(key); return null; }
    const area = desktop.getBoundingClientRect();
    const offset = windows.size % 4 * 22;
    const width = Math.max(220, Math.min(narrow ? 490 : 970, area.width - 36));
    const height = Math.max(200, Math.min(narrow ? 340 : 560, area.height - 36));
    const entry = { title, table: null, panel: null, pending: 0, restoring: new Set(), observer: null };
    const panel = jsPanel.create({
        id: `window-${key}`, container: desktop,
        headerTitle: title, headerLogo: `<i class="bi bi-${icon}"></i>`,
        theme: 'light', borderRadius: '9px',
        panelSize: { width, height }, content,
        position: { my: 'left-top', at: 'left-top', offsetX: Math.min(24 + offset, Math.max(0, area.width - width)), offsetY: Math.min(24 + offset, Math.max(0, area.height - height)) },
        dragit: { containment: 0 }, resizeit: { containment: 0, minWidth: Math.min(340, area.width - 20), minHeight: 200 },
        maximizedMargin: 8, minimizeTo: false, headerControls: { smallify: 'remove' },
        onwindowresize: true,
        onfronted: () => { activeKey = key; updateTaskbar(); },
        onminimized: () => { if (activeKey === key) activeKey = null; updateTaskbar(); },
        onbeforeclose: [() => { if (entry.pending) { notify('Espera a que se guarden los cambios.'); return false; } return true; }],
        onclosed: () => {
            entry.observer?.disconnect(); entry.table?.destroy(); windows.delete(key);
            if (activeKey === key) activeKey = null; updateTaskbar();
        },
    });
    entry.panel = panel; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', title);
    for (const [control, label] of [['minimize', 'Minimizar'], ['maximize', 'Maximizar'], ['normalize', 'Restaurar'], ['close', 'Cerrar']]) {
        const button = panel.querySelector(`.jsPanel-btn-${control}`);
        if (button) { button.setAttribute('aria-label', label); button.title = label; }
    }
    windows.set(key, entry); activeKey = key; updateTaskbar();
    return entry;
}

function setCellSilently(entry, cell, value) {
    entry.restoring.add(cell);
    try { cell.setValue(value); } finally { entry.restoring.delete(cell); }
}

function openTable(resource) {
    const definition = definitions[resource];
    if (!definition) return;
    if (windows.has(resource)) { focusWindow(resource); return; }
    const content = document.createElement('div'); content.className = 'window-content';
    content.innerHTML = '<div class="window-toolbar"><input class="search-input" type="search" placeholder="Buscar en este listado…" aria-label="Buscar en el listado"><span class="table-hint"></span><button class="icon-button" type="button" aria-label="Actualizar listado" title="Actualizar listado"><i class="bi bi-arrow-clockwise"></i></button></div><div class="table-host"></div><div class="window-footer"><span class="row-count">Cargando…</span><span class="save-state">Conectando con PHP…</span></div>';
    content.querySelector('.table-hint').textContent = definition.hint;
    const entry = createWindow(resource, definition.title, definition.icon, content); if (!entry) return;
    const saveState = content.querySelector('.save-state');
    const refresh = content.querySelector('.icon-button');
    const table = new Tabulator(content.querySelector('.table-host'), {
        height: '100%', layout: 'fitColumns', editTriggerEvent: 'click',
        placeholder: 'No hay registros en este listado.', index: 'id',
        columnDefaults: { formatter: 'plaintext', resizable: true, vertAlign: 'middle' },
        columns: definition.fields.map(field => ({ ...field, ...(field.editor ? { editable: cell => !cell.getElement().classList.contains('saving'), validator: ['required', `maxLength:${resource === 'proveedores' ? 128 : 60}`] } : {}) })),
    });
    entry.table = table;
    entry.reload = async () => {
        if (entry.pending) { notify('Espera a que se guarden los cambios antes de actualizar.'); return; }
        refresh.disabled = true; saveState.textContent = 'Cargando…';
        try {
            const result = await api(resource);
            if (!windows.has(resource)) return;
            await table.replaceData(result.filas); saveState.textContent = 'Datos actualizados';
        } catch (error) { saveState.textContent = 'Error de carga'; notify(error.message, true); }
        finally { refresh.disabled = false; }
    };
    table.on('tableBuilt', entry.reload);
    table.on('dataFiltered', (_, rows) => { content.querySelector('.row-count').textContent = `${rows.length} registros`; });
    content.querySelector('.search-input').addEventListener('input', event => {
        const text = event.target.value.trim().toLocaleLowerCase('es');
        if (!text) table.clearFilter();
        else table.setFilter(row => Object.values(row).some(value => String(value ?? '').toLocaleLowerCase('es').includes(text)));
    });
    refresh.addEventListener('click', entry.reload);
    table.on('cellEdited', async cell => {
        if (entry.restoring.has(cell)) return;
        const oldValue = cell.getOldValue(); const value = cell.getValue();
        if (String(oldValue) === String(value)) return;
        entry.pending++; cell.getElement().classList.add('saving'); saveState.textContent = 'Guardando…';
        try {
            const result = await api(null, { accion: 'editar', recurso: resource, id: cell.getRow().getData().id, campo: cell.getField(), anterior: String(oldValue ?? ''), valor: String(value ?? '') });
            setCellSilently(entry, cell, result.valor); saveState.textContent = 'Cambio guardado';
            notify('Cambio guardado.');
            void loadOverview();
        } catch (error) { setCellSilently(entry, cell, oldValue); saveState.textContent = 'Cambio no guardado'; notify(error.message, true); }
        finally { entry.pending--; cell.getElement().classList.remove('saving'); }
    });
    entry.observer = new ResizeObserver(() => { if (entry.panel.status !== 'minimized') table.redraw(); });
    entry.observer.observe(content.querySelector('.table-host'));
}

function openProviderForm() {
    const key = 'proveedor';
    if (windows.has(key)) { focusWindow(key); return; }
    const form = document.createElement('form'); form.className = 'provider-form';
    form.innerHTML = '<div class="form-intro"><span class="shortcut-icon orange"><i class="bi bi-buildings"></i></span><div><h2>Un nuevo proveedor</h2><p>Añádelo al fichero de la tonelería.</p></div></div><label for="provider-name">Nombre del proveedor</label><input id="provider-name" name="nombre" required maxlength="128" autocomplete="organization" placeholder="Ej. Maderas del Norte"><p class="form-help">Este nombre se mostrará en los listados y formularios.</p><div class="form-actions"><button class="primary-button" type="submit"><i class="bi bi-plus-lg"></i> Crear proveedor</button><span class="form-status" role="status"></span></div>';
    const entry = createWindow(key, 'Nuevo proveedor', 'plus-circle', form, true); if (!entry) return;
    form.addEventListener('submit', async event => {
        event.preventDefault(); if (entry.pending || !form.reportValidity()) return;
        entry.pending++; const button = form.querySelector('button'); button.disabled = true;
        const status = form.querySelector('.form-status'); status.textContent = 'Guardando…';
        try {
            const result = await api(null, { accion: 'crear_proveedor', nombre: form.elements.nombre.value.trim() });
            form.reset(); status.textContent = 'Proveedor creado'; notify(`Proveedor ${result.nombre} creado.`);
            await windows.get('proveedores')?.reload?.(); void loadOverview();
        } catch (error) { status.textContent = 'No se pudo guardar'; notify(error.message, true); }
        finally { entry.pending--; button.disabled = false; }
    });
    form.elements.nombre.focus();
}

document.querySelectorAll('[data-table]').forEach(button => button.addEventListener('click', () => openTable(button.dataset.table)));
document.querySelectorAll('[data-form]').forEach(button => button.addEventListener('click', openProviderForm));
document.querySelector('[data-home]').addEventListener('click', () => {
    for (const entry of windows.values()) if (entry.panel.status !== 'minimized') entry.panel.minimize();
    activeKey = null; updateTaskbar();
});
document.getElementById('refresh-home').addEventListener('click', loadOverview);
document.getElementById('today').textContent = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Madrid' }).format(new Date());
if (typeof Tabulator === 'undefined' || typeof jsPanel === 'undefined') notify('No se han cargado las librerías del escritorio. Recarga la página.', true);
void loadOverview();
