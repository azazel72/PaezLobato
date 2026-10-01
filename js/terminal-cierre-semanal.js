const estadoCierreSemanal = {
    lineaId: null,
    pedidoId: null,
    origenVista: "vista_fabricacion",
    data: null,
    borrador: null,
    siguientesSemanas: [],
};

function asegurarEstructuraVistaCierreSemanal() {
    const panel = document.getElementById("panelCierreSemanal");
    if (!panel) return;
    const body = panel.querySelector(".panel-fijo-body");
    if (!body) return;
    if (document.getElementById("cierre-semanal-lotes")
        && document.getElementById("cierre-semanal-codigos")
        && document.getElementById("cierre-semanal-cerrar")) {
        return;
    }
    body.classList.add("cierre-semanal-body");
    body.innerHTML = `
        <div class="cierre-semanal-bloque">
            <div class="d-flex justify-content-between align-items-center gap-2 flex-wrap">
                <h6 class="cierre-semanal-bloque-titulo mb-0">Palets y lotes consumidos</h6>
                <span class="small text-muted" id="cierre-semanal-lotes-resumen"></span>
            </div>
            <div class="cierre-semanal-lotes-lista" id="cierre-semanal-lotes">
                <div class="cierre-semanal-empty">Cargando lotes...</div>
            </div>
        </div>

        <details class="cierre-semanal-bloque cierre-semanal-desplegable" id="cierre-semanal-codigos-panel">
            <summary class="cierre-semanal-desplegable-titulo">Botas fabricadas</summary>
            <div class="cierre-semanal-codigos" id="cierre-semanal-codigos">
                <div class="cierre-semanal-empty">Cargando códigos...</div>
            </div>
        </details>

        <div class="cierre-semanal-bloque">
            <h6 class="cierre-semanal-bloque-titulo">Los cambios de esta pantalla son temporales hasta pulsar Actualizar cambios.</h6>
            <div class="cierre-semanal-acciones">
                <button type="button" class="btn btn-outline-secondary" id="cierre-semanal-reset">
                    <i class="bi bi-arrow-counterclockwise"></i> Restablecer cambios
                </button>
                <button type="button" class="btn btn-dark" id="cierre-semanal-cerrar">
                    <i class="bi bi-check2-circle"></i> Actualizar cambios
                </button>
            </div>
            <div class="cierre-semanal-nota" id="cierre-semanal-nota-acciones"></div>
            <div class="cierre-semanal-traslado mt-3">
                <label for="cierre-semanal-siguiente-linea" class="form-label mb-1">Trasladar sobrante a siguiente semana</label>
                <select id="cierre-semanal-siguiente-linea" class="form-select form-select-sm">
                    <option value="">Seleccione producción semanal...</option>
                </select>
                <label class="form-check mt-2 mb-2">
                    <input class="form-check-input" type="checkbox" id="cierre-semanal-crear-palet-hijo">
                    <span class="form-check-label">Crear palés hijos para los sobrantes</span>
                </label>
                <button type="button" class="btn btn-primary" id="cierre-semanal-trasladar-semana">
                    <i class="bi bi-box-arrow-right"></i> Trasladar a siguiente semana
                </button>
            </div>
        </div>
    `;
}

function obtenerInfoLineaSemanal(linea) {
    const pedido = terminalFabricacion?.pedidos?.[linea?.pedido_id] || null;
    const tipo = terminalFabricacion?.tipos_producto?.[linea?.tipo_producto_id]?.descripcion || "-";
    const material = terminalFabricacion?.materiales?.[linea?.material_id]?.descripcion || "-";
    const tostado = terminalFabricacion?.tostados?.[linea?.tostado_id]?.descripcion || linea?.tostado_descripcion || "-";
    const semanaPedida = Number(linea?.cantidad || 0) || 0;
    const semanaFabricada = Number(linea?.cantidad_fabricada || 0) || 0;
    const pedidoTotal = Number(pedido?.cantidad || 0) || 0;
    const pedidoFabricado = Number(pedido?.cantidad_fabricada || 0) || 0;
    return {
        linea,
        pedido,
        tipo,
        material,
        tostado,
        pedidoDescripcion: (pedido?.descripcion || `Pedido ${linea?.pedido_id || "-"}`).trim(),
        fechaInicio: typeof formatearFechaEuropea === "function" ? formatearFechaEuropea(linea?.fecha_inicio) : (linea?.fecha_inicio || ""),
        semanaPedida,
        semanaFabricada,
        semanaPendiente: semanaPedida - semanaFabricada,
        pedidoTotal,
        pedidoFabricado,
        pedidoPendiente: pedidoTotal - pedidoFabricado,
    };
}

function formatearValorSemanal(valor) {
    return Number(valor || 0).toLocaleString("es-ES", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 3,
    });
}

