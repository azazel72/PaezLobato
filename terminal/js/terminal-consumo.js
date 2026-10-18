function prepararEventosConsumo() {
    const btnAgregarDesdePaletStock = document.getElementById("consumo-stock-agregar-trazabilidad");
    if (btnAgregarDesdePaletStock) {
        btnAgregarDesdePaletStock.addEventListener("click", () => {
            agregarTrazabilidadConsumoDesdePaletStock();
        });
    }
    const btnAgregarDesdePalet = document.getElementById("consumo-palet-agregar-trazabilidad");
    if (btnAgregarDesdePalet) {
        btnAgregarDesdePalet.addEventListener("click", () => {
            agregarTrazabilidadConsumoDesdePalet();
        });
    }
    const tabsConsumo = document.getElementById("consumo-panel-tabs");
    if (tabsConsumo) {
        tabsConsumo.addEventListener("shown.bs.tab", (event) => {
            actualizarBotonFooterConsumo(event.target?.id);
        });
        actualizarBotonFooterConsumo(document.querySelector("#consumo-panel-tabs .nav-link.active")?.id);
    }
    const selectUbicacionConsumo = document.getElementById("consumo-ubicacion-origen");
    if (selectUbicacionConsumo) {
        selectUbicacionConsumo.addEventListener("change", async () => {
            await actualizarPaletsConsumoYCubicaje();
        });
    }
    const selectTipoConsumo = document.getElementById("consumo-tipo-producto");
    if (selectTipoConsumo) {
        selectTipoConsumo.addEventListener("change", async () => {
            await actualizarPaletsConsumoYCubicaje();
        });
    }
    const selectMaderaConsumo = document.getElementById("consumo-madera");
    if (selectMaderaConsumo) {
        selectMaderaConsumo.addEventListener("change", async () => {
            await actualizarPaletsConsumoYCubicaje();
        });
    }
    const selectPaletConsumo = document.getElementById("consumo-palet-origen");
    if (selectPaletConsumo) {
        selectPaletConsumo.addEventListener("change", () => {
            autocompletarCamposConsumoDesdePalet();
        });
    }

    const tablaTrazConsumo = document.querySelector("#tabla_trazabilidad_consumo tbody");
    if (tablaTrazConsumo) {
        tablaTrazConsumo.addEventListener("click", async (event) => {
            const btn = event.target.closest("[data-action='trazabilidad-consumo-eliminar']");
            if (!btn) return;
            const tr = btn.closest("tr");
            if (!tr) return;
            const id = Number(tr.dataset.trazabilidadId);
            const cantidad = Number(tr.dataset.cantidad || 0);
            if (!id) return;
            if (cantidad !== 0) {
                alert("Solo se puede eliminar cuando la cantidad fabricada es 0.");
                return;
            }
            if (!confirm("¿Sacar lote de trazabilidad?")) return;
            await wsRequest("eliminar_trazabilidad_fabricacion", { id });
            cargarTrazabilidadConsumo(lineaFabricacionActualId);
        });
    }
}

function registrarEventosVistaConsumoSemanal() {
    return;
}

function actualizarBotonFooterConsumo(tabActivaId) {
    const btnStock = document.getElementById("consumo-stock-agregar-trazabilidad");
    const btnPalet = document.getElementById("consumo-palet-agregar-trazabilidad");
    if (!btnStock || !btnPalet) return;
    const activaPalet = tabActivaId === "consumo-tab-palet";
    btnStock.classList.toggle("d-none", activaPalet);
    btnPalet.classList.toggle("d-none", !activaPalet);
}

async function iniciarVistaConsumoDirecta() {
        if (esConsumoMaderaLotes()) return abrirConsumoLotes();
        vistaProduccionActiva = "vista_consumo";
        lineaFabricacionActualId = null;
        lineaFabricacionMaterialActualId = null;
        lineaFabricacionTipoBotaActualId = null;
        lineaFabricacionTipoActualId = null;
        ordenFabricacionActualId = null;

        const tituloPanel = document.getElementById("modalConsumoLabel");
        if (tituloPanel) tituloPanel.textContent = "Registro de lotes para consumo";

        const vista = document.getElementById("vista_consumo");
        if (vista) vista.setAttribute("modo", "contenido_pedido");

        const inputPaquetes = document.getElementById("consumo-paquetes");
        if (inputPaquetes && (!inputPaquetes.value || Number(inputPaquetes.value) < 1)) {
                inputPaquetes.value = "1";
        }

        await asegurarDatosFabricacionTerminal();
        poblarProveedoresFondos();
        actualizarModoConsumoFondos();
        await cargarResumenFabricacionSemanalConsumo();
        sincronizarFiltrosConsumoDesdeLinea();
        await cargarPaletsConsumoEnSelector();

        if (typeof setPantalla === "function") {
                setPantalla("vista_consumo", { pedido_id: null, fabricacion_semanal_id: null });
        }
        await cargarTrazabilidadConsumo(null);
}

function obtenerInfoLineaSemanalConsumo(linea, pedido = null) {
        const pedidoLinea = pedido || terminalFabricacion.pedidos?.[linea?.pedido_id] || null;
        return {
                fechaInicio: formatearFechaEuropea(linea?.fecha_inicio),
        tipo: linea?.tipo_descripcion || terminalFabricacion.tipos_producto?.[linea?.tipo_producto_id]?.descripcion || "-",
        material: linea?.material_descripcion || terminalFabricacion.materiales?.[linea?.material_id]?.descripcion || "-",
                semanaPedida: Number(linea?.cantidad) || 0,
                semanaFabricada: Number(linea?.cantidad_fabricada) || 0,
        pedidoTotal: Number(linea?.pedido_total ?? pedidoLinea?.cantidad) || 0,
        pedidoFabricado: Number(linea?.pedido_fabricado ?? pedidoLinea?.cantidad_fabricada) || 0,
        };
}

