const terminalProcesarStock = { stock: [], cubicajes: {}, ubicaciones: [], lotesDestino: [], cargando: false, guardando: false, cargado: false };
const campoProcesarStock = nombre => document.getElementById(`procesarstock-${nombre}`);

function prepararEventosProcesarStock() {
    for (const nombre of ['tipo-producto', 'material', 'ubicacion-origen']) {
        campoProcesarStock(nombre)?.addEventListener('change', actualizarOrigenesProcesarStock);
    }
    for (const evento of ['input', 'change']) {
        campoProcesarStock('origen')?.addEventListener(evento, autocompletarProcesarStockDesdeOrigen);
    }
    campoProcesarStock('ubicacion-destino')?.addEventListener('change', () => {
        actualizarNombresDestinoProcesarStock();
        actualizarEstadoBotonProcesarStock();
    });
    for (const nombre of ['cubicaje', 'paquetes', 'lote-destino']) {
        for (const evento of ['input', 'change']) {
            campoProcesarStock(nombre)?.addEventListener(evento, actualizarEstadoBotonProcesarStock);
        }
    }
    const boton = campoProcesarStock('procesar');
    if (boton) {
        boton.disabled = true;
        boton.addEventListener('click', procesarStockDesdeVistaNueva);
    }
    document.getElementById('form-procesar-stock')?.addEventListener('submit', event => event.preventDefault());
}

async function cargarFormularioProcesarStock() {
    if (terminalProcesarStock.cargando || terminalProcesarStock.guardando) return;
    terminalProcesarStock.cargando = true;
    terminalProcesarStock.cargado = false;
    actualizarEstadoBotonProcesarStock();
    setEstadoProcesarStock('Cargando stock...', 'muted');
    try {
        const [datos, opciones] = await Promise.all([
            peticionConsumoLotes('../api/terminal/procesar_stock.php'),
            peticionConsumoLotes('../api/terminal/opciones_procesado.php'),
        ]);
        terminalProcesarStock.stock = datos.stock;
        terminalProcesarStock.cubicajes = Object.fromEntries(datos.cubicajes.map(item => [String(item.tipo_producto_id), Number(item.cubicaje_estandar)]));
        terminalProcesarStock.ubicaciones = opciones.ubicaciones;
        terminalProcesarStock.lotesDestino = opciones.lotes;
        for (const [campo, clave, descripcion, titulo] of [
            ['tipo-producto', 'tipo_producto_id', 'tipo_descripcion', 'Todas las duelas'],
            ['material', 'material_id', 'material_descripcion', 'Todas las maderas'],
            ['ubicacion-origen', 'ubicacion_id', 'ubicacion_descripcion', 'Todas las ubicaciones'],
        ]) {
            const opcionesFiltro = new Map(datos.stock.filter(lote => lote[clave] != null).map(lote => [lote[clave], lote[descripcion] || String(lote[clave])]));
            opcionesConsumoLotes(campoProcesarStock(campo), opcionesFiltro, titulo);
        }
        opcionesConsumoLotes(campoProcesarStock('ubicacion-destino'), opciones.ubicaciones.map(item => [item.id, item.descripcion]), 'Seleccione ubicación destino...');
        terminalProcesarStock.cargado = true;
        actualizarOrigenesProcesarStock();
        setEstadoProcesarStock('', 'muted');
    } catch (error) {
        setEstadoProcesarStock(error.message || 'Error cargando el formulario.', 'danger');
    } finally {
        terminalProcesarStock.cargando = false;
        actualizarEstadoBotonProcesarStock();
    }
}

function actualizarOrigenesProcesarStock() {
    const filtros = [['tipo-producto', 'tipo_producto_id'], ['material', 'material_id'], ['ubicacion-origen', 'ubicacion_id']];
    const lotes = terminalProcesarStock.stock.filter(lote => filtros.every(([campo, clave]) => !campoProcesarStock(campo).value || String(lote[clave]) === campoProcesarStock(campo).value));
    opcionesConsumoLotes(campoProcesarStock('origen'), lotes.map(lote => [lote.id,
        `${lote.codigo}${lote.objetivo === 'ALMACENADO' ? ' (ALMACENADO)' : ''} | Restante ${(Number(lote.cubicaje) - Number(lote.consumido)).toLocaleString('es-ES', { maximumFractionDigits: 4 })} m³ | ${lote.tipo_descripcion || ''} | ${lote.material_descripcion || ''} | ${lote.ubicacion_descripcion || ''}`]),
    lotes.length ? 'Seleccione lote...' : 'Sin lotes disponibles');
    autocompletarProcesarStockDesdeOrigen();
}

function autocompletarProcesarStockDesdeOrigen() {
    const origen = terminalProcesarStock.stock.find(lote => String(lote.id) === campoProcesarStock('origen').value);
    campoProcesarStock('ubicacion-destino').value = origen?.ubicacion_id == null ? '' : String(origen.ubicacion_id);
    campoProcesarStock('lote-destino').value = origen?.codigo || '';
    campoProcesarStock('cubicaje').value = origen ? String(terminalProcesarStock.cubicajes[String(origen.tipo_producto_id)] || '') : '';
    if (!campoProcesarStock('paquetes').value) campoProcesarStock('paquetes').value = '1';
    actualizarNombresDestinoProcesarStock();
    actualizarEstadoBotonProcesarStock();
}

