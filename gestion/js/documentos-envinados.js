'use strict';

const GestionDocumentosEnvinados = {
    async open() {
        const entry = GestionUI.shell('documentos_envinados', 'Documentos de botas envinadas', 'images'); if (!entry) return;
        entry.actions.append(GestionUI.button('arrow-clockwise', 'Actualizar documentos', () => entry.reload()), GestionUI.button('upload', 'Subir documento para las botas seleccionadas', () => this.upload(entry)), GestionUI.button('link-45deg', 'Vincular archivo existente a las botas seleccionadas', () => this.attach(entry)));
        GestionUI.table(entry, [
            { formatter: 'rowSelection', titleFormatter: 'rowSelection', headerSort: false, headerFilter: false, width: 45, minWidth: 45, hozAlign: 'center', cellClick: (event, cell) => cell.getRow().toggleSelect() },
            ...[['ID', 'id'], ['Código', 'codigo'], ['Ubicación', 'ubicacion'], ['Pedido', 'pedido_numero'], ['Cliente', 'cliente_nombre'], ['Analítica', 'analitica_descripcion'], ['Documentos', 'documentos_count']].map(([title, field]) => ({ title, field, ...(field === 'documentos_count' ? { sorter: 'number' } : {}) })),
            { title: 'Acciones', frozen: true, width: 75, minWidth: 75, headerSort: false, headerFilter: false, formatter: cell => GestionUI.button('folder2-open', 'Ver documentos de esta bota', () => this.files(entry, cell.getRow().getData())) },
        ], { selectableRows: true });
        GestionUI.filters(entry); GestionUI.exports(entry, 'documentos_botas_envinadas'); entry.hint('Selecciona botas para subir o vincular documentos');
        entry.reload = async () => {
            if (entry.pending || entry.loading) return;
            entry.loading = true; entry.status('Cargando…');
            try {
                const result = await GestionUI.request('documentos_envinados');
                if (windows.get('documentos_envinados') !== entry) return;
                await entry.table.replaceData(result.rows); entry.applyFilters(); GestionUI.stamp(entry.content); entry.status('Datos actualizados');
            } catch (error) { entry.status('Error de carga'); notify(error.message, true); }
            finally { entry.loading = false; }
        };
        await entry.ready; await entry.reload();
    },
    selection(entry) {
        const rows = entry.table.getSelectedData();
        if (!rows.length) { notify('Selecciona al menos una bota.'); return null; }
        return rows.map(row => row.id);
    },
    upload(source) {
        if (source.pending || source.loading) return;
        const ids = this.selection(source); if (!ids) return;
        const key = 'documentos-envinados-subir'; if (windows.has(key)) { focusWindow(key); return; }
        const form = document.createElement('form'); form.className = 'data-form';
        form.innerHTML = '<h2>Subir documento o foto</h2><div class="data-form-grid"><label>Título<input name="titulo" required maxlength="150"></label><label>Archivo (hasta 15 MB)<input name="archivo" type="file" required></label></div><div class="data-form-actions"><button class="primary-button" type="submit">Subir y vincular</button><span role="status"></span></div>';
        form.querySelector('[name="titulo"]').value = `Documento envinado ${GestionUI.today()}`;
        const entry = createWindow(key, `Subir documento · ${ids.length} botas`, 'upload', form); if (!entry) return;
        form.addEventListener('submit', async event => {
            event.preventDefault(); if (entry.pending || !form.reportValidity()) return;
            entry.pending++; const button = form.querySelector('button'); button.disabled = true;
            const status = form.querySelector('[role="status"]'); status.textContent = 'Subiendo…';
            try {
                const data = new FormData(form); data.set('entidad', 'productos_envinados'); data.set('entidad_id', ids[0]); data.set('producto_ids', JSON.stringify(ids));
                const response = await fetch('api/router.php?resource=archivos', { method: 'POST', credentials: 'same-origin', body: data }); const result = await response.json();
                if (!response.ok || !result.ok) throw new Error(result.error || 'No se pudo subir el archivo.');
                entry.pending--; entry.panel.close(); await source.reload(); notify('Documento subido y vinculado.');
            } catch (error) { entry.pending--; status.textContent = error.message; }
            finally { button.disabled = false; }
        });
    },
    async attach(source) {
        const ids = this.selection(source); if (!ids || source.pending || source.loading) return;
        try {
            const result = await GestionUI.request('archivos_subidos');
            const key = 'documentos-envinados-vincular'; if (windows.has(key)) { focusWindow(key); return; }
            const form = document.createElement('form'); form.className = 'data-form';
            form.innerHTML = '<h2>Vincular archivo existente</h2><label>Archivo<select required></select></label><div class="data-form-actions"><button class="primary-button" type="submit">Vincular</button><span role="status"></span></div>';
            const select = form.querySelector('select');
            for (const row of result.rows) { const option = document.createElement('option'); option.value = row.id; option.textContent = `${row.titulo} · ${row.nombre_original}`; select.append(option); }
            const entry = createWindow(key, `Vincular archivo · ${ids.length} botas`, 'link-45deg', form); if (!entry) return;
            form.addEventListener('submit', async event => {
                event.preventDefault(); if (entry.pending || !form.reportValidity()) return; entry.pending++;
                try {
                    await GestionUI.request('documentos_envinados', { action: 'attach', producto_ids: ids, archivo_ids: [select.value] });
                    entry.pending--; entry.panel.close(); await source.reload(); notify('Archivo vinculado.');
                } catch (error) { entry.pending--; form.querySelector('[role="status"]').textContent = error.message; }
            });
        } catch (error) { notify(error.message, true); }
    },
    async files(source, product) {
        const key = `documentos-bota-${product.id}`; if (windows.has(key)) { focusWindow(key); return; }
        const content = document.createElement('div'); content.className = 'document-list';
        const entry = createWindow(key, `Documentos · ${product.codigo}`, 'folder2-open', content); if (!entry) return;
        const reload = async () => {
            try {
                const result = await GestionUI.request('documentos_envinados', null, { producto_id: product.id }); content.replaceChildren();
                if (!result.rows.length) { content.textContent = 'Esta bota no tiene documentos asociados.'; return; }
                for (const file of result.rows) {
                    const row = document.createElement('div'); const link = document.createElement('a'); link.textContent = `${file.titulo} · ${file.nombre_original}`; link.href = `api/router.php?resource=archivos&id=${encodeURIComponent(file.id)}`;
                    row.append(link, GestionUI.button('link-45deg', 'Desvincular documento de esta bota', async () => {
                        if (entry.pending || !window.confirm(`¿Desvincular «${file.titulo}» de esta bota?`)) return;
                        entry.pending++;
                        try { await GestionUI.request('documentos_envinados', { action: 'detach', producto_ids: [product.id], archivo_ids: [file.id] }); await reload(); await source.reload(); }
                        catch (error) { notify(error.message, true); } finally { entry.pending--; }
                    })); content.append(row);
                }
            } catch (error) { content.textContent = error.message; }
        };
        await reload();
    },
};
