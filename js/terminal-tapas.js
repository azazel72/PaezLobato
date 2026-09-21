let origenTapasLineaId = null;
let origenTapasSeleccionManual = false;
let origenTapasSeleccionadoId = null;
let paletsTapasFabricacion = [];

function prepararEventosTapas() {
    document.getElementById("consumo-destino-producto")?.addEventListener("change", actualizarModoConsumoTapas);
    document.getElementById("consumo-tapas-agregar")?.addEventListener("click", agregarConsumoTapas);
    document.getElementById("consumo-panel-tabs")?.addEventListener("shown.bs.tab", actualizarModoConsumoTapas);
    document.getElementById("fabricar-bota-tapas-listado")?.addEventListener("click", (event) => {
        const tarjeta = event.target.closest("[data-palet-tapas-id]");
        if (!tarjeta) return;
        const id = Number(tarjeta.dataset.paletTapasId);
        if (!id) return;
        origenTapasSeleccionadoId = origenTapasSeleccionadoId === id ? null : id;
        origenTapasSeleccionManual = true;
        renderizarOrigenesTapasFabricacion();
    });
    actualizarModoConsumoTapas();
}

function actualizarModoConsumoTapas() {
    const esTapas = document.getElementById("consumo-destino-producto")?.value === "tapas";
    document.querySelector("#panelConsumo .panel-fijo-body > .table-responsive")?.classList.toggle("d-none", esTapas);
    document.getElementById("consumo-lote-fila")?.classList.toggle("d-none", esTapas);
    document.getElementById("consumo-proveedor-tapas-fila")?.classList.toggle("d-none", !esTapas);
    document.getElementById("consumo-tapas-listado")?.classList.toggle("d-none", !esTapas);
    document.getElementById("consumo-tapas-agregar")?.classList.toggle("d-none", !esTapas);
    if (esTapas) {
        document.getElementById("consumo-stock-agregar-trazabilidad")?.classList.add("d-none");
        document.getElementById("consumo-palet-agregar-trazabilidad")?.classList.add("d-none");
        poblarProveedoresTapas();
        cargarPaletsTapas();
    } else if (typeof actualizarBotonFooterConsumo === "function") {
        actualizarBotonFooterConsumo(document.querySelector("#consumo-panel-tabs .nav-link.active")?.id);
    }
}

function poblarProveedoresTapas() {
    const selector = document.getElementById("consumo-proveedor-tapas");
    if (!selector) return;
    const anterior = selector.value;
    selector.replaceChildren(new Option("Seleccione proveedor...", ""));
    const proveedores = Object.values(terminalFabricacion.proveedores || {})
        .filter((proveedor) => proveedor?.id && proveedor?.nombre)
        .sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), "es"));
    proveedores.forEach((proveedor) => selector.add(new Option(proveedor.nombre, String(proveedor.id))));
    if (proveedores.some((proveedor) => String(proveedor.id) === anterior)) selector.value = anterior;
}

function crearListadoPaletsTapas(contenedor, palets) {
    if (!contenedor) return;
    contenedor.replaceChildren();
    if (!palets.length) {
        contenedor.textContent = "No hay orígenes de tapas.";
        return;
    }
    const tabla = document.createElement("table");
    tabla.className = "table table-sm table-bordered mb-0";
    const cabecera = tabla.createTHead().insertRow();
    ["Origen tapas", "M³ total", "M³ consumido", "M³ restante"].forEach((texto) => {
        const th = document.createElement("th");
        th.scope = "col";
        th.textContent = texto;
        cabecera.appendChild(th);
    });
    const cuerpo = tabla.createTBody();
    palets.forEach((palet) => {
        const fila = cuerpo.insertRow();
        [palet.codigo, palet.cubicaje, palet.consumido, palet.restante].forEach((valor, indice) => {
            const celda = fila.insertCell();
            celda.textContent = indice === 0 ? String(valor) : formatearNumeroFabricacion(valor);
            if (indice === 3 && Number(valor) < 0) celda.className = "text-danger fw-bold";
        });
    });
    const envoltorio = document.createElement("div");
    envoltorio.className = "table-responsive";
    envoltorio.appendChild(tabla);
    contenedor.appendChild(envoltorio);
}

function obtenerOrigenTapasSeleccionadoId() {
    return origenTapasSeleccionadoId;
}

