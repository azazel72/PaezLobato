const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const state = { lotes: [] };
const context = vm.createContext({ cierreSemanalPhp: state });
for (const file of ['terminal-cierre-semanal-acciones.js', 'terminal-cierre-enviar-restante.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../terminal/js', file), 'utf8'), context);
}
context.iniciarBorradorLotesCierrePhp([
    {id: 1, codigo: 'A', cubicaje: '2.0000', consumido: '0.5000'},
    {id: 2, codigo: 'B', cubicaje: '1.0000', consumido: '1.2000'},
]);
const before = JSON.stringify(state.lotes);
for (const [dest, amount] of [[1, '0.1'], [2, '-0.1'], [2, '0'], [2, '1.5001']]) {
    assert.throws(() => context.aplicarEnvioRestanteCierrePhp(1, dest, amount));
    assert.equal(JSON.stringify(state.lotes), before);
}
context.aplicarEnvioRestanteCierrePhp(1, 2, '0.5000');
assert.equal(state.lotes[0].cubicaje, '1.5000');
assert.equal(state.lotes[1].cubicaje, '1.5000');
assert.equal(state.lotes[0].consumido, '0.5000');
assert.equal(state.lotes[1].consumido, '1.2000');
context.aplicarEnvioRestanteCierrePhp(1, 2, '1.0000');
assert.equal(state.lotes[0].cubicaje, '0.5000');
assert.throws(() => context.aplicarEnvioRestanteCierrePhp(1, 2, '0.0001'));
assert.equal(vm.runInContext('borradorLotesCierrePhp.operaciones.length', context), 2);
console.log('OK: envío virtual acumulado, conservación de material, consumos intactos y límites.');
context.iniciarBorradorLotesCierrePhp([{id:1,codigo:'A',cubicaje:'2.0000',consumido:'0.5000'}]);
context.aplicarSalidaLoteCierrePhp('procesado',1,'0.4000','DESTINO',1);
assert.equal(state.lotes[0].cubicaje,'1.6000');
assert.equal(state.lotes[0].consumido,'0.5000');
context.aplicarSalidaLoteCierrePhp('desperdicio',1,'1.1000');
assert.equal(state.lotes[0].cubicaje,'1.6000');
assert.equal(state.lotes[0].consumido,'1.6000');
console.log('OK: borrador de almacenado y desperdicio conserva la nueva separación cubicaje/consumo.');
