const estadoVistaEnvinado = {
    pendientes: [],
    envinadas: [],
    analiticas: [],
    codigosPendientesSeleccionados: [],
    codigosArchivoSeleccionados: [],
};

function codigoBotaCompletoSinIntroEnvinado(valor) {
    return /(?:-|[xX])\d{9}$/.test(String(valor || "").trim());
}

function prepararAutoinsercionCodigoEnvinado(input, insertarCodigo) {
    if (!input || typeof insertarCodigo !== "function") return;
    input.addEventListener("input", () => {
        const valor = String(input.value || "").trim();
        if (!valor) {
            delete input.dataset.autoinsertUltimo;
            return;
        }
        if (!codigoBotaCompletoSinIntroEnvinado(valor)) return;
        if (input.dataset.autoinsertUltimo === valor) return;
        input.dataset.autoinsertUltimo = valor;
        insertarCodigo(valor);
        if (String(input.value || "").trim() !== valor) {
            delete input.dataset.autoinsertUltimo;
        }
    });
}

function prepararEventosEnvinado() {
    const inputPendiente = document.getElementById("envinado-codigo");
    inputPendiente?.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        agregarCodigoPendienteEnvinado(event.target.value);
    });
    prepararAutoinsercionCodigoEnvinado(inputPendiente, agregarCodigoPendienteEnvinado);

    document.getElementById("envinado-confirmar")?.addEventListener("click", async () => {
        await confirmarEnvinadoPendiente();
    });

    const inputArchivo = document.getElementById("envinado-archivo-codigo");
    inputArchivo?.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") return;
        event.preventDefault();
        agregarCodigoArchivoEnvinado(event.target.value);
    });
    prepararAutoinsercionCodigoEnvinado(inputArchivo, agregarCodigoArchivoEnvinado);

    document.getElementById("envinado-archivo-subir")?.addEventListener("click", async () => {
        await subirArchivoBotaEnvinada();
    });
}

async function cargarVistaEnvinado(forzar = false) {
    const resumen = document.getElementById("envinado-resumen");
    const pendientesLista = document.getElementById("envinado-pendientes-lista");
    const envinadasLista = document.getElementById("envinado-finalizadas-lista");
    if (forzar || !estadoVistaEnvinado.pendientes.length && !estadoVistaEnvinado.envinadas.length) {
        if (pendientesLista) pendientesLista.innerHTML = `<div class="destino-productos-vacio">Cargando botas pendientes...</div>`;
        if (envinadasLista) envinadasLista.innerHTML = `<div class="destino-productos-vacio">Cargando botas envinadas...</div>`;
        if (resumen) resumen.textContent = "";
    }
    try {
        const data = (await wsRequest("listar_resumen_envinado", {})) || {};
        estadoVistaEnvinado.pendientes = Array.isArray(data.pendientes) ? data.pendientes : [];
        estadoVistaEnvinado.envinadas = Array.isArray(data.envinadas) ? data.envinadas : [];
        estadoVistaEnvinado.analiticas = Array.isArray(data.analiticas_activas) ? data.analiticas_activas : [];
        pintarSelectorAnaliticasEnvinado();
        renderizarListasEnvinado();
        renderizarCodigosPendientesEnvinado();
        renderizarCodigosArchivoEnvinado();
    } catch (err) {
        console.error("No se pudo cargar la vista de envinado:", err);
        if (pendientesLista) pendientesLista.innerHTML = `<div class="destino-productos-vacio">Error al cargar botas pendientes.</div>`;
        if (envinadasLista) envinadasLista.innerHTML = `<div class="destino-productos-vacio">Error al cargar botas envinadas.</div>`;
    }
}

function pintarSelectorAnaliticasEnvinado() {
    const selector = document.getElementById("envinado-analitica");
    if (!selector) return;
    const actual = selector.value;
    selector.innerHTML = `<option value="">Selecciona una analitica...</option>` + estadoVistaEnvinado.analiticas.map((item) => `
        <option value="${Number(item.id || 0)}">${escapeHtmlDestinoProductos((item.fecha || "") + " - " + (item.descripcion || ""))}</option>
    `).join("");
    if (actual && estadoVistaEnvinado.analiticas.some((item) => Number(item.id || 0) === Number(actual))) {
        selector.value = actual;
    } else {
        const primeraActiva = estadoVistaEnvinado.analiticas.find((item) => String(item.estado || "").toUpperCase() === "ACTIVA");
        if (primeraActiva) selector.value = String(primeraActiva.id);
    }
}