function construirResumenCantidadesLinea(info) {
    return [
        `Semana: pedidas ${formatearValorSemanal(info.semanaPedida)} | fabricadas ${formatearValorSemanal(info.semanaFabricada)}`,
        `Pedido total: pedidas ${formatearValorSemanal(info.pedidoTotal)} | fabricadas ${formatearValorSemanal(info.pedidoFabricado)}`,
    ].join("\n");
}

function obtenerConsumoDuelaPorTipoBota(tipoBotaId) {
    const consumos = Object.values(terminalFabricacion?.consumos || {});
    const tipos = terminalFabricacion?.tipos_producto || {};
    const botaIdNum = Number(tipoBotaId || 0);
    if (!botaIdNum) return 0;
    const consumo = consumos.find((item) => {
        if (Number(item?.bota_id || 0) !== botaIdNum) return false;
        const tipoConsumible = tipos?.[Number(item?.consumible_id || 0)];
        return String(tipoConsumible?.tipo || "").toUpperCase() === "DUELA";
    });
    return Number(consumo?.consumo || 0) || 0;
}

function obtenerNumeroSemanal(valor) {
    const numero = Number(valor || 0);
    return Number.isFinite(numero) ? numero : 0;
}

function obtenerLoteItemCierreSemanal(item, indice = 0) {
    const codigo = item?.palet_codigo || item?.palet_id || "";
    const lote = typeof obtenerLoteDesdeCodigoPalet === "function"
        ? obtenerLoteDesdeCodigoPalet(codigo)
        : "";
    return String(lote || codigo || `LOTE-${indice + 1}`).trim();
}

function crearBorradorCierreSemanal(items = []) {
    const lotesMap = new Map();
    const consumosPalets = {};
    items.forEach((item, indice) => {
        const loteId = obtenerLoteItemCierreSemanal(item, indice);
        if (!lotesMap.has(loteId)) {
            lotesMap.set(loteId, {
                id: loteId,
                lote: loteId,
                palets: [],
                m3Original: 0,
                m3Consumido: 0,
                botasFabricadas: 0,
                procesado: 0,
                desperdicio: 0,
                trasladado: 0,
            });
        }
        const lote = lotesMap.get(loteId);
        const paletCodigo = String(item?.palet_codigo || item?.palet_id || "").trim();
        if (paletCodigo) lote.palets.push(paletCodigo);
        lote.m3Original += obtenerNumeroSemanal(item?.m3_total ?? item?.palet_cubicaje);
        lote.m3Consumido += obtenerNumeroSemanal(item?.m3_consumidos ?? item?.palet_consumido);
        lote.botasFabricadas += obtenerNumeroSemanal(item?.botas_registradas ?? item?.cantidad_fabricada);
        const trazabilidadId = Number(item?.trazabilidad_id || 0);
        if (trazabilidadId) {
            consumosPalets[trazabilidadId] = obtenerNumeroSemanal(item?.m3_consumidos ?? item?.palet_consumido);
        }
    });
    const lotes = Array.from(lotesMap.values())
        .map((lote) => ({
            ...lote,
            palets: Array.from(new Set(lote.palets)).sort((a, b) => a.localeCompare(b, "es", { numeric: true, sensitivity: "base" })),
        }))
        .sort((a, b) => a.lote.localeCompare(b.lote, "es", { numeric: true, sensitivity: "base" }));
    return {
        lotes,
        consumosPalets,
        operaciones: [],
        secuencia: 0,
    };
}

function obtenerLoteBorradorCierre(loteId) {
    return estadoCierreSemanal.borrador?.lotes?.find((item) => item.id === loteId) || null;
}

function obtenerRestanteLoteCierre(lote) {
    return obtenerNumeroSemanal(lote?.m3Original)
        - obtenerNumeroSemanal(lote?.m3Consumido)
        - obtenerNumeroSemanal(lote?.procesado)
        - obtenerNumeroSemanal(lote?.desperdicio)
        - obtenerNumeroSemanal(lote?.trasladado);
}

function obtenerResumenBorradorCierre() {
    const lotes = estadoCierreSemanal.borrador?.lotes || [];
    return lotes.reduce((acc, lote) => {
        const restante = obtenerRestanteLoteCierre(lote);
        acc.m3Original += obtenerNumeroSemanal(lote.m3Original);
        acc.m3Consumido += obtenerNumeroSemanal(lote.m3Consumido);
        acc.m3Restante += restante;
        acc.botasFabricadas += obtenerNumeroSemanal(lote.botasFabricadas);
        if (restante < 0) acc.negativos += 1;
        if (restante > 0) acc.positivos += 1;
        if (restante === 0) acc.equilibrados += 1;
        return acc;
    }, {
        m3Original: 0,
        m3Consumido: 0,
        m3Restante: 0,
        botasFabricadas: 0,
        negativos: 0,
        positivos: 0,
        equilibrados: 0,
    });
}

