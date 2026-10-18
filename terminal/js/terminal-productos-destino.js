function reproducirFeedbackCodigo(tipo) {
    try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = reproducirFeedbackCodigo.ctx || new AudioCtx();
        reproducirFeedbackCodigo.ctx = ctx;
        const ahora = ctx.currentTime;
        const correcto = tipo === "ok";
        const crearPulso = (inicio, frecuencia, duracion, volumen) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "sine";
            osc.frequency.setValueAtTime(frecuencia, inicio);
            gain.gain.setValueAtTime(0.0001, inicio);
            gain.gain.exponentialRampToValueAtTime(volumen, inicio + 0.01);
            gain.gain.exponentialRampToValueAtTime(0.0001, inicio + duracion);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(inicio);
            osc.stop(inicio + duracion + 0.01);
        };
        if (!correcto) {
            crearPulso(ahora, 220, 0.11, 0.22);
            crearPulso(ahora + 0.16, 220, 0.11, 0.22);
            crearPulso(ahora + 0.32, 220, 0.11, 0.22);
            return;
        }
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(880, ahora);
        osc.frequency.exponentialRampToValueAtTime(1174, ahora + 0.08);
        gain.gain.setValueAtTime(0.0001, ahora);
        gain.gain.exponentialRampToValueAtTime(0.14, ahora + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, ahora + 0.12);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ahora);
        osc.stop(ahora + 0.13);
    } catch (err) {
        console.warn("No se pudo reproducir feedback sonoro:", err);
    }
}

function reproducirCodigoCorrecto() {
    reproducirFeedbackCodigo("ok");
}

function reproducirCodigoError() {
    reproducirFeedbackCodigo("error");
}

async function cargarVistaProductosPorFiltros(config) {
    const lista = document.getElementById(config.listaId);
    const resumen = document.getElementById(config.resumenId);
    if (!lista || !resumen) return;

    lista.innerHTML = `<div class="destino-productos-vacio">Cargando productos...</div>`;
    resumen.textContent = "";

    try {
        const items = (await wsRequest("listar_productos_por_filtros", {
            tipos: config.tipos,
            pedido_estado: config.pedidoEstado,
            pedido_destino: config.pedidoDestino,
            estados_producto: config.estadosProducto,
        })) || [];

        const renderizador = typeof config.renderizador === "function"
            ? config.renderizador
            : renderizarVistaProductosPorFiltros;
        renderizador({
            lista,
            resumen,
            items,
            estadosProducto: config.estadosProducto,
            textoVacio: config.textoVacio,
            etiquetaResumen: config.etiquetaResumen,
            mostrarDestinoPedido: config.mostrarDestinoPedido,
            resolverClasePedido: config.resolverClasePedido,
            renderAccionPedido: config.renderAccionPedido,
        });
    } catch (err) {
        console.error(`No se pudo cargar la vista ${config.listaId}:`, err);
        lista.innerHTML = `<div class="destino-productos-vacio">Error cargando productos.</div>`;
        resumen.textContent = "";
    }
}

function renderizarVistaProductosPorFiltros(config) {
    const { lista, resumen, items, estadosProducto, textoVacio, etiquetaResumen } = config;
    const etiqueta = etiquetaResumen || "productos";
    if (!Array.isArray(items) || !items.length) {
        lista.innerHTML = `<div class="destino-productos-vacio">${textoVacio || "Sin productos."}</div>`;
        resumen.textContent = `0 ${etiqueta}`;
        return;
    }

    const grupos = new Map(estadosProducto.map((estado) => [Number(estado), []]));
    items.forEach((item) => {
        const estado = Number(item?.estado || 0);
        if (!grupos.has(estado)) grupos.set(estado, []);
        grupos.get(estado).push(item);
    });

    const fragmentos = [];
    let total = 0;
    estadosProducto.forEach((estado) => {
        const grupo = grupos.get(Number(estado)) || [];
        total += grupo.length;
        if (!grupo.length) return;
        const titulo = grupo[0]?.estado_descripcion || `Estado ${estado}`;
        fragmentos.push(`
            <section class="destino-productos-grupo">
                <div class="destino-productos-grupo-header">
                    <h6>${escapeHtmlDestinoProductos(titulo)}</h6>
                    <span>${grupo.length}</span>
                </div>
                <div class="destino-productos-grupo-lista">
                    ${grupo.map(renderizarCardProductoDestino).join("")}
                </div>
            </section>
        `);
    });

    lista.innerHTML = fragmentos.join("") || `<div class="destino-productos-vacio">${textoVacio || "Sin productos."}</div>`;
    resumen.textContent = `${total} ${etiqueta}`;
}

