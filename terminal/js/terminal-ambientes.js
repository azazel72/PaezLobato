const terminalAmbientes = {
    maestros: null,
    registroActualId: null,
};

function prepararEventosAmbientes() {
    const inputFecha = document.getElementById("ambiente-fecha");
    const btnGuardar = document.getElementById("ambiente-guardar");
    const btnRecargar = document.getElementById("ambiente-recargar");
    if (!inputFecha || !btnGuardar || !btnRecargar) return;

    inputFecha.addEventListener("change", () => {
        cargarRegistroAmbientePorFecha(inputFecha.value);
    });
    btnGuardar.addEventListener("click", guardarAmbienteDesdeFormulario);
    btnRecargar.addEventListener("click", cargarFormularioAmbientes);
}

async function cargarFormularioAmbientes() {
    const inputFecha = document.getElementById("ambiente-fecha");
    if (!inputFecha) return;
    try {
        const maestros = await wsRequest("maestros", {});
        terminalAmbientes.maestros = maestros || {};

        if (!inputFecha.value) {
            inputFecha.value = new Date().toISOString().slice(0, 10);
        }
        cargarRegistroAmbientePorFecha(inputFecha.value);
    } catch (err) {
        console.error("No se pudo cargar formulario de ambientes:", err);
        setEstadoAmbiente("Error cargando datos de ambientes.", "danger");
    }
}

function parseFloatForm(v) {
    if (v == null) return 0;
    const t = String(v).trim().replace(",", ".");
    if (!t) return 0;
    const n = Number.parseFloat(t);
    return Number.isFinite(n) ? n : 0;
}

function getFormAmbiente() {
    return {
        temperatura_1: parseFloatForm(document.getElementById("ambiente-temperatura-1")?.value),
        humedad_1: parseFloatForm(document.getElementById("ambiente-humedad-1")?.value),
        temperatura_2: parseFloatForm(document.getElementById("ambiente-temperatura-2")?.value),
        humedad_2: parseFloatForm(document.getElementById("ambiente-humedad-2")?.value),
        temperatura_3: parseFloatForm(document.getElementById("ambiente-temperatura-3")?.value),
        humedad_3: parseFloatForm(document.getElementById("ambiente-humedad-3")?.value),
    };
}

function setFormAmbiente(reg) {
    document.getElementById("ambiente-temperatura-1").value = reg?.temperatura_1 ?? 0;
    document.getElementById("ambiente-humedad-1").value = reg?.humedad_1 ?? 0;
    document.getElementById("ambiente-temperatura-2").value = reg?.temperatura_2 ?? 0;
    document.getElementById("ambiente-humedad-2").value = reg?.humedad_2 ?? 0;
    document.getElementById("ambiente-temperatura-3").value = reg?.temperatura_3 ?? 0;
    document.getElementById("ambiente-humedad-3").value = reg?.humedad_3 ?? 0;
}

function cargarRegistroAmbientePorFecha(fecha) {
    const ambientes = terminalAmbientes.maestros?.ambientes || {};
    const registro = Object.values(ambientes).find((a) => String(a?.fecha || "") === String(fecha || ""));
    terminalAmbientes.registroActualId = registro?.id ?? null;
    setFormAmbiente(registro || null);
    setEstadoAmbiente(registro ? "Registro cargado." : "Sin registro previo para la fecha. Se creará al guardar.", "muted");
}

async function guardarAmbienteDesdeFormulario() {
    const inputFecha = document.getElementById("ambiente-fecha");
    if (!inputFecha) return;
    const fecha = String(inputFecha.value || "").trim();
    if (!fecha) {
        setEstadoAmbiente("La fecha es obligatoria.", "danger");
        return;
    }

    const payload = {
        fecha,
        ...getFormAmbiente(),
    };

    try {
        setEstadoAmbiente("Guardando...", "muted");
        if (!terminalAmbientes.registroActualId) {
            const nuevo = await wsRequest("insertar_maestro", {
                tabla: "ambientes",
                ...payload,
            });
            if (!nuevo?.id) throw new Error("No se pudo crear el registro.");
            terminalAmbientes.registroActualId = nuevo.id;
            terminalAmbientes.maestros = terminalAmbientes.maestros || {};
            terminalAmbientes.maestros.ambientes = terminalAmbientes.maestros.ambientes || {};
            terminalAmbientes.maestros.ambientes[nuevo.id] = nuevo;
        } else {
            for (const campo of Object.keys(payload)) {
                await wsRequest("modificar_maestro", {
                    tabla: "ambientes",
                    id: terminalAmbientes.registroActualId,
                    campo,
                    valor: payload[campo],
                    valores: payload,
                });
            }
            if (terminalAmbientes.maestros?.ambientes?.[terminalAmbientes.registroActualId]) {
                terminalAmbientes.maestros.ambientes[terminalAmbientes.registroActualId] = {
                    ...terminalAmbientes.maestros.ambientes[terminalAmbientes.registroActualId],
                    ...payload,
                };
            }
        }
        setEstadoAmbiente("Registro guardado correctamente.", "success");
    } catch (err) {
        console.error("Error guardando ambiente:", err);
        setEstadoAmbiente("No se pudo guardar el registro de ambiente.", "danger");
    }
}

function setEstadoAmbiente(texto, tipo = "muted") {
    const estado = document.getElementById("ambiente-estado");
    if (!estado) return;
    estado.className = "small";
    estado.classList.add(`text-${tipo}`);
    estado.textContent = texto || "";
}