function renderizarOrigenesTapasFabricacion() {
    const contenedor = document.getElementById("fabricar-bota-tapas-listado");
    const resumen = document.getElementById("resumen_origen_tapas");
    if (!contenedor) return;
    contenedor.replaceChildren();
    const seleccionado = paletsTapasFabricacion.find((palet) => Number(palet.id) === origenTapasSeleccionadoId);
    if (resumen) resumen.textContent = seleccionado?.codigo || "Selecciona un origen de tapas";
    if (!paletsTapasFabricacion.length) {
        const vacio = document.createElement("div");
        vacio.className = "panel-botas-trazas-vacio";
        vacio.textContent = "No hay orígenes de tapas.";
        contenedor.appendChild(vacio);
        return;
    }
    paletsTapasFabricacion.forEach((palet) => {
        const activo = Number(palet.id) === origenTapasSeleccionadoId;
        const tarjeta = document.createElement("button");
        tarjeta.type = "button";
        tarjeta.className = `bota-lote-item w-100 text-start${activo ? " bota-lote-item-activo" : ""}`;
        tarjeta.dataset.paletTapasId = String(palet.id);
        tarjeta.setAttribute("aria-pressed", activo ? "true" : "false");
        const titulo = document.createElement("div");
        titulo.className = "bota-lote-titulo";
        titulo.textContent = palet.codigo;
        const volumen = document.createElement("div");
        volumen.className = "bota-lote-detalle";
        volumen.textContent = `M3: ${formatearNumeroFabricacion(palet.cubicaje)} - ${formatearNumeroFabricacion(palet.consumido)} = `;
        const restante = document.createElement("span");
        restante.textContent = formatearNumeroFabricacion(palet.restante);
        if (Number(palet.restante) < 0) restante.className = "text-danger fw-bold";
        volumen.appendChild(restante);
        tarjeta.append(titulo, volumen);
        contenedor.appendChild(tarjeta);
    });
}

async function cargarPaletsTapas(lineaId = null) {
    try {
        const palets = (await wsRequest("listar_palets_tapas", {})) || [];
        crearListadoPaletsTapas(document.getElementById("consumo-tapas-listado"), palets);
        const nuevaLinea = lineaId !== null && lineaId !== origenTapasLineaId;
        if (nuevaLinea) {
            origenTapasLineaId = lineaId;
            origenTapasSeleccionManual = false;
            origenTapasSeleccionadoId = null;
        }
        paletsTapasFabricacion = palets;
        if (!palets.some((palet) => Number(palet.id) === origenTapasSeleccionadoId)) {
            origenTapasSeleccionadoId = null;
        }
        if (!origenTapasSeleccionManual && palets.length === 1) origenTapasSeleccionadoId = Number(palets[0].id);
        renderizarOrigenesTapasFabricacion();
    } catch (error) {
        console.error("No se pudieron cargar los orígenes de tapas:", error);
    }
}

async function agregarConsumoTapas() {
    const proveedorId = Number(document.getElementById("consumo-proveedor-tapas")?.value || 0);
    const desdePalet = document.getElementById("consumo-tab-palet")?.classList.contains("active");
    const paletOrigenId = desdePalet ? null : Number(document.getElementById("consumo-palet-origen")?.value || 0);
    const lotePalet = desdePalet ? String(document.getElementById("consumo-palet-lote")?.value || "").trim() : null;
    const cubicajeInput = desdePalet ? "consumo-palet-cubicaje" : "consumo-cubicaje";
    const cubicaje = Number(String(document.getElementById(cubicajeInput)?.value || "").replace(",", "."));
    const paquetes = desdePalet ? 1 : Number(document.getElementById("consumo-paquetes")?.value || 0);
    if (!proveedorId || (!paletOrigenId && !lotePalet) || cubicaje <= 0 || !Number.isInteger(paquetes) || paquetes < 1) {
        alert("Selecciona proveedor y palet origen, e indica cubicaje y paquetes válidos.");
        return;
    }
    try {
        await wsRequest("agregar_palet_tapas_desde_stock", {
            proveedor_id: proveedorId,
            palet_origen_id: paletOrigenId,
            lote_palet: lotePalet,
            cubicaje,
            paquetes,
        });
        await cargarPaletsConsumoEnSelector();
        await cargarPaletsTapas();
        if (desdePalet) document.getElementById("consumo-palet-lote").value = "";
    } catch (error) {
        console.error("No se pudo agregar el consumo de tapas:", error);
        alert(error?.message || "No se pudo agregar el consumo de tapas.");
    }
}
