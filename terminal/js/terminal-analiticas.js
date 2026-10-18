const estadoAnaliticas = {
    items: [],
    seleccionadaId: null,
    filtroEstado: "",
    filtroFecha: "",
};

function prepararEventosAnaliticas() {
    document.getElementById("analiticas-recargar")?.addEventListener("click", async () => {
        await cargarVistaAnaliticas(true);
    });

    document.getElementById("analitica-nueva")?.addEventListener("click", () => {
        prepararFormularioNuevaAnalitica();
    });

    document.getElementById("analitica-guardar")?.addEventListener("click", async () => {
        await guardarAnaliticaMovil();
    });

    document.getElementById("analiticas-filtro-estado")?.addEventListener("change", (event) => {
        estadoAnaliticas.filtroEstado = String(event.target.value || "").trim().toUpperCase();
        renderizarListaAnaliticas();
    });

    document.getElementById("analiticas-filtro-fecha")?.addEventListener("change", (event) => {
        estadoAnaliticas.filtroFecha = String(event.target.value || "").trim();
        renderizarListaAnaliticas();
    });

    document.getElementById("analiticas-filtro-limpiar")?.addEventListener("click", () => {
        estadoAnaliticas.filtroEstado = "";
        estadoAnaliticas.filtroFecha = "";
        const filtroEstado = document.getElementById("analiticas-filtro-estado");
        const filtroFecha = document.getElementById("analiticas-filtro-fecha");
        if (filtroEstado) filtroEstado.value = "";
        if (filtroFecha) filtroFecha.value = "";
        renderizarListaAnaliticas();
    });

    document.getElementById("analiticas-lista")?.addEventListener("click", async (event) => {
        const card = event.target.closest("[data-analitica-id]");
        if (!card) return;
        await cargarDetalleAnalitica(Number(card.dataset.analiticaId || 0));
    });
}

function obtenerFechaHoyAnalitica() {
    const fecha = new Date();
    const tz = fecha.getTimezoneOffset() * 60000;
    return new Date(fecha.getTime() - tz).toISOString().slice(0, 10);
}

function obtenerDefinicionCamposAnalitica() {
    return [
        { clave: "deposito", etiqueta: "Depósito", unidad: "", tipo: "text" },
        { clave: "litros", etiqueta: "Litros", unidad: "l", tipo: "number" },
        { clave: "alcohol", etiqueta: "Alcohol", unidad: "% vol", tipo: "number" },
        { clave: "av", etiqueta: "AV", unidad: "g/l", tipo: "number" },
        { clave: "ph", etiqueta: "pH", unidad: "", tipo: "number" },
        { clave: "ntu", etiqueta: "NTU", unidad: "NTU", tipo: "number" },
        { clave: "azucar", etiqueta: "Azúcar", unidad: "g/l", tipo: "number" },
        { clave: "numero_botas", etiqueta: "nº botas", unidad: "", tipo: "number" },
        { clave: "cliente", etiqueta: "Cliente", unidad: "", tipo: "text" },
        { clave: "tipo_bota", etiqueta: "Tipo bota", unidad: "", tipo: "text" },
        { clave: "vo_at", etiqueta: "vo(@)", unidad: "", tipo: "number" },
        { clave: "observaciones", etiqueta: "Observaciones", unidad: "", tipo: "textarea" },
    ];
}

async function cargarVistaAnaliticas(forzar = false) {
    const lista = document.getElementById("analiticas-lista");
    if (lista && (forzar || !estadoAnaliticas.items.length)) {
        lista.innerHTML = `<div class="destino-productos-vacio">Cargando analiticas...</div>`;
    }
    try {
        const items = (await wsRequest("listar_analiticas", {})) || [];
        estadoAnaliticas.items = Array.isArray(items) ? items : [];
        renderizarListaAnaliticas();
        if (estadoAnaliticas.seleccionadaId) {
            await cargarDetalleAnalitica(estadoAnaliticas.seleccionadaId, true);
        } else if (!document.getElementById("analitica-descripcion")?.value) {
            prepararFormularioNuevaAnalitica();
        }
    } catch (err) {
        console.error("No se pudieron cargar las analiticas:", err);
        if (lista) lista.innerHTML = `<div class="destino-productos-vacio">Error al cargar analiticas.</div>`;
    }
}

function renderizarListaAnaliticas() {
    const lista = document.getElementById("analiticas-lista");
    const resumen = document.getElementById("analiticas-lista-resumen");
    if (!lista) return;

    const items = (estadoAnaliticas.items || []).filter((item) => {
        const coincideEstado = !estadoAnaliticas.filtroEstado || String(item.estado || "").trim().toUpperCase() === estadoAnaliticas.filtroEstado;
        const coincideFecha = !estadoAnaliticas.filtroFecha || String(item.fecha || "") === estadoAnaliticas.filtroFecha;
        return coincideEstado && coincideFecha;
    });

    if (resumen) resumen.textContent = `${items.length} analitica${items.length === 1 ? "" : "s"}`;

    if (!items.length) {
        lista.innerHTML = `<div class="destino-productos-vacio">No hay analiticas registradas.</div>`;
        return;
    }

    lista.innerHTML = items.map((item) => {
        const selected = Number(item.id || 0) === Number(estadoAnaliticas.seleccionadaId || 0);
        return `
            <article class="analitica-card ${selected ? "is-selected" : ""}" data-analitica-id="${Number(item.id || 0)}">
                <div class="analitica-card-header">
                    <div>
                        <strong>${escapeHtmlDestinoProductos(item.descripcion || "-")}</strong>
                        <div class="small text-muted">${escapeHtmlDestinoProductos(item.fecha || "-")}</div>
                    </div>
                    <span class="envinado-card-tag">${escapeHtmlDestinoProductos(formatearEstadoAnalitica(item.estado))}</span>
                </div>
            </article>
        `;
    }).join("");
}