async function cargarResumenFabricacionSemanalConsumo() {
        const contenedor = document.getElementById("consumo-resumen-fabricacion-lista");
        if (!contenedor) return;

        contenedor.innerHTML = `<div class="produccion-card-empty">Cargando fabricaciones semanales...</div>`;
        try {
            const lineas = (await wsRequest("listar_resumen_fabricacion_consumo", {})) || [];
                renderResumenFabricacionSemanalConsumo(lineas);
        } catch (err) {
                console.error(err);
                contenedor.innerHTML = `<div class="produccion-card-empty">Error al cargar fabricaciones semanales</div>`;
        }
}

function renderResumenFabricacionSemanalConsumo(lineas, destinoId = "consumo-resumen-fabricacion-lista") {
        const contenedor = document.getElementById(destinoId);
        if (!contenedor) return;

        contenedor.innerHTML = "";
        if (!lineas?.length) {
                contenedor.innerHTML = `<div class="produccion-card-empty">Sin líneas en estado Producción</div>`;
                return;
        }

        lineas.forEach((linea) => {
                const card = document.createElement("article");
                card.className = "produccion-card consumo-resumen-card";

                const pedido = null;
                const pedidoDescripcion = String(linea?.pedido_descripcion || `Pedido ${linea.pedido_id || "-"}`).trim();
                const info = obtenerInfoLineaSemanalConsumo(linea, pedido);

                card.innerHTML = `
            <div class="produccion-card-title">
                <div>
                    <h6>${pedidoDescripcion}</h6>
                </div>
                <span class="produccion-card-date">${info.fechaInicio || "-"}</span>
            </div>
            <div class="produccion-card-grid">
                <div class="produccion-card-field">
                    <span class="produccion-card-label">Tipo</span>
                    <span class="produccion-card-value">${info.tipo}</span>
                </div>
                <div class="produccion-card-field">
                    <span class="produccion-card-label">Material</span>
                    <span class="produccion-card-value">${info.material}</span>
                </div>
                <div class="produccion-card-field">
                    <span class="produccion-card-label">Semana pedida</span>
                    <span class="produccion-card-value">${info.semanaPedida}</span>
                </div>
                <div class="produccion-card-field">
                    <span class="produccion-card-label">Semana fabricada</span>
                    <span class="produccion-card-value">${info.semanaFabricada}</span>
                </div>
                <div class="produccion-card-field">
                    <span class="produccion-card-label">Pedido total</span>
                    <span class="produccion-card-value">${info.pedidoTotal}</span>
                </div>
                <div class="produccion-card-field">
                    <span class="produccion-card-label">Pedido fabricado</span>
                    <span class="produccion-card-value">${info.pedidoFabricado}</span>
                </div>
            </div>
        `;
                contenedor.appendChild(card);
        });
}

function resolverTipoDuelaConsumo(tipoBotaId) {
    const consumos = Object.values(terminalFabricacion.consumos || {});
    const tipos = terminalFabricacion.tipos_producto || {};
    const botaIdNum = Number(tipoBotaId || 0);
    if (!botaIdNum) return null;

    const candidatos = consumos
        .filter((c) => Number(c?.bota_id || 0) === botaIdNum)
        .map((c) => Number(c?.consumible_id || 0))
        .filter((id) => {
            const tp = tipos?.[id];
            return String(tp?.tipo || "").toUpperCase() === "DUELA";
        });

    if (!candidatos.length) return null;
    return candidatos[0];
}

async function cargarFabricacionSemanalConsumo(opciones = {}) {
        await iniciarVistaConsumoDirecta();
}

function actualizarCardsFabricacionSemanalConsumo(lineas) {
        renderResumenFabricacionSemanalConsumo(lineas);
}

function mostrarConsumoDesdeLinea(fila) {
    vistaProduccionActiva = "vista_consumo";
    const esConsumoLibre = fila.dataset.consumoLibre === "1";
    lineaFabricacionActualId = esConsumoLibre ? null : (Number(fila.dataset.lineaId || 0) || null);
    lineaFabricacionMaterialActualId = esConsumoLibre ? null : (Number(fila.dataset.materialId || 0) || null);
    lineaFabricacionTipoBotaActualId = esConsumoLibre ? null : (Number(fila.dataset.tipoProductoId || 0) || null);
    lineaFabricacionTipoActualId = esConsumoLibre
        ? null
        : (Number(resolverTipoDuelaConsumo(lineaFabricacionTipoBotaActualId) || lineaFabricacionTipoBotaActualId || 0) || null);
    ordenFabricacionActualId = esConsumoLibre ? null : (Number(fila.dataset.pedidoId || 0) || null);

    const tipoId = Number(fila.dataset.tipoProductoId || 0) || null;
    const descripcionProducto =
        (esConsumoLibre ? "Sin orden semanal" : null) ||
        (tipoId && terminalFabricacion.tipos_producto?.[tipoId]?.descripcion) ||
        fila.children?.[0]?.textContent ||
        "Producto";
    const descripcionMaterial =
        (esConsumoLibre ? "Varias maderas" : null) ||
        (lineaFabricacionMaterialActualId && terminalFabricacion.materiales?.[lineaFabricacionMaterialActualId]?.descripcion) ||
        descripcionProducto;
    const cantidadFabricar = Number(fila.dataset.cantidadFabricar || 0) || 0;
    const cantidadFabricada = Number(fila.dataset.cantidadFabricada || 0) || 0;
    const pedidoDescripcionData = (fila.dataset.pedidoDescripcion || "").trim();
    const pedidoDescripcionMapa = (ordenFabricacionActualId && terminalFabricacion.pedidos?.[ordenFabricacionActualId]?.descripcion) || "";
    const pedidoDescripcion = (pedidoDescripcionData || pedidoDescripcionMapa || "").trim();
    const infoLinea = obtenerInfoLineaSemanalConsumo({
        pedido_id: ordenFabricacionActualId,
        tipo_producto_id: tipoId,
        material_id: lineaFabricacionMaterialActualId,
        cantidad: cantidadFabricar,
        cantidad_fabricada: cantidadFabricada,
    });
    const tituloPanel = document.getElementById("modalConsumoLabel");
    if (tituloPanel) tituloPanel.textContent = "Registro de lotes para consumo";

    if (typeof mostrarSeccion === "function") {
        mostrarSeccion("vista_consumo");
    }
    const vista = document.getElementById("vista_consumo");
    if (vista) vista.setAttribute("modo", "contenido_pedido");
    const inputPaquetes = document.getElementById("consumo-paquetes");
    if (inputPaquetes && (!inputPaquetes.value || Number(inputPaquetes.value) < 1)) {
        inputPaquetes.value = "1";
    }
    sincronizarFiltrosConsumoDesdeLinea();
    cargarPaletsConsumoEnSelector();
    if (typeof setPantalla === "function") {
        setPantalla("vista_consumo", { pedido_id: ordenFabricacionActualId, fabricacion_semanal_id: lineaFabricacionActualId });
    }
    cargarTrazabilidadConsumo(lineaFabricacionActualId);
    poblarProveedoresFondos();
    actualizarModoConsumoFondos();
}

