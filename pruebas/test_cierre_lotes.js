const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const originales = [
    {id: 1, codigo: 'A', cubicaje: '1.0000', consumido: '1.2000', contador_botas: 8},
    {id: 2, codigo: 'B', cubicaje: '1.0000', consumido: '0.2000', contador_botas: 5},
    {id: 3, codigo: 'C', cubicaje: '0.5000', consumido: '0.0000', contador_botas: 0},
];
const peticiones = [];
let fallo = false;
const contexto = {
    console: {info() {}, error() {}}, cierreSemanalPhp: {activo: true, lotes: []},
    window: {}, alert() {}, pintarLotesCierrePhp() {},
    fetch: async (url, options) => {
        peticiones.push({url, body: JSON.parse(options.body)});
        return {ok: !fallo, json: async () => fallo ? {ok: false, error: 'Conflicto'} : {ok: true, lotes: contexto.cierreSemanalPhp.lotes.map(l => ({...l}))}};
    },
};
vm.createContext(contexto);
vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/terminal-cierre-semanal-acciones.js'), 'utf8'), contexto);
const snapshot = () => JSON.stringify(contexto.cierreSemanalPhp.lotes);
const consumo = id => contexto.cierreSemanalPhp.lotes.find(l => l.id === id).consumido;
(async () => {
    contexto.iniciarBorradorLotesCierrePhp(originales);
    contexto.aplicarReasignacionLoteCierrePhp('consumo', 1, 2, '0.2000');
    assert.equal(consumo(1), '1.0000');
    assert.equal(consumo(2), '0.4000');
    contexto.aplicarReasignacionLoteCierrePhp('recibir_consumo', 3, 2, '0.1000');
    assert.equal(consumo(2), '0.3000');
    assert.equal(consumo(3), '0.1000');
    assert.equal(peticiones.length, 0, 'Editar no guarda ni recarga');
    assert.equal(originales[0].consumido, '1.2000', 'Se conserva la copia original');
    for (const [tipo, desde, otro, cantidad] of [
        ['consumo',1,1,'0.1'], ['consumo',1,2,'-0.1'], ['consumo',1,2,'0'],
        ['consumo',1,2,'0.00001'], ['recibir_consumo',3,1,'0.4500'], ['consumo',2,1,'0.4000'],
    ]) {
        const antes = snapshot();
        assert.throws(() => contexto.aplicarReasignacionLoteCierrePhp(tipo,desde,otro,cantidad));
        assert.equal(snapshot(), antes, 'Una operación inválida no altera el borrador');
    }
    await contexto.confirmarLotesCierrePhp();
    assert.equal(peticiones.length, 1);
    assert.deepEqual(peticiones[0].body.operaciones[1], {tipo:'consumo', origen_id:2, destino_id:3, cantidad:'0.1000'});
    assert.equal(vm.runInContext('borradorLotesCierrePhp.operaciones.length',contexto),0);
    assert.deepEqual(contexto.cierreSemanalPhp.lotes.map(l=>l.cubicaje),originales.map(l=>l.cubicaje));
    assert.deepEqual(contexto.cierreSemanalPhp.lotes.map(l=>l.contador_botas),originales.map(l=>l.contador_botas));
    contexto.aplicarReasignacionLoteCierrePhp('consumo',1,2,'0.1000');
    fallo = true;
    await contexto.confirmarLotesCierrePhp();
    assert.equal(vm.runInContext('borradorLotesCierrePhp.operaciones.length',contexto),1,'Se conserva el borrador si falla el guardado');
    contexto.restablecerLotesCierrePhp();
    assert.equal(consumo(1),'1.0000');
    assert.equal(consumo(2),'0.3000');
    assert.equal(vm.runInContext('borradorLotesCierrePhp.operaciones.length',contexto),0);
    contexto.aplicarSalidaLoteCierrePhp('desperdicio', 2, '0.2000');
    contexto.aplicarSalidaLoteCierrePhp('procesado', 3, '0.1000', 'PROCESADO');
    assert.equal(consumo(2), '0.5000');
    assert.equal(consumo(3), '0.2000');
    const antesSalida = snapshot();
    assert.throws(() => contexto.aplicarSalidaLoteCierrePhp('desperdicio', 3, '0.3001'));
    assert.throws(() => contexto.aplicarSalidaLoteCierrePhp('procesado', 3, '0.1', ''));
    assert.equal(snapshot(), antesSalida);
    contexto.restablecerLotesCierrePhp();
    assert.equal(consumo(2), '0.3000');
    assert.equal(consumo(3), '0.1000');
    console.log('OK: reasignaciones, procesado, desperdicio, límites, memoria, confirmación y restablecer.');
})().catch(error=>{console.error(error);process.exitCode=1;});
