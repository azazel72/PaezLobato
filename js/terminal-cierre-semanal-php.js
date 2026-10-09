const cierreSemanalPhp = { activo: false, carga: 0, fabricaciones: [], lotes: [], opcionesProcesado: { ubicaciones: [], lotes: [] } };

function configurarVistaCierreSemanalPhp(activo) {
    cierreSemanalPhp.activo = activo;
    const panel = document.getElementById("cierre-semanal-fabricaciones-panel");
    if (panel) {
        panel.hidden = !activo;
        panel.open = false;
    }
    // Las acciones antiguas se conservan para Consumo: usan IDs de trazas,
    // no los IDs de a_lotes_botas que se muestran en el cierre nuevo.
    const acciones = document.getElementById("cierre-semanal-reset")?.closest(".cierre-semanal-bloque");
    const codigos = document.getElementById("cierre-semanal-codigos-panel");
    if (acciones) acciones.hidden = false;
    const traslado = acciones?.querySelector(".cierre-semanal-traslado");
    if (traslado) traslado.hidden = activo;
    if (!activo) {
        document.getElementById("cierre-semanal-reset").disabled = false;
        document.getElementById("cierre-semanal-cerrar").disabled = false;
    }
    if (codigos) codigos.hidden = activo;
    const titulo = document.getElementById("cierre-semanal-lotes-titulo");
    if (titulo) titulo.textContent = activo ? "Lotes de botas" : "Palets y lotes consumidos";
}

function elementoCierrePhp(etiqueta, clase, texto) {
    const elemento = document.createElement(etiqueta);
    if (clase) elemento.className = clase;
    if (texto !== undefined) elemento.textContent = texto;
    return elemento;
}

function lineasFabricacionCierrePhp(linea) {
    return [
        `Tipo/Material: ${linea.tipo_descripcion || "-"} / ${linea.material_descripcion || "-"}`,
        `Tostado: ${linea.tostado_descripcion || "-"}`,
        `Pedido total/fabricado: ${Number(linea.pedido_cantidad || 0)} / ${Number(linea.pedido_cantidad_fabricada || 0)}`,
        `Semana total/fabricado: ${Number(linea.cantidad || 0)} / ${Number(linea.cantidad_fabricada || 0)}`,
    ];
}

async function cerrarFabricacionCierrePhp(lineaId, boton) {
    if (!lineaId || boton?.disabled) return;
    boton.disabled = true;
    try {
        await POST('./api/cerrar_fabricacion_semanal.php', { fabricacion_semanal_id: Number(lineaId) });
        cierreSemanalPhp.fabricaciones = cierreSemanalPhp.fabricaciones.filter(linea => Number(linea.id) !== Number(lineaId));
        if (Number(estadoCierreSemanal.lineaId) === Number(lineaId)) estadoCierreSemanal.lineaId = null;
        pintarFabricacionesCierrePhp();
    } catch (error) {
        boton.disabled = false;
        alert(error.message);
    }
}

function actualizarCabeceraCierrePhp() {
    const linea = cierreSemanalPhp.fabricaciones.find(item => Number(item.id) === Number(estadoCierreSemanal.lineaId));
    const titulo = document.getElementById("cierre-semanal-titulo");
    if (titulo) titulo.textContent = "Cierre Semanal";
    estadoCierreSemanal.pedidoId = linea ? Number(linea.pedido_id) || null : null;
}

function seleccionarFabricacionCierrePhp(lineaId) {
    const linea = cierreSemanalPhp.fabricaciones.find(item => Number(item.id) === Number(lineaId));
    if (!linea) return;
    estadoCierreSemanal.lineaId = Number(linea.id);
    actualizarCabeceraCierrePhp();
    document.querySelectorAll("#cierre-semanal-fabricaciones [data-linea-id]").forEach(tarjeta => {
        const seleccionada = Number(tarjeta.dataset.lineaId) === Number(linea.id);
        tarjeta.classList.toggle("fabricacion-card-seleccionada", seleccionada);
        tarjeta.setAttribute("aria-pressed", String(seleccionada));
    });
    document.getElementById("cierre-semanal-fabricaciones-panel").open = false;
    console.info("[cierre-semanal PHP] fabricación seleccionada", { id: linea.id });
}