function sincronizarFiltrosConsumoDesdeLinea() {
    const selectorTipo = document.getElementById("consumo-tipo-producto");
    const selectorMadera = document.getElementById("consumo-madera");
    if (selectorTipo) selectorTipo.value = String(lineaFabricacionTipoActualId || "");
    if (selectorMadera) selectorMadera.value = String(lineaFabricacionMaterialActualId || "");
}

function cargarPaletsConsumoEnSelector() {
    poblarFiltrosConsumo(
        String(lineaFabricacionTipoActualId || ""),
        String(lineaFabricacionMaterialActualId || "")
    );
    actualizarPaletsConsumoYCubicaje();
}

async function cargarTrazabilidadConsumo(lineaId) {
    const tbody = document.querySelector("#tabla_trazabilidad_consumo tbody");
    if (!tbody) return;
    try {
        await asegurarDatosFabricacionTerminal();
        const trazas = (await wsRequest("listar_trazabilidad_fabricacion", {
            fabricacion_semanal_id: lineaId || null,
        })) || [];
        tbody.innerHTML = "";
        if (!trazas.length) {
            const tr = document.createElement("tr");
            const td = document.createElement("td");
            td.colSpan = 7;
            td.textContent = "Sin registros";
            tr.appendChild(td);
            tbody.appendChild(tr);
            return;
        }
        trazas.forEach((t) => {
            const tr = document.createElement("tr");
            const palet = terminalFabricacion.palets?.[t.palet_id] || null;
            const cubicajePalet = Number.isFinite(Number(t?.palet_cubicaje))
                ? Number(t.palet_cubicaje)
                : (palet ? Number(palet.cubicaje) : null);
            const consumidoPalet = Number.isFinite(Number(t?.palet_consumido))
                ? Number(t.palet_consumido)
                : (palet ? Number(palet.consumido) : null);
            const restante = Number.isFinite(cubicajePalet) && Number.isFinite(consumidoPalet)
                ? (cubicajePalet - consumidoPalet)
                : (palet ? Number(palet.restante) : null);
            const cubicajeTxt = Number.isFinite(cubicajePalet)
                ? Number(cubicajePalet).toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 3 })
                : "";
            const consumidoTxt = Number.isFinite(consumidoPalet)
                ? Number(consumidoPalet).toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 3 })
                : "";
            const restanteTxt = Number.isFinite(restante)
                ? Number(restante).toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 3 })
                : "";
            tr.dataset.trazabilidadId = t.id ?? "";
            tr.dataset.estado = t.estado ?? 0;
            tr.dataset.cantidad = t.cantidad_fabricada ?? 0;
            if (Number(t.estado) === 1) tr.classList.add("trazabilidad-inactiva");
            const puedeEliminar = Number(t.cantidad_fabricada ?? 0) === 0;
            const botonHtml = puedeEliminar
                ? `<button type="button" class="btn btn-sm btn-outline-danger" data-action="trazabilidad-consumo-eliminar" title="Sacar lote de trazabilidad">
                     <i class="bi bi-trash"></i>
                   </button>`
                : `<span class="text-muted">-</span>`;
            tr.innerHTML = `
        <td>${t.palet_codigo || t.palet_id || ""}</td>
        <td>${t.material_descripcion || "-"}</td>
        <td>${cubicajeTxt}</td>
        <td>${consumidoTxt}</td>
        <td>${restanteTxt}</td>
        <td>${t.cantidad_fabricada ?? ""}</td>
        <td class="text-center">
          ${botonHtml}
        </td>
      `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error(err);
        tbody.innerHTML = `<tr><td colspan="7">Error al cargar trazabilidad</td></tr>`;
    }
}

