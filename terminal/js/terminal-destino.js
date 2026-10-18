function codigoBotaCompletoSinIntro(valor) {
    return /(?:-|[xX])\d{9}$/.test(String(valor || "").trim());
}

function prepararAutoinsercionCodigo(input, insertarCodigo) {
    if (!input || typeof insertarCodigo !== "function") return;
    input.addEventListener("input", () => {
        const valor = String(input.value || "").trim();
        if (!valor) {
            delete input.dataset.autoinsertUltimo;
            return;
        }
        if (!codigoBotaCompletoSinIntro(valor)) return;
        if (input.dataset.autoinsertUltimo === valor) return;
        input.dataset.autoinsertUltimo = valor;
        insertarCodigo(valor);
        if (String(input.value || "").trim() !== valor) {
            delete input.dataset.autoinsertUltimo;
        }
    });
}

function prepararEventosDestino() {
    const lista = document.getElementById("destino-lista");
    const inputCodigo = document.getElementById("destino-expedir-codigo");
    const btnLimpiarCodigo = document.getElementById("destino-expedir-codigo-limpiar");
    const inputCodigoEnvinar = document.getElementById("destino-envinar-codigo");
    const btnConfirmar = document.getElementById("destino-expedir-confirmar");
    const btnConfirmarEnvinar = document.getElementById("destino-envinar-confirmar");
    const modalEl = document.getElementById("modalExpedirDestino");
    const modalEnvinarEl = document.getElementById("modalEnvinarDestino");

    if (lista) {
        lista.addEventListener("click", (event) => {
            const boton = event.target.closest("[data-destino-expedir]");
            if (!boton) return;
            event.preventDefault();
            event.stopPropagation();
            if (boton.dataset.destinoAccion === "envinar") {
                abrirModalEnvinarDestino(boton);
                return;
            }
            abrirModalExpedirDestinoDesdeBoton(boton);
        });
    }

    if (inputCodigo) {
        inputCodigo.addEventListener("keydown", (event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            agregarCodigoExpedicionDestino(inputCodigo.value);
        });
        prepararAutoinsercionCodigo(inputCodigo, agregarCodigoExpedicionDestino);
    }
    if (btnLimpiarCodigo) {
        btnLimpiarCodigo.addEventListener("click", () => {
            if (inputCodigo) {
                inputCodigo.value = "";
                inputCodigo.focus();
            }
        });
    }

    if (inputCodigoEnvinar) {
        inputCodigoEnvinar.addEventListener("keydown", (event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            agregarCodigoEnvinar(inputCodigoEnvinar.value);
        });
        prepararAutoinsercionCodigo(inputCodigoEnvinar, agregarCodigoEnvinar);
    }

    if (btnConfirmar) {
        btnConfirmar.addEventListener("click", async () => {
            await confirmarExpedicionDestino();
        });
    }

    if (btnConfirmarEnvinar) {
        btnConfirmarEnvinar.addEventListener("click", async () => {
            await confirmarEnvinarDestino();
        });
    }

    if (modalEl) {
        modalEl.addEventListener("shown.bs.modal", () => {
            document.addEventListener("keydown", manejarTecladoModalExpedirDestino);
        });
        modalEl.addEventListener("hidden.bs.modal", () => {
            document.removeEventListener("keydown", manejarTecladoModalExpedirDestino);
            limpiarModalExpedirDestino();
        });
    }

    if (modalEnvinarEl) {
        modalEnvinarEl.addEventListener("shown.bs.modal", () => {
            document.addEventListener("keydown", manejarTecladoModalEnvinarDestino);
        });
        modalEnvinarEl.addEventListener("hidden.bs.modal", () => {
            document.removeEventListener("keydown", manejarTecladoModalEnvinarDestino);
            limpiarModalEnvinarDestino();
        });
    }
}

