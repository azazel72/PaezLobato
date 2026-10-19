'use strict';

const CuadranteCompletoModelo = {
    addDays(date, days) { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); },
    days(state) {
        return [0, 1, 4, 5, 6].map((offset, i) => {
            const date = this.addDays(state.inicio, offset);
            return { date, letter: ['J', 'V', 'L', 'M', 'X'][i], holiday: state.festivos.includes(date) };
        });
    },
    people(state) {
        const used = new Set(state.details.map(d => Number(d.usuario_id)));
        return state.usuarios.filter(u => (Number(u.empleado) || used.has(Number(u.id))) && (Number(u.activo) || used.has(Number(u.id)))).sort((a, b) => {
            const ac = String(a.codigo || '').trim(); const bc = String(b.codigo || '').trim();
            return (ac && bc ? ac.localeCompare(bc, 'es', { numeric: true }) : ac ? -1 : bc ? 1 : 0) || String(a.nombre || a.alias).localeCompare(String(b.nombre || b.alias), 'es') || Number(a.id) - Number(b.id);
        });
    },
    positions(state) {
        const used = new Set(state.details.map(d => Number(d.puesto_id)));
        return state.puestos.filter(p => Number(p.activo) || used.has(Number(p.id))).sort((a, b) => Number(a.orden) - Number(b.orden) || String(a.nombre).localeCompare(String(b.nombre), 'es') || Number(a.id) - Number(b.id));
    },
    coverage(state, userId) {
        return this.days(state).map(day => ({ ...day, assigned: state.details.some(d => d.fecha === day.date && Number(d.usuario_id) === Number(userId)) }));
    },
    conflicts(state, userId, date, excludeId) {
        return state.details.filter(d => Number(d.usuario_id) === Number(userId) && d.fecha === date && String(d.id) !== String(excludeId));
    },
    name(state, id) { const user = state.usuarios.find(u => Number(u.id) === Number(id)); return user ? user.alias || user.nombre || `Empleado ${id}` : `Empleado ${id}`; },
    normalize(value) { return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es'); },
    html(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); },
    csv(value) { return '"' + String(value ?? '').replace(/^[=+@\-\t\r]/, "'$&").replace(/"/g, '""') + '"'; },
};