function poblarFiltrosConsumo(valorTipoPrevio = "", valorMaderaPrevio = "") {
    const selectorTipo = document.getElementById("consumo-tipo-producto");
    const selectorMadera = document.getElementById("consumo-madera");
    if (!selectorTipo || !selectorMadera) return;

    const tipos = Object.values(terminalFabricacion.tipos_producto || {})
        .filter((t) => String(t?.tipo || "").toUpperCase() === "DUELA")
        .sort((a, b) => String(b.descripcion || "").localeCompare(String(a.descripcion || ""), "es"));
    const maderas = Object.values(terminalFabricacion.materiales || {})
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

function actualizarPaletsConsumoEnSelector(valorUbicacionPrevio = "", valorStockPrevio = "") {
    const selectorStock = document.getElementById("consumo-palet-origen");
    const selectorUbicacion = document.getElementById("consumo-ubicacion-origen");
    const selectorTipo = document.getElementById("consumo-tipo-producto");
    const selectorMadera = document.getElementById("consumo-madera");
    if (!selectorStock || !selectorUbicacion) return;

    const ubicacionSeleccionada = selectorUbicacion.value === "" ? null : String(selectorUbicacion.value);
    const tipoSeleccionado = selectorTipo?.value ? Number(selectorTipo.value) : null;
    const maderaSeleccionada = selectorMadera?.value ? Number(selectorMadera.value) : null;
    const palets = terminalFabricacion.paletsConsumo || [];
    const materialId = maderaSeleccionada || lineaFabricacionMaterialActualId;
    const tipoId = tipoSeleccionado || lineaFabricacionTipoActualId;

    const opcionesUbicacion = new Map();
    palets.forEach((s) => {
        const instalacionId = s?.id_instalacion;
        if (!instalacionId) return;
        const nombre = terminalFabricacion.instalaciones?.[instalacionId]?.nombre || `Instalación ${instalacionId}`;
        opcionesUbicacion.set(String(instalacionId), nombre);
    });
    const opcionesUbicacionOrdenadas = Array.from(opcionesUbicacion.entries())
        .sort((a, b) => String(a[1]).localeCompare(String(b[1]), "es"));

    selectorUbicacion.innerHTML = `<option value="">Todas las ubicaciones</option>` + opcionesUbicacionOrdenadas
        .map(([id, nombre]) => `<option value="${id}">${nombre}</option>`)
        .join("");
    if (valorUbicacionPrevio && opcionesUbicacion.has(String(valorUbicacionPrevio))) {
        selectorUbicacion.value = valorUbicacionPrevio;
    }

    const filtroUbicacion = selectorUbicacion.value === "" ? ubicacionSeleccionada : String(selectorUbicacion.value);
    const filtrados = palets.filter((s) => {
        const restante = Math.max(Number(s?.cantidad_stock || 0) - Number(s?.cantidad_consumida || 0), 0);
        const cumpleUbicacion = !filtroUbicacion || String(s?.id_instalacion ?? "") === String(filtroUbicacion);
        const cumpleMaterial = !materialId || Number(s?.id_material || 0) === Number(materialId);
        const cumpleTipo = !tipoId || Number(s?.tipo_producto || 0) === Number(tipoId);
        return restante > 0 && cumpleUbicacion && cumpleMaterial && cumpleTipo;
    });

    if (!filtrados.length) {
        selectorStock.innerHTML = `<option value="">Sin palets disponibles</option>`;
        actualizarEstadoCamposConsumoSegunPalet();
        return;
    }
    selectorStock.innerHTML = `<option value="">Seleccione palet...</option>` + filtrados.map((s) => {
        const restante = Math.max(Number(s?.cantidad_stock || 0) - Number(s?.cantidad_consumida || 0), 0)
            .toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 3 });
        const tipoTxt = terminalFabricacion.tipos_producto?.[s.tipo_producto]?.descripcion || `Tipo ${s.tipo_producto || "-"}`;
        const maderaTxt = terminalFabricacion.materiales?.[s.id_material]?.descripcion || `Madera ${s.id_material || "-"}`;
        const ubicTxt = terminalFabricacion.instalaciones?.[s.id_instalacion]?.nombre || `Ubicación ${s.id_instalacion || "-"}`;
        const etiqueta = `${s.codigo || s.id} | Restante ${restante} | ${tipoTxt} | ${maderaTxt} | ${ubicTxt}`;
        return `<option value="${s.id}">${etiqueta}</option>`;
    }).join("");
    if (valorStockPrevio && filtrados.some((s) => String(s.id) === String(valorStockPrevio))) {
        selectorStock.value = String(valorStockPrevio);
    } else if (filtrados.length > 0) {
        selectorStock.value = String(filtrados[0].id);
    }
    autocompletarCamposConsumoDesdePalet();
}

async function actualizarPaletsConsumoYCubicaje() {
    const selectorStock = document.getElementById("consumo-palet-origen");
    const selectorUbicacion = document.getElementById("consumo-ubicacion-origen");
    const selectorTipo = document.getElementById("consumo-tipo-producto");
    const selectorMadera = document.getElementById("consumo-madera");
    if (!selectorStock || !selectorUbicacion) return;

    const valorStockPrevio = selectorStock.value || "";
    const filtroUbicacion = selectorUbicacion.value === "" ? null : String(selectorUbicacion.value);
    const tipoId = selectorTipo?.value ? Number(selectorTipo.value) : null;
    const materialId = selectorMadera?.value ? Number(selectorMadera.value) : null;
    let palets = [];
    try {
        const ctx = await wsRequest("obtener_contexto_consumo", {
            tipo_producto_id: tipoId || null,
            material_id: materialId || null,
            ubicacion_id: filtroUbicacion ? Number(filtroUbicacion) : null,
        });
        palets = Array.isArray(ctx?.palets) ? ctx.palets : [];
        terminalFabricacion.paletsConsumo = palets;
        const tipoCubicaje = Number(tipoId || lineaFabricacionTipoActualId || 0);
        terminalFabricacion.cubicajeConsumo = tipoCubicaje
            ? [{ tipo_producto_id: tipoCubicaje, cubicaje_estandar: Number(ctx?.cubicaje_estandar || 0) }]
            : [];
    } catch (err) {
        console.error("No se pudo obtener contexto de consumo:", err);
        selectorStock.innerHTML = `<option value="">Error cargando palets</option>`;
        actualizarEstadoCamposConsumoSegunPalet();
        return;
    }

    if (!palets.length) {
        selectorStock.innerHTML = `<option value="">Sin palets disponibles</option>`;
        actualizarEstadoCamposConsumoSegunPalet();
        return;
    }

    selectorStock.innerHTML = `<option value="">Seleccione palet...</option>` + palets.map((s) => {
        const restante = Math.max(Number(s?.cantidad_stock || 0) - Number(s?.cantidad_consumida || 0), 0)
            .toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 3 });
        const tipoTxt = terminalFabricacion.tipos_producto?.[s.tipo_producto]?.descripcion || `Tipo ${s.tipo_producto || "-"}`;
        const maderaTxt = terminalFabricacion.materiales?.[s.id_material]?.descripcion || `Madera ${s.id_material || "-"}`;
        const ubicTxt = terminalFabricacion.instalaciones?.[s.id_instalacion]?.nombre || `Ubicación ${s.id_instalacion || "-"}`;
        const etiqueta = `${s.codigo || s.id} | Restante ${restante} | ${tipoTxt} | ${maderaTxt} | ${ubicTxt}`;
        return `<option value="${s.id}">${etiqueta}</option>`;
    }).join("");

    if (valorStockPrevio && palets.some((s) => String(s.id) === String(valorStockPrevio))) {
        selectorStock.value = String(valorStockPrevio);
    } else {
        selectorStock.value = String(palets[0].id);
    }
    autocompletarCamposConsumoDesdePalet();
}