async function cargarVistaDestino() {
    await cargarVistaProductosPorFiltros({
        listaId: "destino-lista",
        resumenId: "destino-resumen",
        tipos: ["BOTA"],
        pedidoEstado: 2,
        estadosProducto: [1, 2],
        etiquetaResumen: "botas",
        textoVacio: "No hay botas para destino.",
        renderizador: renderizarVistaProductosPorPedido,
        mostrarDestinoPedido: true,
        resolverClasePedido: (destino) => {
            const valor = String(destino || "").trim().toUpperCase();
            if (valor === "CLIENTE" || valor === "C") return "destino-pedido-card destino-pedido-card-cliente";
            if (valor === "ENVINADO" || valor === "E") return "destino-pedido-card destino-pedido-card-envinado";
            return "destino-pedido-card";
        },
        renderAccionPedido: (grupo) => renderizarAccionPedidoDestino(grupo),
    });
}

const estadoDestino = {
    pedidoId: null,
    pedidoNumero: "",
    codigosPermitidos: [],
    codigosSeleccionados: [],
};

const estadoDestinoEnvinar = {
    pedidoId: null,
    pedidoNumero: "",
    codigosPermitidos: [],
    codigosSeleccionados: [],
};

const maestrosDestinoEnvinar = {
    instalaciones: {},
    ubicaciones: {},
};

function modalExpedirDestinoAbierto() {
    const modalEl = document.getElementById("modalExpedirDestino");
    return !!modalEl?.classList.contains("show");
}

function modalEnvinarDestinoAbierto() {
    const modalEl = document.getElementById("modalEnvinarDestino");
    return !!modalEl?.classList.contains("show");
}

function redirigirTecladoAlInputCodigoModal(event, opciones) {
    if (!opciones?.abierto?.()) return;
    if (event.ctrlKey || event.altKey || event.metaKey) return;

    const inputCodigo = document.getElementById(opciones.inputCodigoId);
    const inputBloqueante = opciones.inputBloqueanteId ? document.getElementById(opciones.inputBloqueanteId) : null;
    const activo = document.activeElement;
    if (!inputCodigo) return;
    if (activo === inputBloqueante) return;
    if (activo && (activo.tagName === "TEXTAREA" || activo.isContentEditable)) return;
    if (activo === inputCodigo && event.key !== "Escape") return;
    if (event.key === "Tab" || event.key === "Escape") return;

    if (event.key === "Enter") {
        event.preventDefault();
        inputCodigo.focus();
        opciones.onEnter?.(inputCodigo.value);
        return;
    }

    if (event.key === "Backspace") {
        event.preventDefault();
        inputCodigo.focus();
        inputCodigo.value = inputCodigo.value.slice(0, -1);
        return;
    }

    if (event.key === "Delete") {
        event.preventDefault();
        inputCodigo.focus();
        inputCodigo.value = "";
        return;
    }

    if (event.key.length === 1) {
        event.preventDefault();
        inputCodigo.focus();
        inputCodigo.value = `${inputCodigo.value || ""}${event.key}`;
    }
}

function manejarTecladoModalExpedirDestino(event) {
    redirigirTecladoAlInputCodigoModal(event, {
        abierto: modalExpedirDestinoAbierto,
        inputCodigoId: "destino-expedir-codigo",
        inputBloqueanteId: "destino-expedir-contenedor",
        onEnter: agregarCodigoExpedicionDestino,
    });
}

function manejarTecladoModalEnvinarDestino(event) {
    redirigirTecladoAlInputCodigoModal(event, {
        abierto: modalEnvinarDestinoAbierto,
        inputCodigoId: "destino-envinar-codigo",
        inputBloqueanteId: "destino-envinar-ubicacion",
        onEnter: agregarCodigoEnvinar,
    });
}

