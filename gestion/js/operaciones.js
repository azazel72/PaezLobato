'use strict';

const GestionOperaciones = {
    async open(resource, title, config = {}) {
        const entry = windows.get(resource) || await GestionUI.open(resource, title, {
            icon: config.icon || 'table', defaults: config.defaults,
            columns: config.columns, rowActions: config.rowActions, form: config.form,
            setup: source => this.filters(source, config),
            loaded: source => this.refreshFilters(source),
        });
        if (entry) focusWindow(resource);
        return entry;
    },
    filters(entry, config = {}) {
        const box = entry.content.querySelector('.data-options');
        entry.operationFilters = [];
        for (const field of config.refs || []) {
            const label = document.createElement('label'); label.textContent = entry.config.fields[field].label;
            const select = document.createElement('select'); label.append(select); box.append(label);
            entry.operationFilters.push({ field, input: select }); select.addEventListener('change', () => entry.applyFilters());
        }
        if (config.date) {
            for (const [labelText, bound] of [['Desde', 'from'], ['Hasta', 'to']]) {
                const label = document.createElement('label'); label.textContent = labelText;
                const input = document.createElement('input'); input.type = 'date'; label.append(input); box.append(label);
                entry.operationFilters.push({ field: config.date, input, bound }); input.addEventListener('change', () => entry.applyFilters());
            }
        }
        entry.extraFilter = row => entry.operationFilters.every(({ field, input, bound }) => !input.value || (bound === 'from' ? row[field] >= input.value : bound === 'to' ? row[field] <= input.value : String(row[field] ?? '') === input.value));
    },
    refreshFilters(entry) {
        for (const filter of entry.operationFilters || []) {
            if (filter.bound) continue;
            const current = filter.input.value; filter.input.replaceChildren();
            const all = document.createElement('option'); all.value = ''; all.textContent = 'Todos'; filter.input.append(all);
            for (const choice of GestionUI.choices(entry, entry.config.fields[filter.field])) {
                const option = document.createElement('option'); option.value = choice.value; option.textContent = choice.label; filter.input.append(option);
            }
            filter.input.value = current;
        }
    },
    async filter(entry, field, value) {
        const filter = entry?.operationFilters?.find(filter => filter.field === field && !filter.bound);
        if (filter) { filter.input.value = String(value); entry.applyFilters(); }
    },
};