function pintarFabricacionesCierrePhp() {
    const lista = document.getElementById("cierre-semanal-fabricaciones");
    const resumen = document.getElementById("cierre-semanal-fabricaciones-resumen");
    if (resumen) resumen.textContent = `(${cierreSemanalPhp.fabricaciones.length})`;
    if (!lista) return;
    lista.replaceChildren();
    if (!cierreSemanalPhp.fabricaciones.length) {
        lista.appendChild(elementoCierrePhp("div", "cierre-semanal-empty", "No hay fabricaciones activas."));
    }
    cierreSemanalPhp.fabricaciones.forEach(linea => {
        const tarjeta = elementoCierrePhp("article", "fabricacion-card");
        tarjeta.dataset.lineaId = String(linea.id);
        tarjeta.tabIndex = 0;
        tarjeta.setAttribute("role", "button");
        const seleccionada = Number(linea.id) === Number(estadoCierreSemanal.lineaId);
        tarjeta.classList.toggle("fabricacion-card-seleccionada", seleccionada);
        tarjeta.setAttribute("aria-pressed", String(seleccionada));
        const cabecera = elementoCierrePhp("div", "fabricacion-card-title");
        cabecera.appendChild(elementoCierrePhp("h6", "", linea.pedido_descripcion || `Fabricación ${linea.id}`));
        cabecera.appendChild(elementoCierrePhp("span", "fabricacion-card-date", formatearFechaEuropea(linea.fecha_inicio)));
        tarjeta.appendChild(cabecera);
        const datos = elementoCierrePhp("div", "fabricacion-card-resumen");
        lineasFabricacionCierrePhp(linea).forEach(texto => datos.appendChild(elementoCierrePhp("div", "", texto)));
        tarjeta.appendChild(datos);
        const cerrar = elementoCierrePhp("button", "btn btn-outline-primary btn-sm mt-2", "Cierre Semanal");
        cerrar.type = "button";
        cerrar.addEventListener("click", event => {
            event.stopPropagation();
            const descripcion = linea.pedido_descripcion || `fabricación ${linea.id}`;
            if (!confirm(`¿Confirmas el cierre semanal de ${descripcion}?`)) return;
            cerrarFabricacionCierrePhp(linea.id, cerrar);
        });
        tarjeta.appendChild(cerrar);
        tarjeta.addEventListener("click", () => seleccionarFabricacionCierrePhp(linea.id));
        tarjeta.addEventListener("keydown", event => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                seleccionarFabricacionCierrePhp(linea.id);
            }
        });
        lista.appendChild(tarjeta);
    });
    actualizarCabeceraCierrePhp();
}

