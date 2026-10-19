'use strict';

const GestionFabricacion = {
    async open(pedidoId) {
        const options = {
            icon: 'calendar-week',
            setup(entry) {
                const box = entry.content.querySelector('.data-options');
                const pedido = document.createElement('label'); pedido.textContent = 'Pedido';
                const select = document.createElement('select'); pedido.append(select);
                const semana = document.createElement('label'); semana.textContent = 'Desde'; const from = document.createElement('input'); from.type = 'date'; semana.append(from);
                const hasta = document.createElement('label'); hasta.textContent = 'Hasta'; const to = document.createElement('input'); to.type = 'date'; hasta.append(to); box.append(pedido, semana, hasta);
                entry.pedidoFilter = select;
                entry.extraFilter = row => (!select.value || String(row.pedido_id) === select.value) && (!from.value || row.fecha_inicio >= from.value) && (!to.value || row.fecha_inicio <= to.value);
                [select, from, to].forEach(input => input.addEventListener('change', entry.applyFilters));
            },
            loaded(entry) {
                const select = entry.pedidoFilter; const current = select.value; select.replaceChildren();
                const all = document.createElement('option'); all.value = ''; all.textContent = 'Todos los pedidos'; select.append(all);
                for (const item of entry.lookups.pedidos || []) { const option = document.createElement('option'); option.value = item.value; option.textContent = item.label; select.append(option); }
                select.value = current; entry.applyFilters();
            },
        };
        const entry = windows.get('fabricacion_semanal') || await GestionUI.open('fabricacion_semanal', 'Fabricación semanal', options);
        if (!entry) return;
        focusWindow('fabricacion_semanal');
        if (pedidoId && entry.pedidoFilter) { entry.pedidoFilter.value = String(pedidoId); entry.applyFilters(); }
    },
};
