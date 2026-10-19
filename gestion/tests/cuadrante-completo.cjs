const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const context = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/cuadrante-completo-modelo.js'), 'utf8') + '\nglobalThis.model = CuadranteCompletoModelo;', context);
const m = context.model;
const state = {
 inicio: '2026-10-15', festivos: ['2026-10-16'],
 usuarios: [{ id: 1, codigo: '10', nombre: 'Ana', alias: 'Ana', activo: 1, empleado: 1 }, { id: 2, codigo: '2', nombre: 'Benito', alias: 'Benito', activo: 1, empleado: 1 }, { id: 3, nombre: 'Inactivo usado', activo: 0, empleado: 1 }, { id: 4, nombre: 'Inactivo sin uso', activo: 0, empleado: 1 }],
 puestos: [{ id: 1, nombre: 'Segundo', orden: 2, activo: 1 }, { id: 2, nombre: 'Primero', orden: 1, activo: 1 }, { id: 3, nombre: 'Inactivo usado', orden: 3, activo: 0 }, { id: 4, nombre: 'Inactivo sin uso', orden: 4, activo: 0 }],
 details: [{ id: 1, usuario_id: 1, puesto_id: 1, fecha: '2026-10-15' }, { id: 2, usuario_id: 3, puesto_id: 3, fecha: '2026-10-19' }],
};
assert.equal(Array.from(m.days(state), d => d.date).join(','), '2026-10-15,2026-10-16,2026-10-19,2026-10-20,2026-10-21');
assert.equal(Array.from(m.people(state), p => p.id).join(','), '2,1,3');
assert.equal(Array.from(m.positions(state), p => p.id).join(','), '2,1,3');
const coverage = m.coverage(state, 1);
assert.equal(coverage[0].assigned, true); assert.equal(coverage[1].holiday, true);
assert.equal(coverage.filter(d => !d.holiday && !d.assigned).length, 3);
assert.equal(m.conflicts(state, 1, '2026-10-15', 1).length, 0);
assert.equal(m.conflicts(state, 1, '2026-10-15').length, 1);
assert.equal(m.addDays('2026-12-31', 4), '2027-01-04');
assert.equal(m.html('<img src=x onerror="a">'), '&lt;img src=x onerror=&quot;a&quot;&gt;');
assert.equal(m.csv('=SUM(A1)'), '"\'=SUM(A1)"');
console.log('OK: días J/V/L/M/X, orden numérico, inactivos usados, faltas, festivos, conflictos y exportación segura.');
