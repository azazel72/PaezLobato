const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const state = {
    lotes: [{ id: 1, codigo: 'BOTAS', tipo_descripcion: 'Duela 90', cubicaje: '2.0000', consumido: '2.1000' }],
    opcionesProcesado: { lotes: [{ codigo: 'DESTINO', ubicacion_id: 3, tipo_descripcion: 'Duela 90', cubicaje: '1.0000', consumido: '0.2000' }] },
};
const context = vm.createContext({ cierreSemanalPhp: state });
vm.runInContext(fs.readFileSync(path.join(__dirname, '../terminal/js/terminal-cierre-semanal-acciones.js'), 'utf8'), context);
assert.equal(context.etiquetaLoteComboCierrePhp(state.lotes[0]), 'BOTAS · Duela 90 · Restante: -0.1000 m³');
vm.runInContext(`borradorLotesCierrePhp.operaciones.push(
    {tipo:'procesado', origen_id:1, codigo_destino:'DESTINO', ubicacion_id:3, cantidad:'0.1000'},
    {tipo:'procesado', origen_id:1, codigo_destino:'DESTINO', ubicacion_id:3, cantidad:'0.2000'},
    {tipo:'procesado', origen_id:1, codigo_destino:'NUEVO', ubicacion_id:4, cantidad:'0.4000'}
);`, context);
const result = context.lotesProcesadoVirtualesCierrePhp();
assert.equal(result[0].cubicaje, '1.3000');
assert.match(context.etiquetaLoteComboCierrePhp(result[0]), /Restante: 1\.1000 m³/);
assert.equal(result[1].tipo_descripcion, 'Duela 90');
assert.equal(result[1].cubicaje, '0.4000');
assert.equal(state.opcionesProcesado.lotes[0].cubicaje, '1.0000', 'La vista virtual no modifica la base');
state.lotes[0].consumido = '0.5000';
assert.match(context.etiquetaLoteComboCierrePhp(state.lotes[0]), /Restante: 1\.5000 m³/);
vm.runInContext('borradorLotesCierrePhp.operaciones = [];', context);
assert.equal(context.lotesProcesadoVirtualesCierrePhp().length, 1);
console.log('OK: etiquetas de duela, restante virtual, operaciones acumuladas, nuevos destinos y restablecimiento.');

function reset() {
    context.iniciarBorradorLotesCierrePhp([
        { id: 1, codigo: 'NEGATIVO', cubicaje: '1.0000', consumido: '1.2000' },
        { id: 2, codigo: 'POSITIVO', cubicaje: '1.0000', consumido: '0.5000' },
        { id: 3, codigo: 'SIN HUECO', cubicaje: '1.0000', consumido: '1.0000' },
    ]);
}
reset();
assert.throws(() => context.aplicarReasignacionLoteCierrePhp('consumo', 1, 2, '-0.1'));
assert.throws(() => context.aplicarReasignacionLoteCierrePhp('consumo', 1, 2, '0'));
assert.throws(() => context.aplicarReasignacionLoteCierrePhp('consumo', 1, 3, '0.1'), /negativo/);
context.aplicarReasignacionLoteCierrePhp('recibir_consumo', 2, 1, '0.1');
assert.equal(state.lotes[0].consumido, '1.1000', 'El origen puede conservar restante negativo');
assert.equal(state.lotes[1].consumido, '0.6000');
reset();
assert.throws(() => context.aplicarReasignacionLoteCierrePhp('consumo', 1, 2, '0.3'), /supera/);
context.aplicarReasignacionLoteCierrePhp('consumo', 1, 2, '0.2000');
assert.equal(state.lotes[0].consumido, '1.0000');
assert.equal(state.lotes[1].consumido, '0.7000');
assert.throws(() => context.aplicarReasignacionLoteCierrePhp('consumo', 1, 2, '0.1'), /dirección/);
reset();
context.aplicarReasignacionLoteCierrePhp('recibir_consumo', 2, 1, '0.3000');
assert.equal(state.lotes[0].consumido, '0.9000');
assert.equal(state.lotes[1].consumido, '0.8000');
console.log('OK: reasignación por signo y recepción parcial desde origen con restante negativo.');
