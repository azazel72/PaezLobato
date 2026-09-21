function prepararEventosFabricacion() {
    console.log("[fabricar-bota] prepararEventosFabricacion iniciado");
    registrarEventosVistaFabricacionSemanal();

    const btnImprimir = document.getElementById("fabricacion-imprimir-etiqueta");
    console.log("[fabricar-bota] boton abrir modal encontrado:", !!btnImprimir);

    const btnImprimirFabricarBota = document.getElementById("fabricar-bota-imprimir");
    console.log("[fabricar-bota] boton imprimir encontrado:", !!btnImprimirFabricarBota);
    if (btnImprimirFabricarBota) {
        btnImprimirFabricarBota.addEventListener("click", async () => {
            await imprimirEtiquetaFabricarBotaDesdeUI();
        });
    }

    const btnConfirmar = document.getElementById("fabricacion-confirmar-impresion");
    if (btnConfirmar) {
        btnConfirmar.addEventListener("click", async () => {
            const operariosIds = obtenerOperariosSeleccionados();
            if (!operariosIds.length) {
                alert("Selecciona al menos un operario.");
                return;
            }
            const inputCantidad = document.getElementById("fabricacion-cantidad-etiquetas");
            const cantidad = Math.max(1, Number.parseInt(inputCantidad?.value || "1", 10) || 1);
            if (inputCantidad) inputCantidad.value = String(cantidad);
            const modalEl = document.getElementById("modalOperarioFabricacion");
            const modal = modalEl ? bootstrap.Modal.getInstance(modalEl) : null;
            if (modal) modal.hide();
            await imprimirEtiquetaFabricacion(operariosIds, cantidad);
        });
    }

    const listaTrazFabricacion = document.getElementById("lista_trazabilidad_botas");
    if (listaTrazFabricacion) {
        listaTrazFabricacion.addEventListener("click", async (event) => {
            const item = event.target.closest("[data-lote]");
            if (!item) return;
            const lote = String(item.dataset.lote || "").trim();
            const activa = item.dataset.activa === "1";
            if (!lote) return;
            if (activa) {
                await actualizarEstadoLoteFabricacion(lote, 1);
            } else {
                await actualizarEstadoLoteFabricacion(lote, 0);
            }
            await cargarTrazabilidadFabricacion(lineaFabricacionActualId);
        });
    }

}

function registrarEventosVistaFabricacionSemanal() {
    const tablaLineas = document.querySelector("#vista_fabricacion_semanal #lista_fabricacion_semanal_botas");
    if (tablaLineas) {
        tablaLineas.addEventListener("click", function (event) {
            const botonCierre = event.target.closest("[data-action='abrir-cierre-semanal']");
            if (botonCierre) {
                event.stopPropagation();
                const lineaId = Number(botonCierre.getAttribute("data-linea-id") || 0);
                if (lineaId) {
                    abrirVistaCierreSemanalDesdeLinea?.(lineaId, "vista_fabricacion_semanal");
                }
                return;
            }
            const fila = event.target.closest("[data-linea-id]");
            if (!fila) return;
            seleccionarLineaFabricacionSemanal(fila);
        });
    }
}

let lineaFabricacionActualId = null;
let lineaFabricacionMaterialActualId = null;
let lineaFabricacionTipoActualId = null;
let lineaFabricacionTipoBotaActualId = null;
let ordenFabricacionActualId = null;
let lotesFabricacionTabla = [];

// Cache sencillo para datos que necesitamos mostrar
const terminalFabricacion = {
    clientes: null,
    estados_trazabilidad_fabricacion: null,
    tipos_producto: null,
    materiales: null,
    tostados: null,
    instalaciones: null,
    ubicaciones: null,
    palets: null,
    cubicaje: null,
    usuarios: null,
    proveedores: null,
    puestos_trabajo: null,
    pedidos: null,
    consumos: null,
};

async function refrescarMaestrosFabricacion() {
    try {
        const maestros = await wsRequest("maestros", {});
        terminalFabricacion.clientes = maestros?.clientes || {};
        terminalFabricacion.estados_trazabilidad_fabricacion = maestros?.estados_trazabilidad_fabricacion || {};
        terminalFabricacion.materiales = maestros?.materiales || {};
        terminalFabricacion.tostados = maestros?.tostados || {};
        terminalFabricacion.instalaciones = maestros?.instalaciones || {};
        terminalFabricacion.ubicaciones = maestros?.ubicaciones || {};
        terminalFabricacion.palets = maestros?.palets || {};
        terminalFabricacion.cubicaje = maestros?.cubicaje || {};
        terminalFabricacion.usuarios = maestros?.usuarios || {};
        terminalFabricacion.proveedores = maestros?.proveedores || {};
        terminalFabricacion.puestos_trabajo = maestros?.puestos_trabajo || {};
    } catch (err) {
        console.error("No se pudieron refrescar maestros:", err);
    }
}