function actualizarNombresDestinoProcesarStock() {
    const ubicacion = campoProcesarStock('ubicacion-destino').value;
    campoProcesarStock('nombres-destino').replaceChildren(...terminalProcesarStock.lotesDestino
        .filter(lote => String(lote.ubicacion_id) === ubicacion).map(lote => new Option(`${lote.codigo} (ALMACENADO)`, lote.codigo)));
}

function actualizarEstadoBotonProcesarStock() {
    const boton = campoProcesarStock('procesar');
    if (!boton) return;
    const origen = terminalProcesarStock.stock.find(lote => String(lote.id) === campoProcesarStock('origen').value);
    const cubicaje = Number(campoProcesarStock('cubicaje').value);
    const paquetes = Number(campoProcesarStock('paquetes').value);
    const total = cubicaje * paquetes;
    campoProcesarStock('total').value = total > 0 && Number.isFinite(total) ? total.toLocaleString('es-ES', { maximumFractionDigits: 4 }) : '';
    const ubicacion = campoProcesarStock('ubicacion-destino').value;
    const nombre = campoProcesarStock('lote-destino').value.trim();
    const restante = origen ? Number(origen.cubicaje) - Number(origen.consumido) : NaN;
    let motivo = '';
    if (terminalProcesarStock.cargando) motivo = 'Cargando los datos del formulario.';
    else if (terminalProcesarStock.guardando) motivo = 'Guardando el procesado.';
    else if (!terminalProcesarStock.cargado) motivo = 'No se han cargado los datos. Vuelve a entrar en Procesar.';
    else if (!origen) motivo = 'Selecciona un lote de origen.';
    else if (!ubicacion) motivo = 'Selecciona una ubicación de destino de madera (M).';
    else if (!nombre) motivo = 'Indica el nombre del lote de destino.';
    else if ([...nombre].length > 60) motivo = 'El nombre de destino debe tener un máximo de 60 caracteres.';
    else if (!Number.isFinite(cubicaje) || cubicaje <= 0) motivo = 'Indica un cubicaje mayor que cero.';
    else if (!Number.isInteger(paquetes) || paquetes <= 0) motivo = 'Indica un número entero de paquetes mayor que cero.';
    else if (!Number.isFinite(total) || !Number.isFinite(restante)) motivo = 'No se pudo calcular la cantidad disponible del lote.';
    else if (total > restante + 0.0000001) motivo = `El total (${total.toLocaleString('es-ES', { maximumFractionDigits: 4 })} m³) supera el restante del origen (${restante.toLocaleString('es-ES', { maximumFractionDigits: 4 })} m³).`;
    boton.disabled = Boolean(motivo);
    boton.title = motivo;
    const aviso = campoProcesarStock('validacion');
    if (aviso) {
        aviso.textContent = motivo;
        aviso.hidden = !motivo;
    }
}

async function procesarStockDesdeVistaNueva() {
    actualizarEstadoBotonProcesarStock();
    if (terminalProcesarStock.guardando || campoProcesarStock('procesar').disabled) return;
    const origen = terminalProcesarStock.stock.find(lote => String(lote.id) === campoProcesarStock('origen').value);
    const nombreDestino = campoProcesarStock('lote-destino').value.trim();
    const ubicacionDestino = campoProcesarStock('ubicacion-destino').value;
    if (origen && String(origen.ubicacion_id) === ubicacionDestino
        && origen.codigo.trim().toLocaleLowerCase('es') === nombreDestino.toLocaleLowerCase('es')) {
        setEstadoProcesarStock('El lote de destino es el mismo que el de origen: coinciden el nombre y la ubicación. Cambia el nombre o la ubicación de destino.', 'danger');
        return;
    }
    terminalProcesarStock.guardando = true;
    actualizarEstadoBotonProcesarStock();
    setEstadoProcesarStock('Procesando stock...', 'muted');
    let respuesta;
    try {
        respuesta = await peticionConsumoLotes('../api/terminal/procesar_stock.php', {
            origen_id: Number(campoProcesarStock('origen').value),
            ubicacion_id: Number(campoProcesarStock('ubicacion-destino').value),
            codigo_destino: campoProcesarStock('lote-destino').value.trim(),
            cubicaje: campoProcesarStock('cubicaje').value,
            paquetes: Number(campoProcesarStock('paquetes').value),
        });
    } catch (error) {
        setEstadoProcesarStock(error.message || 'No se pudo procesar el stock.', 'danger');
        return;
    } finally {
        terminalProcesarStock.guardando = false;
        actualizarEstadoBotonProcesarStock();
    }
    campoProcesarStock('paquetes').value = '1';
    await cargarFormularioProcesarStock();
    const mensaje = `Stock procesado correctamente en el lote ${respuesta.codigo_destino}.`;
    setEstadoProcesarStock(terminalProcesarStock.cargado ? mensaje : `${mensaje} Vuelve a entrar para recargar el stock.`, terminalProcesarStock.cargado ? 'success' : 'warning');
}

function setEstadoProcesarStock(texto, tipo = 'muted') {
    const estado = campoProcesarStock('estado');
    if (!estado) return;
    estado.className = `small text-${tipo}`;
    estado.textContent = texto;
}
