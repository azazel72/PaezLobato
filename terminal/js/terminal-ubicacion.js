const terminalUbicacion = {
    maestros: null,
    fabricacion: null,
};

function prepararEventosUbicacion() {
    const selTipo = document.getElementById("crearstock-tipo-producto");
    const selMaterial = document.getElementById("crearstock-material");
    const selUbicacion = document.getElementById("crearstock-ubicacion");
    const btnCrear = document.getElementById("crearstock-crear");
    const selOrigen = document.getElementById("crearstock-origen");
    const inputLote = document.getElementById("crearstock-lote");
    const inputCubico = document.getElementById("crearstock-cubico");

    if (selTipo) selTipo.addEventListener("change", actualizarSelectorOrigenCrearStock);
    if (selMaterial) selMaterial.addEventListener("change", actualizarSelectorOrigenCrearStock);
    if (selUbicacion) selUbicacion.addEventListener("change", actualizarSelectorOrigenCrearStock);
    if (selOrigen) selOrigen.addEventListener("change", actualizarEstadoBotonCrearStock);
    if (inputLote) inputLote.addEventListener("input", actualizarEstadoBotonCrearStock);
    if (inputCubico) inputCubico.addEventListener("input", actualizarEstadoBotonCrearStock);
    if (btnCrear) {
        btnCrear.disabled = true;
        btnCrear.title = "Completa los datos para crear el palet";
        btnCrear.addEventListener("click", crearPaletDesdeStock);
    }
}

async function cargarFormularioCrearStock() {
    try {
        await asegurarDatosCrearStock();
        poblarCombosCrearStock();
        actualizarSelectorOrigenCrearStock();
    } catch (err) {
        console.error("No se pudo cargar el formulario de crear stock:", err);
        setEstadoCrearStock("Error cargando datos del formulario.", "danger");
    }
}

async function asegurarDatosCrearStock() {
    if (terminalUbicacion.maestros && terminalUbicacion.fabricacion) return;
    const [maestros, fabricacion] = await Promise.all([
        wsRequest("maestros", {}),
        wsRequest("fabricacion", {}),
    ]);
    terminalUbicacion.maestros = maestros || {};
    terminalUbicacion.fabricacion = fabricacion || {};
}

function poblarCombosCrearStock() {
    const selTipo = document.getElementById("crearstock-tipo-producto");
    const selMaterial = document.getElementById("crearstock-material");
    const selUbicacion = document.getElementById("crearstock-ubicacion");
    if (!selTipo || !selMaterial || !selUbicacion) return;

    const valorTipo = selTipo.value;
    const valorMaterial = selMaterial.value;
    const valorUbicacion = selUbicacion.value;

    const tipos = Object.values(terminalUbicacion.fabricacion?.tipos_producto || {})
        .filter((t) => String(t?.tipo || "").toUpperCase() === "DUELA")
        .sort((a, b) => String(a.descripcion || "").localeCompare(String(b.descripcion || ""), "es"));
    const materiales = Object.values(terminalUbicacion.maestros?.materiales || {})
        .sort((a, b) => String(a.descripcion || "").localeCompare(String(b.descripcion || ""), "es"));
    const ubicaciones = Object.values(terminalUbicacion.maestros?.ubicaciones || {})
        .sort((a, b) => String(a.descripcion || "").localeCompare(String(b.descripcion || ""), "es"));

    selTipo.innerHTML = `<option value="">Seleccione tipo...</option>` + tipos.map((t) =>
        `<option value="${t.id}">${t.descripcion || t.codigo || t.id}</option>`
    ).join("");

    selMaterial.innerHTML = `<option value="">Seleccione madera...</option>` + materiales.map((m) =>
        `<option value="${m.id}">${m.descripcion || m.id}</option>`
    ).join("");

    selUbicacion.innerHTML = `<option value="">Seleccione instalación...</option>` + ubicaciones.map((u) => {
        const instalacion = terminalUbicacion.maestros?.instalaciones?.[u.instalacion_id]?.descripcion || "";
        const etiqueta = instalacion ? `${instalacion} - ${u.descripcion}` : (u.descripcion || u.id);
        return `<option value="${u.id}">${etiqueta}</option>`;
    }).join("");

    if (valorTipo) selTipo.value = valorTipo;
    if (valorMaterial) selMaterial.value = valorMaterial;
    if (valorUbicacion) selUbicacion.value = valorUbicacion;
}