function prepararFormularioNuevaAnalitica() {
    estadoAnaliticas.seleccionadaId = null;
    document.getElementById("analitica-fecha").value = obtenerFechaHoyAnalitica();
    document.getElementById("analitica-estado").value = "ACTIVA";
    document.getElementById("analitica-descripcion").value = "";
    document.getElementById("analitica-estado-guardado").textContent = "Nueva analitica.";
    document.getElementById("analiticas-bloque-lista")?.setAttribute("open", "open");
    renderizarCamposAnalitica({});
    renderizarListaAnaliticas();
}

async function cargarDetalleAnalitica(analiticaId, silencioso = false) {
    if (!analiticaId) return;
    try {
        const detalle = await wsRequest("obtener_analitica", { analitica_id: analiticaId });
        estadoAnaliticas.seleccionadaId = Number(detalle?.id || 0) || null;
        document.getElementById("analitica-fecha").value = detalle?.fecha || obtenerFechaHoyAnalitica();
        document.getElementById("analitica-estado").value = detalle?.estado || "ACTIVA";
        document.getElementById("analitica-descripcion").value = detalle?.descripcion || "";
        document.getElementById("analitica-estado-guardado").textContent = silencioso ? "" : `Editando analitica #${detalle?.id || ""}.`;
        renderizarCamposAnalitica(detalle?.valores || {});
        document.getElementById("analiticas-bloque-lista")?.removeAttribute("open");
        renderizarListaAnaliticas();
    } catch (err) {
        console.error("No se pudo cargar la analitica:", err);
        alert(err?.message || "No se pudo cargar la analitica.");
    }
}

function renderizarCamposAnalitica(valores) {
    const contenedor = document.getElementById("analitica-campos");
    if (!contenedor) return;
    contenedor.innerHTML = obtenerDefinicionCamposAnalitica().map((campo) => `
        <div class="analitica-campo-row">
            <div>
                <div class="analitica-campo-header">
                    <label class="form-label mb-0">${escapeHtmlDestinoProductos(campo.etiqueta)}</label>
                    <span class="analitica-campo-unidad">${escapeHtmlDestinoProductos(campo.unidad || "-")}</span>
                </div>
                ${campo.tipo === "textarea" ? `
                    <textarea
                        class="form-control analitica-campo-valor"
                        data-analitica-clave="${escapeHtmlDestinoProductos(campo.clave)}"
                        rows="3"
                        maxlength="500"
                    >${escapeHtmlDestinoProductos(valores?.[campo.clave] || "")}</textarea>
                ` : `
                    <input
                        type="${escapeHtmlDestinoProductos(campo.tipo || "text") }"
                        class="form-control analitica-campo-valor"
                        data-analitica-clave="${escapeHtmlDestinoProductos(campo.clave)}"
                        value="${escapeHtmlDestinoProductos(valores?.[campo.clave] || "") }"
                        ${campo.tipo === "number" ? 'step="any" inputmode="decimal"' : ''}
                        ${campo.clave === "numero_botas" ? 'step="1" inputmode="numeric"' : ''}
                        maxlength="64"
                    >
                `}
            </div>
        </div>
    `).join("");
}

function recogerValoresAnalitica() {
    const valores = {};
    document.querySelectorAll("#analitica-campos .analitica-campo-valor").forEach((input) => {
        const clave = String(input.dataset.analiticaClave || "").trim();
        if (!clave) return;
        valores[clave] = input.value?.trim() || "";
    });
    return valores;
}

async function guardarAnaliticaMovil() {
    const fecha = document.getElementById("analitica-fecha")?.value || "";
    const estado = document.getElementById("analitica-estado")?.value || "ACTIVA";
    const descripcion = document.getElementById("analitica-descripcion")?.value?.trim() || "";
    const estadoEl = document.getElementById("analitica-estado-guardado");
    const valores = recogerValoresAnalitica();

    if (!fecha) {
        alert("La fecha es obligatoria.");
        return;
    }
    if (!descripcion) {
        alert("La descripción es obligatoria.");
        return;
    }

    try {
        if (estadoEl) estadoEl.textContent = "Guardando...";
        const detalle = await wsRequest("guardar_analitica", {
            id: estadoAnaliticas.seleccionadaId,
            fecha,
            estado,
            descripcion,
            valores,
        });
        estadoAnaliticas.seleccionadaId = Number(detalle?.id || 0) || null;
        if (estadoEl) estadoEl.textContent = `Analitica guardada #${detalle?.id || ""}.`;
        await cargarVistaAnaliticas(true);
    } catch (err) {
        console.error("No se pudo guardar la analitica:", err);
        if (estadoEl) estadoEl.textContent = "";
        alert(err?.message || "No se pudo guardar la analitica.");
    }
}

function formatearEstadoAnalitica(estado) {
    const map = {
        ACTIVA: "Activa",
        FINALIZADA: "Finalizada",
    };
    return map[String(estado || "").trim().toUpperCase()] || (estado || "-");
}
