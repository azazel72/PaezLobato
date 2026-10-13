const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const llamadas = [];
const tbody = { innerHTML: '', filas: [], appendChild(fila) { this.filas.push(fila); } };
function elemento() {
    const clases = new Set();
    return {
        dataset: {}, hijos: [],
        appendChild(hijo) { this.hijos.push(hijo); },
        classList: {
            add(clase) { clases.add(clase); }, remove(clase) { clases.delete(clase); },
            toggle(clase, activo) { if (activo) clases.add(clase); else clases.delete(clase); },
            contains(clase) { return clases.has(clase); },
        },
    };
}
let fallarSeleccion = false;
const contexto = {
    console: { error() {} }, alert() {},
    document: {
        addEventListener() {}, querySelector() { return tbody; }, createElement: elemento,
    },
    GET: async url => {
        llamadas.push(['GET', url]);
        return { ok: true, inventario_flejes: [
            { id: 4, estado: 1, lote: '40', tipo_producto_descripcion: 'Fleje 40', restante: -2 },
            { id: 7, estado: 0, lote: '70', tipo_producto_descripcion: 'Fleje 70', restante: 5 },
        ] };
    },
    POST: async (url, datos) => {
        llamadas.push(['POST', url, datos.id, datos.estado]);
        return fallarSeleccion ? undefined : { ok: true, ...datos };
    },
    wsRequest() { throw new Error('Los flejes no deben llamar a Python'); },
};
vm.createContext(contexto);
const terminal = fs.readFileSync(path.join(__dirname, '../js/terminal.js'), 'utf8');
vm.runInContext(terminal.slice(terminal.indexOf('function prepararEventosMenuFlejes()'),
    terminal.indexOf('function routeMessage(data)')), contexto);
(async () => {
    await contexto.cargarEntradasFlejesMenu();
    assert.equal(tbody.filas.length, 2);
    const fila = tbody.filas[0];
    assert.equal(fila.dataset.entradaId, 7);
    await contexto.alternarEstadoEntradaFlejeMenu(fila);
    assert.equal(fila.dataset.estado, '1');
    assert.equal(fila.classList.contains('fleje-estado-1'), true);
    fallarSeleccion = true;
    await contexto.alternarEstadoEntradaFlejeMenu(fila);
    assert.equal(fila.dataset.estado, '1', 'Un error PHP conserva la selección confirmada');
    assert.equal(fila.dataset.loading, '0');
    assert.deepEqual(llamadas, [
        ['GET', './api/entradas_flejes.php'],
        ['POST', './api/entradas_flejes.php', 7, 1],
        ['POST', './api/entradas_flejes.php', 7, 0],
    ]);
    console.log('OK: carga y selección PHP, sin WebSocket, y fallo sin selección falsa.');
})().catch(error => { console.error(error); process.exitCode = 1; });