function actualizarSelectorOrigenCrearStock() {
    const selTipo = document.getElementById("crearstock-tipo-producto");
    const selMaterial = document.getElementById("crearstock-material");
    const selUbicacion = document.getElementById("crearstock-ubicacion");
    const selOrigen = document.getElementById("crearstock-origen");
    if (!selTipo || !selMaterial || !selUbicacion || !selOrigen) return;

    const tipoId = Number(selTipo.value || 0);
    const materialId = Number(selMaterial.value || 0);
    const ubicacionId = Number(selUbicacion.value || 0);

    const palets = Object.values(terminalUbicacion.maestros?.palets || {});
    const materiales = terminalUbicacion.maestros?.materiales || {};
    const ubicaciones = terminalUbicacion.maestros?.ubicaciones || {};

    const filtrados = palets
        .filter((p) => p?.linea_entrada_id == null)
        .filter((p) => !Boolean(p?.procesado))
        .filter((p) => {
            if (tipoId && Number(p.tipo_producto_id || 0) !== tipoId) return false;
            if (materialId && Number(p.material_id || 0) !== materialId) return false;
            if (ubicacionId && Number(p.ubicacion_id || 0) !== ubicacionId) return false;
            return true;
        })
        .sort((a, b) => String(a.codigo || "").localeCompare(String(b.codigo || ""), "es"));

    selOrigen.innerHTML = `<option value="">Seleccione origen...</option>`;
    if (!filtrados.length) {
        selOrigen.innerHTML = `<option value="">Sin palets para este filtro</option>`;
        setEstadoCrearStock("No hay palets de origen para la selección actual.", "muted");
        actualizarEstadoBotonCrearStock();
        return;
    }

    selOrigen.innerHTML += filtrados.map((p) => {
        const material = materiales?.[p.material_id]?.descripcion || "";
        const ubic = ubicaciones?.[p.ubicacion_id]?.descripcion || "";
        const restante = Math.max(Number(p.cubicaje || 0) - Number(p.consumido || 0), 0);
        const restoTxt = restante.toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 3 });
        return `<option value="${p.id}">${p.codigo || p.id} | ${material} | ${ubic} | restante ${restoTxt}</option>`;
    }).join("");

    setEstadoCrearStock(`${filtrados.length} palet(s) disponibles como origen.`, "muted");
    actualizarEstadoBotonCrearStock();
}

function actualizarEstadoBotonCrearStock() {
    const selOrigen = document.getElementById("crearstock-origen");
    const inputLote = document.getElementById("crearstock-lote");
    const inputCubico = document.getElementById("crearstock-cubico");
    const btnCrear = document.getElementById("crearstock-crear");
    if (!selOrigen || !inputLote || !inputCubico || !btnCrear) return;

    const origenId = Number(selOrigen.value || 0);
    const lote = String(inputLote.value || "").trim();
    const cubicaje = Number.parseFloat(String(inputCubico.value || "").replace(",", "."));
    const habilitado = Boolean(origenId) && Boolean(lote) && Number.isFinite(cubicaje) && cubicaje > 0;

    btnCrear.disabled = !habilitado;
    btnCrear.title = habilitado ? "" : "Completa los datos para crear el palet";
}