function obtenerCubicajeInicialConsumo(tipoProductoId) {
    const lista = Array.isArray(terminalFabricacion.cubicajeConsumo) ? terminalFabricacion.cubicajeConsumo : [];
    const enLista = lista.find((c) => Number(c?.tipo_producto_id || 0) === Number(tipoProductoId));
    if (enLista) return Number(enLista.cubicaje_estandar || 0);
    const mapa = terminalFabricacion.cubicaje || {};
    const item = Object.values(mapa).find((c) => Number(c?.tipo_producto_id || 0) === Number(tipoProductoId));
    return Number(item?.cubicaje_estandar || 0);
}

function actualizarEstadoCamposConsumoSegunPalet() {
    const selectStock = document.getElementById("consumo-palet-origen");
    const inputLote = document.getElementById("consumo-lote");
    const inputCubicaje = document.getElementById("consumo-cubicaje");
    const inputPaquetes = document.getElementById("consumo-paquetes");
    const hayStock = Boolean(Number(selectStock?.value || 0));
    if (inputLote) inputLote.disabled = !hayStock;
    if (inputCubicaje) inputCubicaje.disabled = !hayStock;
    if (inputPaquetes) inputPaquetes.disabled = !hayStock;
    if (!hayStock) {
        if (inputLote) inputLote.value = "";
        if (inputPaquetes) inputPaquetes.value = "1";
        if (inputCubicaje) inputCubicaje.value = "";
    } else if (inputPaquetes && (!inputPaquetes.value || Number(inputPaquetes.value) < 1)) {
        inputPaquetes.value = "1";
    }
}

function autocompletarCamposConsumoDesdePalet() {
    const selectStock = document.getElementById("consumo-palet-origen");
    const inputLote = document.getElementById("consumo-lote");
    const inputCubicaje = document.getElementById("consumo-cubicaje");
    const selectorTipo = document.getElementById("consumo-tipo-producto");
    if (!selectStock || !inputLote || !inputCubicaje) return;

    actualizarEstadoCamposConsumoSegunPalet();
    const stockId = Number(selectStock.value || 0);
    if (!stockId) return;
    const tipoSeleccionado = selectorTipo?.value ? Number(selectorTipo.value) : lineaFabricacionTipoActualId;
    const cubicajeInicial = obtenerCubicajeInicialConsumo(tipoSeleccionado);
    if (Number.isFinite(cubicajeInicial) && cubicajeInicial >= 0) {
        inputCubicaje.value = String(cubicajeInicial);
    }
}

async function agregarTrazabilidadConsumoDesdePaletStock() {
    const selectPaletOrigen = document.getElementById("consumo-palet-origen");
    const loteInput = document.getElementById("consumo-lote");
    const cubicajeInput = document.getElementById("consumo-cubicaje");
    const paquetesInput = document.getElementById("consumo-paquetes");
    const paletOrigenId = Number(selectPaletOrigen?.value || 0);
    const lote = (loteInput?.value || "").trim();
    const cubicaje = Number.parseFloat((cubicajeInput?.value || "").toString().replace(",", "."));
    const paquetes = Number.parseInt((paquetesInput?.value || "1").toString(), 10) || 1;
    const tipoPrevio = String(document.getElementById("consumo-tipo-producto")?.value || "");
    const maderaPrevia = String(document.getElementById("consumo-madera")?.value || "");
    const ubicacionPrevia = String(document.getElementById("consumo-ubicacion-origen")?.value || "");
    const paletPrevio = String(selectPaletOrigen?.value || "");
    if (!paletOrigenId || !lote || !Number.isFinite(cubicaje) || cubicaje <= 0) {
        alert("Debes completar palet origen, cubicaje, paquetes y lote.");
        return;
    }

    try {
        await wsRequest("agregar_trazabilidad_fabricacion_desde_palet_stock", {
            fabricacion_semanal_id: lineaFabricacionActualId || null,
            palet_origen_id: paletOrigenId,
            lote,
            cubicaje,
            paquetes,
        });
        if (loteInput) loteInput.value = "";
        if (cubicajeInput) cubicajeInput.value = "";
        if (paquetesInput) paquetesInput.value = "1";
        const selectorTipo = document.getElementById("consumo-tipo-producto");
        const selectorMadera = document.getElementById("consumo-madera");
        const selectorUbicacion = document.getElementById("consumo-ubicacion-origen");
        if (selectorTipo) selectorTipo.value = tipoPrevio;
        if (selectorMadera) selectorMadera.value = maderaPrevia;
        if (selectorUbicacion) selectorUbicacion.value = ubicacionPrevia;
        if (selectPaletOrigen) selectPaletOrigen.value = paletPrevio;
        await cargarPaletsConsumoEnSelector();
        await cargarTrazabilidadConsumo(lineaFabricacionActualId || null);
        sincronizarBackdropModales();
    } catch (err) {
        console.error(err);
        alert("Error al agregar trazabilidad.");
        sincronizarBackdropModales();
    }
}

