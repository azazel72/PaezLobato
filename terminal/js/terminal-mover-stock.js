const terminalMoverStock = {
    maestros: null,
    fabricacion: null,
    materiales: null,
    instalaciones: null,
    ubicaciones: null,
    palets: null,
    tipos_producto: null,
    paletsConsumo: [],
    cubicajeConsumo: [],
};

function prepararEventosMoverStock() {
    const selectorTipo = document.getElementById("moverstock-tipo-producto");
    const selectorMadera = document.getElementById("moverstock-material");
    const selectorUbicacionOrigen = document.getElementById("moverstock-ubicacion-origen");
    const selectorOrigen = document.getElementById("moverstock-origen");
    const selectorUbicacionDestino = document.getElementById("moverstock-ubicacion-destino");
    const inputCubicaje = document.getElementById("moverstock-cubicaje");
    const inputPaquetes = document.getElementById("moverstock-paquetes");
    const btnMover = document.getElementById("moverstock-mover");

    if (selectorTipo) selectorTipo.addEventListener("change", actualizarOrigenesMoverStock);
    if (selectorMadera) selectorMadera.addEventListener("change", actualizarOrigenesMoverStock);
    if (selectorUbicacionOrigen) selectorUbicacionOrigen.addEventListener("change", actualizarOrigenesMoverStock);
    if (selectorOrigen) selectorOrigen.addEventListener("change", autocompletarMoverStockDesdeOrigen);
    if (selectorUbicacionDestino) selectorUbicacionDestino.addEventListener("change", actualizarEstadoBotonMoverStock);
    if (inputCubicaje) inputCubicaje.addEventListener("input", actualizarEstadoBotonMoverStock);
    if (inputPaquetes) inputPaquetes.addEventListener("input", actualizarEstadoBotonMoverStock);
    if (btnMover) {
        btnMover.disabled = true;
        btnMover.title = "Completa los datos para mover stock";
        btnMover.addEventListener("click", moverStockDesdeVistaNueva);
    }
}

async function cargarFormularioMoverStock() {
    try {
        await asegurarDatosMoverStock();
        poblarFiltrosMoverStock();
        await actualizarOrigenesMoverStock();
    } catch (err) {
        console.error("No se pudo cargar el formulario de mover stock:", err);
        setEstadoMoverStock("Error cargando datos del formulario.", "danger");
    }
}

async function asegurarDatosMoverStock() {
    const [maestros, fabricacion] = await Promise.all([
        wsRequest("maestros", {}),
        wsRequest("fabricacion", {}),
    ]);
    terminalMoverStock.maestros = maestros || {};
    terminalMoverStock.fabricacion = fabricacion || {};
    terminalMoverStock.materiales = maestros?.materiales || {};
    terminalMoverStock.instalaciones = maestros?.instalaciones || {};
    terminalMoverStock.ubicaciones = maestros?.ubicaciones || {};
    terminalMoverStock.palets = maestros?.palets || {};
    terminalMoverStock.tipos_producto = fabricacion?.tipos_producto || {};
}

function poblarFiltrosMoverStock(valorTipoPrevio = "", valorMaderaPrevio = "") {
    const selectorTipo = document.getElementById("moverstock-tipo-producto");
    const selectorMadera = document.getElementById("moverstock-material");
    if (!selectorTipo || !selectorMadera) return;

    const tipos = Object.values(terminalMoverStock.tipos_producto || {})
        .filter((t) => String(t?.tipo || "").toUpperCase() === "DUELA")
        .sort((a, b) => String(a.descripcion || "").localeCompare(String(b.descripcion || ""), "es"));
    const maderas = Object.values(terminalMoverStock.materiales || {})
        .sort((a, b) => String(a.descripcion || "").localeCompare(String(b.descripcion || ""), "es"));

    selectorTipo.innerHTML = `<option value="">Todos los tipos</option>` + tipos.map((t) =>
        `<option value="${t.id}">${t.descripcion || t.codigo || t.id}</option>`
    ).join("");
    selectorMadera.innerHTML = `<option value="">Todas las maderas</option>` + maderas.map((m) =>
        `<option value="${m.id}">${m.descripcion || m.id}</option>`
    ).join("");

    selectorTipo.value = String(valorTipoPrevio || "");
    selectorMadera.value = String(valorMaderaPrevio || "");
}

function obtenerEtiquetaUbicacionMoverStock(ubicacion) {
    const instalacion = terminalMoverStock.instalaciones?.[ubicacion?.instalacion_id]?.nombre || "";
    return instalacion ? `${instalacion} - ${ubicacion?.descripcion || ubicacion?.id}` : (ubicacion?.descripcion || ubicacion?.id || "");
}

