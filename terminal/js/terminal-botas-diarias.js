const estadoBotasDiarias = {
    items: [],
    seleccionada: null,
    ultimaFecha: "",
};

function prepararEventosBotasDiarias() {
    const btnObtener = document.getElementById("botas-diarias-obtener");
    if (btnObtener) {
        btnObtener.addEventListener("click", () => {
            cargarVistaBotasDiarias(true);
        });
    }

    const lista = document.getElementById("botas-diarias-lista");
    if (lista) {
        lista.addEventListener("click", (event) => {
            const botonReimprimir = event.target.closest("[data-reimprimir-producto-id]");
            if (botonReimprimir) {
                event.preventDefault();
                event.stopPropagation();
                const productoId = Number(botonReimprimir.dataset.reimprimirProductoId || 0);
                if (productoId) {
                    reimprimirBotaDiariaPorId(productoId);
                }
                return;
            }
            const card = event.target.closest("[data-producto-id]");
            if (!card) return;
            const productoId = Number(card.dataset.productoId || 0);
            if (!productoId) return;
            abrirModalBotaDiaria(productoId);
        });
    }

    const btnReimprimir = document.getElementById("botas-diarias-reimprimir");
    if (btnReimprimir) {
        btnReimprimir.addEventListener("click", async () => {
            await reimprimirBotaDiariaSeleccionada();
        });
    }
}