function registrarOperacionTemporalCierre(tipo, detalle) {
    if (!estadoCierreSemanal.borrador) return;
    estadoCierreSemanal.borrador.secuencia += 1;
    estadoCierreSemanal.borrador.operaciones.push({
        id: estadoCierreSemanal.borrador.secuencia,
        tipo,
        detalle,
    });
    renderizarNotaCambiosCierreSemanal();
    console.log("cierre_semanal_borrador", {
        operaciones: estadoCierreSemanal.borrador.operaciones,
        lotes: estadoCierreSemanal.borrador.lotes,
    });
}

function formatearOperacionCierreSemanal(operacion) {
    const detalle = operacion?.detalle || {};
    const m3 = formatearValorSemanal(detalle.m3);
    if (operacion?.tipo === "reasignar") {
        return `Reasignar sobrante ${m3} m3: lote ${detalle.origen} a lote ${detalle.destino}.`;
    }
    if (operacion?.tipo === "reasignar_consumo") {
        return `Reasignar ${m3} m3 de consumo entre los palés seleccionados.`;
    }
    if (operacion?.tipo === "procesado") {
        return `Enviar ${m3} m3 del lote ${detalle.lote} a procesado (${detalle.palet_destino_codigo}).`;
    }
    if (operacion?.tipo === "desperdicio") {
        return `Registrar ${m3} m3 de desperdicio en el lote ${detalle.lote}.`;
    }
    return `${operacion?.tipo || "Cambio"}: ${m3} m3.`;
}

function renderizarNotaCambiosCierreSemanal() {
    const nota = document.getElementById("cierre-semanal-nota-acciones");
    if (!nota) return;
    const operaciones = estadoCierreSemanal.borrador?.operaciones || [];
    nota.replaceChildren();
    if (!operaciones.length) {
        nota.textContent = "No hay cambios pendientes de actualizar.";
        return;
    }
    const resumen = document.createElement("div");
    resumen.textContent = `Cambios pendientes: ${operaciones.length}`;
    const lista = document.createElement("ul");
    operaciones.forEach((operacion) => {
        const item = document.createElement("li");
        item.textContent = formatearOperacionCierreSemanal(operacion);
        lista.appendChild(item);
    });
    nota.append(resumen, lista);
}

function obtenerValorNumericoInput(selector) {
    const valor = String(document.querySelector(selector)?.value || "").trim().replace(",", ".");
    const numero = Number(valor);
    return Number.isFinite(numero) ? numero : NaN;
}

function obtenerPaletsNegativosCierreSemanal() {
    return (estadoCierreSemanal.data?.palets || []).filter((palet) => (
        obtenerNumeroSemanal(palet?.palet_cubicaje) < 0
        || obtenerNumeroSemanal(palet?.palet_consumido) < 0
        || obtenerNumeroSemanal(palet?.m3_sobrante) < 0
    ));
}

function actualizarCabeceraCierreSemanal(info) {
    const resumenEl = document.getElementById("cierre-semanal-resumen");
    if (!resumenEl) return;
    const resumen = obtenerResumenBorradorCierre();
    resumenEl.textContent = [
        `Semana: pedidas ${formatearValorSemanal(info.semanaPedida)} | fabricadas ${formatearValorSemanal(info.semanaFabricada)}`,
        `Pedido total: pedidas ${formatearValorSemanal(info.pedidoTotal)} | fabricadas ${formatearValorSemanal(info.pedidoFabricado)}`,
        `M3 consumidos: ${formatearValorSemanal(resumen.m3Consumido)} | M3 restantes: ${formatearValorSemanal(resumen.m3Restante)}`,
    ].join("\n");
}

function construirEtiquetaSiguienteSemana(linea) {
    const pedidoDescripcion = (terminalFabricacion?.pedidos?.[Number(linea?.pedido_id || 0)]?.descripcion || `Pedido ${linea?.pedido_id || "-"}`).trim();
    const tipoDescripcion = terminalFabricacion?.tipos_producto?.[Number(linea?.tipo_producto_id || 0)]?.descripcion || "-";
    const fechaInicio = typeof formatearFechaEuropea === "function" ? formatearFechaEuropea(linea?.fecha_inicio) : (linea?.fecha_inicio || "-");
    return `${pedidoDescripcion} · ${tipoDescripcion} · ${fechaInicio}`;
}

function renderizarOpcionesSiguienteSemana() {
    const select = document.getElementById("cierre-semanal-siguiente-linea");
    if (!select) return;
    const actual = String(select.value || "");
    const opciones = estadoCierreSemanal.siguientesSemanas || [];
    select.innerHTML = `
        <option value="">Seleccione producción semanal...</option>
        ${opciones.map((linea) => `<option value="${linea.id}">${construirEtiquetaSiguienteSemana(linea)}</option>`).join("")}
    `;
    if (actual && opciones.some((linea) => String(linea.id) === actual)) {
        select.value = actual;
    }
}