function pintarLotesCierrePhp() {
    const lista = document.getElementById("cierre-semanal-lotes");
    const resumen = document.getElementById("cierre-semanal-lotes-resumen");
    if (resumen) resumen.textContent = `${cierreSemanalPhp.lotes.length} lotes`;
    if (!lista) return;
    lista.replaceChildren();
    if (!cierreSemanalPhp.lotes.length) {
        lista.appendChild(elementoCierrePhp("div", "cierre-semanal-empty", "No hay lotes de botas."));
    }
    // Sin filtrar por estado, selección, fabricación, stock restante o trazas.
    cierreSemanalPhp.lotes.forEach(lote => {
        const restante = Number(lote.cubicaje || 0) - Number(lote.consumido || 0);
        const tarjeta = elementoCierrePhp("article", "cierre-semanal-lote");
        tarjeta.dataset.loteId = String(lote.id);
        tarjeta.classList.toggle("cierre-semanal-lote-negativo", restante < 0);
        tarjeta.classList.toggle("cierre-semanal-lote-positivo", restante > 0);
        tarjeta.appendChild(elementoCierrePhp("div", "cierre-semanal-lote-titulo", `Lote ${lote.codigo || "-"}`));
        const datos = elementoCierrePhp("div", "cierre-semanal-lote-grid");
        [
            `M3 original: ${formatearNumeroFabricacion(lote.cubicaje)}`,
            `M3 consumido: ${formatearNumeroFabricacion(lote.consumido)}`,
            `M3 restante: ${formatearNumeroFabricacion(restante)}`,
            `Botas fabricadas: ${Number(lote.contador_botas || 0)}`,
        ].forEach(texto => datos.appendChild(elementoCierrePhp("div", "", texto)));
        tarjeta.appendChild(datos);
        if (Math.abs(restante) < 0.0000001 && !lote.finalizarPendiente) {
            const finalizar = elementoCierrePhp("button", "btn btn-outline-secondary btn-sm mt-2", "Finalizar lote");
            finalizar.type = "button";
            finalizar.addEventListener("click", event => {
                event.stopPropagation();
                solicitarFinalizarLoteCierrePhp(lote);
            });
            tarjeta.appendChild(finalizar);
        }
        tarjeta.appendChild(crearAccionesLoteCierrePhp(lote));
        lista.appendChild(tarjeta);
    });
    pintarCambiosLotesCierrePhp();
}

async function cargarCierreSemanalDesdePhp() {
    if (borradorLotesCierrePhp.operaciones.length || borradorLotesCierrePhp.guardando) {
        pintarFabricacionesCierrePhp();
        pintarLotesCierrePhp();
        return;
    }
    const carga = ++cierreSemanalPhp.carga;
    estadoCierreSemanal.data = null;
    estadoCierreSemanal.borrador = null;
    cierreSemanalPhp.fabricaciones = [];
    cierreSemanalPhp.lotes = [];
    actualizarCabeceraCierrePhp();
    document.getElementById("cierre-semanal-fabricaciones-resumen").textContent = "";
    document.getElementById("cierre-semanal-lotes-resumen").textContent = "";
    document.getElementById("cierre-semanal-fabricaciones").textContent = "Cargando fabricaciones...";
    document.getElementById("cierre-semanal-lotes").textContent = "Cargando lotes...";
    const [fabricaciones, lotes, opcionesProcesado] = await Promise.allSettled([
        GET("./api/fabricacion.php"),
        GET("./api/lotes_botas.php"),
        GET("./api/opciones_procesado.php"),
    ]);
    if (carga !== cierreSemanalPhp.carga || !cierreSemanalPhp.activo) return;
    if (fabricaciones.status === "fulfilled" && fabricaciones.value?.ok && Array.isArray(fabricaciones.value.fabricaciones)) {
        cierreSemanalPhp.fabricaciones = fabricaciones.value.fabricaciones;
        pintarFabricacionesCierrePhp();
    } else {
        document.getElementById("cierre-semanal-fabricaciones").textContent = "No se pudieron cargar las fabricaciones.";
        console.error("[cierre-semanal PHP] Error cargando fabricaciones", fabricaciones);
    }
    if (lotes.status === "fulfilled" && lotes.value?.ok && Array.isArray(lotes.value.lotes)) {
        cierreSemanalPhp.lotes = lotes.value.lotes;
        iniciarBorradorLotesCierrePhp(cierreSemanalPhp.lotes);
        pintarLotesCierrePhp();
    } else {
        document.getElementById("cierre-semanal-lotes").textContent = "No se pudieron cargar los lotes.";
        console.error("[cierre-semanal PHP] Error cargando lotes", lotes);
    }
    if (opcionesProcesado.status === "fulfilled" && opcionesProcesado.value?.ok) {
        cierreSemanalPhp.opcionesProcesado = {
            ubicaciones: Array.isArray(opcionesProcesado.value.ubicaciones) ? opcionesProcesado.value.ubicaciones : [],
            lotes: Array.isArray(opcionesProcesado.value.lotes) ? opcionesProcesado.value.lotes : [],
        };
        if (cierreSemanalPhp.lotes.length) pintarLotesCierrePhp();
    }
}