function renderizarAccionPedidoDestino(grupo) {
    const destino = String(grupo?.pedidoDestino || "").trim().toUpperCase();
    if (destino === "CLIENTE" || destino === "C") {
        return `
        <button
            type="button"
            class="btn btn-sm destino-pedido-accion"
            data-destino-expedir="1"
            data-pedido-id="${Number(grupo?.pedidoId || 0)}"
            data-pedido-numero="${escapeHtmlDestinoProductos(grupo?.pedidoNumero || "")}"
            data-codigos="${escapeHtmlDestinoProductos((grupo?.codigos || []).join("|"))}"
            title="Expedir"
            aria-label="Expedir pedido"
        >
            <i class="bi bi-truck"></i>
        </button>
    `;
    }
    if (destino === "ENVINADO" || destino === "E") {
        return `
        <button
            type="button"
            class="btn btn-sm destino-pedido-accion"
            data-destino-expedir="1"
            data-destino-accion="envinar"
            data-pedido-id="${Number(grupo?.pedidoId || 0)}"
            data-pedido-numero="${escapeHtmlDestinoProductos(grupo?.pedidoNumero || "")}"
            data-codigos="${escapeHtmlDestinoProductos((grupo?.codigos || []).join("|"))}"
            title="Enviar a envinar"
            aria-label="Enviar a envinar"
        >
            <svg viewBox="0 0 64 64" width="18" height="18" aria-hidden="true" focusable="false">
                <path fill="currentColor" d="M21 6c-2.8 0-5 2.2-5 5v12c0 9.2 6.3 16.9 14.8 19.1L29 52h-6c-1.7 0-3 1.3-3 3v3h24v-3c0-1.7-1.3-3-3-3h-6l-1.8-9.9C41.7 39.9 48 32.2 48 23V11c0-2.8-2.2-5-5-5H21zm1 6h20v10c0 7.7-5.4 14.1-12.6 15.6C25.2 36.8 22 30.8 22 24V12z"/>
            </svg>
        </button>
    `;
    }
    return "";
}

function abrirModalExpedirDestinoDesdeBoton(boton) {
    estadoDestino.pedidoId = Number(boton.dataset.pedidoId || 0);
    estadoDestino.pedidoNumero = String(boton.dataset.pedidoNumero || "");
    estadoDestino.codigosPermitidos = String(boton.dataset.codigos || "")
        .split("|")
        .map((codigo) => codigo.trim())
        .filter(Boolean);
    estadoDestino.codigosSeleccionados = [];

    const tituloPedido = document.getElementById("destino-expedir-pedido");
    const inputContenedor = document.getElementById("destino-expedir-contenedor");
    const inputCodigo = document.getElementById("destino-expedir-codigo");
    const modalEl = document.getElementById("modalExpedirDestino");

    if (tituloPedido) tituloPedido.textContent = estadoDestino.pedidoNumero;
    if (inputContenedor) inputContenedor.value = "";
    if (inputCodigo) inputCodigo.value = "";
    renderizarCodigosExpedicionDestino();
    mostrarErrorExpedicionDestino("");

    if (!modalEl) return;
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
    setTimeout(() => inputCodigo?.focus(), 150);
}

function agregarCodigoExpedicionDestino(codigoRaw) {
    const codigo = String(codigoRaw || "").trim();
    const inputCodigo = document.getElementById("destino-expedir-codigo");
    if (!codigo) return;
    if (!estadoDestino.codigosPermitidos.includes(codigo)) {
        if (inputCodigo) inputCodigo.value = "";
        reproducirCodigoError();
        mostrarErrorExpedicionDestino(`Código ${codigo}: no existe.`);
        return;
    }
    if (estadoDestino.codigosSeleccionados.includes(codigo)) {
        if (inputCodigo) inputCodigo.value = "";
        reproducirCodigoError();
        mostrarErrorExpedicionDestino(`Código ${codigo}: ya escaneada.`);
        return;
    }
    estadoDestino.codigosSeleccionados.push(codigo);
    if (inputCodigo) inputCodigo.value = "";
    reproducirCodigoCorrecto();
    mostrarErrorExpedicionDestino("");
    renderizarCodigosExpedicionDestino();
}

function quitarCodigoExpedicionDestino(codigo) {
    estadoDestino.codigosSeleccionados = estadoDestino.codigosSeleccionados.filter((item) => item !== codigo);
    renderizarCodigosExpedicionDestino();
}