async function cargarCodigosCierreSemanal(lineaId) {
    const items = (await wsRequest("listar_productos_por_filtros", { tipos: ["BOTA"] })) || [];
    return items
        .filter((item) => Number(item?.fabricacion_semanal_id || 0) === Number(lineaId || 0))
        .map((item) => String(item?.codigo || "").trim())
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, "es", { numeric: true, sensitivity: "base" }));
}

function renderizarLotesCierreSemanal(info) {
    const lista = document.getElementById("cierre-semanal-lotes");
    const resumenEl = document.getElementById("cierre-semanal-lotes-resumen");
    const lotes = estadoCierreSemanal.borrador?.lotes || [];
    const resumen = obtenerResumenBorradorCierre();
    if (resumenEl) {
        const operaciones = estadoCierreSemanal.borrador?.operaciones?.length || 0;
        resumenEl.textContent = `Lotes ${lotes.length} | Positivos ${resumen.positivos} | Negativos ${resumen.negativos} | Ajustes ${operaciones}`;
    }
    if (!lista) return;
    if (!lotes.length) {
        lista.innerHTML = `<div class="cierre-semanal-empty">Sin lotes registrados.</div>`;
        return;
    }
    lista.innerHTML = lotes.map((lote) => {
        const restante = obtenerRestanteLoteCierre(lote);
        const consumoReasignable = Math.max(lote.m3Consumido - lote.m3Original, 0);
        const claseEstado = restante < 0
            ? " cierre-semanal-lote-negativo"
            : (restante > 0 ? " cierre-semanal-lote-positivo" : "");
        const destinos = (estadoCierreSemanal.data?.palets || [])
            .filter((palet) => String(palet?.lote || "") !== String(lote.id))
            .map((palet) => ({
                trazabilidadId: Number(palet?.trazabilidad_id || 0),
                codigo: String(palet?.palet_codigo || palet?.palet_id || "").trim(),
                lote: String(palet?.lote || "").trim(),
            }))
            .filter((palet) => palet.trazabilidadId && palet.codigo)
            .map((palet) => `<option value="${palet.trazabilidadId}">${palet.codigo} · Lote ${palet.lote}</option>`)
            .join("");
        const destinosSobrante = lotes
            .filter((destino) => destino.id !== lote.id)
            .map((destino) => `<option value="${destino.id}">Lote ${destino.lote}</option>`)
            .join("");
        return `
        <article class="cierre-semanal-lote${claseEstado}" data-cierre-lote="${lote.id}">
            <div class="cierre-semanal-lote-titulo">Lote ${lote.lote}</div>
            <div class="cierre-semanal-lote-meta">${lote.palets.length ? `Palets: ${lote.palets.join(", ")}` : "Sin palets asociados"}</div>
            <div class="cierre-semanal-lote-grid">
                <div><strong>M3 orig./consum.:</strong> <span data-cierre-metrica="m3Original">${formatearValorSemanal(lote.m3Original)}</span> / <span data-cierre-metrica="m3Consumido">${formatearValorSemanal(lote.m3Consumido)}</span></div>
                <div><strong>M3 restantes:</strong> <span data-cierre-metrica="m3Restante">${formatearValorSemanal(restante)}</span></div>
                <div><strong>Botas fabricadas:</strong> <span data-cierre-metrica="botasFabricadas">${formatearValorSemanal(lote.botasFabricadas)}</span></div>
                <div><strong>A procesado:</strong> <span data-cierre-metrica="procesado">${formatearValorSemanal(lote.procesado)}</span></div>
                <div><strong>A desperdicio:</strong> <span data-cierre-metrica="desperdicio">${formatearValorSemanal(lote.desperdicio)}</span></div>
            </div>
            <div class="cierre-semanal-lote-acciones mt-3">
                <details class="cierre-semanal-lote-form cierre-semanal-lote-form-full">
                    <summary class="cierre-semanal-operacion-titulo">Reasignar consumo a otro palé</summary>
                    <div class="cierre-semanal-operacion-cuerpo">
                        <select class="form-select form-select-sm" data-cierre-destino-lote="${lote.id}">
                            <option value="">Seleccione palé destino...</option>
                            ${destinos}
                        </select>
                        <div class="cierre-semanal-lote-inline">
                            <input class="form-control form-control-sm" type="number" step="0.001" value="${formatearValorSemanal(consumoReasignable).replace(',', '.')}" data-cierre-m3-reasignar="${lote.id}">
                            <button type="button" class="btn btn-sm btn-outline-primary" data-action="reasignar-lote" data-lote-id="${lote.id}">
                                Reasignar consumo
                            </button>
                        </div>
                    </div>
                </details>
                <details class="cierre-semanal-lote-form cierre-semanal-lote-form-full">
                    <summary class="cierre-semanal-operacion-titulo">Reasignar sobrante a otro lote</summary>
                    <div class="cierre-semanal-operacion-cuerpo">
                        <select class="form-select form-select-sm" data-cierre-destino-sobrante="${lote.id}">
                            <option value="">Seleccione lote destino...</option>
                            ${destinosSobrante}
                        </select>
                        <div class="cierre-semanal-lote-inline">
                            <input class="form-control form-control-sm" type="number" step="0.001" value="${formatearValorSemanal(restante).replace(',', '.')}" data-cierre-m3-sobrante="${lote.id}">
                            <button type="button" class="btn btn-sm btn-outline-primary" data-action="reasignar-sobrante" data-lote-id="${lote.id}">
                                Reasignar sobrante
                            </button>
                        </div>
                    </div>
                </details>
                <details class="cierre-semanal-lote-form cierre-semanal-lote-form-full">
                    <summary class="cierre-semanal-operacion-titulo">Enviar m3 a procesado</summary>
                    <div class="cierre-semanal-operacion-cuerpo">
                        <input class="form-control form-control-sm" type="text" placeholder="Codigo de palet destino" data-cierre-codigo-procesado="${lote.id}">
                        <div class="cierre-semanal-lote-inline">
                            <input class="form-control form-control-sm" type="number" step="0.001" value="${formatearValorSemanal(restante).replace(',', '.')}" placeholder="M3 a procesado" data-cierre-m3-procesado="${lote.id}">
                            <button type="button" class="btn btn-sm btn-outline-success" data-action="procesar-lote" data-lote-id="${lote.id}">
                                Enviar a procesado
                            </button>
                        </div>
                    </div>
                </details>
                <details class="cierre-semanal-lote-form cierre-semanal-lote-form-full">
                    <summary class="cierre-semanal-operacion-titulo">Consumir restante como desperdicio</summary>
                    <div class="cierre-semanal-operacion-cuerpo">
                        <div class="cierre-semanal-lote-inline">
                            <input class="form-control form-control-sm" type="number" step="0.001" value="${formatearValorSemanal(restante).replace(',', '.')}" data-cierre-m3-desperdicio="${lote.id}">
                            <button type="button" class="btn btn-sm btn-outline-danger" data-action="desperdicio-lote" data-lote-id="${lote.id}">
                                Desperdicio
                            </button>
                        </div>
                    </div>
                </details>
            </div>
        </article>
    `;
    }).join("");
}

