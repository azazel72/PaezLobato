document.addEventListener("DOMContentLoaded", function () {

    // Navegacion por secciones usando el atributo "mostrar"
    const botonesNavegacion = document.querySelectorAll("button[mostrar]");
    botonesNavegacion.forEach(function (boton) {
        boton.addEventListener("click", function () {
            if (boton.dataset.origenFabricacion) {
                contextoNavegacion.fabricacionOrigen = boton.dataset.origenFabricacion;
            }
            if (boton.dataset.contextoRecepcion) {
                contextoNavegacion.recepcionOrigen = boton.dataset.contextoRecepcion;
            }
            if (boton.dataset.contextoConsumo) {
                contextoNavegacion.consumoOrigen = boton.dataset.contextoConsumo;
            }
            if (boton.dataset.contextoUbicacion) {
                contextoNavegacion.ubicacionOrigen = boton.dataset.contextoUbicacion;
            }
            if (boton.dataset.contextoMoverStock) {
                contextoNavegacion.moverStockOrigen = boton.dataset.contextoMoverStock;
            }
            if (boton.dataset.contextoProcesarStock) {
                contextoNavegacion.procesarStockOrigen = boton.dataset.contextoProcesarStock;
            }
            contextoNavegacion.autoAccesoConsumo = boton.dataset.accesoDirectoConsumo === "1";
            contextoNavegacion.autoAccesoFabricacion = boton.dataset.accesoDirectoFabricacion === "1";
            mostrarSeccion(boton.getAttribute("mostrar"));
        });
    });

    // Selecciona todas las migas de pan
    const migasPan = document.querySelector("header nav ol");
    migasPan.addEventListener("click", function (event) {
        console.info("[breadcrumb] clic delegado", {
            texto: event.target.textContent?.trim(),
            destino: event.target.closest("li[mostrar]")?.getAttribute("mostrar"),
            pantalla: pantallaActual,
        });
        event.preventDefault();
        const miga = event.target.closest("li:not(.active)");
        if (!miga || !miga.hasAttribute("mostrar")) return; // Verifica que se haya hecho clic en una miga válida
        // Muestra la sección correspondiente al atributo 'mostrar'
        mostrarSeccion(miga.getAttribute("mostrar"));
    });

    prepararEventosRecepcion();
    prepararEventosConsumo();
    prepararEventosConsumoLotes();
    prepararEventosFondos();
    prepararEventosFabricacion();
    prepararEventosCierreSemanal?.();
    prepararEventosLotesCierrePhp();
    prepararEventosDestino();
    prepararEventosAlmacen();
    prepararEventosAnaliticas?.();
    prepararEventosEnvinado?.();
    prepararEventosMenuFlejes();
    prepararEventosUbicacion();
    prepararEventosMoverStock();
    prepararEventosProcesarStock();
    prepararEventosAmbientes();
    prepararEventosBotasDiarias?.();
    prepararEventosBuscarBotas?.();

    // Muestra la sección de tareas al cargar la página
    mostrarSeccion("vista_tareas");

    conexionInicial();
});

let pantallaActual = null;
let contextoPantalla = {};
const contextoNavegacion = {
    fabricacionOrigen: "palets_madera",
    recepcionOrigen: "palets_madera",
    consumoOrigen: "palets_madera",
    ubicacionOrigen: "botas",
    moverStockOrigen: "palets_madera",
    procesarStockOrigen: "palets_madera",
    cierreSemanalOrigen: "vista_fabricacion",
    autoAccesoConsumo: false,
    autoAccesoFabricacion: false,
};