async function asegurarDatosFabricacionTerminal() {
    if (
        terminalFabricacion.clientes &&
        terminalFabricacion.estados_trazabilidad_fabricacion &&
        terminalFabricacion.tipos_producto &&
        terminalFabricacion.materiales &&
        terminalFabricacion.tostados &&
        terminalFabricacion.ubicaciones &&
        terminalFabricacion.usuarios &&
        terminalFabricacion.proveedores
    ) return;
    try {
        const maestros = await wsRequest("maestros", {});
        terminalFabricacion.clientes = maestros?.clientes || {};
        terminalFabricacion.estados_trazabilidad_fabricacion = maestros?.estados_trazabilidad_fabricacion || {};
        terminalFabricacion.materiales = maestros?.materiales || {};
        terminalFabricacion.tostados = maestros?.tostados || {};
        terminalFabricacion.instalaciones = maestros?.instalaciones || {};
        terminalFabricacion.ubicaciones = maestros?.ubicaciones || {};
        terminalFabricacion.palets = maestros?.palets || {};
        terminalFabricacion.cubicaje = maestros?.cubicaje || {};
        terminalFabricacion.usuarios = maestros?.usuarios || {};
        terminalFabricacion.proveedores = maestros?.proveedores || {};
        terminalFabricacion.puestos_trabajo = maestros?.puestos_trabajo || {};
        const fabricacion = await wsRequest("fabricacion", {});
        terminalFabricacion.pedidos = fabricacion?.pedidos || {};
        terminalFabricacion.tipos_producto = fabricacion?.tipos_producto || {};
        terminalFabricacion.consumos = fabricacion?.consumos || {};
    } catch (err) {
        console.error("No se pudieron cargar datos de fabricacion:", err);
        terminalFabricacion.clientes = terminalFabricacion.clientes || {};
        terminalFabricacion.estados_trazabilidad_fabricacion = terminalFabricacion.estados_trazabilidad_fabricacion || {};
        terminalFabricacion.tipos_producto = terminalFabricacion.tipos_producto || {};
        terminalFabricacion.materiales = terminalFabricacion.materiales || {};
        terminalFabricacion.tostados = terminalFabricacion.tostados || {};
        terminalFabricacion.instalaciones = terminalFabricacion.instalaciones || {};
        terminalFabricacion.ubicaciones = terminalFabricacion.ubicaciones || {};
        terminalFabricacion.palets = terminalFabricacion.palets || {};
        terminalFabricacion.cubicaje = terminalFabricacion.cubicaje || {};
        terminalFabricacion.usuarios = terminalFabricacion.usuarios || {};
        terminalFabricacion.proveedores = terminalFabricacion.proveedores || {};
        terminalFabricacion.puestos_trabajo = terminalFabricacion.puestos_trabajo || {};
        terminalFabricacion.pedidos = terminalFabricacion.pedidos || {};
        terminalFabricacion.consumos = terminalFabricacion.consumos || {};
    }
}

async function cargarFabricacionSemanalActivaFabricacion(opciones = {}) {
    const autoAbrirLineaUnica = opciones.autoAbrirLineaUnica !== false;
    const contenedor = document.querySelector("#lista_fabricacion_semanal_botas");
    if (!contenedor) return;
    try {
        await asegurarDatosFabricacionTerminal();
        const fabricacion = (await wsRequest("fabricacion", {})) || {};
        terminalFabricacion.pedidos = fabricacion?.pedidos || {};
        terminalFabricacion.tipos_producto = fabricacion?.tipos_producto || {};
        const lineas = Object.values(fabricacion?.fabricacion_semanal || {})
            .filter((l) => Number(l?.estado || 0) === 2);

        if (!lineas.length) {
            contenedor.innerHTML = `<div class="fabricacion-card-empty">No hay fabricacion semanal activa</div>`;
            return;
        }

        actualizarCardsFabricacionSemanalBotas(lineas);

        if (autoAbrirLineaUnica && lineas.length === 1) {
            const filaUnica = contenedor.querySelector("[data-linea-id]");
            if (filaUnica) {
                await mostrarLineaFabricacion(filaUnica);
            }
        }
    } catch (err) {
        console.error(err);
        contenedor.innerHTML = `<div class="fabricacion-card-empty">Error al cargar fabricacion semanal activa</div>`;
    }
}

function seleccionarLineaFabricacionSemanal(fila) {
    if (!fila || fila.closest("thead") || fila.closest("tfoot")) return;
    mostrarLineaFabricacion(fila);
}