function refrescarResumenLotesCierreSemanal() {
    const resumenEl = document.getElementById("cierre-semanal-lotes-resumen");
    if (!resumenEl) return;
    const lotes = estadoCierreSemanal.borrador?.lotes || [];
    const resumen = obtenerResumenBorradorCierre();
    const operaciones = estadoCierreSemanal.borrador?.operaciones?.length || 0;
    resumenEl.textContent = `Lotes ${lotes.length} | Positivos ${resumen.positivos} | Negativos ${resumen.negativos} | Ajustes ${operaciones}`;
}

function refrescarInputsLoteCierre(loteId) {
    const lote = obtenerLoteBorradorCierre(loteId);
    if (!lote) return;
    const restante = obtenerRestanteLoteCierre(lote);
    const valorDefecto = formatearValorSemanal(restante).replace(",", ".");
    const inputReasignar = document.querySelector(`[data-cierre-m3-reasignar="${loteId}"]`);
    const inputProcesado = document.querySelector(`[data-cierre-m3-procesado="${loteId}"]`);
    const inputDesperdicio = document.querySelector(`[data-cierre-m3-desperdicio="${loteId}"]`);
    if (inputReasignar) inputReasignar.value = valorDefecto;
    if (inputProcesado) inputProcesado.value = valorDefecto;
    if (inputDesperdicio) inputDesperdicio.value = valorDefecto;
}

function refrescarLoteCierreSemanal(loteId) {
    const lote = obtenerLoteBorradorCierre(loteId);
    const article = document.querySelector(`[data-cierre-lote="${loteId}"]`);
    if (!lote || !article) return;
    const restante = obtenerRestanteLoteCierre(lote);
    article.classList.toggle("cierre-semanal-lote-negativo", restante < 0);
    article.classList.toggle("cierre-semanal-lote-positivo", restante > 0);
    const setTexto = (metrica, valor) => {
        const el = article.querySelector(`[data-cierre-metrica="${metrica}"]`);
        if (el) el.textContent = formatearValorSemanal(valor);
    };
    setTexto("m3Original", lote.m3Original);
    setTexto("m3Consumido", lote.m3Consumido);
    setTexto("m3Restante", restante);
    setTexto("botasFabricadas", lote.botasFabricadas);
    setTexto("procesado", lote.procesado);
    setTexto("desperdicio", lote.desperdicio);
    setTexto("trasladado", lote.trasladado);
    refrescarInputsLoteCierre(loteId);
}

function renderizarCodigosCierreSemanal(codigos) {
    const contenedor = document.getElementById("cierre-semanal-codigos");
    if (!contenedor) return;
    if (!codigos.length) {
        contenedor.innerHTML = `<div class="cierre-semanal-empty">No hay códigos de botas fabricadas todavía.</div>`;
        return;
    }
    contenedor.innerHTML = `
        <div class="small text-muted">${codigos.length} códigos de botas fabricadas.</div>
        <div class="cierre-semanal-codigos-lista">
            ${codigos.map((codigo) => `<span class="cierre-semanal-codigo">${codigo}</span>`).join("")}
        </div>
    `;
}