function mostrarSeccion(id) {
    if (id === "vista_inicio") {
        id = "vista_tareas";
    }
    const seccionActiva = document.getElementById(id);
    if (seccionActiva) {
        console.info("[ws-auth] cambio de ventana", {
            anterior: pantallaActual,
            destino: id,
            ...(typeof diagnosticoAutenticacionWs === "function" ? diagnosticoAutenticacionWs() : {}),
        });
        // Oculta todas las secciones
        const secciones = document.querySelectorAll("section");
        secciones.forEach(function (seccion) {
            seccion.classList.remove("pagina-activa");
        });
        // Muestra la sección correspondiente
        seccionActiva.classList.add("pagina-activa");
        if (id === "vista_recepcion") {
            cargarEntradasRecepcion();
        }
        if (id === "vista_consumo") {
            const activarAutoAccesoConsumo = contextoNavegacion.autoAccesoConsumo === true;
            contextoNavegacion.autoAccesoConsumo = false;
            document.getElementById('panelConsumo').classList.toggle('d-none', esConsumoMaderaLotes());
            if (esConsumoMaderaLotes()) {
                abrirConsumoLotes();
            } else if (activarAutoAccesoConsumo) {
                iniciarVistaConsumoDirecta?.();
            } else {
                cargarResumenFabricacionSemanalConsumo?.();
            }
        }
        if (id === "vista_fabricacion") {
            contextoNavegacion.autoAccesoConsumo = false;
            contextoNavegacion.autoAccesoFabricacion = false;
            cargarFabricacionSemanalActivaFabricacion({ vistaId: "vista_fabricacion" });
        }
        if (id === "vista_ubicacion") {
            cargarFormularioCrearStock();
        }
        if (id === "vista_mover_stock") {
            cargarFormularioMoverStock();
        }
        if (id === "vista_procesar_stock") {
            cargarFormularioProcesarStock();
        }
        if (id === "vista_menu_palets_fleje") {
            cargarEntradasFlejesMenu();
        }
        if (id === "vista_ambientes") {
            cargarFormularioAmbientes();
        }
        if (id === "vista_botas_diarias") {
            cargarVistaBotasDiarias?.();
        }
        if (id === "vista_buscar_botas") {
            cargarVistaBuscarBotas?.();
        }
        if (id === "vista_destino") {
            cargarVistaDestino?.();
        }
        if (id === "vista_analiticas") {
            cargarVistaAnaliticas?.();
        }
        if (id === "vista_envinado") {
            cargarVistaEnvinado?.();
        }
        if (id === "vista_cierre_semanal") {
            cargarVistaCierreSemanal?.();
        }
        // Actualiza las migas de pan
        actualizarMigasPan(id);
        setPantalla(id, {});
    }
}

