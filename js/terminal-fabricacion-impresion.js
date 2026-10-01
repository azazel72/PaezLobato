const claveImpresionBotasPendiente = "fabricacion-botas-impresion-pendiente-v3";
let fabricacionImpresionEnCurso = false;
let fabricacionImpresionPendiente = null;

function guardarImpresionBotasPendiente(pendiente) {
    fabricacionImpresionPendiente = pendiente;
    try {
        if (pendiente) sessionStorage.setItem(claveImpresionBotasPendiente, JSON.stringify(pendiente));
        else sessionStorage.removeItem(claveImpresionBotasPendiente);
    } catch (error) {
        console.warn("[fabricar-bota] No se pudo guardar la impresión pendiente en esta pestaña", error);
    }
    actualizarBotonImpresionBotas();
}

function validarSeleccionImpresionBotas(opciones = {}) {
    const payload = {
        fabricacion_semanal_id: Number(lineaFabricacionActualId || 0),
        lotes_botas_ids: lotesBotasMovil.filter(lote => Number(lote.estado) === 1).map(lote => Number(lote.id)),
        lote_fondos_id: 0,
        batidero: Number(document.getElementById("fabricar-bota-batidero")?.value || 0),
        operarios_ids: opciones.operariosIds || [Number(document.getElementById("fabricar-bota-operario-fondado")?.value || 0)],
        cantidad_etiquetas: Number(opciones.cantidadEtiquetas ?? document.getElementById("fabricar-bota-cantidad-etiquetas")?.value ?? 0),
    };
    const fondos = lotesFondosMovil.filter(lote => Number(lote.estado) === 1);
    if (fondos.length === 1) payload.lote_fondos_id = Number(fondos[0].id);
    const enteroPositivo = valor => Number.isInteger(valor) && valor > 0;
    const faltan = [];
    if (!enteroPositivo(payload.fabricacion_semanal_id)) faltan.push("fabricación");
    if (!payload.lotes_botas_ids.length || !payload.lotes_botas_ids.every(enteroPositivo)) faltan.push("al menos un lote de botas");
    if (fondos.length !== 1 || !enteroPositivo(payload.lote_fondos_id)) faltan.push("un único lote de fondos");
    if (![11,12,13,21,22,23,31,32,33,41,42,43,51,52,53].includes(payload.batidero)) faltan.push("batidero");
    if (!Array.isArray(payload.operarios_ids) || !payload.operarios_ids.length || !payload.operarios_ids.every(enteroPositivo)) faltan.push("operario de fondado");
    if (!enteroPositivo(payload.cantidad_etiquetas)) faltan.push("cantidad entera de etiquetas mayor que cero");
    return { payload, faltan };
}

function actualizarBotonImpresionBotas() {
    const boton = document.getElementById("fabricar-bota-imprimir");
    if (!boton) return;
    const faltan = fabricacionImpresionPendiente ? [] : validarSeleccionImpresionBotas().faltan;
    boton.disabled = fabricacionImpresionEnCurso || faltan.length > 0;
    boton.title = faltan.length ? `Falta seleccionar: ${faltan.join(", ")}.` : "";
    boton.innerHTML = `<i class="bi bi-printer"></i> ${fabricacionImpresionPendiente ? "Reintentar impresión" : "Imprimir etiqueta"}`;
}

document.addEventListener("DOMContentLoaded", () => {
    for (const id of ["fabricar-bota-batidero", "fabricar-bota-operario-fondado", "fabricar-bota-cantidad-etiquetas"]) {
        const campo = document.getElementById(id);
        campo?.addEventListener("change", actualizarBotonImpresionBotas);
        campo?.addEventListener("input", actualizarBotonImpresionBotas);
    }
    try {
        const pendiente = JSON.parse(sessionStorage.getItem(claveImpresionBotasPendiente) || "null");
        if (pendiente && Array.isArray(pendiente.codigos) && pendiente.codigos.length) {
            fabricacionImpresionPendiente = pendiente;
        }
    } catch (error) {
        console.warn("[fabricar-bota] No se pudo recuperar la impresión pendiente", error);
    }
    actualizarBotonImpresionBotas();
});

