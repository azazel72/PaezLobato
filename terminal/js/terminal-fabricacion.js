function prepararEventosFabricacion() {
    console.log("[fabricar-bota] prepararEventosFabricacion iniciado");
    registrarEventosVistaFabricacionSemanal();

    document.getElementById("lista_fabricacion_semanal_botas_header")?.addEventListener("click", async (event) => {
        if (event.target.closest("[data-action='abrir-cierre-semanal']")) return;
        const tarjeta = event.target.closest("[data-linea-id]");
        if (tarjeta) await seleccionarFabricacionDesdePhp(tarjeta);
    });

    document.getElementById("lista_trazabilidad_botas")?.addEventListener("click", async (event) => {
        const tarjeta = event.target.closest("[data-lote-id]");
        if (!tarjeta) return;
        await cambiarEstadoLoteBota(Number(tarjeta.dataset.loteId), Number(tarjeta.dataset.estado) === 1 ? 0 : 1);
    });

    document.getElementById("fabricar-bota-fondos-listado")?.addEventListener("click", async (event) => {
        const tarjeta = event.target.closest("[data-lote-id]");
        if (!tarjeta) return;
        await seleccionarLoteFondo(Number(tarjeta.dataset.loteId));
    });

    const btnImprimir = document.getElementById("fabricacion-imprimir-etiqueta");
    console.log("[fabricar-bota] boton abrir modal encontrado:", !!btnImprimir);

    const btnImprimirFabricarBota = document.getElementById("fabricar-bota-imprimir");
    console.log("[fabricar-bota] boton imprimir encontrado:", !!btnImprimirFabricarBota);
    if (btnImprimirFabricarBota) {
        btnImprimirFabricarBota.addEventListener("click", async () => {
            await imprimirEtiquetaFabricarBotaDesdeUI();
        });
    }

    document.getElementById("fabricacion-cierre-semanal")?.addEventListener("click", () => {
        const boton = document.getElementById("fabricacion-cierre-semanal");
        const lineaId = Number(boton?.dataset.lineaId || lineaFabricacionActualId || 0);
        console.info("[fabricacion] abrir cierre semanal", { fabricacion_semanal_id: lineaId });
        abrirVistaCierreSemanalDesdeLinea?.(lineaId, "vista_fabricacion");
    });

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

async function seleccionarFabricacionDesdePhp(tarjeta) {
    const lineaId = Number(tarjeta.dataset.lineaId || 0);
    if (!lineaId) return;
    try {
        const respuesta = await GET(`../api/terminal/fabricacion_seleccion.php?id=${encodeURIComponent(lineaId)}`);
        const linea = respuesta?.fabricacion || {};
        lineaFabricacionActualId = lineaId;
        ordenFabricacionActualId = Number(linea.pedido_id || 0) || null;
        lineaFabricacionMaterialActualId = Number(linea.material_id || 0) || null;
        lineaFabricacionTipoBotaActualId = Number(linea.tipo_producto_id || 0) || null;
        lineaFabricacionTipoActualId = lineaFabricacionTipoBotaActualId;
        document.querySelectorAll("#lista_fabricacion_semanal_botas_header [data-linea-id]").forEach((item) => {
            item.classList.toggle("fabricacion-card-seleccionada", item === tarjeta);
        });
        const selectorFabricaciones = document.getElementById("fabricacion-semanal-selector");
        if (selectorFabricaciones) selectorFabricaciones.open = false;
        const botonCierre = document.getElementById("fabricacion-cierre-semanal");
        if (botonCierre) {
            botonCierre.dataset.lineaId = String(lineaId);
            botonCierre.disabled = false;
        }
        const producto = document.getElementById("botas-producto-orden");
        if (producto) producto.textContent = `Tipo/Material: ${linea.tipo_descripcion || "-"} / ${linea.material_descripcion || "-"}`;
        const cantidades = document.getElementById("botas-resumen-cantidades");
        if (cantidades) {
            cantidades.innerHTML = `Tostado: ${linea.tostado_descripcion || "-"}<br>Pedido total/fabricado: ${Number(linea.pedido_cantidad || 0)} / ${Number(linea.pedido_cantidad_fabricada || 0)}<br>Semana total/fabricado: ${Number(linea.cantidad || 0)} / ${Number(linea.cantidad_fabricada || 0)}`;
        }
        const titulo = document.getElementById("botas-panel-titulo");
        if (titulo) titulo.textContent = linea.pedido_descripcion ? `Fabricación de botas: ${linea.pedido_descripcion}` : "Fabricación de botas";
    } catch (error) {
        console.error("No se pudo seleccionar la fabricación:", error);
    } finally {
        actualizarBotonImpresionBotas();
    }
}

async function cambiarEstadoLoteBota(id, estado) {
    if (!id) return;
    await POST("../api/terminal/lotes_botas_estado.php", { id, estado });
    const respuesta = await GET("../api/terminal/lotes_botas.php");
    lotesBotasMovil = Array.isArray(respuesta?.lotes) ? respuesta.lotes : [];
    pintarLotesBotasDesdePhp();
}

async function seleccionarLoteFondo(id) {
    if (!id) return;
    await POST("../api/terminal/lotes_fondos_estado.php", { id });
    const respuesta = await GET("../api/terminal/lotes_fondos.php");
    lotesFondosMovil = Array.isArray(respuesta?.lotes) ? respuesta.lotes : [];
    pintarLotesFondosDesdePhp();
}

function registrarEventosVistaFabricacionSemanal() {
    const tablaLineas = document.querySelector("#vista_fabricacion #lista_fabricacion_semanal_botas");
    if (tablaLineas) {
        tablaLineas.addEventListener("click", function (event) {
            const botonCierre = event.target.closest("[data-action='abrir-cierre-semanal']");
            if (botonCierre) {
                event.stopPropagation();
                const lineaId = Number(botonCierre.getAttribute("data-linea-id") || 0);
                if (lineaId) {
                    abrirVistaCierreSemanalDesdeLinea?.(lineaId, "vista_fabricacion");
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
let fabricacionesSemanalesMovil = [];
let lotesBotasMovil = [];
let lotesFondosMovil = [];

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
    const contenedor = document.querySelector("#lista_fabricacion_semanal_botas_header, #lista_fabricacion_semanal_botas_legacy");
    if (!contenedor) return;
    try {
        const [fabricaciones, lotesBotas, lotesFondos] = await Promise.all([
            GET("../api/terminal/fabricacion.php"),
            GET("../api/terminal/lotes_botas.php"),
            GET("../api/terminal/lotes_fondos.php"),
        ]);
        fabricacionesSemanalesMovil = Array.isArray(fabricaciones?.fabricaciones)
            ? fabricaciones.fabricaciones
            : [];
        lotesBotasMovil = Array.isArray(lotesBotas?.lotes) ? lotesBotas.lotes : [];
        lotesFondosMovil = Array.isArray(lotesFondos?.lotes) ? lotesFondos.lotes : [];
        const resumenFabricaciones = document.getElementById("fabricacion-semanal-selector-resumen");
        if (resumenFabricaciones) resumenFabricaciones.textContent = `${fabricacionesSemanalesMovil.length} fabricaciones`;
        const botonCierre = document.getElementById("fabricacion-cierre-semanal");
        if (botonCierre) botonCierre.disabled = fabricacionesSemanalesMovil.length === 0;
        await cargarCodigosBatideroEnSelector(false);
        await cargarOperariosFondadoEnSelector(false);
        pintarLotesBotasDesdePhp();
        pintarLotesFondosDesdePhp();

        if (!fabricacionesSemanalesMovil.length) {
            contenedor.innerHTML = `<div class="fabricacion-card-empty">No hay fabricacion semanal activa</div>`;
            return;
        }

        actualizarCardsFabricacionSemanalBotas(fabricacionesSemanalesMovil);
    } catch (err) {
        console.error(err);
        contenedor.innerHTML = `<div class="fabricacion-card-empty">Error al cargar fabricacion semanal activa</div>`;
    }
}

function pintarLotesBotasDesdePhp() {
    actualizarBotonImpresionBotas();
    const lista = document.getElementById("lista_trazabilidad_botas");
    const resumen = document.getElementById("resumen_trazabilidad_botas");
    if (!lista) return;
    lista.replaceChildren();
    if (!lotesBotasMovil.length) {
        lista.innerHTML = `<div class="panel-botas-trazas-vacio">Sin lotes de botas.</div>`;
        if (resumen) resumen.textContent = "";
        return;
    }
    if (resumen) resumen.textContent = `${lotesBotasMovil.length} lotes`;
    lotesBotasMovil.forEach((lote) => {
        const tarjeta = document.createElement("article");
        const restante = Number(lote.cubicaje || 0) - Number(lote.consumido || 0);
        tarjeta.className = `bota-lote-item${Number(lote.estado) === 1 ? " bota-lote-item-activo" : ""}${restante < 0 ? " bota-lote-item-negativo" : ""}`;
        tarjeta.dataset.loteId = String(lote.id || "");
        tarjeta.dataset.estado = String(lote.estado || 0);
        tarjeta.innerHTML = `
            <div class="bota-lote-titulo">${lote.codigo || "-"}</div>
            <div class="bota-lote-detalle">M3: ${formatearNumeroFabricacion(lote.cubicaje)} - ${formatearNumeroFabricacion(lote.consumido)} = ${formatearNumeroFabricacion(restante)}</div>
            <div class="bota-lote-detalle">Botas: ${Number(lote.contador_botas || 0)}</div>
        `;
        lista.appendChild(tarjeta);
    });
}

function pintarLotesFondosDesdePhp() {
    actualizarBotonImpresionBotas();
    const lista = document.getElementById("fabricar-bota-fondos-listado");
    const resumen = document.getElementById("resumen_origen_fondos");
    if (!lista) return;
    lista.replaceChildren();
    if (!lotesFondosMovil.length) {
        lista.innerHTML = `<div class="panel-botas-trazas-vacio">Sin lotes de fondos.</div>`;
        if (resumen) resumen.textContent = "";
        return;
    }
    if (resumen) resumen.textContent = `${lotesFondosMovil.length} lotes`;
    lotesFondosMovil.forEach((lote) => {
        const tarjeta = document.createElement("article");
        const restante = Number(lote.cubicaje || 0) - Number(lote.consumido || 0);
        tarjeta.className = `bota-lote-item${Number(lote.estado) === 1 ? " bota-lote-item-activo" : ""}${restante < 0 ? " bota-lote-item-negativo" : ""}`;
        tarjeta.dataset.loteId = String(lote.id || "");
        tarjeta.dataset.estado = String(lote.estado || 0);
        tarjeta.innerHTML = `
            <div class="bota-lote-titulo">${lote.codigo || "-"}</div>
            <div class="bota-lote-detalle">M3: ${formatearNumeroFabricacion(lote.cubicaje)} - ${formatearNumeroFabricacion(lote.consumido)} = ${formatearNumeroFabricacion(restante)}</div>
            <div class="bota-lote-detalle">Fondos: ${Number(lote.contador_fondos || 0)}</div>
        `;
        lista.appendChild(tarjeta);
    });
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
        const baseTitulo = "Fabricación de botas";
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
        cargarPaletsFondos(lineaFabricacionActualId);
    }
}

function actualizarCardsFabricacionSemanalBotas(lineas) {
    const contenedor = document.querySelector("#lista_fabricacion_semanal_botas_header, #lista_fabricacion_semanal_botas_legacy");
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
        const pedidoDescripcion = (linea.pedido_descripcion || pedido?.descripcion || `Pedido ${linea.pedido_id || "-"}`).trim();
        card.dataset.pedidoDescripcion = pedidoDescripcion;

                const info = {
                        fechaInicio: formatearFechaEuropea(linea.fecha_inicio),
                        tipo: linea.tipo_descripcion || terminalFabricacion.tipos_producto?.[linea.tipo_producto_id]?.descripcion || "-",
                        material: linea.material_descripcion || terminalFabricacion.materiales?.[linea.material_id]?.descripcion || "-",
                        tostado: linea.tostado_descripcion || terminalFabricacion.tostados?.[linea.tostado_id]?.descripcion || "-",
                        semanaPedida: Number(linea.cantidad) || 0,
                        semanaFabricada: Number(linea.cantidad_fabricada) || 0,
                        pedidoTotal: Number(linea.pedido_cantidad ?? pedido?.cantidad) || 0,
                        pedidoFabricado: Number(linea.pedido_cantidad_fabricada ?? pedido?.cantidad_fabricada) || 0,
                };

        card.innerHTML = `
            <div class="fabricacion-card-title">
                                <h6>${pedidoDescripcion}</h6>
                                <span class="fabricacion-card-date">${info.fechaInicio || "-"}</span>
            </div>
                        <div class="fabricacion-card-resumen">
                <div>Tipo/Material: ${info.tipo} / ${info.material}</div>
                <div>Tostado: ${info.tostado || "-"}</div>
                <div>Pedido total/fabricado: ${info.pedidoTotal} / ${info.pedidoFabricado}</div>
                <div>Semana total/fabricado: ${info.semanaPedida} / ${info.semanaFabricada}</div>
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
    const numero = Number(valor);
    return (Number.isFinite(numero) ? numero : 0).toLocaleString("es-ES", {
        minimumFractionDigits: 4,
        maximumFractionDigits: 4,
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
            const restante = item.volumenTotal - item.consumidoTotal;
            card.className = `bota-lote-item${item.activa ? " bota-lote-item-activo" : ""}${restante < 0 ? " bota-lote-item-negativo" : ""}`;
            card.dataset.lote = item.lote;
            card.dataset.activa = item.activa ? "1" : "0";
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
    actualizarBotonImpresionBotas();
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
        actualizarBotonImpresionBotas();
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
    } finally {
        actualizarBotonImpresionBotas();
    }
}

async function imprimirEtiquetaFabricarBotaDesdeUI() {
    await fabricarEImprimirBotasDesdePhp();
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
    await fabricarEImprimirBotasDesdePhp({ operariosIds, cantidadEtiquetas });
}


function refrescarFabricacionDesdeServidor(_data = {}) {
    if (typeof pantallaActual !== "undefined" && pantallaActual !== "vista_fabricacion") cargarFabricacionSemanalActivaFabricacion();
    if (lineaFabricacionActualId) {
        cargarTrazabilidadFabricacion(lineaFabricacionActualId);
    }
}
