const consumoLotes = { stock: [], botas: [], fondos: [], cubicajes: {}, cargando: false, guardando: false, cargado: false };
const campoConsumoLotes = nombre => document.getElementById(`consumo-lotes-${nombre}`);

function esConsumoMaderaLotes() {
    return contextoNavegacion.consumoOrigen !== 'palets_fleje';
}

async function peticionConsumoLotes(url, datos) {
    const token = window.SharedAuthToken?.getToken?.();
    const respuesta = await fetch(url, {
        method: datos ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store',
        headers: { ...(datos ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        ...(datos ? { body: JSON.stringify(datos) } : {}),
    });
    const resultado = await respuesta.json();
    if (!respuesta.ok || !resultado.ok) throw new Error(resultado.error || 'No se pudieron cargar los lotes.');
    return resultado;
}

function opcionesConsumoLotes(selector, opciones, titulo) {
    const anterior = selector.value;
    selector.replaceChildren(new Option(titulo, ''));
    for (const [id, texto] of opciones) selector.add(new Option(texto, String(id)));
    if ([...selector.options].some(op => op.value === anterior)) selector.value = anterior;
}

function cargarCubicajesConsumoLotes(lista) {
    const cubicajes = {};
    lista = Array.isArray(lista) ? lista : [];
    lista.forEach(item => { if (item?.tipo_producto_id != null) cubicajes[String(item.tipo_producto_id)] = Number(item.cubicaje_estandar) || 0; });
    consumoLotes.cubicajes = cubicajes;
}

function actualizarCubicajeConsumoLotes() {
    const origen = consumoLotes.stock.find(lote => String(lote.id) === campoConsumoLotes('origen').value);
    const valor = origen ? consumoLotes.cubicajes[String(origen.tipo_producto_id)] : undefined;
    const input = campoConsumoLotes('cubicaje');
    if (input) input.value = Number.isFinite(valor) && valor > 0 ? String(valor) : '';
    actualizarFormularioConsumoLotes();
}

function pintarOrigenesConsumoLotes() {
    const origenAnterior = campoConsumoLotes('origen').value;
    const filtros = [['tipo', 'tipo_producto_id'], ['material', 'material_id'], ['ubicacion', 'ubicacion_id']];
    const nombre = campoConsumoLotes('buscar').value.trim().toLocaleLowerCase('es');
    const lotes = consumoLotes.stock.filter(lote => filtros.every(([campo, clave]) => !campoConsumoLotes(campo).value || String(lote[clave]) === campoConsumoLotes(campo).value)
        && (!nombre || lote.codigo.toLocaleLowerCase('es').includes(nombre)));
    opcionesConsumoLotes(campoConsumoLotes('origen'), lotes.map(lote => [lote.id, `${lote.codigo}${lote.objetivo === 'ALMACENADO' ? ' (ALMACENADO)' : ''} — ${formatearNumeroFabricacion(Number(lote.cubicaje) - Number(lote.consumido))} m³ restantes`]), 'Seleccione lote de stock...');
    if (campoConsumoLotes('origen').value !== origenAnterior) actualizarCubicajeConsumoLotes();
    actualizarFormularioConsumoLotes();
}

function actualizarFormularioConsumoLotes() {
    const fondos = campoConsumoLotes('destino').value === 'fondos';
    const origen = consumoLotes.stock.find(lote => String(lote.id) === campoConsumoLotes('origen').value);
    const cubicaje = Number(campoConsumoLotes('cubicaje').value);
    const paquetes = Number(campoConsumoLotes('paquetes').value);
    const destino = fondos ? campoConsumoLotes('fondos').value : campoConsumoLotes('nombre').value.trim();
    campoConsumoLotes('agregar').disabled = consumoLotes.cargando || consumoLotes.guardando || !consumoLotes.cargado || !origen || !destino
        || cubicaje <= 0 || !Number.isInteger(paquetes) || paquetes < 1 || cubicaje * paquetes > Number(origen.cubicaje) - Number(origen.consumido) + 0.0000001;
}

function limpiarFormularioConsumoLotes() {
    for (const campo of ['tipo', 'material', 'ubicacion', 'origen', 'fondos']) campoConsumoLotes(campo).value = '';
    for (const campo of ['buscar', 'cubicaje', 'nombre']) campoConsumoLotes(campo).value = '';
    campoConsumoLotes('paquetes').value = '1';
    campoConsumoLotes('mensaje').textContent = '';
    pintarOrigenesConsumoLotes();
}

function pintarDestinoConsumoLotes() {
    const fondos = campoConsumoLotes('destino').value === 'fondos';
    campoConsumoLotes('nombre-fila').classList.toggle('d-none', fondos);
    campoConsumoLotes('fondos-fila').classList.toggle('d-none', !fondos);
    campoConsumoLotes('titulo').textContent = fondos ? 'Lotes fondos' : 'Lotes de botas';
    const contenedor = campoConsumoLotes('listado');
    contenedor.replaceChildren();
    const lotes = fondos ? consumoLotes.fondos : consumoLotes.botas;
    if (!lotes.length) contenedor.textContent = fondos ? 'No hay lotes de fondos.' : 'No hay lotes de botas.';
    else {
        const tabla = document.createElement('table');
        tabla.className = 'table table-bordered table-sm';
        const cabecera = tabla.createTHead().insertRow();
        for (const nombre of [fondos ? 'Lote' : 'Lote', 'Madera', 'M³ total', 'M³ consumido', 'M³ restante']) {
            const th = document.createElement('th'); th.scope = 'col'; th.textContent = nombre; cabecera.appendChild(th);
        }
        const cuerpo = tabla.createTBody();
        for (const lote of lotes) {
            const fila = cuerpo.insertRow();
            fila.dataset.loteCodigo = lote.codigo;
            fila.tabIndex = 0;
            [lote.codigo, lote.material_descripcion || '—', lote.cubicaje, lote.consumido, Number(lote.cubicaje) - Number(lote.consumido)].forEach((valor, indice) => {
                const celda = fila.insertCell(); celda.textContent = indice < 2 ? valor : formatearNumeroFabricacion(valor);
                if (indice === 4 && Number(valor) < 0) celda.className = 'text-danger fw-bold';
            });
        }
        contenedor.appendChild(tabla);
    }
    actualizarFormularioConsumoLotes();
}

async function cargarConsumoLotes() {
    if (consumoLotes.cargando) return;
    consumoLotes.cargando = true;
    actualizarFormularioConsumoLotes();
    try {
        await asegurarDatosFabricacionTerminal();
        const datos = await peticionConsumoLotes('./api/consumo_lotes.php');
        cargarCubicajesConsumoLotes(datos.cubicajes);
        for (const clave of ['stock', 'botas', 'fondos']) {
            if (!Array.isArray(datos[clave])) throw new Error('Respuesta de lotes no válida.');
            consumoLotes[clave] = datos[clave];
        }
        consumoLotes.cargado = true;
        for (const [campo, clave, descripcion, titulo] of [
            ['tipo', 'tipo_producto_id', 'tipo_descripcion', 'Todas las duelas'],
            ['material', 'material_id', 'material_descripcion', 'Todas las maderas'],
            ['ubicacion', 'ubicacion_id', 'ubicacion_descripcion', 'Todas las ubicaciones'],
        ]) {
            const opciones = new Map(consumoLotes.stock.filter(l => l[clave] !== null).map(l => [l[clave], l[descripcion] || String(l[clave])]));
            opcionesConsumoLotes(campoConsumoLotes(campo), opciones, titulo);
        }
        opcionesConsumoLotes(campoConsumoLotes('fondos'), consumoLotes.fondos.map(lote => [lote.codigo, lote.codigo]), 'Seleccione lote de fondos...');
        campoConsumoLotes('nombres').replaceChildren(...consumoLotes.botas.map(lote => new Option(lote.codigo, lote.codigo)));
        pintarOrigenesConsumoLotes();
        pintarDestinoConsumoLotes();
    } catch (error) {
        consumoLotes.cargado = false;
        throw error;
    } finally {
        consumoLotes.cargando = false;
        actualizarFormularioConsumoLotes();
    }
}

async function abrirConsumoLotes() {
    document.getElementById('panelConsumo').classList.add('d-none');
    document.getElementById('panelConsumoLotes').classList.remove('d-none');
    campoConsumoLotes('mensaje').textContent = 'Cargando lotes...';
    const resultados = await Promise.allSettled([
        cargarConsumoLotes(),
        peticionConsumoLotes('./api/fabricacion.php').then(datos => {
            if (typeof renderResumenFabricacionSemanalConsumo === 'function') {
                renderResumenFabricacionSemanalConsumo(datos.fabricaciones || [], 'consumo-lotes-fabricaciones');
            }
        }),
    ]);
    campoConsumoLotes('mensaje').textContent = resultados.filter(r => r.status === 'rejected').map(r => r.reason.message).join(' ');
}

async function guardarConsumoLotes() {
    if (consumoLotes.guardando || campoConsumoLotes('agregar').disabled) return;
    const destino = campoConsumoLotes('destino').value;
    const datos = {
        destino, origen_id: Number(campoConsumoLotes('origen').value),
        codigo_destino: destino === 'fondos' ? campoConsumoLotes('fondos').value : campoConsumoLotes('nombre').value.trim(),
        cubicaje: campoConsumoLotes('cubicaje').value, paquetes: Number(campoConsumoLotes('paquetes').value),
    };
    const origen = consumoLotes.stock.find(lote => String(lote.id) === String(datos.origen_id));
    const cantidadTransaccion = Number(datos.cubicaje) * datos.paquetes;
    consumoLotes.guardando = true;
    actualizarFormularioConsumoLotes();
    let guardado = false;
    try {
        await peticionConsumoLotes('./api/consumo_lotes.php', datos);
        guardado = true;
        if (destino === 'fondos') campoConsumoLotes('fondos').value = '';
        else campoConsumoLotes('nombre').value = '';
        campoConsumoLotes('cubicaje').value = '';
        campoConsumoLotes('paquetes').value = '1';
        await cargarConsumoLotes();
        campoConsumoLotes('mensaje').textContent = `Transacción: lote ${origen?.codigo || datos.origen_id}, cantidad ${formatearNumeroFabricacion(cantidadTransaccion)}, destino ${datos.codigo_destino}.`;
    } catch (error) {
        campoConsumoLotes('mensaje').textContent = guardado ? `Movimiento guardado. No se pudo actualizar la pantalla: ${error.message}` : error.message;
    } finally {
        consumoLotes.guardando = false;
        actualizarFormularioConsumoLotes();
    }
}

function prepararEventosConsumoLotes() {
    campoConsumoLotes('destino').addEventListener('change', () => {
        limpiarFormularioConsumoLotes();
        pintarDestinoConsumoLotes();
    });
    campoConsumoLotes('listado').addEventListener('click', event => {
        const fila = event.target.closest('tr[data-lote-codigo]');
        if (!fila) return;
        if (campoConsumoLotes('destino').value === 'fondos') {
            campoConsumoLotes('fondos').value = fila.dataset.loteCodigo || '';
        } else {
            campoConsumoLotes('nombre').value = fila.dataset.loteCodigo || '';
        }
        actualizarFormularioConsumoLotes();
    });
    for (const campo of ['tipo', 'material', 'ubicacion']) campoConsumoLotes(campo).addEventListener('change', pintarOrigenesConsumoLotes);
    campoConsumoLotes('buscar').addEventListener('input', pintarOrigenesConsumoLotes);
    for (const campo of ['origen', 'cubicaje', 'paquetes', 'nombre', 'fondos']) campoConsumoLotes(campo).addEventListener('input', actualizarFormularioConsumoLotes);
    campoConsumoLotes('origen').addEventListener('change', () => {
        const lote = consumoLotes.stock.find(l => String(l.id) === campoConsumoLotes('origen').value);
        if (lote) campoConsumoLotes('nombre').value = lote.codigo;
        actualizarCubicajeConsumoLotes();
    });
    campoConsumoLotes('agregar').addEventListener('click', guardarConsumoLotes);
}