async function agregarTrazabilidadConsumoDesdePalet() {
    const lotePaletInput = document.getElementById("consumo-palet-lote");
    const cubicajeInput = document.getElementById("consumo-palet-cubicaje");
    const lote_palet = (lotePaletInput?.value || "").trim();
    const cubicaje = Number.parseFloat((cubicajeInput?.value || "").toString().replace(",", "."));

    if (!lote_palet || !Number.isFinite(cubicaje) || cubicaje <= 0) {
        alert("Debes completar lote palet y cubicaje.");
        return;
    }

    try {
        await wsRequest("agregar_trazabilidad_fabricacion_desde_palet", {
            fabricacion_semanal_id: lineaFabricacionActualId || null,
            lote_palet,
            cubicaje,
        });
        if (lotePaletInput) lotePaletInput.value = "";
        if (cubicajeInput) cubicajeInput.value = "";
        cargarTrazabilidadConsumo(lineaFabricacionActualId || null);
        sincronizarBackdropModales();
    } catch (err) {
        console.error(err);
        alert("Error al agregar consumo desde palet.");
        sincronizarBackdropModales();
    }
}

function refrescarConsumoDesdeServidor() {
    if (esConsumoMaderaLotes()) return;
    cargarResumenFabricacionSemanalConsumo();
    if (vistaProduccionActiva === "vista_consumo") {
        cargarTrazabilidadConsumo(lineaFabricacionActualId || null);
    }
}

//-------------------

async function cargarPaletsConsumoEnSelector() {
    const selector = document.getElementById("consumo-palet-origen");
    const selectorUbicacion = document.getElementById("consumo-ubicacion-origen");
    const selectorTipo = document.getElementById("consumo-tipo-producto");
    const selectorMadera = document.getElementById("consumo-madera");
    if (!selector || !selectorUbicacion) return;

    await asegurarDatosFabricacionTerminal();

    const valorStockPrevio = selector.value || "";
    const valorUbicacionPrevio = selectorUbicacion.value || "";
    const valorTipoPrevio = selectorTipo
        ? String(selectorTipo.value || "")
        : String(lineaFabricacionTipoActualId || "");
    const valorMaderaPrevio = selectorMadera
        ? String(selectorMadera.value || "")
        : String(lineaFabricacionMaterialActualId || "");

    selector.innerHTML = `<option value="">Cargando palets...</option>`;
    selectorUbicacion.innerHTML = `<option value="">Cargando ubicaciones...</option>`;
    if (selectorTipo) selectorTipo.innerHTML = `<option value="">Cargando tipos...</option>`;
    if (selectorMadera) selectorMadera.innerHTML = `<option value="">Cargando maderas...</option>`;
    try {
        terminalFabricacion.paletsConsumo = (await wsRequest("listar_palets_consumo", {})) || [];
        terminalFabricacion.cubicajeConsumo = (await wsRequest("listar_cubicaje", {})) || [];
        console.log("[consumo] palets recibidos:", terminalFabricacion.paletsConsumo);
        poblarFiltrosConsumo(valorTipoPrevio, valorMaderaPrevio);
        actualizarPaletsConsumoEnSelector(valorUbicacionPrevio, valorStockPrevio);
    } catch (err) {
        console.error("No se pudo cargar el selector de palets de consumo:", err);
        selector.innerHTML = `<option value="">Error cargando palets</option>`;
        selectorUbicacion.innerHTML = `<option value="">Error cargando ubicaciones</option>`;
        if (selectorTipo) selectorTipo.innerHTML = `<option value="">Error cargando tipos</option>`;
        if (selectorMadera) selectorMadera.innerHTML = `<option value="">Error cargando maderas</option>`;
        actualizarEstadoCamposConsumoSegunPalet();
    }
}