function esInstalacionMPorId(instalacionId) {
    const instalacion = terminalMoverStock.instalaciones?.[instalacionId] || null;
    const nombre = String(instalacion?.nombre || "").trim().toUpperCase();
    const tipo = String(instalacion?.tipo || "").trim().toUpperCase();
    return nombre === "M" || tipo === "M";
}

async function actualizarOrigenesMoverStock() {
    const selectorTipo = document.getElementById("moverstock-tipo-producto");
    const selectorMadera = document.getElementById("moverstock-material");
    const selectorUbicacion = document.getElementById("moverstock-ubicacion-origen");
    const selectorOrigen = document.getElementById("moverstock-origen");
    if (!selectorUbicacion || !selectorOrigen) return;

    const valorUbicacionPrevio = selectorUbicacion.value || "";
    const valorOrigenPrevio = selectorOrigen.value || "";
    const tipoId = selectorTipo?.value ? Number(selectorTipo.value) : null;
    const materialId = selectorMadera?.value ? Number(selectorMadera.value) : null;

    try {
        terminalMoverStock.paletsConsumo = (await wsRequest("listar_palets_consumo", {})) || [];
        const ctx = await wsRequest("obtener_contexto_consumo", {
            tipo_producto_id: tipoId || null,
            material_id: materialId || null,
            ubicacion_id: valorUbicacionPrevio ? Number(valorUbicacionPrevio) : null,
        });
        terminalMoverStock.paletsConsumo = Array.isArray(ctx?.palets) ? ctx.palets : [];
        terminalMoverStock.cubicajeConsumo = tipoId
            ? [{ tipo_producto_id: tipoId, cubicaje_estandar: Number(ctx?.cubicaje_estandar || 0) }]
            : [];
    } catch (err) {
        console.error("No se pudo obtener contexto para mover stock:", err);
        selectorOrigen.innerHTML = `<option value="">Error cargando palets</option>`;
        selectorUbicacion.innerHTML = `<option value="">Error cargando ubicaciones</option>`;
        actualizarEstadoBotonMoverStock();
        return;
    }

    poblarSelectorUbicacionOrigenMoverStock(valorUbicacionPrevio);
    poblarSelectorOrigenMoverStock(valorOrigenPrevio);
}

function poblarSelectorUbicacionOrigenMoverStock(valorPrevio = "") {
    const selectorUbicacion = document.getElementById("moverstock-ubicacion-origen");
    const selectorDestino = document.getElementById("moverstock-ubicacion-destino");
    if (!selectorUbicacion || !selectorDestino) return;
    const valorDestinoPrevio = selectorDestino.value || "";

    const opcionesUbicacion = new Map();
    (terminalMoverStock.paletsConsumo || []).forEach((s) => {
        const instalacionId = s?.id_instalacion;
        if (!instalacionId) return;
        if (!esInstalacionMPorId(instalacionId)) return;
        const nombre = terminalMoverStock.instalaciones?.[instalacionId]?.nombre || `Instalación ${instalacionId}`;
        opcionesUbicacion.set(String(instalacionId), nombre);
    });
    const opcionesOrdenadas = Array.from(opcionesUbicacion.entries())
        .sort((a, b) => String(a[1]).localeCompare(String(b[1]), "es"));
    const opcionesDestino = Object.values(terminalMoverStock.ubicaciones || {})
        .filter((u) => esInstalacionMPorId(u?.instalacion_id))
        .sort((a, b) => String(obtenerEtiquetaUbicacionMoverStock(a)).localeCompare(String(obtenerEtiquetaUbicacionMoverStock(b)), "es"));

    selectorUbicacion.innerHTML = `<option value="">Todas las ubicaciones</option>` + opcionesOrdenadas
        .map(([id, nombre]) => `<option value="${id}">${nombre}</option>`)
        .join("");
    selectorDestino.innerHTML = `<option value="">Seleccione destino...</option>` + opcionesDestino
        .map((u) => `<option value="${u.id}">${obtenerEtiquetaUbicacionMoverStock(u)}</option>`)
        .join("");

    if (valorPrevio && opcionesUbicacion.has(String(valorPrevio))) {
        selectorUbicacion.value = String(valorPrevio);
    }
    if (valorDestinoPrevio && opcionesDestino.some((u) => String(u.id) === String(valorDestinoPrevio))) {
        selectorDestino.value = String(valorDestinoPrevio);
    }
}

