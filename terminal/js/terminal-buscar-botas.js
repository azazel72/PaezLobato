const estadoBuscarBotas = {
    items: [],
    ultimoCodigo: "",
};

function prepararEventosBuscarBotas() {
    const btnBuscar = document.getElementById("buscar-botas-obtener");
    const inputCodigo = document.getElementById("buscar-botas-codigo");
    if (btnBuscar) {
        btnBuscar.addEventListener("click", () => {
            cargarVistaBuscarBotas(true);
        });
    }
    if (inputCodigo) {
        inputCodigo.addEventListener("keydown", (event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            cargarVistaBuscarBotas(true);
        });
    }

    const lista = document.getElementById("buscar-botas-lista");
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
            abrirModalBuscarBota(productoId);
        });
    }
}

async function cargarVistaBuscarBotas(forzar = false) {
    const inputCodigo = document.getElementById("buscar-botas-codigo");
    if (!inputCodigo) return;
    const codigo = String(inputCodigo.value || "").trim();
    if (!codigo) {
        estadoBuscarBotas.items = [];
        estadoBuscarBotas.ultimoCodigo = "";
        const lista = document.getElementById("buscar-botas-lista");
        if (lista) lista.innerHTML = `<div class="fabricacion-card-empty">Introduce parte del código y pulsa Buscar.</div>`;
        return;
    }
    if (!forzar && estadoBuscarBotas.ultimoCodigo === codigo && estadoBuscarBotas.items.length) {
        renderizarListaBuscarBotas();
        return;
    }
    await obtenerBuscarBotas(codigo);
}

async function obtenerBuscarBotas(codigo) {
    const lista = document.getElementById("buscar-botas-lista");
    if (!lista) return;
    lista.innerHTML = `<div class="fabricacion-card-empty">Buscando botas...</div>`;
    try {
        const items = (await wsRequest("buscar_botas_por_codigo", { codigo })) || [];
        estadoBuscarBotas.items = Array.isArray(items) ? items : [];
        estadoBuscarBotas.ultimoCodigo = codigo;
        renderizarListaBuscarBotas();
    } catch (err) {
        console.error("No se pudieron buscar las botas:", err);
        estadoBuscarBotas.items = [];
        estadoBuscarBotas.ultimoCodigo = codigo;
        lista.innerHTML = `<div class="fabricacion-card-empty">Error al buscar botas.</div>`;
    }
}

function renderizarListaBuscarBotas() {
    const lista = document.getElementById("buscar-botas-lista");
    if (!lista) return;
    const items = estadoBuscarBotas.items || [];
    lista.innerHTML = "";
    if (!items.length) {
        lista.innerHTML = `<div class="fabricacion-card-empty">No hay botas con ese código.</div>`;
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

function abrirModalBuscarBota(productoId) {
    const item = (estadoBuscarBotas.items || []).find((row) => Number(row.producto_id || 0) === Number(productoId || 0));
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

function refrescarBuscarBotasDesdeServidor(_data = {}) {
    if (!estadoBuscarBotas.ultimoCodigo) return;
    cargarVistaBuscarBotas(true);
}
