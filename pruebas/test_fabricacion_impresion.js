const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function entorno({ fallarImpresion = false, respuestaPhp = null } = {}) {
    const llamadas = { php: [], impresion: [], avisos: [], orden: [] };
    const elementos = {
        'fabricar-bota-batidero': { value: '11' },
        'fabricar-bota-operario-fondado': { value: '7' },
        'fabricar-bota-cantidad-etiquetas': { value: '2' },
        'fabricar-bota-imprimir': {},
    };
    const almacen = new Map();
    const contexto = {
        console: { info() {}, warn() {}, error() {} },
        document: { addEventListener() {}, getElementById: id => elementos[id] },
        sessionStorage: { getItem: key => almacen.get(key), setItem: (key, value) => almacen.set(key, value), removeItem: key => almacen.delete(key) },
        conn: { socket: { readyState: 1 } }, WebSocket: { OPEN: 1 },
        lineaFabricacionActualId: 28,
        lotesBotasMovil: [{ id: 129, estado: 1 }, { id: 130, estado: 0 }],
        lotesFondosMovil: [{ id: 3, estado: 1 }],
        alert: msg => { llamadas.avisos.push(msg); llamadas.orden.push('aviso'); },
        POST: async (url, datos) => { llamadas.php.push({ url, datos }); return respuestaPhp || { ok: true, codigos: ['BOTA1', 'BOTA2'] }; },
        wsRequest: async (accion, datos) => {
            llamadas.impresion.push({ accion, datos });
            if (fallarImpresion) { fallarImpresion = false; throw new Error('Impresora desconectada'); }
            return { ok: true };
        },
    };
    vm.createContext(contexto);
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/terminal-fabricacion-impresion.js'), 'utf8'), contexto);
    contexto.refrescarFabricacionTrasCrearBotas = async () => { llamadas.orden.push('refresco'); };
    return { contexto, llamadas, elementos, almacen };
}

(async () => {
    for (const quitar of [
        e => { e.contexto.lineaFabricacionActualId = null; },
        e => { e.contexto.lotesBotasMovil = []; },
        e => { e.contexto.lotesFondosMovil = []; },
        e => { e.contexto.lotesFondosMovil.push({ id: 4, estado: 1 }); },
        e => { e.elementos['fabricar-bota-batidero'].value = ''; },
        e => { e.elementos['fabricar-bota-operario-fondado'].value = ''; },
        e => { e.elementos['fabricar-bota-cantidad-etiquetas'].value = '0'; },
        e => { e.elementos['fabricar-bota-cantidad-etiquetas'].value = '1.5'; },
    ]) {
        const incompleto = entorno();
        quitar(incompleto);
        incompleto.contexto.actualizarBotonImpresionBotas();
        assert.equal(incompleto.elementos['fabricar-bota-imprimir'].disabled, true, 'Falta un requisito: botón deshabilitado');
        await incompleto.contexto.fabricarEImprimirBotasDesdePhp();
        assert.equal(incompleto.llamadas.php.length, 0, 'También se valida al invocar la impresión');
        assert.equal(incompleto.llamadas.impresion.length, 0);
    }
    const normal = entorno();
    normal.contexto.actualizarBotonImpresionBotas();
    assert.equal(normal.elementos['fabricar-bota-imprimir'].disabled, false, 'Selección completa: impresión habilitada');
    await normal.contexto.fabricarEImprimirBotasDesdePhp();
    assert.equal(normal.llamadas.php.length, 1);
    assert.equal(normal.llamadas.php[0].url, './api/fabricacion_crear_botas.php');
    assert.deepEqual(JSON.parse(JSON.stringify(normal.llamadas.php[0].datos.lotes_botas_ids)), [129]);
    assert.deepEqual(JSON.parse(JSON.stringify(normal.llamadas.impresion[0].datos)), { codigos: ['BOTA1', 'BOTA2'] });
    assert.equal(normal.almacen.size, 0);
    assert.deepEqual(normal.llamadas.orden, ['refresco', 'aviso'], 'Se refresca antes del aviso bloqueante');

    const errorPhp = entorno({ respuestaPhp: { ok: false, error: 'Receta incompleta' } });
    await errorPhp.contexto.fabricarEImprimirBotasDesdePhp();
    assert.equal(errorPhp.llamadas.impresion.length, 0, 'Sin OK de PHP nunca se imprime');
    assert(errorPhp.llamadas.avisos.includes('Receta incompleta'));

    const reintento = entorno({ fallarImpresion: true });
    await reintento.contexto.fabricarEImprimirBotasDesdePhp();
    assert.equal(reintento.almacen.size, 1);
    assert.equal(reintento.elementos['fabricar-bota-imprimir'].disabled, false, 'Se pueden reimprimir los códigos ya creados');
    assert.deepEqual(reintento.llamadas.orden, ['refresco', 'aviso'], 'Si falla la impresora también se refrescan las botas ya creadas');
    assert.match(reintento.elementos['fabricar-bota-imprimir'].innerHTML, /Reintentar/);
    await reintento.contexto.fabricarEImprimirBotasDesdePhp();
    assert.equal(reintento.llamadas.php.length, 1, 'Un fallo de impresora no vuelve a crear botas');
    assert.equal(reintento.llamadas.impresion.length, 2);
    assert.deepEqual(reintento.llamadas.impresion[0].datos, reintento.llamadas.impresion[1].datos);
    assert.equal(reintento.almacen.size, 0);

    const dobleClic = entorno();
    await Promise.all([dobleClic.contexto.fabricarEImprimirBotasDesdePhp(), dobleClic.contexto.fabricarEImprimirBotasDesdePhp()]);
    assert.equal(dobleClic.llamadas.php.length, 1);
    assert.equal(dobleClic.llamadas.impresion.length, 1);
    const desconectado = entorno();
    desconectado.contexto.conn.socket.readyState = 3;
    await desconectado.contexto.fabricarEImprimirBotasDesdePhp();
    assert.equal(desconectado.llamadas.php.length, 0);
    console.log('OK: PHP antes de imprimir, solo códigos, reintento sin fabricar, doble clic y desconexión.');
})().catch(error => { console.error(error); process.exitCode = 1; });
