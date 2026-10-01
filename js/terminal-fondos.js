let origenFondosLineaId = null;
let origenFondosSeleccionManual = false;
let origenFondosSeleccionadoId = null;
let paletsFondosFabricacion = [];

function prepararEventosFondos() {
    document.getElementById("consumo-destino-producto")?.addEventListener("change", actualizarModoConsumoFondos);
    document.getElementById("consumo-fondos-agregar")?.addEventListener("click", agregarConsumoFondos);
    document.getElementById("consumo-panel-tabs")?.addEventListener("shown.bs.tab", actualizarModoConsumoFondos);
    document.getElementById("fabricar-bota-fondos-listado")?.addEventListener("click", (event) => {
        const tarjeta = event.target.closest("[data-palet-fondos-id]");
        if (!tarjeta) return;
        const id = Number(tarjeta.dataset.paletFondosId);
        if (!id) return;
        origenFondosSeleccionadoId = origenFondosSeleccionadoId === id ? null : id;
        origenFondosSeleccionManual = true;
        renderizarOrigenesFondosFabricacion();
    });
    actualizarModoConsumoFondos();
}

function actualizarModoConsumoFondos() {
    const esFondos = document.getElementById("consumo-destino-producto")?.value === "fondos";
    document.querySelector("#panelConsumo .panel-fijo-body > .table-responsive")?.classList.toggle("d-none", esFondos);
    document.getElementById("consumo-lote-fila")?.classList.toggle("d-none", esFondos);
    document.getElementById("consumo-proveedor-fondos-fila")?.classList.toggle("d-none", !esFondos);
    document.getElementById("consumo-fondos-listado")?.classList.toggle("d-none", !esFondos);
    document.getElementById("consumo-fondos-agregar")?.classList.toggle("d-none", !esFondos);
    if (esFondos) {
        document.getElementById("consumo-stock-agregar-trazabilidad")?.classList.add("d-none");
        document.getElementById("consumo-palet-agregar-trazabilidad")?.classList.add("d-none");
        poblarProveedoresFondos();
        cargarPaletsFondos();
    } else if (typeof actualizarBotonFooterConsumo === "function") {
        actualizarBotonFooterConsumo(document.querySelector("#consumo-panel-tabs .nav-link.active")?.id);
    }
}

function poblarProveedoresFondos() {
    const selector = document.getElementById("consumo-proveedor-fondos");
    if (!selector) return;
    const anterior = selector.value;
    selector.replaceChildren(new Option("Seleccione proveedor...", ""));
    const proveedores = Object.values(terminalFabricacion.proveedores || {})
        .filter((proveedor) => proveedor?.id && proveedor?.nombre)
        .sort((a, b) => String(a.nombre).localeCompare(String(b.nombre), "es"));
    proveedores.forEach((proveedor) => selector.add(new Option(proveedor.nombre, String(proveedor.id))));
    if (proveedores.some((proveedor) => String(proveedor.id) === anterior)) selector.value = anterior;
}

function crearListadoPaletsFondos(contenedor, palets) {
    if (!contenedor) return;
    contenedor.replaceChildren();
    if (!palets.length) {
        contenedor.textContent = "No hay orígenes de fondos.";
        return;
    }
    const tabla = document.createElement("table");
    tabla.className = "table table-sm table-bordered mb-0";
    const cabecera = tabla.createTHead().insertRow();
    ["Origen fondos", "M³ total", "M³ consumido", "M³ restante"].forEach((texto) => {
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

function obtenerOrigenFondosSeleccionadoId() {
    return origenFondosSeleccionadoId;
}

function renderizarOrigenesFondosFabricacion() {
    const contenedor = document.getElementById("fabricar-bota-fondos-listado");
    const resumen = document.getElementById("resumen_origen_fondos");
    if (!contenedor) return;
    contenedor.replaceChildren();
    const seleccionado = paletsFondosFabricacion.find((palet) => Number(palet.id) === origenFondosSeleccionadoId);
    if (resumen) resumen.textContent = seleccionado?.codigo || "Selecciona un origen de fondos";
    if (!paletsFondosFabricacion.length) {
        const vacio = document.createElement("div");
        vacio.className = "panel-botas-trazas-vacio";
        vacio.textContent = "No hay orígenes de fondos.";
        contenedor.appendChild(vacio);
        return;
    }
    paletsFondosFabricacion.forEach((palet) => {
        const activo = Number(palet.id) === origenFondosSeleccionadoId;
        const tarjeta = document.createElement("button");
        tarjeta.type = "button";
        tarjeta.className = `bota-lote-item w-100 text-start${activo ? " bota-lote-item-activo" : ""}`;
        tarjeta.dataset.paletFondosId = String(palet.id);
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

async function cargarPaletsFondos(lineaId = null) {
    try {
        const palets = (await wsRequest("listar_palets_fondos", {})) || [];
        cargarPaletsFondosDesdeDatos(palets, lineaId);
    } catch (error) {
        console.error("No se pudieron cargar los orígenes de fondos:", error);
    }
}

function cargarPaletsFondosDesdeDatos(palets = [], lineaId = null) {
    crearListadoPaletsFondos(document.getElementById("consumo-fondos-listado"), palets);
    const nuevaLinea = lineaId !== null && lineaId !== origenFondosLineaId;
    if (nuevaLinea) {
        origenFondosLineaId = lineaId;
        origenFondosSeleccionManual = false;
        origenFondosSeleccionadoId = null;
    }
    paletsFondosFabricacion = Array.isArray(palets) ? palets : [];
    if (!paletsFondosFabricacion.some((palet) => Number(palet.id) === origenFondosSeleccionadoId)) {
        origenFondosSeleccionadoId = null;
    }
    if (!origenFondosSeleccionManual && paletsFondosFabricacion.length === 1) {
        origenFondosSeleccionadoId = Number(paletsFondosFabricacion[0].id);
    }
    renderizarOrigenesFondosFabricacion();
}

async function agregarConsumoFondos() {
    const proveedorId = Number(document.getElementById("consumo-proveedor-fondos")?.value || 0);
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
        await wsRequest("agregar_palet_fondos_desde_stock", {
            proveedor_id: proveedorId,
            palet_origen_id: paletOrigenId,
            lote_palet: lotePalet,
            cubicaje,
            paquetes,
        });
        await cargarPaletsConsumoEnSelector();
        await cargarPaletsFondos();
        if (desdePalet) document.getElementById("consumo-palet-lote").value = "";
    } catch (error) {
        console.error("No se pudo agregar el consumo de fondos:", error);
        alert(error?.message || "No se pudo agregar el consumo de fondos.");
    }
}