async function mostrarLineaFabricacion(fila) {
    lineaFabricacionActualId = Number(fila.dataset.lineaId || 0) || null;
    lineaFabricacionMaterialActualId = Number(fila.dataset.materialId || 0) || null;
    lineaFabricacionTipoBotaActualId = Number(fila.dataset.tipoProductoId || 0) || null;
    lineaFabricacionTipoActualId = lineaFabricacionTipoBotaActualId;
    ordenFabricacionActualId = Number(fila.dataset.pedidoId || 0) || null;
    const tipoId = Number(fila.dataset.tipoProductoId || 0) || null;
    const descripcionProducto =
        (tipoId && terminalFabricacion.tipos_producto?.[tipoId]?.descripcion) ||
        fila.children?.[0]?.textContent ||
        "Producto";
    const descripcionMaterial =
        (lineaFabricacionMaterialActualId && terminalFabricacion.materiales?.[lineaFabricacionMaterialActualId]?.descripcion) ||
        descripcionProducto;
    const cantidadFabricar = Number(fila.dataset.cantidadFabricar || 0) || 0;
    const cantidadFabricada = Number(fila.dataset.cantidadFabricada || 0) || 0;
    const pedidoDescripcionData = (fila.dataset.pedidoDescripcion || "").trim();
    const pedidoIdData = Number(fila.dataset.pedidoId || 0) || ordenFabricacionActualId || null;
    const pedidoDescripcionMapa = (pedidoIdData && terminalFabricacion.pedidos?.[pedidoIdData]?.descripcion) || "";
    const pedidoDescripcion = (pedidoDescripcionData || pedidoDescripcionMapa || "").trim();
    const infoLinea = typeof obtenerInfoLineaSemanal === "function"
        ? obtenerInfoLineaSemanal({
            pedido_id: pedidoIdData,
            tipo_producto_id: tipoId,
            material_id: lineaFabricacionMaterialActualId,
            tostado_id: Number(fila.dataset.tostadoId || 0) || null,
            cantidad: cantidadFabricar,
            cantidad_fabricada: cantidadFabricada,
        })
        : null;
    const descripcionTostado =
        (lineaFabricacionActualId && terminalFabricacion.tostados?.[Number(fila.dataset.tostadoId || 0)]?.descripcion) ||
        (infoLinea?.tostado || "-");
    const resumenProducto = `Tipo: ${descripcionProducto} | Madera: ${descripcionMaterial} | Tostado: ${descripcionTostado}`;
    const titulo = document.getElementById("botas-producto-orden");
    if (titulo) {
        titulo.textContent = resumenProducto;
    }
    const resumenCantidades = document.getElementById("botas-resumen-cantidades");
    if (resumenCantidades) {
        resumenCantidades.textContent = infoLinea
            ? construirResumenCantidadesLinea(infoLinea)
            : `Semana: pedida ${cantidadFabricar} | fabricada ${cantidadFabricada}`;
    }
    const tituloPanel = document.getElementById("botas-panel-titulo");
    if (tituloPanel) {
        const baseTitulo = "Fabricar bota";
        tituloPanel.textContent = pedidoDescripcion
            ? `${baseTitulo}: ${pedidoDescripcion}`
            : baseTitulo;
    }
    if (typeof mostrarSeccion === "function") {
        mostrarSeccion("vista_fabricacion");
    }
    const inputCantidad = document.getElementById("fabricar-bota-cantidad-etiquetas");
    if (inputCantidad && (!inputCantidad.value || Number(inputCantidad.value) < 0)) {
        inputCantidad.value = "0";
    }
    await cargarOperariosFondadoEnSelector(true);
    await cargarCodigosBatideroEnSelector(true);
    if (typeof setPantalla === "function") {
        setPantalla("vista_fabricacion", { pedido_id: ordenFabricacionActualId, fabricacion_semanal_id: lineaFabricacionActualId });
    }
    if (lineaFabricacionActualId) {
        cargarTrazabilidadFabricacion(lineaFabricacionActualId);
        cargarPaletsTapas(lineaFabricacionActualId);
    }
}