function poblarFiltrosConsumo(valorTipoPrevio = "", valorMaderaPrevio = "") {
    const selectorTipo = document.getElementById("consumo-tipo-producto");
    const selectorMadera = document.getElementById("consumo-madera");
    if (!selectorTipo || !selectorMadera) return;

    const tipos = Object.values(terminalFabricacion.tipos_producto || {})
        .filter((t) => String(t?.tipo || "").toUpperCase() === "DUELA")
        .sort((a, b) => String(b.descripcion || "").localeCompare(String(a.descripcion || ""), "es"));
    const maderas = Object.values(terminalFabricacion.materiales || {})
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

function sincronizarFiltrosConsumoDesdeLinea() {
    const selectorTipo = document.getElementById("consumo-tipo-producto");
    const selectorMadera = document.getElementById("consumo-madera");
    if (selectorTipo) selectorTipo.value = String(lineaFabricacionTipoActualId || "");
    if (selectorMadera) selectorMadera.value = String(lineaFabricacionMaterialActualId || "");
}

function actualizarPaletsConsumoEnSelector(valorUbicacionPrevio = "", valorStockPrevio = "") {
    const selectorStock = document.getElementById("consumo-palet-origen");
    const selectorUbicacion = document.getElementById("consumo-ubicacion-origen");
    const selectorTipo = document.getElementById("consumo-tipo-producto");
    const selectorMadera = document.getElementById("consumo-madera");
    if (!selectorStock || !selectorUbicacion) return;

    const ubicacionSeleccionada = selectorUbicacion.value === "" ? null : String(selectorUbicacion.value);
    const tipoSeleccionado = selectorTipo?.value ? Number(selectorTipo.value) : null;
    const maderaSeleccionada = selectorMadera?.value ? Number(selectorMadera.value) : null;
    const palets = (terminalFabricacion.paletsConsumo || []);
    const materialId = maderaSeleccionada || lineaFabricacionMaterialActualId;
    const tipoId = tipoSeleccionado || lineaFabricacionTipoActualId;

    const opcionesUbicacion = new Map(); // id_instalacion -> nombre
    palets.forEach((s) => {
        const instalacionId = s?.id_instalacion;
        if (!instalacionId) return;
        const nombre = terminalFabricacion.instalaciones?.[instalacionId]?.nombre || `Instalación ${instalacionId}`;
        opcionesUbicacion.set(String(instalacionId), nombre);
    });
    const opcionesUbicacionOrdenadas = Array.from(opcionesUbicacion.entries())
        .sort((a, b) => String(a[1]).localeCompare(String(b[1]), "es"));

    selectorUbicacion.innerHTML = `<option value="">Todas las ubicaciones</option>` + opcionesUbicacionOrdenadas
        .map(([id, nombre]) => `<option value="${id}">${nombre}</option>`)
        .join("");
    if (valorUbicacionPrevio && opcionesUbicacion.has(String(valorUbicacionPrevio))) {
        selectorUbicacion.value = valorUbicacionPrevio;
    }

    const filtroUbicacion = selectorUbicacion.value === "" ? ubicacionSeleccionada : String(selectorUbicacion.value);
    const filtrados = palets.filter((s) => {
        const restante = Math.max(Number(s?.cantidad_stock || 0) - Number(s?.cantidad_consumida || 0), 0);
        const cumpleUbicacion = !filtroUbicacion || String(s?.id_instalacion ?? "") === String(filtroUbicacion);
        const cumpleMaterial = !materialId || Number(s?.id_material || 0) === Number(materialId);
        const cumpleTipo = !tipoId || Number(s?.tipo_producto || 0) === Number(tipoId);
        return restante > 0 && cumpleUbicacion && cumpleMaterial && cumpleTipo;
    });
    console.log("[consumo] palets tras filtro tipo+material+ubicacion:", filtrados, { tipoId, materialId, filtroUbicacion });

    if (!filtrados.length) {
        selectorStock.innerHTML = `<option value="">Sin palets disponibles</option>`;
        actualizarEstadoCamposConsumoSegunPalet();
        return;
    }
    selectorStock.innerHTML = `<option value="">Seleccione palet...</option>` + filtrados.map((s) => {
        const restante = Math.max(Number(s?.cantidad_stock || 0) - Number(s?.cantidad_consumida || 0), 0)
            .toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 3 });
        const tipoTxt = terminalFabricacion.tipos_producto?.[s.tipo_producto]?.descripcion || `Tipo ${s.tipo_producto || "-"}`;
        const maderaTxt = terminalFabricacion.materiales?.[s.id_material]?.descripcion || `Madera ${s.id_material || "-"}`;
        const ubicTxt = terminalFabricacion.instalaciones?.[s.id_instalacion]?.nombre || `Ubicación ${s.id_instalacion || "-"}`;
        const etiqueta = `${s.codigo || s.id} | Restante ${restante} | ${tipoTxt} | ${maderaTxt} | ${ubicTxt}`;
        return `<option value="${s.id}">${etiqueta}</option>`;
    }).join("");
    if (valorStockPrevio && filtrados.some((s) => String(s.id) === String(valorStockPrevio))) {
        selectorStock.value = String(valorStockPrevio);
    } else if (filtrados.length > 0) {
        selectorStock.value = String(filtrados[0].id);
    }
    autocompletarCamposConsumoDesdePalet();
}

async function actualizarPaletsConsumoYCubicaje() {
    const selectorStock = document.getElementById("consumo-palet-origen");
    const selectorUbicacion = document.getElementById("consumo-ubicacion-origen");
    const selectorTipo = document.getElementById("consumo-tipo-producto");
    const selectorMadera = document.getElementById("consumo-madera");
    if (!selectorStock || !selectorUbicacion) return;

    const valorStockPrevio = selectorStock.value || "";
    const filtroUbicacion = selectorUbicacion.value === "" ? null : String(selectorUbicacion.value);
    const tipoId = selectorTipo?.value ? Number(selectorTipo.value) : null;
    const materialId = selectorMadera?.value ? Number(selectorMadera.value) : null;
    let palets = [];
    try {
        const ctx = await wsRequest("obtener_contexto_consumo", {
            tipo_producto_id: tipoId || null,
            material_id: materialId || null,
            ubicacion_id: filtroUbicacion ? Number(filtroUbicacion) : null,
        });
        palets = Array.isArray(ctx?.palets) ? ctx.palets : [];
        terminalFabricacion.paletsConsumo = palets;
        const tipoCubicaje = Number(tipoId || lineaFabricacionTipoActualId || 0);
        terminalFabricacion.cubicajeConsumo = tipoCubicaje
            ? [{ tipo_producto_id: tipoCubicaje, cubicaje_estandar: Number(ctx?.cubicaje_estandar || 0) }]
            : [];
    } catch (err) {
        console.error("No se pudo obtener contexto de consumo:", err);
        selectorStock.innerHTML = `<option value="">Error cargando palets</option>`;
        actualizarEstadoCamposConsumoSegunPalet();
        return;
    }
    const filtrados = palets;

    if (!filtrados.length) {
        selectorStock.innerHTML = `<option value="">Sin palets disponibles</option>`;
        actualizarEstadoCamposConsumoSegunPalet();
        return;
    }

    selectorStock.innerHTML = `<option value="">Seleccione palet...</option>` + filtrados.map((s) => {
        const restante = Math.max(Number(s?.cantidad_stock || 0) - Number(s?.cantidad_consumida || 0), 0)
            .toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 3 });
        const tipoTxt = terminalFabricacion.tipos_producto?.[s.tipo_producto]?.descripcion || `Tipo ${s.tipo_producto || "-"}`;
        const maderaTxt = terminalFabricacion.materiales?.[s.id_material]?.descripcion || `Madera ${s.id_material || "-"}`;
        const ubicTxt = terminalFabricacion.instalaciones?.[s.id_instalacion]?.nombre || `Ubicación ${s.id_instalacion || "-"}`;
        const etiqueta = `${s.codigo || s.id} | Restante ${restante} | ${tipoTxt} | ${maderaTxt} | ${ubicTxt}`;
        return `<option value="${s.id}">${etiqueta}</option>`;
    }).join("");

    if (valorStockPrevio && filtrados.some((s) => String(s.id) === String(valorStockPrevio))) {
        selectorStock.value = String(valorStockPrevio);
    } else {
        selectorStock.value = String(filtrados[0].id);
    }
    autocompletarCamposConsumoDesdePalet();
}