function actualizarMigasPan(mostrarSeccion) {
    const migasPan = document.querySelector("nav[aria-label='breadcrumb'] ol");
    migasPan.innerHTML = '';
    var nuevaMiga = null;
    switch (mostrarSeccion) {
        case "vista_tareas":
            nuevaMiga = crearMigaPan("Inicio", "vista_tareas", true);
            migasPan.appendChild(nuevaMiga);
            break;
        case "vista_menu_palets":
            nuevaMiga = crearMigaPan("Inicio", "vista_tareas", false);
            migasPan.appendChild(nuevaMiga);
            nuevaMiga = crearMigaPan("Palets", mostrarSeccion, true);
            migasPan.appendChild(nuevaMiga);
            break;
        case "vista_menu_palets_fleje":
            nuevaMiga = crearMigaPan("Inicio", "vista_tareas", false);
            migasPan.appendChild(nuevaMiga);
            nuevaMiga = crearMigaPan("Palets", "vista_menu_palets", false);
            migasPan.appendChild(nuevaMiga);
            nuevaMiga = crearMigaPan("Fleje", mostrarSeccion, true);
            migasPan.appendChild(nuevaMiga);
            break;
        case "vista_menu_palets_madera":
            nuevaMiga = crearMigaPan("Inicio", "vista_tareas", false);
            migasPan.appendChild(nuevaMiga);
            nuevaMiga = crearMigaPan("Palets", "vista_menu_palets", false);
            migasPan.appendChild(nuevaMiga);
            nuevaMiga = crearMigaPan("Madera", mostrarSeccion, true);
            migasPan.appendChild(nuevaMiga);
            break;
        case "vista_menu_movimientos":
            nuevaMiga = crearMigaPan("Inicio", "vista_tareas", false);
            migasPan.appendChild(nuevaMiga);
            nuevaMiga = crearMigaPan("Palets", "vista_menu_palets", false);
            migasPan.appendChild(nuevaMiga);
            nuevaMiga = crearMigaPan("Madera", "vista_menu_palets_madera", false);
            migasPan.appendChild(nuevaMiga);
            nuevaMiga = crearMigaPan("Movimientos", mostrarSeccion, true);
            migasPan.appendChild(nuevaMiga);
            break;
        case "vista_menu_botas":
            nuevaMiga = crearMigaPan("Inicio", "vista_tareas", false);
            migasPan.appendChild(nuevaMiga);
            nuevaMiga = crearMigaPan("Botas", mostrarSeccion, true);
            migasPan.appendChild(nuevaMiga);
            break;
        case "vista_recepcion":
            nuevaMiga = crearMigaPan("Inicio", "vista_tareas", false);
            migasPan.appendChild(nuevaMiga);
            nuevaMiga = crearMigaPan("Palets", "vista_menu_palets", false);
            migasPan.appendChild(nuevaMiga);
            if (contextoNavegacion.recepcionOrigen === "palets_fleje") {
                nuevaMiga = crearMigaPan("Fleje", "vista_menu_palets_fleje", false);
            } else {
                nuevaMiga = crearMigaPan("Madera", "vista_menu_palets_madera", false);
            }
            migasPan.appendChild(nuevaMiga);
            nuevaMiga = crearMigaPan("Recepción", mostrarSeccion, true);
            migasPan.appendChild(nuevaMiga);
            break;
        case "vista_ubicacion":
            nuevaMiga = crearMigaPan("Inicio", "vista_tareas", false);
            migasPan.appendChild(nuevaMiga);
            if (contextoNavegacion.ubicacionOrigen === "botas") {
                nuevaMiga = crearMigaPan("Botas", "vista_menu_botas", false);
                migasPan.appendChild(nuevaMiga);
                nuevaMiga = crearMigaPan("Ubicación", mostrarSeccion, true);
            } else if (contextoNavegacion.ubicacionOrigen === "palets_madera") {
                nuevaMiga = crearMigaPan("Palets", "vista_menu_palets", false);
                migasPan.appendChild(nuevaMiga);
                nuevaMiga = crearMigaPan("Madera", "vista_menu_palets_madera", false);
                migasPan.appendChild(nuevaMiga);
                nuevaMiga = crearMigaPan("Movimientos", "vista_menu_movimientos", false);
                migasPan.appendChild(nuevaMiga);
                nuevaMiga = crearMigaPan("Crear a partir de Stock", mostrarSeccion, true);
            } else {
                nuevaMiga = crearMigaPan("Ubicación", mostrarSeccion, true);
            }
            migasPan.appendChild(nuevaMiga);
            break;
        case "vista_mover_stock":
            nuevaMiga = crearMigaPan("Inicio", "vista_tareas", false);
            migasPan.appendChild(nuevaMiga);
            if (contextoNavegacion.moverStockOrigen === "palets_madera") {
                nuevaMiga = crearMigaPan("Palets", "vista_menu_palets", false);
                migasPan.appendChild(nuevaMiga);
                nuevaMiga = crearMigaPan("Madera", "vista_menu_palets_madera", false);
                migasPan.appendChild(nuevaMiga);
                nuevaMiga = crearMigaPan("Movimientos", "vista_menu_movimientos", false);
                migasPan.appendChild(nuevaMiga);
                nuevaMiga = crearMigaPan("Mover Stock", mostrarSeccion, true);
            } else {
                nuevaMiga = crearMigaPan("Mover Stock", mostrarSeccion, true);
            }
            migasPan.appendChild(nuevaMiga);
            break;
        case "vista_procesar_stock":
            nuevaMiga = crearMigaPan("Inicio", "vista_tareas", false);
            migasPan.appendChild(nuevaMiga);
            if (contextoNavegacion.procesarStockOrigen === "palets_madera") {
                nuevaMiga = crearMigaPan("Palets", "vista_menu_palets", false);
                migasPan.appendChild(nuevaMiga);
                nuevaMiga = crearMigaPan("Madera", "vista_menu_palets_madera", false);
                migasPan.appendChild(nuevaMiga);
                nuevaMiga = crearMigaPan("Movimientos", "vista_menu_movimientos", false);
                migasPan.appendChild(nuevaMiga);
                nuevaMiga = crearMigaPan("Procesar", mostrarSeccion, true);
            } else {
                nuevaMiga = crearMigaPan("Procesar", mostrarSeccion, true);
            }
            migasPan.appendChild(nuevaMiga);
            break;
        case "vista_consumo":
            nuevaMiga = crearMigaPan("Inicio", "vista_tareas", false);
            migasPan.appendChild(nuevaMiga);
            nuevaMiga = crearMigaPan("Palets", "vista_menu_palets", false);
            migasPan.appendChild(nuevaMiga);
            if (contextoNavegacion.consumoOrigen === "palets_fleje") {
                nuevaMiga = crearMigaPan("Fleje", "vista_menu_palets_fleje", false);
            } else {
                nuevaMiga = crearMigaPan("Madera", "vista_menu_palets_madera", false);
            }
            nuevaMiga = crearMigaPan("Consumo", mostrarSeccion, true);
            migasPan.appendChild(nuevaMiga);
            break;
        case "vista_fabricacion":
            nuevaMiga = crearMigaPan("Inicio", "vista_tareas", false);
            migasPan.appendChild(nuevaMiga);
            nuevaMiga = crearMigaPan("Botas", "vista_menu_botas", false);
            migasPan.appendChild(nuevaMiga);
            nuevaMiga = crearMigaPan("Fabricación de botas", mostrarSeccion, true);
            migasPan.appendChild(nuevaMiga);
            break;
        case "vista_cierre_semanal":
            nuevaMiga = crearMigaPan("Inicio", "vista_tareas", false);
            migasPan.appendChild(nuevaMiga);
            if (contextoNavegacion.cierreSemanalOrigen === "vista_consumo") {
                nuevaMiga = crearMigaPan("Palets", "vista_menu_palets", false);
                migasPan.appendChild(nuevaMiga);
                if (contextoNavegacion.consumoOrigen === "palets_fleje") {
                    nuevaMiga = crearMigaPan("Fleje", "vista_menu_palets_fleje", false);
                } else {
                    nuevaMiga = crearMigaPan("Madera", "vista_menu_palets_madera", false);
                }
                migasPan.appendChild(nuevaMiga);
                nuevaMiga = crearMigaPan("Consumo", "vista_consumo", false);
            } else {
                nuevaMiga = crearMigaPan("Botas", "vista_menu_botas", false);
                migasPan.appendChild(nuevaMiga);
                nuevaMiga = crearMigaPan("Fabricación semanal", "vista_fabricacion", false);
            }
            migasPan.appendChild(nuevaMiga);
            nuevaMiga = crearMigaPan("Cierre semanal", mostrarSeccion, true);
            migasPan.appendChild(nuevaMiga);
            break;
        case "vista_destino":
            nuevaMiga = crearMigaPan("Inicio", "vista_tareas", false);
            migasPan.appendChild(nuevaMiga);
            nuevaMiga = crearMigaPan("Botas", "vista_menu_botas", false);
            migasPan.appendChild(nuevaMiga);
            nuevaMiga = crearMigaPan("Destino", mostrarSeccion, true);
            migasPan.appendChild(nuevaMiga);
            break;
        case "vista_analiticas":
            nuevaMiga = crearMigaPan("Inicio", "vista_tareas", false);
            migasPan.appendChild(nuevaMiga);
            nuevaMiga = crearMigaPan("Botas", "vista_menu_botas", false);
            migasPan.appendChild(nuevaMiga);
            nuevaMiga = crearMigaPan("Analiticas", mostrarSeccion, true);
            migasPan.appendChild(nuevaMiga);
            break;
        case "vista_envinado":
            nuevaMiga = crearMigaPan("Inicio", "vista_tareas", false);
            migasPan.appendChild(nuevaMiga);
            nuevaMiga = crearMigaPan("Botas", "vista_menu_botas", false);
            migasPan.appendChild(nuevaMiga);
            nuevaMiga = crearMigaPan("Envinado", mostrarSeccion, true);
            migasPan.appendChild(nuevaMiga);
            break;
        case "vista_ambientes":
            nuevaMiga = crearMigaPan("Inicio", "vista_tareas", false);
            migasPan.appendChild(nuevaMiga);
            nuevaMiga = crearMigaPan("Ambientes", mostrarSeccion, true);
            migasPan.appendChild(nuevaMiga);
            break;
        case "vista_botas_diarias":
            nuevaMiga = crearMigaPan("Inicio", "vista_tareas", false);
            migasPan.appendChild(nuevaMiga);
            nuevaMiga = crearMigaPan("Botas diarias", mostrarSeccion, true);
            migasPan.appendChild(nuevaMiga);
            break;
        case "vista_buscar_botas":
            nuevaMiga = crearMigaPan("Inicio", "vista_tareas", false);
            migasPan.appendChild(nuevaMiga);
            nuevaMiga = crearMigaPan("Buscar botas", mostrarSeccion, true);
            migasPan.appendChild(nuevaMiga);
            break;
    }
}