function actualizarCardsFabricacionSemanalBotas(lineas) {
    const contenedor = document.querySelector("#lista_fabricacion_semanal_botas");
    if (!contenedor) return;
    contenedor.innerHTML = "";
    if (!lineas || !lineas.length) {
        contenedor.innerHTML = `<div class="fabricacion-card-empty">Sin líneas en estado Producción</div>`;
        return;
    }

    lineas.forEach((linea) => {
        const card = document.createElement("article");
        card.className = "fabricacion-card";
        card.dataset.lineaId = linea.id ?? "";
        card.dataset.tipoProductoId = linea.tipo_producto_id ?? "";
        card.dataset.materialId = linea.material_id ?? "";
        card.dataset.tostadoId = linea.tostado_id ?? "";
        card.dataset.pedidoId = linea.pedido_id ?? "";
        card.dataset.cantidadFabricar = linea.cantidad ?? "";
        card.dataset.cantidadFabricada = linea.cantidad_fabricada ?? "";

        const pedido = terminalFabricacion.pedidos?.[linea.pedido_id] || null;
        const pedidoDescripcion = (pedido?.descripcion || `Pedido ${linea.pedido_id || "-"}`).trim();
        card.dataset.pedidoDescripcion = pedidoDescripcion;

        const info = typeof obtenerInfoLineaSemanal === "function"
            ? obtenerInfoLineaSemanal(linea)
            : {
                fechaInicio: formatearFechaEuropea(linea.fecha_inicio),
                tipo: terminalFabricacion.tipos_producto?.[linea.tipo_producto_id]?.descripcion || "-",
                material: terminalFabricacion.materiales?.[linea.material_id]?.descripcion || "-",
                tostado: terminalFabricacion.tostados?.[linea.tostado_id]?.descripcion || "-",
                semanaPedida: Number(linea.cantidad) || 0,
                semanaFabricada: Number(linea.cantidad_fabricada) || 0,
                pedidoTotal: Number(pedido?.cantidad) || 0,
                pedidoFabricado: Number(pedido?.cantidad_fabricada) || 0,
            };

        card.innerHTML = `
      <div class="fabricacion-card-title">
        <div>
          <h6>${pedidoDescripcion}</h6>
        </div>
        <span class="fabricacion-card-date">${info.fechaInicio || "-"}</span>
      </div>
      <div class="fabricacion-card-grid">
        <div class="fabricacion-card-field">
          <span class="fabricacion-card-label">Tipo</span>
          <span class="fabricacion-card-value">${info.tipo}</span>
        </div>
        <div class="fabricacion-card-field">
          <span class="fabricacion-card-label">Material</span>
          <span class="fabricacion-card-value">${info.material}</span>
        </div>
        <div class="fabricacion-card-field">
          <span class="fabricacion-card-label">Tostado</span>
          <span class="fabricacion-card-value">${info.tostado || "-"}</span>
        </div>
        <div class="fabricacion-card-field fabricacion-card-field-semana-pedida">
          <span class="fabricacion-card-label">Semana pedida</span>
          <span class="fabricacion-card-value">${info.semanaPedida}</span>
        </div>
        <div class="fabricacion-card-field">
          <span class="fabricacion-card-label">Semana fabricada</span>
          <span class="fabricacion-card-value">${info.semanaFabricada}</span>
        </div>
        <div class="fabricacion-card-field">
          <span class="fabricacion-card-label">Pedido total</span>
          <span class="fabricacion-card-value">${info.pedidoTotal}</span>
        </div>
        <div class="fabricacion-card-field">
          <span class="fabricacion-card-label">Pedido fabricado</span>
          <span class="fabricacion-card-value">${info.pedidoFabricado}</span>
        </div>
      </div>
        <div class="fabricacion-card-actions">
          <button type="button" class="btn btn-outline-primary btn-sm" data-action="abrir-cierre-semanal" data-linea-id="${linea.id ?? ""}">
            <i class="bi bi-clipboard-check"></i> Cierre semanal
          </button>
        </div>
    `;
        contenedor.appendChild(card);
    });
}

function formatearFechaEuropea(valor) {
    if (!valor) return "";
    const d = new Date(valor);
    if (Number.isNaN(d.getTime())) return valor;
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
}

function formatearNumeroFabricacion(valor) {
    return Number(valor || 0).toLocaleString("es-ES", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 3,
    });
}

function actualizarResumenLotesFabricacion() {
    const resumen = document.getElementById("resumen_trazabilidad_botas");
    if (!resumen) return;
    const lotesActivos = lotesFabricacionTabla
        .filter((item) => item.activa)
        .map((item) => item.lote)
        .filter(Boolean);
    const texto = lotesActivos.join(" / ");
    resumen.textContent = texto;
    resumen.title = texto;
}

async function cargarTrazabilidadFabricacion(lineaId) {
    const lista = document.getElementById("lista_trazabilidad_botas");
    if (!lista) return;
    try {
        await asegurarDatosFabricacionTerminal();
        const trazas = (await wsRequest("listar_trazabilidad_fabricacion", {
            fabricacion_semanal_id: lineaId,
            // Código anterior: incluir_huerfanas: true,
            incluir_compartidas: true,
        })) || [];
        lotesFabricacionTabla = agruparLotesFabricacion(trazas);
        actualizarResumenLotesFabricacion();
        lista.innerHTML = "";
        if (!lotesFabricacionTabla.length) {
            lista.innerHTML = `<div class="panel-botas-trazas-vacio">Sin registros</div>`;
            return;
        }
        lotesFabricacionTabla.forEach((item) => {
            const card = document.createElement("article");
            card.className = `bota-lote-item${item.activa ? " bota-lote-item-activo" : ""}`;
            card.dataset.lote = item.lote;
            card.dataset.activa = item.activa ? "1" : "0";
            const restante = Math.max(0, item.volumenTotal - item.consumidoTotal);
            card.innerHTML = `
        <div class="bota-lote-titulo">${item.lote}</div>
        <div class="bota-lote-detalle">M3: ${formatearNumeroFabricacion(item.volumenTotal)} - ${formatearNumeroFabricacion(item.consumidoTotal)} = ${formatearNumeroFabricacion(restante)}</div>
        <div class="bota-lote-detalle">Botas: ${item.cantidad} fab. / ${item.botasRestantesEstimadas} rest.</div>
      `;
            lista.appendChild(card);
        });
    } catch (err) {
        console.error(err);
        lotesFabricacionTabla = [];
        actualizarResumenLotesFabricacion();
        lista.innerHTML = `<div class="panel-botas-trazas-vacio">Error al cargar lotes</div>`;
    }
}

