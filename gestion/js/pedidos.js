'use strict';

const GestionPedidos = {
    open() {
        return GestionUI.open('pedidos', 'Pedidos', {
            icon: 'clipboard-check',
            setup(entry) {
                const options = entry.content.querySelector('.data-options');
                const label = document.createElement('label'); label.textContent = 'Destino';
                const select = document.createElement('select');
                select.innerHTML = '<option value="">Todos</option><option value="C">Cliente</option><option value="E">Envinado</option>';
                label.append(select); options.append(label);
                entry.extraFilter = row => !select.value || ({ CLIENTE: 'C', ENVINADO: 'E' }[row.destino] ?? row.destino) === select.value;
                select.addEventListener('change', entry.applyFilters);
            },
        });
    },
};