function renderizarListasEnvinado() {
    const resumen = document.getElementById("envinado-resumen");
    const pendientesLista = document.getElementById("envinado-pendientes-lista");
    const envinadasLista = document.getElementById("envinado-finalizadas-lista");
    const pendientesContador = document.getElementById("envinado-pendientes-contador");
    const envinadasContador = document.getElementById("envinado-finalizadas-contador");
    if (resumen) resumen.textContent = `${estadoVistaEnvinado.pendientes.length} pendientes y ${estadoVistaEnvinado.envinadas.length} envinadas.`;
    if (pendientesContador) pendientesContador.textContent = String(estadoVistaEnvinado.pendientes.length);
    if (envinadasContador) envinadasContador.textContent = String(estadoVistaEnvinado.envinadas.length);

    if (pendientesLista) {
        pendientesLista.innerHTML = estadoVistaEnvinado.pendientes.length
            ? estadoVistaEnvinado.pendientes.map(renderizarCardPendienteEnvinado).join("")
            : `<div class="destino-productos-vacio">No hay botas pendientes de envinar.</div>`;
    }
    if (envinadasLista) {
        envinadasLista.innerHTML = estadoVistaEnvinado.envinadas.length
            ? estadoVistaEnvinado.envinadas.map(renderizarCardFinalizadaEnvinado).join("")
            : `<div class="destino-productos-vacio">No hay botas envinadas.</div>`;
    }
}

function renderizarCardPendienteEnvinado(item) {
    return `
        <article class="envinado-card">
            <div class="envinado-card-header">
                <div>
                    <strong>${escapeHtmlDestinoProductos(item.codigo || "-")}</strong>
                    <div class="small text-muted">${escapeHtmlDestinoProductos(item.ubicacion || "-")}</div>
                </div>
            </div>
            <div class="envinado-card-meta">
                <div>
                    <span>Pedido</span>
                    <strong>${escapeHtmlDestinoProductos(item.pedido_numero || "-")}</strong>
                </div>
                <div>
                    <span>Cliente</span>
                    <strong>${escapeHtmlDestinoProductos(item.cliente_nombre || "-")}</strong>
                </div>
            </div>
            <div class="envinado-card-tags">
                <span class="envinado-card-tag">${escapeHtmlDestinoProductos(item.estado_descripcion || "Pendiente")}</span>
            </div>
        </article>
    `;
}

function renderizarCardFinalizadaEnvinado(item) {
    return `
        <article class="envinado-card">
            <div class="envinado-card-header">
                <div>
                    <strong>${escapeHtmlDestinoProductos(item.codigo || "-")}</strong>
                    <div class="small text-muted">${escapeHtmlDestinoProductos(item.ubicacion || "-")}</div>
                </div>
            </div>
            <div class="envinado-card-meta">
                <div>
                    <span>Pedido</span>
                    <strong>${escapeHtmlDestinoProductos(item.pedido_numero || "-")}</strong>
                </div>
                <div>
                    <span>Analitica</span>
                    <strong>${escapeHtmlDestinoProductos(item.analitica_descripcion || "-")}</strong>
                </div>
            </div>
            <div class="envinado-card-tags">
                <span class="envinado-card-tag">${escapeHtmlDestinoProductos(item.estado_descripcion || "Envinada")}</span>
                <span class="envinado-card-tag">${Number(item.documentos_count || 0)} doc.</span>
            </div>
        </article>
    `;
}

function agregarCodigoPendienteEnvinado(codigoRaw) {
    const codigo = String(codigoRaw || "").trim();
    const input = document.getElementById("envinado-codigo");
    if (!codigo) return;
    if (!estadoVistaEnvinado.pendientes.some((item) => String(item.codigo || "") === codigo)) {
        if (input) input.value = "";
        reproducirCodigoError();
        mostrarErrorEnvinado(`Código ${codigo}: no está pendiente de envinar.`);
        return;
    }
    if (estadoVistaEnvinado.codigosPendientesSeleccionados.includes(codigo)) {
        if (input) input.value = "";
        reproducirCodigoError();
        mostrarErrorEnvinado(`Código ${codigo}: ya está agregado.`);
        return;
    }
    estadoVistaEnvinado.codigosPendientesSeleccionados.push(codigo);
    if (input) input.value = "";
    reproducirCodigoCorrecto();
    mostrarErrorEnvinado("");
    renderizarCodigosPendientesEnvinado();
}