function renderizarCodigosExpedicionDestino() {
    const contenedor = document.getElementById("destino-expedir-codigos");
    const contador = document.getElementById("destino-expedir-contador");
    if (!contenedor) return;
    if (contador) {
        const total = estadoDestino.codigosSeleccionados.length;
        contador.textContent = `${total} escaneada${total === 1 ? "" : "s"}`;
    }
    if (!estadoDestino.codigosSeleccionados.length) {
        contenedor.innerHTML = `<div class="text-muted small">Sin botas seleccionadas.</div>`;
        return;
    }
    contenedor.innerHTML = estadoDestino.codigosSeleccionados
        .map((codigo) => `
            <span class="destino-expedir-codigo">
                ${escapeHtmlDestinoProductos(codigo)}
                <button type="button" data-destino-quitar-codigo="${escapeHtmlDestinoProductos(codigo)}" aria-label="Quitar código">&times;</button>
            </span>
        `)
        .join("");

    contenedor.querySelectorAll("[data-destino-quitar-codigo]").forEach((boton) => {
        boton.addEventListener("click", () => {
            quitarCodigoExpedicionDestino(String(boton.dataset.destinoQuitarCodigo || ""));
        });
    });
}

function mostrarErrorExpedicionDestino(texto) {
    const error = document.getElementById("destino-expedir-error");
    const inputCodigo = document.getElementById("destino-expedir-codigo");
    if (!error) return;
    error.textContent = texto || "";
    error.classList.toggle("d-none", !texto);
    if (texto && inputCodigo) {
        inputCodigo.value = "";
        inputCodigo.focus();
    }
}

function limpiarModalExpedirDestino() {
    estadoDestino.pedidoId = null;
    estadoDestino.pedidoNumero = "";
    estadoDestino.codigosPermitidos = [];
    estadoDestino.codigosSeleccionados = [];
    const tituloPedido = document.getElementById("destino-expedir-pedido");
    const inputContenedor = document.getElementById("destino-expedir-contenedor");
    const inputCodigo = document.getElementById("destino-expedir-codigo");
    if (tituloPedido) tituloPedido.textContent = "";
    if (inputContenedor) inputContenedor.value = "";
    if (inputCodigo) inputCodigo.value = "";
    mostrarErrorExpedicionDestino("");
    renderizarCodigosExpedicionDestino();
}

async function confirmarExpedicionDestino() {
    const inputContenedor = document.getElementById("destino-expedir-contenedor");
    const btnConfirmar = document.getElementById("destino-expedir-confirmar");
    const modalEl = document.getElementById("modalExpedirDestino");
    const contenedor = String(inputContenedor?.value || "").trim();

    if (!estadoDestino.pedidoId) {
        mostrarErrorExpedicionDestino("No hay pedido seleccionado.");
        return;
    }
    if (!contenedor) {
        mostrarErrorExpedicionDestino("Contenedor es obligatorio.");
        return;
    }
    if (!estadoDestino.codigosSeleccionados.length) {
        mostrarErrorExpedicionDestino("Debes agregar al menos una bota.");
        return;
    }
    if (!confirm(`Hay ${estadoDestino.codigosSeleccionados.length} botas seleccionadas. ¿Confirmas la expedición?`)) {
        return;
    }

    try {
        if (btnConfirmar) btnConfirmar.disabled = true;
        mostrarErrorExpedicionDestino("");
        await wsRequest("expedir_productos_destino", {
            pedido_id: estadoDestino.pedidoId,
            contenedor,
            codigos: estadoDestino.codigosSeleccionados,
        });
        const modal = modalEl ? bootstrap.Modal.getOrCreateInstance(modalEl) : null;
        modal?.hide();
        await cargarVistaDestino();
    } catch (err) {
        console.error("No se pudo expedir el pedido:", err);
        mostrarErrorExpedicionDestino(err?.message || "No se pudo expedir el pedido.");
    } finally {
        if (btnConfirmar) btnConfirmar.disabled = false;
    }
}

async function asegurarMaestrosEnvinarDestino() {
    const tieneInstalaciones = maestrosDestinoEnvinar.instalaciones && Object.keys(maestrosDestinoEnvinar.instalaciones).length > 0;
    const tieneUbicaciones = maestrosDestinoEnvinar.ubicaciones && Object.keys(maestrosDestinoEnvinar.ubicaciones).length > 0;
    if (tieneInstalaciones && tieneUbicaciones) return;
    const maestros = await wsRequest("maestros", {});
    maestrosDestinoEnvinar.instalaciones = maestros?.instalaciones || {};
    maestrosDestinoEnvinar.ubicaciones = maestros?.ubicaciones || {};
}