function obtenerCubicajeInicialConsumo(tipoProductoId) {
    const lista = Array.isArray(terminalFabricacion.cubicajeConsumo) ? terminalFabricacion.cubicajeConsumo : [];
    const enLista = lista.find((c) => Number(c?.tipo_producto_id || 0) === Number(tipoProductoId));
    if (enLista) return Number(enLista.cubicaje_estandar || 0);
    const mapa = terminalFabricacion.cubicaje || {};
    const item = Object.values(mapa).find((c) => Number(c?.tipo_producto_id || 0) === Number(tipoProductoId));
    return Number(item?.cubicaje_estandar || 0);
}

function actualizarEstadoCamposConsumoSegunPalet() {
    const selectStock = document.getElementById("consumo-palet-origen");
    const inputLote = document.getElementById("consumo-lote");
    const inputCubicaje = document.getElementById("consumo-cubicaje");
    const inputPaquetes = document.getElementById("consumo-paquetes");
    const hayStock = Boolean(Number(selectStock?.value || 0));
    if (inputLote) inputLote.disabled = !hayStock;
    if (inputCubicaje) inputCubicaje.disabled = !hayStock;
    if (inputPaquetes) inputPaquetes.disabled = !hayStock;
    if (!hayStock) {
        if (inputLote) inputLote.value = "";
        if (inputPaquetes) inputPaquetes.value = "1";
        if (inputCubicaje) inputCubicaje.value = "";
    } else if (inputPaquetes && (!inputPaquetes.value || Number(inputPaquetes.value) < 1)) {
        inputPaquetes.value = "1";
    }
}

function autocompletarCamposConsumoDesdePalet() {
    const selectStock = document.getElementById("consumo-palet-origen");
    const inputLote = document.getElementById("consumo-lote");
    const inputCubicaje = document.getElementById("consumo-cubicaje");
    const selectorTipo = document.getElementById("consumo-tipo-producto");
    if (!selectStock || !inputLote || !inputCubicaje) return;

    actualizarEstadoCamposConsumoSegunPalet();
    const stockId = Number(selectStock.value || 0);
    if (!stockId) return;
    const tipoSeleccionado = selectorTipo?.value ? Number(selectorTipo.value) : lineaFabricacionTipoActualId;
    const cubicajeInicial = obtenerCubicajeInicialConsumo(tipoSeleccionado);
    if (Number.isFinite(cubicajeInicial) && cubicajeInicial >= 0) {
        inputCubicaje.value = String(cubicajeInicial);
    }
}

async function cargarLineasFabricacion(pedidoId, opciones = {}) {
    const cfg = obtenerConfigVistaProduccion(opciones.vistaId);
    vistaProduccionActiva = cfg.vistaId;
    const autoAbrirLineaUnica = opciones.autoAbrirLineaUnica === true;
    const tbody = document.querySelector(`${cfg.tablaLineasSelector} tbody`);
    if (!tbody) return;
    try {
        const lineas = (await wsRequest("listar_fabricacion_semanal", { pedido_id: pedidoId })) || [];
        actualizarTablaLineasFabricacion(lineas, cfg.vistaId);
        if (autoAbrirLineaUnica && lineas.length === 1) {
            const filaUnica = tbody.querySelector("tr[data-linea-id]");
            if (filaUnica) {
                mostrarLotesMateriales(filaUnica, cfg.vistaId);
            }
        }
    } catch (err) {
        console.error(err);
        tbody.innerHTML = `<tr><td colspan="4">Error al cargar lineas</td></tr>`;
    }
}

function actualizarTablaLineasFabricacion(lineas, vistaId = null) {
    const cfg = obtenerConfigVistaProduccion(vistaId);
    const tbody = document.querySelector(`${cfg.tablaLineasSelector} tbody`);
    if (!tbody) return;
    tbody.innerHTML = "";
    if (!lineas || !lineas.length) {
        const tr = document.createElement("tr");
        const td = document.createElement("td");
        td.colSpan = 4;
        td.textContent = "Sin lineas";
        tr.appendChild(td);
        tbody.appendChild(tr);
        return;
    }
    lineas.forEach((l) => {
        const tr = document.createElement("tr");
        tr.dataset.lineaId = l.id ?? "";
        tr.dataset.tipoProductoId = l.tipo_producto_id ?? "";
        tr.dataset.materialId = l.material_id ?? "";
        tr.dataset.pedidoId = l.pedido_id ?? "";
        tr.dataset.cantidadFabricar = l.cantidad ?? "";
        tr.dataset.pedidoDescripcion = (terminalFabricacion.pedidos?.[l.pedido_id]?.descripcion || "").trim();
        const tipo =
            terminalFabricacion.tipos_producto?.[l.tipo_producto_id]?.descripcion ||
            (typeof l.tipo_producto_id !== "undefined" ? String(l.tipo_producto_id) : "");
        const cantidad = Number(l.cantidad) || 0;
        const fabricada = Number(l.cantidad_fabricada) || 0;
        const falta = Math.max(0, cantidad - fabricada);
        tr.innerHTML = `
      <td>${tipo}</td>
      <td>${cantidad}</td>
      <td>${fabricada}</td>
      <td>${falta}</td>
    `;
        tbody.appendChild(tr);
    });
}

function actualizarCardsFabricacionSemanalConsumo(lineas) {
        renderResumenFabricacionSemanalConsumo(lineas);
}