function poblarSelectorOrigenMoverStock(valorPrevio = "") {
    const selectorOrigen = document.getElementById("moverstock-origen");
    const selectorUbicacion = document.getElementById("moverstock-ubicacion-origen");
    const selectorTipo = document.getElementById("moverstock-tipo-producto");
    const selectorMadera = document.getElementById("moverstock-material");
    if (!selectorOrigen || !selectorUbicacion) return;

    const filtroUbicacion = selectorUbicacion.value ? String(selectorUbicacion.value) : null;
    const tipoId = selectorTipo?.value ? Number(selectorTipo.value) : null;
    const materialId = selectorMadera?.value ? Number(selectorMadera.value) : null;

    const filtrados = (terminalMoverStock.paletsConsumo || []).filter((s) => {
        const restante = Math.max(Number(s?.cantidad_stock || 0) - Number(s?.cantidad_consumida || 0), 0);
        const cumpleInstalacionM = esInstalacionMPorId(s?.id_instalacion);
        const cumpleUbicacion = !filtroUbicacion || String(s?.id_instalacion ?? "") === String(filtroUbicacion);
        const cumpleMaterial = !materialId || Number(s?.id_material || 0) === Number(materialId);
        const cumpleTipo = !tipoId || Number(s?.tipo_producto || 0) === Number(tipoId);
        return restante > 0 && cumpleInstalacionM && cumpleUbicacion && cumpleMaterial && cumpleTipo;
    });

    if (!filtrados.length) {
        selectorOrigen.innerHTML = `<option value="">Sin palets disponibles</option>`;
        autocompletarMoverStockDesdeOrigen();
        return;
    }

    selectorOrigen.innerHTML = `<option value="">Seleccione palet...</option>` + filtrados.map((s) => {
        const restante = Math.max(Number(s?.cantidad_stock || 0) - Number(s?.cantidad_consumida || 0), 0)
            .toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 3 });
        const tipoTxt = terminalMoverStock.tipos_producto?.[s.tipo_producto]?.descripcion || `Tipo ${s.tipo_producto || "-"}`;
        const maderaTxt = terminalMoverStock.materiales?.[s.id_material]?.descripcion || `Madera ${s.id_material || "-"}`;
        const ubicTxt = terminalMoverStock.instalaciones?.[s.id_instalacion]?.nombre || `Ubicación ${s.id_instalacion || "-"}`;
        const etiqueta = `${s.codigo || s.id} | Restante ${restante} | ${tipoTxt} | ${maderaTxt} | ${ubicTxt}`;
        return `<option value="${s.id}">${etiqueta}</option>`;
    }).join("");

    if (valorPrevio && filtrados.some((s) => String(s.id) === String(valorPrevio))) {
        selectorOrigen.value = String(valorPrevio);
    } else if (filtrados.length > 0) {
        selectorOrigen.value = String(filtrados[0].id);
    }
    autocompletarMoverStockDesdeOrigen();
}

function obtenerCubicajeInicialMoverStock(tipoProductoId) {
    const lista = Array.isArray(terminalMoverStock.cubicajeConsumo) ? terminalMoverStock.cubicajeConsumo : [];
    const enLista = lista.find((c) => Number(c?.tipo_producto_id || 0) === Number(tipoProductoId));
    if (enLista) return Number(enLista.cubicaje_estandar || 0);
    return 0;
}

function autocompletarMoverStockDesdeOrigen() {
    const selectorOrigen = document.getElementById("moverstock-origen");
    const selectorTipo = document.getElementById("moverstock-tipo-producto");
    const inputCubicaje = document.getElementById("moverstock-cubicaje");
    const inputPaquetes = document.getElementById("moverstock-paquetes");
    if (!selectorOrigen || !inputCubicaje || !inputPaquetes) return;

    const origenId = Number(selectorOrigen.value || 0);
    if (!origenId) {
        inputCubicaje.value = "";
        inputPaquetes.value = "1";
        actualizarEstadoBotonMoverStock();
        return;
    }

    const tipoId = selectorTipo?.value ? Number(selectorTipo.value) : null;
    const cubicajeInicial = obtenerCubicajeInicialMoverStock(tipoId);
    if (Number.isFinite(cubicajeInicial) && cubicajeInicial > 0) {
        inputCubicaje.value = String(cubicajeInicial);
    }
    if (!inputPaquetes.value || Number(inputPaquetes.value) < 1) {
        inputPaquetes.value = "1";
    }
    actualizarEstadoBotonMoverStock();
}