async function abrirModalOperarioFabricacion() {
    const modalEl = document.getElementById("modalOperarioFabricacion");
    if (!modalEl) return;
    const inputCantidad = document.getElementById("fabricacion-cantidad-etiquetas");
    if (inputCantidad && (!inputCantidad.value || Number(inputCantidad.value) < 1)) {
        inputCantidad.value = "1";
    }
    await asegurarDatosFabricacionTerminal();
    await cargarOperariosEnModal();
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
    ajustarZIndexModal(modalEl);
}

async function cargarCodigosBatideroEnSelector(mantenerSeleccion = false) {
    const selector = document.getElementById("fabricar-bota-batidero");
    if (!selector) return;
    const valorPrevio = selector.value || "";
    const dias = ["Jueves", "Viernes", "Lunes", "Martes", "Miércoles"];
    const options = [`<option value="">Seleccione código...</option>`];
    for (let i = 0; i < dias.length; i += 1) {
        const base = (i + 1) * 10;
        const manana = base + 1;
        const mediaTarde = base + 2;
        const tarde = base + 3;
        options.push(`<option value="${manana}">${manana} (${dias[i]} mañana)</option>`);
        options.push(`<option value="${mediaTarde}">${mediaTarde} (${dias[i]} media mañana)</option>`);
        options.push(`<option value="${tarde}">${tarde} (${dias[i]} tarde)</option>`);
    }
    selector.innerHTML = options.join("");
    if (mantenerSeleccion && valorPrevio && Array.from(selector.options).some((opt) => opt.value === valorPrevio)) {
        selector.value = valorPrevio;
        return;
    }
    selector.value = "";
}

function obtenerLoteDesdeCodigoPalet(codigoPalet) {
    return String(codigoPalet || "").split("#", 1)[0].trim().slice(0, 8);
}

function resolverConsumoDuelaFabricacion(tipoBotaId) {
    const consumos = Object.values(terminalFabricacion.consumos || {});
    const tipos = terminalFabricacion.tipos_producto || {};
    const botaIdNum = Number(tipoBotaId || 0);
    if (!botaIdNum) return 0;

    return consumos.reduce((total, c) => {
        if (Number(c?.bota_id || 0) !== botaIdNum) return total;
        const tipoConsumible = tipos?.[Number(c?.consumible_id || 0)];
        return total + (String(tipoConsumible?.tipo || "").toUpperCase() === "DUELA"
            ? Number(c?.consumo || 0) || 0
            : 0);
    }, 0);
}

function agruparLotesFabricacion(trazas) {
    const consumoDuela = resolverConsumoDuelaFabricacion(lineaFabricacionTipoBotaActualId);
    const lotes = new Map();
    (trazas || []).forEach((t) => {
        const codigoPalet = t.palet_codigo || t.palet_id || "";
        const lote = obtenerLoteDesdeCodigoPalet(codigoPalet) || String(codigoPalet || "");
        if (!lote) return;
        if (!lotes.has(lote)) {
            lotes.set(lote, {
                lote,
                palets: 0,
                cantidad: 0,
                volumenTotal: 0,
                consumidoTotal: 0,
                botasRestantesEstimadas: 0,
                primerRegistroId: Number(t.id || 0) || Number.MAX_SAFE_INTEGER,
                activa: false,
                trazas: [],
            });
        }
        const item = lotes.get(lote);
        const cubicaje = Number(t.palet_cubicaje || 0) || 0;
        const consumido = Number(t.palet_consumido || 0) || 0;
        item.palets += 1;
        item.cantidad += Number(t.cantidad_fabricada || 0);
        item.volumenTotal += cubicaje;
        item.consumidoTotal += consumido;
        item.primerRegistroId = Math.min(item.primerRegistroId, Number(t.id || 0) || Number.MAX_SAFE_INTEGER);
        item.activa = item.activa || Number(t.estado || 0) === 0;
        item.trazas.push(t);
    });
    lotes.forEach((item) => {
        const restante = Math.max(0, item.volumenTotal - item.consumidoTotal);
        item.botasRestantesEstimadas = consumoDuela > 0 ? Math.floor(restante / consumoDuela) : 0;
        item.agotado = restante <= 0;
    });
    return Array.from(lotes.values()).sort((a, b) => {
        if (a.agotado !== b.agotado) return a.agotado ? 1 : -1;
        if (a.primerRegistroId !== b.primerRegistroId) return a.primerRegistroId - b.primerRegistroId;
        return String(a.lote).localeCompare(String(b.lote), "es", { numeric: true, sensitivity: "base" });
    });
}

async function actualizarEstadoLoteFabricacion(lote, estado) {
    const grupo = lotesFabricacionTabla.find((item) => item.lote === lote);
    if (!grupo?.trazas?.length) return;
    // Código anterior, conservado para revertir:
    // for (const traza of grupo.trazas) {
    //     if (!traza?.id) continue;
    //     await wsRequest("actualizar_estado_trazabilidad_fabricacion", { id: traza.id, estado });
    // }
    await wsRequest("actualizar_estado_lote_fabricacion_compartida", {
        fabricacion_semanal_id: lineaFabricacionActualId,
        lote,
        estado,
    });
}