async function crearPaletDesdeStock() {
    const selUbicacion = document.getElementById("crearstock-ubicacion");
    const selOrigen = document.getElementById("crearstock-origen");
    const inputLote = document.getElementById("crearstock-lote");
    const inputCubico = document.getElementById("crearstock-cubico");
    const btnCrear = document.getElementById("crearstock-crear");
    if (!selUbicacion || !selOrigen || !inputLote || !inputCubico || !btnCrear) return;

    const origenId = Number(selOrigen.value || 0);
    const ubicacionSeleccionadaId = Number(selUbicacion.value || 0) || null;
    const lote = String(inputLote.value || "").trim();
    const cubicaje = Number.parseFloat(String(inputCubico.value || "").replace(",", "."));

    if (!origenId) {
        setEstadoCrearStock("Selecciona un palet de origen.", "danger");
        return;
    }
    if (!lote) {
        setEstadoCrearStock("El lote es obligatorio.", "danger");
        return;
    }
    if (!Number.isFinite(cubicaje) || cubicaje <= 0) {
        setEstadoCrearStock("El cúbico debe ser mayor que 0.", "danger");
        return;
    }

    const paletOrigen = terminalUbicacion.maestros?.palets?.[origenId];
    if (!paletOrigen) {
        setEstadoCrearStock("No se encontró el palet de origen.", "danger");
        return;
    }
    const restanteOrigen = Math.max(Number(paletOrigen.cubicaje || 0) - Number(paletOrigen.consumido || 0), 0);
    if (cubicaje > restanteOrigen) {
        setEstadoCrearStock("El cúbico supera el restante disponible del palet origen.", "danger");
        return;
    }

    btnCrear.disabled = true;
    setEstadoCrearStock("Creando palet...", "muted");

    try {
        const codigoResp = await wsRequest("siguiente_codigo_palet", {
            lote,
            palet_codigo: paletOrigen.codigo || "",
        });
        const codigo = String(codigoResp?.codigo || "").trim();
        if (!codigo) {
            throw new Error("No se recibió código de palet desde backend.");
        }

        const nuevoPalet = await wsRequest("insertar_maestro", {
            tabla: "palets",
            codigo,
            linea_entrada_id: null,
            tipo_producto_id: paletOrigen.tipo_producto_id ?? null,
            material_id: paletOrigen.material_id ?? null,
            cubicaje,
            consumido: 0,
            estado: paletOrigen.estado ?? null,
            ubicacion_id: ubicacionSeleccionadaId ?? paletOrigen.ubicacion_id ?? null,
            procesado: true,
        });
        if (!nuevoPalet?.id) {
            throw new Error("No se pudo crear el palet destino.");
        }

        await wsRequest("insertar_maestro", {
            tabla: "trazabilidad_procesado",
            palet_origen_id: origenId,
            palet_destino_id: nuevoPalet.id,
        });
        const nuevoConsumidoOrigen = Number(paletOrigen.consumido || 0) + cubicaje;
        await wsRequest("modificar_maestro", {
            tabla: "palets",
            id: origenId,
            campo: "consumido",
            valor: nuevoConsumidoOrigen,
        });

        terminalUbicacion.maestros.palets[nuevoPalet.id] = nuevoPalet;
        if (terminalUbicacion.maestros.palets[origenId]) {
            terminalUbicacion.maestros.palets[origenId].consumido = nuevoConsumidoOrigen;
        }
        inputLote.value = "";
        inputCubico.value = "";
        actualizarSelectorOrigenCrearStock();
        setEstadoCrearStock(`Palet creado correctamente (${nuevoPalet.codigo || nuevoPalet.id}).`, "success");
    } catch (err) {
        console.error("Error creando palet desde stock:", err);
        setEstadoCrearStock("No se pudo crear el palet desde stock.", "danger");
    } finally {
        btnCrear.disabled = false;
    }
}

function setEstadoCrearStock(texto, tipo = "muted") {
    const estado = document.getElementById("crearstock-estado");
    if (!estado) return;
    estado.className = "small";
    estado.classList.add(`text-${tipo}`);
    estado.textContent = texto || "";
}