// NOTA: Mostrar datos del cierre por consola.
function registrarBotasReferidasCierreSemanal(lineaId, data = {}) {
    const codigos = Array.isArray(data?.codigos_botas) ? data.codigos_botas : [];
    const porPalet = Array.isArray(data?.palets)
        ? data.palets
            .filter((item) => Array.isArray(item?.codigos_botas) && item.codigos_botas.length)
            .map((item) => ({
                trazabilidad_id: Number(item?.trazabilidad_id || 0) || null,
                palet_codigo: String(item?.palet_codigo || "").trim(),
                lote: String(item?.lote || "").trim(),
                codigos_botas: item.codigos_botas.map((codigo) => String(codigo || "").trim()).filter(Boolean),
            }))
        : [];
    console.log("[cierre-semanal] botas referidas", {
        fabricacion_semanal_id: Number(lineaId || 0) || null,
        total_codigos: codigos.length,
        codigos_botas: codigos,
        por_palet: porPalet,
    });
}

async function abrirVistaCierreSemanalDesdeLinea(lineaId, origenVista = "vista_fabricacion") {
    estadoCierreSemanal.lineaId = Number(lineaId || 0) || null;
    estadoCierreSemanal.pedidoId = null;
    estadoCierreSemanal.origenVista = origenVista || "vista_fabricacion";
    if (typeof contextoNavegacion !== "undefined") {
        contextoNavegacion.cierreSemanalOrigen = estadoCierreSemanal.origenVista;
    }
    mostrarSeccion?.("vista_cierre_semanal");
}

async function cargarVistaCierreSemanal() {
    try {
        asegurarEstructuraVistaCierreSemanal();
        const usarPhp = estadoCierreSemanal.origenVista !== "vista_consumo";
        configurarVistaCierreSemanalPhp(usarPhp);
        if (usarPhp) {
            await cargarCierreSemanalDesdePhp();
            return;
        }
        const lineaId = Number(estadoCierreSemanal.lineaId || 0);
        if (!lineaId) return;
        const data = (await wsRequest("obtener_cierre_semanal", { fabricacion_semanal_id: lineaId })) || {};
        const linea = data?.linea || {};
        const pedido = data?.pedido || {};
        const info = {
            linea,
            pedido,
            tipo: linea?.tipo_producto_descripcion || "-",
            material: linea?.material_descripcion || "-",
            pedidoDescripcion: (pedido?.descripcion || `Pedido ${linea?.pedido_id || "-"}`).trim(),
            fechaInicio: typeof formatearFechaEuropea === "function" ? formatearFechaEuropea(linea?.fecha_inicio) : (linea?.fecha_inicio || ""),
            semanaPedida: Number(linea?.cantidad || 0) || 0,
            semanaFabricada: Number(linea?.cantidad_fabricada || 0) || 0,
            semanaPendiente: (Number(linea?.cantidad || 0) || 0) - (Number(linea?.cantidad_fabricada || 0) || 0),
            pedidoTotal: Number(pedido?.cantidad || 0) || 0,
            pedidoFabricado: Number(pedido?.cantidad_fabricada || 0) || 0,
            pedidoPendiente: (Number(pedido?.cantidad || 0) || 0) - (Number(pedido?.cantidad_fabricada || 0) || 0),
        };
        estadoCierreSemanal.pedidoId = Number(linea?.pedido_id || 0) || null;
        const items = Array.isArray(data?.palets) ? data.palets : [];
        const codigos = Array.isArray(data?.codigos_botas) ? data.codigos_botas : [];
        const fabricacion = (await wsRequest("fabricacion", {})) || {};
        terminalFabricacion.pedidos = fabricacion?.pedidos || terminalFabricacion.pedidos || {};
        terminalFabricacion.tipos_producto = fabricacion?.tipos_producto || terminalFabricacion.tipos_producto || {};
        estadoCierreSemanal.siguientesSemanas = Object.values(fabricacion?.fabricacion_semanal || {})
            .filter((item) => Number(item?.id || 0) !== lineaId)
            .filter((item) => [1, 2].includes(Number(item?.estado || 0)))
            .sort((a, b) => String(a?.fecha_inicio || "").localeCompare(String(b?.fecha_inicio || "")));
        estadoCierreSemanal.data = data;
        estadoCierreSemanal.borrador = crearBorradorCierreSemanal(items);
        renderizarNotaCambiosCierreSemanal();
        //registrarBotasReferidasCierreSemanal(lineaId, data);

        const titulo = document.getElementById("cierre-semanal-titulo");
        const subtitulo = document.getElementById("cierre-semanal-subtitulo");
        if (titulo) titulo.textContent = "Cierre Semanal";
        if (subtitulo) subtitulo.textContent = `Tipo ${info.tipo} | Madera ${info.material} | Inicio ${info.fechaInicio || "-"}`;
        actualizarCabeceraCierreSemanal(info);
        renderizarLotesCierreSemanal(info);
        renderizarOpcionesSiguienteSemana();
        renderizarCodigosCierreSemanal(codigos);
    } catch (err) {
        console.error(err);
        const lotes = document.getElementById("cierre-semanal-lotes");
        const codigos = document.getElementById("cierre-semanal-codigos");
        if (lotes) lotes.innerHTML = `<div class="cierre-semanal-empty">Error al cargar lotes.</div>`;
        if (codigos) codigos.innerHTML = `<div class="cierre-semanal-empty">Error al cargar códigos.</div>`;
    }
}