function renderizarCodigosPendientesEnvinado() {
    const contenedor = document.getElementById("envinado-codigos");
    if (!contenedor) return;
    const contador = document.getElementById("envinado-codigos-contador");
    if (contador) {
        const total = estadoVistaEnvinado.codigosPendientesSeleccionados.length;
        contador.textContent = `${total} seleccionada${total === 1 ? "" : "s"}`;
    }
    if (!estadoVistaEnvinado.codigosPendientesSeleccionados.length) {
        contenedor.innerHTML = `<div class="text-muted small">Sin botas seleccionadas.</div>`;
        return;
    }
    contenedor.innerHTML = estadoVistaEnvinado.codigosPendientesSeleccionados.map((codigo) => `
        <span class="destino-expedir-codigo">
            ${escapeHtmlDestinoProductos(codigo)}
            <button type="button" data-envinado-quitar="${escapeHtmlDestinoProductos(codigo)}" aria-label="Quitar código">&times;</button>
        </span>
    `).join("");
    contenedor.querySelectorAll("[data-envinado-quitar]").forEach((boton) => {
        boton.addEventListener("click", () => {
            estadoVistaEnvinado.codigosPendientesSeleccionados = estadoVistaEnvinado.codigosPendientesSeleccionados.filter((item) => item !== String(boton.dataset.envinadoQuitar || ""));
            renderizarCodigosPendientesEnvinado();
        });
    });
}

function mostrarErrorEnvinado(texto) {
    const el = document.getElementById("envinado-error");
    if (!el) return;
    el.textContent = texto || "";
    el.classList.toggle("d-none", !texto);
}

async function confirmarEnvinadoPendiente() {
    const selector = document.getElementById("envinado-analitica");
    const analiticaId = Number(selector?.value || 0);
    if (!analiticaId) {
        mostrarErrorEnvinado("Debes seleccionar una analitica.");
        return;
    }
    if (!estadoVistaEnvinado.codigosPendientesSeleccionados.length) {
        mostrarErrorEnvinado("Debes agregar al menos una bota.");
        return;
    }
    if (!confirm(`Hay ${estadoVistaEnvinado.codigosPendientesSeleccionados.length} botas seleccionadas. ¿Confirmas el envío?`)) {
        return;
    }
    try {
        mostrarErrorEnvinado("");
        await wsRequest("envinar_botas_pendientes", {
            analitica_id: analiticaId,
            codigos: estadoVistaEnvinado.codigosPendientesSeleccionados,
        });
        estadoVistaEnvinado.codigosPendientesSeleccionados = [];
        await cargarVistaEnvinado(true);
    } catch (err) {
        console.error("No se pudieron marcar las botas como envinadas:", err);
        const codigos = estadoVistaEnvinado.codigosPendientesSeleccionados.join(", ");
        mostrarErrorEnvinado(codigos ? `${codigos}: ${err?.message || "No se pudieron marcar las botas."}` : (err?.message || "No se pudieron marcar las botas."));
    }
}

function agregarCodigoArchivoEnvinado(codigoRaw) {
    const codigo = String(codigoRaw || "").trim();
    const input = document.getElementById("envinado-archivo-codigo");
    if (!codigo) return;
    if (!estadoVistaEnvinado.envinadas.some((item) => String(item.codigo || "") === codigo)) {
        if (input) input.value = "";
        mostrarErrorArchivoEnvinado(`Código ${codigo}: no está envinado.`);
        return;
    }
    if (estadoVistaEnvinado.codigosArchivoSeleccionados.includes(codigo)) {
        if (input) input.value = "";
        mostrarErrorArchivoEnvinado(`Código ${codigo}: ya está agregado.`);
        return;
    }
    estadoVistaEnvinado.codigosArchivoSeleccionados.push(codigo);
    if (input) input.value = "";
    mostrarErrorArchivoEnvinado("");
    renderizarCodigosArchivoEnvinado();
}