function renderizarVistaProductosPorPedido(config) {
    const { lista, resumen, items, textoVacio, etiquetaResumen, mostrarDestinoPedido, resolverClasePedido, renderAccionPedido } = config;
    const etiqueta = etiquetaResumen || "productos";
    if (!Array.isArray(items) || !items.length) {
        lista.innerHTML = `<div class="destino-productos-vacio">${textoVacio || "Sin productos."}</div>`;
        resumen.textContent = `0 ${etiqueta}`;
        return;
    }

    const pedidos = new Map();
    items.forEach((item) => {
        const pedidoId = Number(item?.pedido_id || 0);
        if (!pedidoId) return;
        if (!pedidos.has(pedidoId)) {
            pedidos.set(pedidoId, {
                pedidoId,
                pedidoNumero: item?.pedido_numero || item?.pedido_descripcion || `Pedido ${pedidoId}`,
                cliente: item?.cliente_nombre || "Sin cliente",
                pedidoDestino: String(item?.pedido_destino || "").trim(),
                codigos: [],
            });
        }
        pedidos.get(pedidoId).codigos.push(String(item?.codigo || "").trim());
    });

    const grupos = Array.from(pedidos.values()).sort((a, b) =>
        String(a.pedidoNumero).localeCompare(String(b.pedidoNumero), "es")
    );

    lista.innerHTML = grupos.map((grupo) => `
        <details class="${escapeHtmlDestinoProductos(typeof resolverClasePedido === "function" ? resolverClasePedido(grupo.pedidoDestino) : "destino-pedido-card")}">
            <summary class="destino-pedido-resumen">
                <div class="destino-pedido-resumen-main">
                    <strong>${escapeHtmlDestinoProductos(grupo.pedidoNumero)}</strong>
                    <span>${escapeHtmlDestinoProductos(grupo.cliente)}</span>
                    ${mostrarDestinoPedido ? `<span class="destino-pedido-destino">${escapeHtmlDestinoProductos(obtenerTextoDestinoPedido(grupo.pedidoDestino))}</span>` : ""}
                </div>
                <div class="destino-pedido-resumen-lateral">
                    <div class="destino-pedido-resumen-total">${grupo.codigos.length} botas</div>
                    ${typeof renderAccionPedido === "function" ? renderAccionPedido(grupo) : ""}
                </div>
            </summary>
            <div class="destino-pedido-codigos">
                ${grupo.codigos
                    .filter(Boolean)
                    .sort((a, b) => a.localeCompare(b, "es"))
                    .map((codigo) => `<div class="destino-pedido-codigo">${escapeHtmlDestinoProductos(codigo)}</div>`)
                    .join("")}
            </div>
        </details>
    `).join("");

    resumen.textContent = `${items.length} ${etiqueta}`;
}

function obtenerTextoDestinoPedido(destino) {
    const valor = String(destino || "").trim().toUpperCase();
    if (valor === "E" || valor === "ENVINADO") return "Envinar";
    if (valor === "C" || valor === "CLIENTE") return "Cliente";
    return String(destino || "Sin destino");
}

function renderizarCardProductoDestino(item) {
    const pedido = item?.pedido_numero || item?.pedido_descripcion || `Pedido ${item?.pedido_id || ""}`;
    const cliente = item?.cliente_nombre || "Sin cliente";
    const tipo = item?.tipo_producto_descripcion || item?.producto_tipo || "Sin tipo";
    const material = item?.material_descripcion || "Sin material";
    const codigo = item?.codigo || `Producto ${item?.id || ""}`;
    return `
        <article class="destino-producto-card">
            <div class="destino-producto-card-top">
                <strong>${escapeHtmlDestinoProductos(codigo)}</strong>
                <span>${escapeHtmlDestinoProductos(item?.estado_descripcion || "")}</span>
            </div>
            <div class="destino-producto-card-grid">
                <div>
                    <span>Pedido</span>
                    <strong>${escapeHtmlDestinoProductos(pedido)}</strong>
                </div>
                <div>
                    <span>Cliente</span>
                    <strong>${escapeHtmlDestinoProductos(cliente)}</strong>
                </div>
                <div>
                    <span>Tipo</span>
                    <strong>${escapeHtmlDestinoProductos(tipo)}</strong>
                </div>
                <div>
                    <span>Madera</span>
                    <strong>${escapeHtmlDestinoProductos(material)}</strong>
                </div>
            </div>
        </article>
    `;
}

function escapeHtmlDestinoProductos(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