function obtenerFechaHoyLocalBotasDiarias() {
    const fecha = new Date();
    const y = fecha.getFullYear();
    const m = String(fecha.getMonth() + 1).padStart(2, "0");
    const d = String(fecha.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

async function cargarVistaBotasDiarias(forzar = false) {
    const inputFecha = document.getElementById("botas-diarias-fecha");
    if (!inputFecha) return;
    if (!inputFecha.value) {
        inputFecha.value = obtenerFechaHoyLocalBotasDiarias();
    }
    const fecha = inputFecha.value || obtenerFechaHoyLocalBotasDiarias();
    if (!forzar && estadoBotasDiarias.ultimaFecha === fecha && estadoBotasDiarias.items.length) {
        renderizarListaBotasDiarias();
        return;
    }
    await obtenerBotasDiarias(fecha);
}

async function obtenerBotasDiarias(fecha) {
    const lista = document.getElementById("botas-diarias-lista");
    if (!lista) return;
    lista.innerHTML = `<div class="fabricacion-card-empty">Cargando botas...</div>`;
    estadoBotasDiarias.seleccionada = null;
    try {
        const items = (await wsRequest("listar_botas_diarias", { fecha })) || [];
        estadoBotasDiarias.items = Array.isArray(items) ? items : [];
        estadoBotasDiarias.ultimaFecha = fecha;
        renderizarListaBotasDiarias();
    } catch (err) {
        console.error("No se pudieron cargar las botas diarias:", err);
        estadoBotasDiarias.items = [];
        estadoBotasDiarias.ultimaFecha = fecha;
        lista.innerHTML = `<div class="fabricacion-card-empty">Error al cargar botas.</div>`;
    }
}

function renderizarListaBotasDiarias() {
    const lista = document.getElementById("botas-diarias-lista");
    if (!lista) return;
    const items = estadoBotasDiarias.items || [];
    lista.innerHTML = "";
    if (!items.length) {
        lista.innerHTML = `<div class="fabricacion-card-empty">No hay botas fabricadas en esa fecha.</div>`;
        return;
    }

    items.forEach((item) => {
        const card = document.createElement("article");
        card.className = "botas-diarias-card";
        card.dataset.productoId = item.producto_id ?? "";
        card.dataset.estado = item.estado ?? "";
        const operarios = (item.operarios || []).map((op) => op.nombre).filter(Boolean).join(" / ") || "-";
        const pedido = item.pedido_descripcion || item.pedido_numero || "-";
        card.innerHTML = `
            <div class="botas-diarias-card-titulo">
                <div class="botas-diarias-card-titulo-main">
                    <h6>${item.codigo || "-"}</h6>
                    <div class="botas-diarias-card-fecha">${formatearFechaHoraBotasDiarias(item.fecha)}</div>
                </div>
            </div>
            <div class="botas-diarias-card-cuerpo">
                <div class="botas-diarias-card-cuerpo-main">
                    <div class="botas-diarias-card-linea botas-diarias-card-linea-secundaria">Pedido: ${pedido}</div>
                    <div class="botas-diarias-card-linea botas-diarias-card-linea-secundaria">Batidero: ${item.codigo_batidero || "-"}</div>
                    <div class="botas-diarias-card-linea botas-diarias-card-linea-secundaria">Fondado: ${operarios}</div>
                </div>
                <button
                    type="button"
                    class="btn btn-sm destino-pedido-accion"
                    data-reimprimir-producto-id="${item.producto_id ?? ""}"
                    title="Reimprimir etiqueta"
                    aria-label="Reimprimir etiqueta"
                >
                    <i class="bi bi-printer"></i>
                </button>
            </div>
        `;
        lista.appendChild(card);
    });
}

function formatearFechaHoraBotasDiarias(valor) {
    if (!valor) return "-";
    const fecha = new Date(valor);
    if (Number.isNaN(fecha.getTime())) return String(valor);
    return fecha.toLocaleString("es-ES", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function abrirModalBotaDiaria(productoId) {
    const item = (estadoBotasDiarias.items || []).find((row) => Number(row.producto_id || 0) === Number(productoId || 0));
    if (!item) return;
    estadoBotasDiarias.seleccionada = item;
    const contenedor = document.getElementById("botas-diarias-detalle");
    if (contenedor) {
        const operarios = (item.operarios || []).map((op) => op.nombre).filter(Boolean).join(" / ") || "-";
        const palets = (item.palets || []).join(" / ") || "-";
        const lotes = (item.lotes || []).join(" / ") || "-";
        contenedor.innerHTML = `
            <div class="botas-diarias-detalle-linea"><span class="text-muted">Código</span><strong>${item.codigo || "-"}</strong></div>
            <div class="botas-diarias-detalle-linea"><span class="text-muted">Fecha</span><strong>${formatearFechaHoraBotasDiarias(item.fecha)}</strong></div>
            <div class="botas-diarias-detalle-linea"><span class="text-muted">Pedido</span><strong>${item.pedido_descripcion || item.pedido_numero || "-"}</strong></div>
            <div class="botas-diarias-detalle-linea"><span class="text-muted">Tipo</span><strong>${item.tipo_producto_descripcion || "-"}</strong></div>
            <div class="botas-diarias-detalle-linea"><span class="text-muted">Material</span><strong>${item.material_descripcion || "-"}</strong></div>
            <div class="botas-diarias-detalle-linea"><span class="text-muted">Tostado</span><strong>${item.tostado_descripcion || "-"}</strong></div>
            <div class="botas-diarias-detalle-linea"><span class="text-muted">Batidero</span><strong>${item.codigo_batidero || "-"}</strong></div>
            <div class="botas-diarias-detalle-linea"><span class="text-muted">Operarios</span><strong>${operarios}</strong></div>
            <div class="botas-diarias-detalle-linea"><span class="text-muted">Lotes</span><strong>${lotes}</strong></div>
            <div class="botas-diarias-detalle-linea"><span class="text-muted">Palets</span><strong>${palets}</strong></div>
        `;
    }
    const modalEl = document.getElementById("modalBotasDiarias");
    if (!modalEl) return;
    bootstrap.Modal.getOrCreateInstance(modalEl).show();
}

async function reimprimirBotaDiariaSeleccionada() {
    const item = estadoBotasDiarias.seleccionada;
    if (!item?.producto_id) {
        alert("No hay bota seleccionada.");
        return;
    }
    await reimprimirBotaDiariaPorId(item.producto_id, true);
}

async function reimprimirBotaDiariaPorId(productoId, cerrarModal = false) {
    if (!productoId) return;
    try {
        await wsRequest("reimprimir_etiqueta_bota", { producto_id: productoId });
        if (cerrarModal) {
            const modalEl = document.getElementById("modalBotasDiarias");
            const modal = modalEl ? bootstrap.Modal.getOrCreateInstance(modalEl) : null;
            modal?.hide();
        }
    } catch (err) {
        console.error("No se pudo reimprimir la etiqueta:", err);
        alert("Error al reimprimir la etiqueta.");
    }
}

function refrescarBotasDiariasDesdeServidor(_data = {}) {
    if (!estadoBotasDiarias.ultimaFecha) return;
    cargarVistaBotasDiarias(true);
}