function obtenerUbicacionesEnvinar() {
    const instalaciones = maestrosDestinoEnvinar.instalaciones || {};
    const ubicaciones = maestrosDestinoEnvinar.ubicaciones || {};
    return Object.values(ubicaciones)
        .filter((ubicacion) => {
            const instalacion = instalaciones?.[ubicacion?.instalacion_id] || null;
            return String(instalacion?.tipo || "").trim().toUpperCase() === "B";
        })
        .sort((a, b) => {
            const ordenA = Number(a?.orden || 0);
            const ordenB = Number(b?.orden || 0);
            if (ordenA !== ordenB) return ordenA - ordenB;
            return Number(a?.id || 0) - Number(b?.id || 0);
        });
}

function obtenerTextoUbicacionEnvinar(ubicacion) {
    const instalaciones = maestrosDestinoEnvinar.instalaciones || {};
    const instalacion = instalaciones?.[ubicacion?.instalacion_id] || null;
    const nombreInstalacion = String(instalacion?.nombre || "").trim();
    const nombreUbicacion = String(ubicacion?.descripcion || ubicacion?.id || "").trim();
    return nombreInstalacion ? `${nombreInstalacion} - ${nombreUbicacion}` : nombreUbicacion;
}

function pintarSelectorUbicacionesEnvinar() {
    const selector = document.getElementById("destino-envinar-ubicacion");
    if (!selector) return;
    const ubicaciones = obtenerUbicacionesEnvinar();
    selector.innerHTML = `<option value="">Selecciona una ubicación...</option>` + ubicaciones
        .map((ubicacion) => `<option value="${ubicacion.id}">${escapeHtmlDestinoProductos(obtenerTextoUbicacionEnvinar(ubicacion))}</option>`)
        .join("");
}

async function abrirModalEnvinarDestino(boton) {
    estadoDestinoEnvinar.pedidoId = Number(boton.dataset.pedidoId || 0);
    estadoDestinoEnvinar.pedidoNumero = String(boton.dataset.pedidoNumero || "");
    estadoDestinoEnvinar.codigosPermitidos = String(boton.dataset.codigos || "")
        .split("|")
        .map((codigo) => codigo.trim())
        .filter(Boolean);
    estadoDestinoEnvinar.codigosSeleccionados = [];

    const tituloPedido = document.getElementById("destino-envinar-pedido");
    const inputCodigo = document.getElementById("destino-envinar-codigo");
    const modalEl = document.getElementById("modalEnvinarDestino");

    if (tituloPedido) tituloPedido.textContent = estadoDestinoEnvinar.pedidoNumero;
    await asegurarMaestrosEnvinarDestino();
    pintarSelectorUbicacionesEnvinar();
    if (inputCodigo) inputCodigo.value = "";
    renderizarCodigosEnvinar();
    mostrarErrorEnvinar("");

    if (!modalEl) return;
    const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
    modal.show();
    setTimeout(() => inputCodigo?.focus(), 150);
}

function agregarCodigoEnvinar(codigoRaw) {
    const codigo = String(codigoRaw || "").trim();
    const inputCodigo = document.getElementById("destino-envinar-codigo");
    if (!codigo) return;
    if (!estadoDestinoEnvinar.codigosPermitidos.includes(codigo)) {
        if (inputCodigo) inputCodigo.value = "";
        reproducirCodigoError();
        mostrarErrorEnvinar(`Código ${codigo}: no está en la lista del pedido.`);
        return;
    }
    if (estadoDestinoEnvinar.codigosSeleccionados.includes(codigo)) {
        if (inputCodigo) inputCodigo.value = "";
        reproducirCodigoError();
        mostrarErrorEnvinar(`Código ${codigo}: ya está agregado.`);
        return;
    }
    estadoDestinoEnvinar.codigosSeleccionados.push(codigo);
    if (inputCodigo) inputCodigo.value = "";
    reproducirCodigoCorrecto();
    mostrarErrorEnvinar("");
    renderizarCodigosEnvinar();
}

function quitarCodigoEnvinar(codigo) {
    estadoDestinoEnvinar.codigosSeleccionados = estadoDestinoEnvinar.codigosSeleccionados.filter((item) => item !== codigo);
    renderizarCodigosEnvinar();
}