function sincronizarBackdropModales() {
    const modalesAbiertos = document.querySelectorAll(".modal.show").length;
    const backdrops = Array.from(document.querySelectorAll(".modal-backdrop"));
    if (modalesAbiertos <= 0) {
        backdrops.forEach((el) => el.remove());
        document.body.classList.remove("modal-open");
        document.body.style.removeProperty("padding-right");
        document.body.style.removeProperty("overflow");
        return;
    }
    if (backdrops.length > modalesAbiertos) {
        backdrops.slice(0, backdrops.length - modalesAbiertos).forEach((el) => el.remove());
    }
}

function obtenerUltimaAsignacionPorUsuario(items = []) {
    const porUsuario = new Map();
    for (const item of items) {
        const usuario = item?.usuario || null;
        if (!usuario?.id) continue;
        const existente = porUsuario.get(usuario.id);
        if (!existente || ((item.fecha || "") > (existente.fecha || ""))) {
            porUsuario.set(usuario.id, item);
        }
    }
    return Array.from(porUsuario.values());
}

async function cargarOperariosFondadoEnSelector(mantenerSeleccion = false) {
    const selector = document.getElementById("fabricar-bota-operario-fondado");
    if (!selector) return;
    const valorPrevio = selector.value || "";
    try {
        selector.innerHTML = `<option value="">Cargando operarios...</option>`;
        const payload = (await wsRequest("listar_operarios_planificacion_fabricacion", {
            puesto_nombre: "FONDAR",
            dias_previos: 2,
            incluir_otros: false,
        })) || [];
        const lista = obtenerUltimaAsignacionPorUsuario(payload)
            .sort((a, b) => {
                const na = (a?.usuario?.nombre || a?.usuario?.alias || "").toString();
                const nb = (b?.usuario?.nombre || b?.usuario?.alias || "").toString();
                return na.localeCompare(nb, "es", { sensitivity: "base" });
            });

        if (!lista.length) {
            selector.innerHTML = `<option value="">Sin operarios de FONDAR (ultimos 2 dias)</option>`;
            return;
        }

        selector.innerHTML = `<option value="">Seleccione operario...</option>` + lista.map((item) => {
            const u = item.usuario || {};
            const nombre = u.nombre || u.alias || `Empleado ${u.id || ""}`.trim();
            const fecha = item.fecha ? formatearFechaEuropea(item.fecha) : "";
            return `<option value="${u.id}">${nombre}${fecha ? " | " + fecha : ""}</option>`;
        }).join("");
        if (mantenerSeleccion && valorPrevio && Array.from(selector.options).some((opt) => opt.value === valorPrevio)) {
            selector.value = valorPrevio;
            return;
        }
        selector.value = "";
    } catch (err) {
        console.error("No se pudieron cargar operarios de fondado:", err);
        selector.innerHTML = `<option value="">Error cargando operarios</option>`;
    }
}

async function imprimirEtiquetaFabricarBotaDesdeUI() {
    if (!lineaFabricacionActualId) {
        alert("Seleccione una linea de fabricacion.");
        return;
    }
    const lotesSeleccionados = lotesFabricacionTabla
        .filter((item) => item.activa)
        .map((item) => item.lote);
    const batidero = Number(document.getElementById("fabricar-bota-batidero")?.value || 0);
    const operarioFondadoId = Number(document.getElementById("fabricar-bota-operario-fondado")?.value || 0);
    const cantidad = Number(document.getElementById("fabricar-bota-cantidad-etiquetas")?.value || 0);
    const paletTapasId = obtenerOrigenTapasSeleccionadoId();
    if (!paletTapasId) {
        alert("Debes seleccionar un origen de tapas.");
        return;
    }
    if (!lotesSeleccionados.length || !batidero || !operarioFondadoId || cantidad <= 0) {
        alert("Debes seleccionar al menos un lote, y completar batidero y operario de fondado.");
        return;
    }
    try {
        const payload = {
            fabricacion_semanal_id: lineaFabricacionActualId,
            lotes: lotesSeleccionados,
            tipo: "BOTA",
            operarios_ids: [operarioFondadoId],
            batidero,
            cantidad_etiquetas: cantidad,
            palet_tapas_id: paletTapasId,
        };
        console.log("[fabricar-bota] enviando wsRequest imprimir_etiqueta_fabricacion", payload);
        const resp = await wsRequest("imprimir_etiqueta_fabricacion", payload);
        console.log("[fabricar-bota] respuesta wsRequest imprimir_etiqueta_fabricacion", resp);

        cargarTrazabilidadFabricacion(lineaFabricacionActualId);
        cargarPaletsTapas(lineaFabricacionActualId);
        //cargarFabricacionSemanalActivaFabricacion();
        const cantidadInput = document.getElementById("fabricar-bota-cantidad-etiquetas");
        if (cantidadInput) {
            cantidadInput.value = "0";
        }
    } catch (err) {
        console.error("[fabricar-bota] error en imprimir_etiqueta_fabricacion", err);
        alert("Error al imprimir etiqueta.");
    }
}