function renderizarCodigosArchivoEnvinado() {
    const contenedor = document.getElementById("envinado-archivo-codigos");
    if (!contenedor) return;
    const contador = document.getElementById("envinado-archivo-codigos-contador");
    if (contador) {
        const total = estadoVistaEnvinado.codigosArchivoSeleccionados.length;
        contador.textContent = `${total} seleccionada${total === 1 ? "" : "s"}`;
    }
    if (!estadoVistaEnvinado.codigosArchivoSeleccionados.length) {
        contenedor.innerHTML = `<div class="text-muted small">Sin botas seleccionadas.</div>`;
        return;
    }
    contenedor.innerHTML = estadoVistaEnvinado.codigosArchivoSeleccionados.map((codigo) => `
        <span class="destino-expedir-codigo">
            ${escapeHtmlDestinoProductos(codigo)}
            <button type="button" data-envinado-archivo-quitar="${escapeHtmlDestinoProductos(codigo)}" aria-label="Quitar código">&times;</button>
        </span>
    `).join("");
    contenedor.querySelectorAll("[data-envinado-archivo-quitar]").forEach((boton) => {
        boton.addEventListener("click", () => {
            estadoVistaEnvinado.codigosArchivoSeleccionados = estadoVistaEnvinado.codigosArchivoSeleccionados.filter((item) => item !== String(boton.dataset.envinadoArchivoQuitar || ""));
            renderizarCodigosArchivoEnvinado();
        });
    });
}

function mostrarErrorArchivoEnvinado(texto) {
    const el = document.getElementById("envinado-archivo-error");
    if (!el) return;
    el.textContent = texto || "";
    el.classList.toggle("d-none", !texto);
}

async function subirArchivoBotaEnvinada() {
    const titulo = document.getElementById("envinado-archivo-titulo")?.value?.trim() || "";
    const fileInput = document.getElementById("envinado-archivo-file");
    const archivo = fileInput?.files?.[0];
    const primeraBota = estadoVistaEnvinado.envinadas.find((item) => estadoVistaEnvinado.codigosArchivoSeleccionados.includes(String(item.codigo || "")));

    if (!titulo) {
        mostrarErrorArchivoEnvinado("Debes indicar un titulo.");
        return;
    }
    if (!archivo) {
        mostrarErrorArchivoEnvinado("Debes seleccionar un archivo o foto.");
        return;
    }
    if (!estadoVistaEnvinado.codigosArchivoSeleccionados.length) {
        mostrarErrorArchivoEnvinado("Debes agregar al menos una bota envinada.");
        return;
    }
    if (!primeraBota?.id) {
        mostrarErrorArchivoEnvinado("No se pudo resolver la bota inicial para la subida.");
        return;
    }

    try {
        mostrarErrorArchivoEnvinado("");
        const formData = new FormData();
        formData.append("titulo", titulo);
        formData.append("entidad", "productos_envinados");
        formData.append("entidad_id", String(primeraBota.id));
        formData.append("files[]", archivo);

        const resp = await fetch("../api/archivos/upload.php", {
            method: "POST",
            body: formData,
        });
        const data = await resp.json();
        if (!resp.ok || data.error) {
            throw new Error(data.error || `Error HTTP ${resp.status}`);
        }
        const archivoIds = Array.isArray(data?.data?.ids) ? data.data.ids : [];
        if (!archivoIds.length) {
            throw new Error("La subida no devolvió archivos.");
        }
        await wsRequest("vincular_archivos_botas_envinadas", {
            archivo_ids: archivoIds,
            codigos: estadoVistaEnvinado.codigosArchivoSeleccionados,
        });
        document.getElementById("envinado-archivo-titulo").value = "";
        if (fileInput) fileInput.value = "";
        estadoVistaEnvinado.codigosArchivoSeleccionados = [];
        await cargarVistaEnvinado(true);
    } catch (err) {
        console.error("No se pudo subir el archivo de envinado:", err);
        const codigos = estadoVistaEnvinado.codigosArchivoSeleccionados.join(", ");
        mostrarErrorArchivoEnvinado(codigos ? `${codigos}: ${err?.message || "No se pudo subir el archivo."}` : (err?.message || "No se pudo subir el archivo."));
    }
}
