'use strict';

const GestionPaneles = {
    async create(key, title, icon, template) {
        if (windows.has(key)) { focusWindow(key); return null; }
        const response = await fetch(`vistas/${template}?v=20261019e`, { cache: 'no-store' });
        if (!response.ok) throw new Error('No se pudo cargar la vista.');
        if (windows.has(key)) { focusWindow(key); return null; }
        const wrapper = document.createElement('div'); wrapper.innerHTML = await response.text();
        const content = wrapper.firstElementChild;
        const entry = createWindow(key, title, icon, content); if (!entry) return null;
        entry.content = content; entry.parts = [];
        entry.table = { destroy: () => entry.parts.forEach(part => { part.observer?.disconnect(); part.table?.destroy(); }) };
        entry.panel.maximize(); return entry;
    },
    region(parent, host, title) {
        const content = document.createElement('div'); content.className = 'window-content data-window';
        content.innerHTML = '<div class="window-toolbar data-toolbar"><input class="search-input" type="search" placeholder="Buscar en el listado…" aria-label="Buscar en el listado"><div class="data-actions"></div></div><div class="data-options"></div><div class="table-host filters-hidden"></div><div class="window-footer"><span class="row-count">Cargando…</span><span class="table-hint"></span><span class="footer-status"><span class="save-state" role="status"></span><span class="last-updated"></span></span></div>';
        host.append(content);
        const part = { title, content, panel: parent.panel, editing: false, loading: false,
            isCurrent: () => windows.get(parent.panel.id.replace('window-', '')) === parent,
            status: text => { content.querySelector('.save-state').textContent = text; },
            hint: text => { content.querySelector('.table-hint').textContent = text; },
            actions: content.querySelector('.data-actions'),
        };
        Object.defineProperty(part, 'pending', { get: () => parent.pending, set: value => { parent.pending = value; } });
        parent.parts.push(part); return part;
    },
    async rows(parent, resource, selector, options = {}) {
        const part = this.region(parent, parent.content.querySelector(selector), options.title || resource);
        await GestionUI.open(resource, part.title, { ...options, entry: part }); return part;
    },
};