function renderizarCodigosEnvinar() {
    const contenedor = document.getElementById("destino-envinar-codigos");
    const contador = document.getElementById("destino-envinar-contador");
    if (!contenedor) return;
    if (contador) {
        const total = estadoDestinoEnvinar.codigosSeleccionados.length;
        contador.textContent = `${total} seleccionada${total === 1 ? "" : "s"}`;
    }
    if (!estadoDestinoEnvinar.codigosSeleccionados.length) {
        contenedor.innerHTML = `<div class="text-muted small">Sin botas seleccionadas.</div>`;
        return;
    }
    contenedor.innerHTML = estadoDestinoEnvinar.codigosSeleccionados
        .map((codigo) => `
            <span class="destino-expedir-codigo">
                ${escapeHtmlDestinoProductos(codigo)}
                <button type="button" data-destino-envinar-quitar="${escapeHtmlDestinoProductos(codigo)}" aria-label="Quitar código">&times;</button>
            </span>
        `)
        .join("");

    contenedor.querySelectorAll("[data-destino-envinar-quitar]").forEach((boton) => {
        boton.addEventListener("click", () => {
            quitarCodigoEnvinar(String(boton.dataset.destinoEnvinarQuitar || ""));
        });
    });
}

function mostrarErrorEnvinar(texto) {
    const error = document.getElementById("destino-envinar-error");
    const inputCodigo = document.getElementById("destino-envinar-codigo");
    if (!error) return;
    error.textContent = texto || "";
    error.classList.toggle("d-none", !texto);
    if (texto && inputCodigo) {
        inputCodigo.value = "";
        inputCodigo.focus();
    }
}

function limpiarModalEnvinarDestino() {
    estadoDestinoEnvinar.pedidoId = null;
    estadoDestinoEnvinar.pedidoNumero = "";
    estadoDestinoEnvinar.codigosPermitidos = [];
    estadoDestinoEnvinar.codigosSeleccionados = [];

    const tituloPedido = document.getElementById("destino-envinar-pedido");
    const selectorUbicacion = document.getElementById("destino-envinar-ubicacion");
    const inputCodigo = document.getElementById("destino-envinar-codigo");
    if (tituloPedido) tituloPedido.textContent = "";
    if (selectorUbicacion) selectorUbicacion.innerHTML = `<option value="">Selecciona una ubicación...</option>`;
    if (inputCodigo) inputCodigo.value = "";
    mostrarErrorEnvinar("");
    renderizarCodigosEnvinar();
}

async function confirmarEnvinarDestino() {
    const selectorUbicacion = document.getElementById("destino-envinar-ubicacion");
    const btnConfirmar = document.getElementById("destino-envinar-confirmar");
    const modalEl = document.getElementById("modalEnvinarDestino");
    const ubicacionId = Number(selectorUbicacion?.value || 0);

    if (!estadoDestinoEnvinar.pedidoId) {
        mostrarErrorEnvinar("No hay pedido seleccionado.");
        return;
    }
    if (!ubicacionId) {
        mostrarErrorEnvinar("Debes seleccionar una ubicación.");
        return;
    }
    if (!estadoDestinoEnvinar.codigosSeleccionados.length) {
        mostrarErrorEnvinar("Debes agregar al menos una bota.");
        return;
    }
    if (!confirm(`Hay ${estadoDestinoEnvinar.codigosSeleccionados.length} botas seleccionadas. ¿Confirmas el envío a envinar?`)) {
        return;
    }

    try {
        if (btnConfirmar) btnConfirmar.disabled = true;
        mostrarErrorEnvinar("");
        await wsRequest("envinar_productos_destino", {
            pedido_id: estadoDestinoEnvinar.pedidoId,
            ubicacion_id: ubicacionId,
            codigos: estadoDestinoEnvinar.codigosSeleccionados,
        });
        const modal = modalEl ? bootstrap.Modal.getOrCreateInstance(modalEl) : null;
        modal?.hide();
        await cargarVistaDestino();
    } catch (err) {
        console.error("No se pudo enviar a envinar el pedido:", err);
        mostrarErrorEnvinar(err?.message || "No se pudo enviar a envinar el pedido.");
    } finally {
        if (btnConfirmar) btnConfirmar.disabled = false;
    }
}
