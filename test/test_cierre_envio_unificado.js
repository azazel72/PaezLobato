const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
class Element {
    constructor(tag, className, textContent) { Object.assign(this, { tag, className, textContent, dataset: {}, children: [], events: {}, value: '' }); }
    appendChild(element) { this.children.push(element); return element; }
    setAttribute(name, value) { this[name] = value; }
    addEventListener(name, handler) { this.events[name] = handler; }
}
const state = { lotes: [], opcionesProcesado: { ubicaciones: [{ id: 8, descripcion: 'Almacén' }], lotes: [] } };
const context = vm.createContext({ cierreSemanalPhp: state, elementoCierrePhp: (...args) => new Element(...args) });
for (const name of ['terminal-cierre-semanal-acciones.js', 'terminal-cierre-enviar-restante.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../terminal/js', name), 'utf8'), context);
}
const find = (node, predicate) => predicate(node) ? node : node.children.map(child => find(child, predicate)).find(Boolean);
context.iniciarBorradorLotesCierrePhp([
    { id: 1, codigo: 'A', cubicaje: '2.0000', consumido: '0.5000' },
    { id: 2, codigo: 'B', cubicaje: '1.0000', consumido: '1.2000' },
]);
const form = context.crearAccionEnviarRestanteCierrePhp(state.lotes[0]);
const mode = find(form, node => node.dataset.cierreEnvioTipo);
const lot = find(form, node => node.dataset.cierreEnvioLote);
const amount = find(form, node => node.dataset.cierreEnvioCantidad);
const button = find(form, node => node.tag === 'button');
const processing = find(form, node => node.dataset.cierreProcesadoCodigo);
assert.equal(button.disabled, true, 'Otro lote requiere selección');
lot.value = '2'; lot.events.change(); assert.equal(button.disabled, false);
assert.equal(amount.max, '1.5000'); assert.equal(amount.readOnly, false);
mode.value = 'procesado'; mode.events.change();
assert.equal(lot.hidden, true); assert.equal(amount.min, '0.0001');
assert.equal(button.textContent, 'Enviar a procesar'); assert(processing);
mode.value = 'desperdicio'; mode.events.change();
assert.equal(amount.readOnly, true); assert.equal(amount.value, '1.5000');
assert.equal(button.textContent, 'Enviar a desperdicio');
mode.value = 'restante'; mode.events.change();
assert.equal(lot.hidden, false); assert.equal(amount.readOnly, false);
const negative = context.crearAccionEnviarRestanteCierrePhp(state.lotes[1]);
const negativeMode = find(negative, node => node.dataset.cierreEnvioTipo);
assert.equal(negativeMode.value, 'desperdicio');
assert(negativeMode.children.filter(option => option.value !== 'desperdicio').every(option => option.disabled));
assert.equal(find(negative, node => node.dataset.cierreEnvioCantidad).value, '-0.2000');
assert.equal(context.crearAccionEnviarRestanteCierrePhp({ cubicaje: '1', consumido: '1' }), null);
console.log('OK: selector único, destinos y campos adaptables, límites y desperdicio negativo conservado.');