function crearMigaPan(nombre, destino, activo = false) {
    const nuevaMiga = document.createElement("li");
    nuevaMiga.classList.add("breadcrumb-item");
    nuevaMiga.setAttribute("mostrar", destino);
    if (activo) {
        nuevaMiga.innerHTML = nombre;
        nuevaMiga.classList.add("active");
        nuevaMiga.setAttribute("aria-current", "page");
    } else {
        nuevaMiga.innerHTML = `<a href="#">${nombre}</a>`;
        nuevaMiga.addEventListener("click", (event) => {
            console.info("[breadcrumb] clic", { texto: nombre, destino, pantalla: pantallaActual });
            event.preventDefault();
            event.stopPropagation();
            mostrarSeccion(destino);
        });
    }
    return nuevaMiga;
}

function prepararEventosMenuFlejes() {
    const tbody = document.querySelector("#tabla_entradas_flejes_menu tbody");
    if (!tbody) return;

    tbody.addEventListener("click", async (event) => {
        const fila = event.target.closest("tr");
        if (!fila || !fila.dataset.entradaId || fila.dataset.loading === "1") return;
        await alternarEstadoEntradaFlejeMenu(fila);
    });
}

async function cargarEntradasFlejesMenu() {
    const tbody = document.querySelector("#tabla_entradas_flejes_menu tbody");
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="3">Cargando entradas de fleje...</td></tr>`;
    try {
        const resp = await GET("./api/entradas_flejes.php");
        if (!resp?.ok) throw new Error(resp?.error || "No se pudo cargar el inventario de flejes.");
        const filas = (resp.inventario_flejes || [])
            .filter((item) => Number(item.estado || 0) < 2)
            .sort((a, b) => {
                const ea = Number(a.estado || 0);
                const eb = Number(b.estado || 0);
                if (ea !== eb) return ea - eb;
                return String(a.lote || "").localeCompare(String(b.lote || ""), "es");
            });

        tbody.innerHTML = "";
        if (!filas.length) {
            tbody.innerHTML = `<tr><td colspan="3">No hay entradas de fleje con estado menor de 2.</td></tr>`;
            return;
        }

        filas.forEach((item) => {
            const tr = document.createElement("tr");
            const estado = Number(item.estado || 0);
            tr.dataset.entradaId = item.id ?? "";
            tr.dataset.estado = String(estado);
            if (estado === 1) tr.classList.add("fleje-estado-1");

            const tdTipo = document.createElement("td");
            tdTipo.textContent = item.tipo_producto_descripcion || item.tipo_producto_tipo || item.tipo_producto_nombre || "FLEJE";

            const tdLote = document.createElement("td");
            tdLote.textContent = item.lote || item.palet_codigo || `Entrada ${item.id ?? ""}`;

            const tdRestante = document.createElement("td");
            tdRestante.classList.add("text-end");
            const restante = Number(item.restante || 0);
            tdRestante.textContent = Number.isFinite(restante)
                ? restante.toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 2 })
                : "0";

            tr.appendChild(tdTipo);
            tr.appendChild(tdLote);
            tr.appendChild(tdRestante);
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error("No se pudo cargar inventario de flejes:", err);
        tbody.innerHTML = `<tr><td colspan="3">Error al cargar entradas de fleje.</td></tr>`;
    }
}

async function alternarEstadoEntradaFlejeMenu(fila) {
    const entradaId = Number(fila.dataset.entradaId || 0);
    const estadoActual = Number(fila.dataset.estado || 0);
    if (!entradaId || ![0, 1].includes(estadoActual)) return;

    const estadoNuevo = estadoActual === 1 ? 0 : 1;
    fila.dataset.loading = "1";
    fila.classList.add("opacity-50");

    try {
        const respuesta = await POST("./api/entradas_flejes.php", {
            id: entradaId,
            estado: estadoNuevo,
        });
        if (!respuesta?.ok) throw new Error(respuesta?.error || "No se pudo actualizar el estado del fleje.");
        fila.dataset.estado = String(respuesta.estado);
        fila.classList.toggle("fleje-estado-1", respuesta.estado === 1);
    } catch (err) {
        console.error("No se pudo actualizar el estado de entrada_fleje:", err);
        alert("No se pudo actualizar el estado del fleje.");
    } finally {
        fila.dataset.loading = "0";
        fila.classList.remove("opacity-50");
    }
}

function routeMessage(data) {
    //console.log("Mensaje recibido:", data);
    try {
        const msg = typeof data === 'string' ? JSON.parse(data) : data;
        if (msg.request_id) {
        const pending = pendingWsRequests.get(msg.request_id);
        if (pending) {
            pendingWsRequests.delete(msg.request_id);
            if (msg.error) {
                if (msg.error === "unauthorized") {
                    console.error("[ws-auth] respuesta no autorizada", {
                        action: msg.action,
                        request_id: msg.request_id,
                        ...(typeof diagnosticoAutenticacionWs === "function" ? diagnosticoAutenticacionWs() : {}),
                    });
                }
                const error = new Error(msg.error);
                pending.reject(error);
                alert(msg.error);
            } else {
                pending.resolve(msg.data);
            }
            return;
        }
        }
        if (msg.error) {
            if (msg.action === "login") {
                setFeedback?.("Usuario o clave incorrectos.", true);
                mostrarLogin?.();
                console.error("Error login servidor:", msg.error, msg);
                return;
            }
            console.error("Error servidor:", msg.error, msg);
            alert(msg.error);
            return;
        }
        (ACCIONES[msg.action] || ACCIONES.default)?.(msg);
    } catch (e) {
        console.error('WS JSON inválido:', e, data);
    }
}

var ACCIONES = {
    "default": (msg) => {
        console.warn("Acción no manejada:", msg);
    },
    "login": respuesta_login,
    "logout": () => {},
    "set_pantalla": () => {},
    "fabricacion_actualizar": (msg) => {
        if (
            pantallaActual === "vista_fabricacion"
            || pantallaActual === "vista_consumo"
            || pantallaActual === "vista_ubicacion"
            || pantallaActual === "vista_mover_stock"
            || pantallaActual === "vista_procesar_stock"
            || pantallaActual === "vista_botas_diarias"
            || pantallaActual === "vista_buscar_botas"
            || pantallaActual === "vista_analiticas"
            || pantallaActual === "vista_envinado"
        ) {
            if (msg?.data?.refetch_maestros) {
                refrescarMaestrosFabricacion?.();
            }
            if ((msg?.data?.tabla === "palets_fondos" || msg?.data?.tabla === "trazabilidad_fabricacion") && !(pantallaActual === "vista_consumo" && esConsumoMaderaLotes())) {
                cargarPaletsFondos?.(pantallaActual === "vista_fabricacion" ? lineaFabricacionActualId : null);
            }
            if (pantallaActual === "vista_consumo") {
                refrescarConsumoDesdeServidor?.(msg.data || {});
            }
            if (pantallaActual === "vista_fabricacion") {
                refrescarFabricacionDesdeServidor?.(msg.data || {});
            }
            if (pantallaActual === "vista_ubicacion") {
                cargarFormularioCrearStock?.();
            }
            if (pantallaActual === "vista_mover_stock") {
                cargarFormularioMoverStock?.();
            }
            if (pantallaActual === "vista_procesar_stock") {
                cargarFormularioProcesarStock?.();
            }
            if (pantallaActual === "vista_botas_diarias") {
                refrescarBotasDiariasDesdeServidor?.(msg.data || {});
            }
            if (pantallaActual === "vista_buscar_botas") {
                refrescarBuscarBotasDesdeServidor?.(msg.data || {});
            }
            if (pantallaActual === "vista_analiticas") {
                cargarVistaAnaliticas?.(true);
            }
            if (pantallaActual === "vista_envinado") {
                cargarVistaEnvinado?.(true);
            }
        }
    },
    "async_error": (msg) => {
        const texto = msg.error || msg.data || "Error async servidor.";
        console.error("Error async servidor:", texto);
        alert(texto);
    },
    "async_print": (msg) => {
        const data = msg.data || {};
        const codigo = data.codigo || "";
        console.log("Impresion completada:", data);
        if (codigo) {
            alert(`Etiqueta enviada a impresora: ${codigo}`);
        } else {
            alert("Etiqueta enviada a impresora.");
        }
    },
};

function setPantalla(pantalla, contexto = {}) {
    pantallaActual = pantalla;
    contextoPantalla = contexto;
    enviarPantalla();
}

function enviarPantalla() {
    const ws = conn && conn.socket;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    const payload = { pantalla: pantallaActual, contexto: contextoPantalla };
    ws.send(JSON.stringify({ action: "set_pantalla", data: payload }));
}
