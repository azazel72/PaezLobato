const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
function Option(text, value) { this.text = text; this.value = String(value); }
function campo() {
    return { value: '', options: [], disabled: false, addEventListener() {},
        replaceChildren(...opciones) { this.options = opciones; this.value = opciones[0]?.value || ''; },
        add(opcion) { this.options.push(opcion); } };
}
const campos = Object.fromEntries(['tipo-producto','material','ubicacion-origen','origen','ubicacion-destino','lote-destino','nombres-destino','cubicaje','paquetes','total','procesar','estado'].map(nombre => [`procesarstock-${nombre}`,campo()]));
campos['procesarstock-paquetes'].value = '1';
const llamadas = [];
let fallo = false;
let falloCarga = false;
const contexto = {
    console, Option, window: {},
    document: { getElementById: id => campos[id] },
    wsRequest() { throw new Error('Procesar no debe depender de Python'); },
    fetch: async (url, opciones) => {
        llamadas.push([url, opciones.method]);
        if (falloCarga && opciones.method === 'GET') throw new Error('Carga fallida');
        let datos;
        if (opciones.method === 'POST') {
            if (fallo) return { ok: false, json: async () => ({ ok: false, error: 'Saldo insuficiente' }) };
            const payload = JSON.parse(opciones.body);
            assert.equal(payload.ubicacion_id, 2);
            assert.equal(payload.codigo_destino, 'EDITADO');
            assert.equal(payload.cubicaje, '0.25');
            datos = { ok: true, codigo_destino: payload.codigo_destino };
        } else if (url.includes('opciones_procesado')) {
            datos = { ok: true, ubicaciones: [{ id: 1, descripcion: 'Origen' },{ id: 2, descripcion: 'Otra' }], lotes: [{ codigo: 'LOTE-A', ubicacion_id: 1 },{ codigo: 'LOTE-B', ubicacion_id: 2 }] };
        } else {
            datos = { ok: true, stock: [
                { id: 10, codigo: 'ORIGEN#1', codigo_destino: 'ORIGEN', cubicaje: 1, consumido: 0, tipo_producto_id: 7, material_id: 4, ubicacion_id: 1 },
                { id: 11, codigo: 'OTRO#1', codigo_destino: 'OTRO', cubicaje: 1, consumido: 0, tipo_producto_id: 8, material_id: 4, ubicacion_id: 2 },
            ], cubicajes: [{ tipo_producto_id: 7, cubicaje_estandar: 0.25 },{ tipo_producto_id: 8, cubicaje_estandar: 0.5 }] };
        }
        return { ok: true, json: async () => datos };
    },
};
vm.createContext(contexto);
for (const archivo of ['terminal-consumo-lotes.js','terminal-procesar-stock.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname,'../js',archivo),'utf8'),contexto);
}
const valor = nombre => campos[`procesarstock-${nombre}`];
(async () => {
    await contexto.cargarFormularioProcesarStock();
    assert.equal(valor('ubicacion-destino').value,'1','Destino predeterminado igual al origen');
    assert.equal(valor('lote-destino').value,'ORIGEN','Nombre propuesto por PHP');
    assert.equal(valor('cubicaje').value,'0.25','Cubicaje del tipo real del origen, sin filtro seleccionado');
    assert.equal(valor('procesar').disabled,false);
    valor('origen').value = '11'; contexto.autocompletarProcesarStockDesdeOrigen();
    assert.equal(valor('ubicacion-destino').value,'2');
    assert.equal(valor('lote-destino').value,'OTRO');
    assert.equal(valor('cubicaje').value,'0.5');
    valor('tipo-producto').value = '7'; contexto.actualizarOrigenesProcesarStock();
    assert.equal(valor('origen').value,'10','Filtro de tipo selecciona solo su origen');
    valor('ubicacion-destino').value = '2'; contexto.actualizarNombresDestinoProcesarStock();
    assert.deepEqual(valor('nombres-destino').options.map(op => op.value),['LOTE-B']);
    valor('lote-destino').value = 'EDITADO';
    fallo = true;
    await contexto.procesarStockDesdeVistaNueva();
    assert.match(valor('estado').textContent,/Saldo insuficiente/);
    assert.equal(valor('lote-destino').value,'EDITADO','Error conserva el formulario');
    fallo = false;
    await Promise.all([contexto.procesarStockDesdeVistaNueva(),contexto.procesarStockDesdeVistaNueva()]);
    assert.equal(llamadas.filter(([,metodo]) => metodo === 'POST').length,2,'Un error y un envío confirmado; doble clic no duplica');
    assert.match(valor('estado').textContent,/correctamente.*EDITADO/);
    falloCarga = true;
    await contexto.cargarFormularioProcesarStock();
    assert.equal(valor('procesar').disabled,true,'Carga fallida deshabilita el envío');
    console.log('OK: combos PHP, origen/destino, nombre editable, sugerencias, cubicaje, errores y doble clic.');
})().catch(error => { console.error(error); process.exitCode = 1; });