function actualizarEstadoBotonMoverStock() {
    const selectorOrigen = document.getElementById("moverstock-origen");
    const selectorDestino = document.getElementById("moverstock-ubicacion-destino");
    const inputCubicaje = document.getElementById("moverstock-cubicaje");
    const inputPaquetes = document.getElementById("moverstock-paquetes");
    const inputTotal = document.getElementById("moverstock-total");
    const btnMover = document.getElementById("moverstock-mover");
    if (!selectorOrigen || !selectorDestino || !inputCubicaje || !inputPaquetes || !inputTotal || !btnMover) return;

    const origenId = Number(selectorOrigen.value || 0);
    const destinoId = Number(selectorDestino.value || 0);
    const cubicaje = Number.parseFloat(String(inputCubicaje.value || "").replace(",", "."));
    const paquetes = Number.parseInt(String(inputPaquetes.value || "1"), 10);
    const total = Number.isFinite(cubicaje) && Number.isFinite(paquetes) ? cubicaje * paquetes : NaN;

    inputTotal.value = Number.isFinite(total) && total > 0
        ? total.toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 3 })
        : "";

    const paletOrigen = terminalMoverStock.palets?.[origenId] || null;
    const ubicacionOrigenId = paletOrigen
        ? Number(paletOrigen.ubicacion_id || 0)
        : 0;
    const mismaUbicacion = Boolean(ubicacionOrigenId && destinoId && ubicacionOrigenId === destinoId);
    const habilitado = Boolean(origenId)
        && Boolean(destinoId)
        && Number.isFinite(cubicaje)
        && cubicaje > 0
        && Number.isFinite(paquetes)
        && paquetes > 0
        && !mismaUbicacion;

    btnMover.disabled = !habilitado;
    btnMover.title = mismaUbicacion ? "El destino debe ser distinto del origen" : (habilitado ? "" : "Completa los datos para mover stock");
}

async function moverStockDesdeVistaNueva() {
    const selectorOrigen = document.getElementById("moverstock-origen");
    const selectorDestino = document.getElementById("moverstock-ubicacion-destino");
    const inputCubicaje = document.getElementById("moverstock-cubicaje");
    const inputPaquetes = document.getElementById("moverstock-paquetes");
    const btnMover = document.getElementById("moverstock-mover");
    if (!selectorOrigen || !selectorDestino || !inputCubicaje || !inputPaquetes || !btnMover) return;

    const origenId = Number(selectorOrigen.value || 0);
    const destinoId = Number(selectorDestino.value || 0);
    const cubicaje = Number.parseFloat(String(inputCubicaje.value || "").replace(",", "."));
    const paquetes = Number.parseInt(String(inputPaquetes.value || "1"), 10);
    const cubicajeTotal = cubicaje * paquetes;

    if (!origenId) {
        setEstadoMoverStock("Selecciona un palet de origen.", "danger");
        return;
    }
    if (!destinoId) {
        setEstadoMoverStock("Selecciona una ubicación de destino.", "danger");
        return;
    }
    if (!Number.isFinite(cubicajeTotal) || cubicajeTotal <= 0) {
        setEstadoMoverStock("El cubicaje total debe ser mayor que 0.", "danger");
        return;
    }
    if (!Number.isFinite(paquetes) || paquetes <= 0) {
        setEstadoMoverStock("Los paquetes deben ser mayores que 0.", "danger");
        return;
    }

    const paletOrigen = terminalMoverStock.palets?.[origenId];
    if (!paletOrigen) {
        setEstadoMoverStock("No se encontró el palet de origen.", "danger");
        return;
    }
    const ubicacionOrigenId = Number(paletOrigen.ubicacion_id || 0);
    if (ubicacionOrigenId && ubicacionOrigenId === destinoId) {
        setEstadoMoverStock("La ubicación destino debe ser distinta del origen.", "danger");
        return;
    }

    const restante = Math.max(Number(paletOrigen.cubicaje || 0) - Number(paletOrigen.consumido || 0), 0);
    if (cubicajeTotal > restante) {
        setEstadoMoverStock("El cubicaje supera el restante disponible del origen.", "danger");
        return;
    }

    btnMover.disabled = true;
    setEstadoMoverStock("Moviendo stock...", "muted");

    try {
        await wsRequest("mover_stock", {
            palet_origen_id: origenId,
            ubicacion_destino_id: destinoId,
            cubicaje,
            paquetes,
        });

        inputCubicaje.value = "";
        inputPaquetes.value = "1";
        await refrescarVistaMoverStock();
        setEstadoMoverStock("Stock movido correctamente.", "success");
    } catch (err) {
        console.error("Error moviendo stock:", err);
        setEstadoMoverStock("No se pudo mover el stock.", "danger");
    } finally {
        actualizarEstadoBotonMoverStock();
    }
}

async function refrescarVistaMoverStock() {
    await asegurarDatosMoverStock();
    poblarFiltrosMoverStock(
        document.getElementById("moverstock-tipo-producto")?.value || "",
        document.getElementById("moverstock-material")?.value || ""
    );
    await actualizarOrigenesMoverStock();
    try {
        await refrescarMaestrosFabricacion?.();
        await actualizarPaletsConsumoYCubicaje?.();
    } catch (err) {
        console.warn("No se pudieron refrescar otras vistas tras mover stock:", err);
    }
}

function setEstadoMoverStock(texto, tipo = "muted") {
    const estado = document.getElementById("moverstock-estado");
    if (!estado) return;
    estado.className = "small";
    estado.classList.add(`text-${tipo}`);
    estado.textContent = texto || "";
}