async function refrescarFabricacionTrasCrearBotas(lineaId) {
    const [botas, fondos, fabricaciones] = await Promise.all([
        GET("./api/lotes_botas.php"),
        GET("./api/lotes_fondos.php"),
        GET("./api/fabricacion.php"),
    ]);
    lotesBotasMovil = botas.lotes || [];
    lotesFondosMovil = fondos.lotes || [];
    fabricacionesSemanalesMovil = fabricaciones.fabricaciones || [];
    pintarLotesBotasDesdePhp();
    pintarLotesFondosDesdePhp();
    actualizarCardsFabricacionSemanalBotas(fabricacionesSemanalesMovil);
    const seleccionId = Number(lineaFabricacionActualId);
    if (seleccionId) {
        const tarjeta = document.querySelector(`#lista_fabricacion_semanal_botas_header [data-linea-id="${seleccionId}"]`);
        const selector = document.getElementById("fabricacion-semanal-selector");
        const abierto = selector?.open;
        if (tarjeta) await seleccionarFabricacionDesdePhp(tarjeta);
        if (selector) selector.open = abierto;
    }
    console.info("[fabricar-bota] datos de pantalla actualizados", { fabricacionId: lineaId });
}

async function fabricarEImprimirBotasDesdePhp(opciones = {}) {
    if (fabricacionImpresionEnCurso) return;
    if (!conn?.socket || conn.socket.readyState !== WebSocket.OPEN) {
        alert("Conecta con el servidor de impresión antes de continuar.");
        return;
    }
    let payload = null;
    if (!fabricacionImpresionPendiente) {
        const seleccion = validarSeleccionImpresionBotas(opciones);
        if (seleccion.faltan.length) {
            actualizarBotonImpresionBotas();
            alert(`Falta seleccionar: ${seleccion.faltan.join(", ")}.`);
            return;
        }
        payload = seleccion.payload;
    }

    fabricacionImpresionEnCurso = true;
    actualizarBotonImpresionBotas();
    let lineaCreadaId = null;
    let avisoFinal = "";
    try {
        if (!fabricacionImpresionPendiente) {
            const respuesta = await POST("./api/fabricacion_crear_botas.php", payload);
            if (!respuesta?.ok || !Array.isArray(respuesta.codigos) || respuesta.codigos.length !== payload.cantidad_etiquetas) {
                throw new Error(respuesta?.error || "PHP no ha confirmado la creación de las botas. Revisa la respuesta en consola.");
            }
            lineaCreadaId = payload.fabricacion_semanal_id;
            guardarImpresionBotasPendiente({ codigos: respuesta.codigos, fabricacionId: lineaCreadaId });
            const cantidadInput = document.getElementById("fabricar-bota-cantidad-etiquetas");
            if (cantidadInput) cantidadInput.value = "0";
        }
        const { codigos, fabricacionId } = fabricacionImpresionPendiente;
        lineaCreadaId = fabricacionId;
        console.info("[fabricar-bota] enviar códigos a imprimir", { codigos });
        const impresion = await wsRequest("imprimir_etiqueta_fabricacion", { codigos });
        if (!impresion?.ok) throw new Error("El servidor no ha confirmado el envío a la impresora.");
        console.info("[fabricar-bota] impresión enviada", impresion);
        guardarImpresionBotasPendiente(null);
        avisoFinal = `${codigos.length} etiqueta(s) enviada(s) a la impresora.`;
    } catch (error) {
        console.error("[fabricar-bota] fabricación/impresión", error);
        avisoFinal = fabricacionImpresionPendiente
            ? `Las botas ya están creadas. Pulsa «Reintentar impresión» para enviar los mismos códigos sin volver a fabricarlas. ${error.message}`
            : error.message;
    } finally {
        if (lineaCreadaId) {
            try {
                await refrescarFabricacionTrasCrearBotas(lineaCreadaId);
            } catch (error) {
                console.warn("[fabricar-bota] No se pudo refrescar la vista", error);
                avisoFinal += " No se pudieron actualizar los datos de pantalla. Recarga la vista para consultar los valores actuales.";
            }
        }
        fabricacionImpresionEnCurso = false;
        actualizarBotonImpresionBotas();
    }
    if (avisoFinal) alert(avisoFinal);
}