function prepararEventosCierreSemanal() {
    const btnReset = document.getElementById("cierre-semanal-reset");
    if (btnReset) {
        btnReset.addEventListener("click", () => {
            if (cierreSemanalPhp.activo) {
                restablecerLotesCierrePhp();
                return;
            }
            estadoCierreSemanal.borrador = crearBorradorCierreSemanal(estadoCierreSemanal.data?.palets || []);
            renderizarNotaCambiosCierreSemanal();
            const info = obtenerInfoLineaSemanal(estadoCierreSemanal.data?.linea || {});
            actualizarCabeceraCierreSemanal(info);
            renderizarLotesCierreSemanal(info);
            renderizarOpcionesSiguienteSemana();
        });
    }
    const btnTrasladarSemana = document.getElementById("cierre-semanal-trasladar-semana");
    if (btnTrasladarSemana) {
        btnTrasladarSemana.addEventListener("click", async () => {
            const destinoId = Number(document.getElementById("cierre-semanal-siguiente-linea")?.value || 0);
            const paletsNegativos = obtenerPaletsNegativosCierreSemanal();
            if (paletsNegativos.length) {
                const codigos = paletsNegativos
                    .map((palet) => String(palet?.palet_codigo || palet?.palet_id || "sin código"))
                    .join(", ");
                alert(`Atención: se cerrará la fabricación con ${paletsNegativos.length} palet(s) con valores negativos: ${codigos}.`);
            }
            try {
                const respuesta = await wsRequest("trasladar_sobrantes_cierre_semanal", {
                    fabricacion_semanal_id: estadoCierreSemanal.lineaId,
                    fabricacion_semanal_destino_id: destinoId || null,
                    crear_palet_hijo: Boolean(document.getElementById("cierre-semanal-crear-palet-hijo")?.checked),
                });
                alert(`Fabricación semanal finalizada. Palés asignados al destino: ${respuesta?.palets_asignados?.length || 0}.`);
                await cargarVistaCierreSemanal();
            } catch (err) {
                console.error(err);
                alert("No se pudieron trasladar los sobrantes.");
            }
        });
    }
    const btnCerrar = document.getElementById("cierre-semanal-cerrar");
    if (btnCerrar) {
        btnCerrar.addEventListener("click", async () => {
            if (cierreSemanalPhp.activo) {
                await confirmarLotesCierrePhp();
                return;
            }
            const operaciones = estadoCierreSemanal.borrador?.operaciones || [];
            if (!operaciones.length) {
                alert("No hay cambios pendientes de actualizar.");
                return;
            }
            try {
                btnCerrar.disabled = true;
                const respuesta = await wsRequest("actualizar_cambios_cierre_semanal", {
                    fabricacion_semanal_id: estadoCierreSemanal.lineaId,
                    operaciones,
                });
                estadoCierreSemanal.data = respuesta?.cierre || null;
                await cargarVistaCierreSemanal();
                alert("Cambios actualizados.");
            } catch (err) {
                console.error(err);
                alert("No se pudieron actualizar los cambios del cierre.");
            } finally {
                btnCerrar.disabled = false;
            }
        });
    }
    const listaLotes = document.getElementById("cierre-semanal-lotes");
    if (listaLotes && !listaLotes.dataset.bindCierreSemanal) {
        listaLotes.dataset.bindCierreSemanal = "1";
        listaLotes.addEventListener("click", (event) => {
            if (cierreSemanalPhp.activo) return;
            const info = obtenerInfoLineaSemanal(estadoCierreSemanal.data?.linea || {});
            const btnReasignarSobrante = event.target.closest("[data-action='reasignar-sobrante']");
            if (btnReasignarSobrante) {
                const origenId = btnReasignarSobrante.getAttribute("data-lote-id") || "";
                const destinoId = String(document.querySelector(`[data-cierre-destino-sobrante="${origenId}"]`)?.value || "");
                const m3 = obtenerValorNumericoInput(`[data-cierre-m3-sobrante="${origenId}"]`);
                const origen = obtenerLoteBorradorCierre(origenId);
                const destino = obtenerLoteBorradorCierre(destinoId);
                if (!origen || !destino) {
                    alert("Indica un lote destino.");
                    return;
                }
                origen.m3Original -= m3;
                destino.m3Original += m3;
                registrarOperacionTemporalCierre("reasignar", { origen: origenId, destino: destinoId, m3 });
                actualizarCabeceraCierreSemanal(info);
                renderizarLotesCierreSemanal(info);
                return;
            }
            const btnReasignarItem = event.target.closest("[data-action='reasignar-lote']");
            if (btnReasignarItem) {
                const origenId = btnReasignarItem.getAttribute("data-lote-id") || "";
                const destinoTrazabilidadId = Number(document.querySelector(`[data-cierre-destino-lote="${origenId}"]`)?.value || 0);
                const m3 = obtenerValorNumericoInput(`[data-cierre-m3-reasignar="${origenId}"]`);
                const origen = obtenerLoteBorradorCierre(origenId);
                const trazaOrigen = (estadoCierreSemanal.data?.palets || []).find((palet) => (
                    String(palet?.lote || "") === String(origenId)
                ));
                const trazaDestino = (estadoCierreSemanal.data?.palets || []).find((palet) => (
                    Number(palet?.trazabilidad_id || 0) === destinoTrazabilidadId
                ));
                const destino = obtenerLoteBorradorCierre(String(trazaDestino?.lote || ""));
                if (!origen || !trazaOrigen || !destinoTrazabilidadId) {
                    alert("Debes indicar un palé destino y el lote origen debe tener un palé con sobreconsumo.");
                    return;
                }
                const consumosPalets = estadoCierreSemanal.borrador?.consumosPalets || {};
                const consumoOrigen = obtenerNumeroSemanal(consumosPalets[trazaOrigen.trazabilidad_id]);
                const consumoDestino = obtenerNumeroSemanal(consumosPalets[trazaDestino?.trazabilidad_id]);
                if (!trazaDestino) {
                    alert("No se encontró el palé destino.");
                    return;
                }
                registrarOperacionTemporalCierre("reasignar_consumo", {
                    trazabilidad_origen_id: Number(trazaOrigen.trazabilidad_id),
                    trazabilidad_destino_id: destinoTrazabilidadId,
                    m3,
                });
                consumosPalets[trazaOrigen.trazabilidad_id] = consumoOrigen - m3;
                consumosPalets[trazaDestino.trazabilidad_id] = consumoDestino + m3;
                origen.m3Consumido -= m3;
                if (destino && destino !== origen) destino.m3Consumido += m3;
                actualizarCabeceraCierreSemanal(info);
                renderizarLotesCierreSemanal(info);
                return;
            }
            const btnProcesarItem = event.target.closest("[data-action='procesar-lote']");
            if (btnProcesarItem) {
                const loteId = btnProcesarItem.getAttribute("data-lote-id") || "";
                const lote = obtenerLoteBorradorCierre(loteId);
                const m3 = obtenerValorNumericoInput(`[data-cierre-m3-procesado="${loteId}"]`);
                const codigoPalet = String(document.querySelector(`[data-cierre-codigo-procesado="${loteId}"]`)?.value || "").trim();
                const restante = obtenerRestanteLoteCierre(lote);
                if (!lote || !Number.isFinite(m3) || m3 <= 0) {
                    alert("Debes indicar m3 válidos para enviar a procesado.");
                    return;
                }
                if (!codigoPalet) {
                    alert("Debes indicar el codigo de palet destino para procesado.");
                    return;
                }
                if (restante < m3) {
                    alert("No puedes enviar a procesado más m3 de los restantes positivos del lote.");
                    return;
                }
                lote.procesado += m3;
                registrarOperacionTemporalCierre("procesado", { lote: loteId, m3, palet_destino_codigo: codigoPalet });
                actualizarCabeceraCierreSemanal(info);
                renderizarLotesCierreSemanal(info);
                return;
            }
            const btnDesperdicio = event.target.closest("[data-action='desperdicio-lote']");
            if (btnDesperdicio) {
                const loteId = btnDesperdicio.getAttribute("data-lote-id") || "";
                const lote = obtenerLoteBorradorCierre(loteId);
                const m3 = obtenerValorNumericoInput(`[data-cierre-m3-desperdicio="${loteId}"]`);
                const restante = obtenerRestanteLoteCierre(lote);
                if (!lote || !Number.isFinite(m3) || m3 <= 0) {
                    alert("Ese lote no tiene restante pendiente para llevar a desperdicio.");
                    return;
                }
                if (restante < m3) {
                    alert("No puedes llevar a desperdicio más cantidad que el restante positivo del lote.");
                    return;
                }
                lote.desperdicio += m3;
                registrarOperacionTemporalCierre("desperdicio", { lote: loteId, m3 });
                actualizarCabeceraCierreSemanal(info);
                renderizarLotesCierreSemanal(info);
            }
        });
    }
}
