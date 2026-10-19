'use strict';

const GestionCuadranteAnchuras = {
    bind(entry) {
        const root = entry.content;
        const layout = root.querySelector('.cc-layout');
        const pool = root.querySelector('.cc-pool');
        this.handle(root.querySelector('.cc-pool-resizer'), root, {
            get: () => pool.getBoundingClientRect().width,
            set: width => layout.style.setProperty('--cc-pool-width', `${width}px`),
            min: 120, max: () => Math.max(120, layout.clientWidth - 187),
        });
    },
    table(entry) {
        const table = entry.content.querySelector('.cc-table');
        const headers = [...table.querySelectorAll('thead th')];
        if (entry.columnWidths) this.apply(entry);
        headers.forEach((header, index) => {
            const handle = document.createElement('span');
            handle.className = 'cc-column-resizer';
            handle.title = `Arrastrar para ajustar: ${header.textContent}`;
            handle.setAttribute('aria-label', `Anchura de ${header.textContent}`);
            header.append(handle);
            this.handle(handle, entry.content, {
                get: () => entry.columnWidths?.[index] ?? header.getBoundingClientRect().width,
                set: width => {
                    if (!entry.columnWidths) entry.columnWidths = headers.map(item => item.getBoundingClientRect().width);
                    entry.columnWidths[index] = width;
                    this.apply(entry);
                },
                min: index === 0 ? 100 : 80, max: () => 1200,
            });
        });
    },
    apply(entry) {
        const table = entry.content.querySelector('.cc-table');
        let group = table.querySelector('colgroup');
        if (!group) { group = document.createElement('colgroup'); table.prepend(group); }
        group.replaceChildren(...entry.columnWidths.map(width => {
            const col = document.createElement('col'); col.style.width = `${width}px`; return col;
        }));
        table.classList.add('cc-custom-widths');
        table.style.width = `${entry.columnWidths.reduce((sum, width) => sum + width, 0)}px`;
    },
    handle(element, root, options) {
        element.tabIndex = 0;
        element.setAttribute('role', 'separator');
        element.setAttribute('aria-orientation', 'vertical');
        element.setAttribute('aria-valuemin', String(options.min));
        const update = value => {
            const maximum = options.max();
            const width = Math.round(Math.max(options.min, Math.min(maximum, value)));
            options.set(width);
            element.setAttribute('aria-valuenow', String(width));
            element.setAttribute('aria-valuemax', String(maximum));
        };
        element.setAttribute('aria-valuenow', String(Math.round(options.get())));
        element.setAttribute('aria-valuemax', String(options.max()));
        let drag = null;
        element.addEventListener('pointerdown', event => {
            if (event.button !== 0 || drag) return;
            event.preventDefault(); event.stopPropagation();
            drag = { id: event.pointerId, x: event.clientX, width: options.get() };
            element.setPointerCapture(event.pointerId);
            root.classList.add('cc-resizing');
        });
        element.addEventListener('pointermove', event => {
            if (drag?.id === event.pointerId) update(drag.width + event.clientX - drag.x);
        });
        const stop = event => {
            if (drag?.id !== event.pointerId) return;
            drag = null; root.classList.remove('cc-resizing');
            if (element.hasPointerCapture(event.pointerId)) element.releasePointerCapture(event.pointerId);
        };
        for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) element.addEventListener(type, stop);
        element.addEventListener('dragstart', event => { event.preventDefault(); event.stopPropagation(); });
        element.addEventListener('keydown', event => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault(); event.stopPropagation();
            update(event.key === 'Home' ? options.min : event.key === 'End' ? options.max() : options.get() + (event.key === 'ArrowLeft' ? -10 : 10));
        });
    },
};