function ajustarZIndexModal(modalEl) {
    const abiertos = document.querySelectorAll(".modal.show").length;
    const base = 1050;
    const zIndex = base + (abiertos * 10);
    modalEl.style.zIndex = zIndex;
    const backdrop = document.querySelector(".modal-backdrop.show:last-of-type");
    if (backdrop) {
        backdrop.style.zIndex = zIndex - 1;
    }
}

function obtenerFechasPreferencia() {
    const fechas = [];
    const hoy = new Date();
    fechas.push(formatearFechaYYYYMMDD(hoy));
    let cursor = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    let count = 0;
    while (count < 3) {
        cursor.setDate(cursor.getDate() - 1);
        const day = cursor.getDay();
        if (day === 0 || day === 6) continue;
        fechas.push(formatearFechaYYYYMMDD(cursor));
        count += 1;
    }
    return fechas;
}

function formatearFechaYYYYMMDD(fecha) {
    const y = fecha.getFullYear();
    const m = String(fecha.getMonth() + 1).padStart(2, "0");
    const d = String(fecha.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

function formatearFechaYYYYMMDDUtc(fecha) {
    const y = fecha.getUTCFullYear();
    const m = String(fecha.getUTCMonth() + 1).padStart(2, "0");
    const d = String(fecha.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

function obtenerInicioCuadranteDesdeFecha(fechaStr) {
    const base = obtenerAnteriorDiaSemana(4, new Date(fechaStr + "T00:00:00"));
    return formatearFechaYYYYMMDDUtc(base);
}

async function obtenerOperariosPorPuesto(fechas) {
    const puestosFabricacion = Object.values(terminalFabricacion.puestos_trabajo || {})
        .filter((p) => p && p.fabricacion)
        .map((p) => p.id);
    if (!puestosFabricacion.length || !fechas.length) return new Map();

    const fechasSet = new Set(fechas);
    const cuadrantesPorInicio = new Map();
    const inicios = Array.from(new Set(fechas.map(obtenerInicioCuadranteDesdeFecha)));
    for (const inicio of inicios) {
        try {
            const cuadrante = await wsRequest("cargar_cuadrantes", { fecha: inicio });
            cuadrantesPorInicio.set(inicio, cuadrante);
        } catch (err) {
            console.warn("No se pudo cargar cuadrante:", inicio, err);
        }
    }

    const porPuesto = new Map();
    for (const cuadrante of cuadrantesPorInicio.values()) {
        const detalles = cuadrante?.detalles || [];
        detalles.forEach((det) => {
            if (!fechasSet.has(det.fecha)) return;
            if (!puestosFabricacion.includes(det.puesto_id)) return;
            if (!det.usuario_id) return;
            if (!porPuesto.has(det.puesto_id)) {
                porPuesto.set(det.puesto_id, new Set());
            }
            porPuesto.get(det.puesto_id).add(det.usuario_id);
        });
    }
    return porPuesto;
}

function ordenarEmpleadosPorNombre(empleados) {
    return empleados.sort((a, b) => {
        const na = (a?.nombre || a?.alias || "").toString();
        const nb = (b?.nombre || b?.alias || "").toString();
        return na.localeCompare(nb, "es", { sensitivity: "base" });
    });
}

function crearFilaSeccion(texto) {
    const tr = document.createElement("tr");
    tr.className = "table-secondary";
    const td = document.createElement("td");
    td.colSpan = 2;
    td.textContent = texto;
    tr.appendChild(td);
    return tr;
}

function crearFilaOperario({ id, nombre, fecha, checked = false }) {
    const tr = document.createElement("tr");
    tr.dataset.operarioId = id;
    if (checked) tr.classList.add("operario-row-selected");
    const fechaTexto = fecha ? (typeof formatearFechaEuropea === "function" ? formatearFechaEuropea(fecha) : fecha) : "";
    tr.innerHTML = `
      <td>${fechaTexto}</td>
      <td>${nombre}</td>
    `;
    tr.addEventListener("click", (e) => {
        tr.classList.toggle("operario-row-selected");
    });
    return tr;
}

async function cargarOperariosEnModal() {
    const tbody = document.querySelector("#tabla_operarios_fabricacion tbody");
    const btnConfirmar = document.getElementById("fabricacion-confirmar-impresion");
    if (!tbody) return;
    let payload = [];
    try {
        payload = await wsRequest("listar_operarios_planificacion_fabricacion", {}) || [];
    } catch (err) {
        console.warn("No se pudieron cargar operarios planificados:", err);
    }
    tbody.innerHTML = "";
    if (!payload.length) {
        const tr = document.createElement("tr");
        const td = document.createElement("td");
        td.colSpan = 2;
        td.textContent = "No hay empleados disponibles.";
        tr.appendChild(td);
        tbody.appendChild(tr);
        if (btnConfirmar) btnConfirmar.disabled = true;
        return;
    }
    if (btnConfirmar) btnConfirmar.disabled = false;
    const planificados = payload.filter((p) => p.origen === "planificacion");
    const otros = payload.filter((p) => p.origen !== "planificacion");

    const porPuesto = new Map();
    planificados.forEach((item) => {
        const puestoId = item.puesto_id || 0;
        if (!porPuesto.has(puestoId)) porPuesto.set(puestoId, new Map());
        const porUsuario = porPuesto.get(puestoId);
        const usuarioId = item.usuario_id;
        if (!usuarioId) return;
        const existente = porUsuario.get(usuarioId);
        if (!existente || (item.fecha && existente.fecha < item.fecha)) {
            porUsuario.set(usuarioId, item);
        }
    });

    const yaListados = new Set();
    const getPuestoNombre = (map) => map.values().next().value?.puesto_nombre || "";
    Array.from(porPuesto.entries())
        .sort((a, b) => getPuestoNombre(a[1]).localeCompare(getPuestoNombre(b[1]), "es", { sensitivity: "base" }))
        .forEach(([puestoId, porUsuario]) => {
            const sample = porUsuario.values().next().value;
            const puestoNombre = sample?.puesto_nombre || `Puesto ${puestoId}`;
            const lista = Array.from(porUsuario.values()).sort((a, b) => {
                const na = a?.usuario?.nombre || a?.usuario?.alias || "";
                const nb = b?.usuario?.nombre || b?.usuario?.alias || "";
                return na.localeCompare(nb, "es", { sensitivity: "base" });
            });
            if (!lista.length) return;
            tbody.appendChild(crearFilaSeccion(`Puesto: ${puestoNombre}`));
            lista.forEach((item) => {
                const u = item.usuario || {};
                if (u.id) yaListados.add(u.id);
                tbody.appendChild(crearFilaOperario({
                    id: u.id,
                    nombre: u.nombre || u.alias || `Empleado ${u.id || ""}`.trim(),
                    fecha: item.fecha,
                    checked: false,
                }));
            });
        });

    const otrosFiltrados = ordenarEmpleadosPorNombre(
        otros
            .map((o) => o.usuario)
            .filter((u) => u && !yaListados.has(u.id))
    );
    if (otrosFiltrados.length) {
        tbody.appendChild(crearFilaSeccion("Otros operarios"));
        otrosFiltrados.forEach((u) => {
            tbody.appendChild(crearFilaOperario({
                id: u.id,
                nombre: u.nombre || u.alias || `Empleado ${u.id}`,
                fecha: "",
                checked: false,
            }));
        });
    }
}

function obtenerOperariosSeleccionados() {
    const seleccionados = Array.from(
        document.querySelectorAll("#tabla_operarios_fabricacion tbody tr.operario-row-selected")
    )
        .map((tr) => Number(tr.dataset.operarioId))
        .filter((id) => Number.isFinite(id));
    return Array.from(new Set(seleccionados));
}

async function imprimirEtiquetaFabricacion(operariosIds = [], cantidadEtiquetas = 1) {
    if (!lineaFabricacionActualId) {
        alert("Seleccione una linea de fabricacion.");
        return;
    }
    if (!obtenerOrigenTapasSeleccionadoId()) {
        alert("Debes seleccionar un origen de tapas.");
        return;
    }
    try {
        const trazas = (await wsRequest("listar_trazabilidad_fabricacion", {
            fabricacion_semanal_id: lineaFabricacionActualId,
            // Código anterior: incluir_huerfanas: true,
            incluir_compartidas: true,
        })) || [];
        const activas = trazas.filter((t) => Number(t.estado || 0) === 0);
        if (!activas.length) {
            alert("No hay palets activos para imprimir.");
            return;
        }
        const trazabilidadIds = activas
            .map((t) => Number(t.id))
            .filter((id) => !!id);
        const paletCodigos = activas.map((t) => t.palet_codigo || t.palet_id || "").filter(Boolean);
        const resp = await wsRequest("imprimir_etiqueta_fabricacion", {
            trazabilidad_ids: trazabilidadIds,
            palet_codigos: paletCodigos,
            tipo: "BOTA",
            operarios_ids: operariosIds,
            cantidad_etiquetas: Math.max(1, Number.parseInt(String(cantidadEtiquetas), 10) || 1),
            palet_tapas_id: obtenerOrigenTapasSeleccionadoId(),
        });
        console.log("Etiqueta creada:", resp);
        cargarTrazabilidadFabricacion(lineaFabricacionActualId);
        cargarPaletsTapas(lineaFabricacionActualId);
        cargarFabricacionSemanalActivaFabricacion();
    } catch (err) {
        console.error(err);
        alert("Error al imprimir etiqueta.");
    }
}


function refrescarFabricacionDesdeServidor(_data = {}) {
    if (typeof pantallaActual !== "undefined" && pantallaActual !== "vista_fabricacion") cargarFabricacionSemanalActivaFabricacion();
    if (lineaFabricacionActualId) {
        cargarTrazabilidadFabricacion(lineaFabricacionActualId);
    }
}
