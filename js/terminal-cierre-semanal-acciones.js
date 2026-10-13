const borradorLotesCierrePhp = { originales: [], operaciones: [], guardando: false };

function unidadesLoteCierre(valor) {
    const texto = String(valor ?? "").trim().replace(",", ".");
    if (!/^\d+(?:\.\d{1,4})?$/.test(texto)) throw new Error("Indica una cantidad válida con un máximo de cuatro decimales.");
    const [entero, decimal = ""] = texto.split(".");
    const unidades = Number(entero) * 10000 + Number(decimal.padEnd(4, "0"));
    if (!Number.isSafeInteger(unidades) || unidades > 9999999999) throw new Error("La cantidad supera el límite permitido.");
    return unidades;
}

function decimalLoteCierre(unidades) {
    const valor = Number(unidades);
    const signo = valor < 0 ? "-" : "";
    const absoluto = Math.abs(valor);
    return `${signo}${Math.floor(absoluto / 10000)}.${String(absoluto % 10000).padStart(4, "0")}`;
}

function decimalLoteCierreConSigno(unidades) {
    const valor = Number(unidades) || 0;
    if (valor < 0) return `-${decimalLoteCierre(Math.abs(valor))}`;
    return decimalLoteCierre(valor);
}

function unidadesLoteCierreConSigno(valor) {
    const texto = String(valor ?? "").trim().replace(",", ".");
    const negativo = texto.startsWith("-");
    const absoluto = unidadesLoteCierre(negativo ? texto.slice(1) : texto);
    return negativo ? -absoluto : absoluto;
}

function iniciarBorradorLotesCierrePhp(lotes) {
    borradorLotesCierrePhp.originales = lotes.map(lote => ({ ...lote }));
    borradorLotesCierrePhp.operaciones = [];
    cierreSemanalPhp.lotes = lotes.map(lote => ({ ...lote, finalizarPendiente: false }));
}

function solicitarFinalizarLoteCierrePhp(lote) {
    if (borradorLotesCierrePhp.guardando || !lote || lote.finalizarPendiente) return;
    const restante = unidadesLoteCierre(lote.cubicaje) - unidadesLoteCierre(lote.consumido);
    if (restante !== 0) {
        alert("El lote solo se puede finalizar cuando el restante es cero.");
        return;
    }
    lote.finalizarPendiente = true;
    borradorLotesCierrePhp.operaciones.push({ tipo: "finalizar", origen_id: Number(lote.id) });
    pintarLotesCierrePhp();
}

function aplicarReasignacionLoteCierrePhp(tipo, origenId, destinoId, valor) {
    if (borradorLotesCierrePhp.guardando) throw new Error("Espera a que terminen de guardarse los cambios.");
    if (!["consumo", "recibir_consumo"].includes(tipo)) throw new Error("Operación no válida.");
    const actual = cierreSemanalPhp.lotes.find(lote => Number(lote.id) === Number(origenId));
    const otro = cierreSemanalPhp.lotes.find(lote => Number(lote.id) === Number(destinoId));
    const origen = tipo === "consumo" ? actual : otro;
    const destino = tipo === "consumo" ? otro : actual;
    if (!origen || !destino || origen === destino) throw new Error("Selecciona otro lote de destino.");
    const cantidad = unidadesLoteCierre(valor);
    if (cantidad <= 0) throw new Error("La cantidad debe ser mayor que cero.");
    const desde = unidadesLoteCierre(origen.consumido);
    const hasta = unidadesLoteCierre(destino.consumido);
    if (cantidad > desde) throw new Error("No puedes reasignar más consumo del registrado en el lote de origen.");
    if (hasta + cantidad > unidadesLoteCierre(destino.cubicaje)) throw new Error("El consumo dejaría el restante del lote receptor en negativo.");
    if (hasta + cantidad > 9999999999) throw new Error("El lote de destino superaría el límite permitido.");
    origen.consumido = decimalLoteCierre(desde - cantidad);
    destino.consumido = decimalLoteCierre(hasta + cantidad);
    borradorLotesCierrePhp.operaciones.push({ tipo: "consumo", origen_id: Number(origen.id), destino_id: Number(destino.id), cantidad: decimalLoteCierre(cantidad) });
    console.info("[cierre-semanal PHP] cambio en memoria", borradorLotesCierrePhp.operaciones.at(-1));
}

function aplicarSalidaLoteCierrePhp(tipo, id, valor, codigo = "", ubicacionId = "") {
    if (borradorLotesCierrePhp.guardando) throw new Error("Espera a que terminen de guardarse los cambios.");
    if (!["procesado", "desperdicio"].includes(tipo)) throw new Error("Operación no válida.");
    const lote = cierreSemanalPhp.lotes.find(l => Number(l.id) === Number(id));
    const cantidad = tipo === "desperdicio" ? unidadesLoteCierreConSigno(valor) : unidadesLoteCierre(valor);
    if (!lote || (tipo === "desperdicio" ? cantidad === 0 : cantidad <= 0)) throw new Error("Indica un lote y una cantidad válida.");
    const consumido = unidadesLoteCierre(lote.consumido);
    const cubicaje = unidadesLoteCierre(lote.cubicaje);
    if (tipo === "desperdicio") {
        if (cantidad === 0 || consumido + cantidad !== cubicaje) throw new Error("A desperdicio debe enviarse todo el restante para dejarlo a cero.");
    } else if (cantidad <= 0 || consumido + cantidad > cubicaje) throw new Error("La cantidad supera el restante del lote.");
    codigo = codigo.trim();
    const ubicacion = Number(ubicacionId || 0);
    if (tipo === "procesado" && (!Number.isInteger(ubicacion) || ubicacion < 1)) throw new Error("Selecciona una ubicación.");
    if (tipo === "procesado" && (!codigo || codigo.length > 60)) throw new Error("Indica el nombre del lote de destino (máximo 60 caracteres).");
    lote.consumido = decimalLoteCierre(consumido + cantidad);
    borradorLotesCierrePhp.operaciones.push({ tipo, origen_id: Number(lote.id), cantidad: decimalLoteCierre(cantidad), ...(tipo === "procesado" ? { codigo_destino: codigo, ubicacion_id: ubicacion } : {}) });
}

function rellenarLotesProcesadoPorUbicacion(select, input) {
    const ubicacionId = Number(select?.value || 0);
    const datalist = input ? document.getElementById(input.getAttribute("list")) : null;
    if (!datalist) return;
    datalist.replaceChildren();
    cierreSemanalPhp.opcionesProcesado.lotes
        .filter(lote => !ubicacionId || Number(lote.ubicacion_id || 0) === ubicacionId)
        .forEach(lote => {
            const opcion = elementoCierrePhp("option", "", `${lote.codigo} (ALMACENADO)`);
            opcion.value = lote.codigo;
            datalist.appendChild(opcion);
        });
}

function crearAccionesLoteCierrePhp(lote) {
    const acciones = elementoCierrePhp("div", "cierre-semanal-lote-acciones mt-3");
    for (const tipo of ["consumo", "recibir_consumo"]) {
        const entrada = tipo === "recibir_consumo";
        const formulario = elementoCierrePhp("details", "cierre-semanal-lote-form cierre-semanal-lote-form-full");
        formulario.dataset.cierrePhpTipo = tipo;
        formulario.appendChild(elementoCierrePhp("summary", "cierre-semanal-operacion-titulo", entrada ? "Reasignar consumo desde otro lote" : "Reasignar consumo a otro lote"));
        const cuerpo = elementoCierrePhp("div", "cierre-semanal-operacion-cuerpo");
        const selector = elementoCierrePhp("select", "form-select form-select-sm");
        selector.setAttribute("aria-label", `Lote ${entrada ? "origen" : "destino"} para reasignar consumo ${entrada ? "a" : "de"} ${lote.codigo}`);
        const vacio = elementoCierrePhp("option", "", entrada ? "Seleccione lote origen..." : "Seleccione lote destino...");
        vacio.value = "";
        selector.appendChild(vacio);
        // La lista ya está en memoria: ninguna consulta por tarjeta o selector.
        for (const destino of cierreSemanalPhp.lotes) {
            if (Number(destino.id) === Number(lote.id)) continue;
            const opcion = elementoCierrePhp("option", "", destino.codigo);
            opcion.value = String(destino.id);
            selector.appendChild(opcion);
        }
        selector.disabled = borradorLotesCierrePhp.guardando;
        cuerpo.appendChild(selector);
        const linea = elementoCierrePhp("div", "cierre-semanal-lote-inline");
        const input = elementoCierrePhp("input", "form-control form-control-sm");
        input.type = "number";
        input.min = "0.0001";
        input.step = "0.0001";
        input.setAttribute("aria-label", `M3 de consumo ${entrada ? "a recibir en" : "a ceder desde"} ${lote.codigo}`);
        const consumido = unidadesLoteCierre(lote.consumido);
        const cubicaje = unidadesLoteCierre(lote.cubicaje);
        const maximo = entrada ? Math.max(0, cubicaje - consumido) : consumido;
        input.max = decimalLoteCierre(maximo);
        input.value = decimalLoteCierre(entrada ? maximo : Math.max(0, consumido - cubicaje));
        input.disabled = borradorLotesCierrePhp.guardando;
        linea.appendChild(input);
        const boton = elementoCierrePhp("button", "btn btn-sm btn-outline-primary", entrada ? "Recibir consumo" : "Reasignar consumo");
        boton.type = "button";
        boton.dataset.cierrePhpReasignar = tipo;
        boton.disabled = borradorLotesCierrePhp.guardando || maximo <= 0 || cierreSemanalPhp.lotes.length < 2;
        linea.appendChild(boton);
        cuerpo.appendChild(linea);
        formulario.appendChild(cuerpo);
        acciones.appendChild(formulario);
    }
    for (const tipo of ["procesado", "desperdicio"]) {
        const titulo = tipo === "procesado" ? "Enviar a procesar" : "Enviar a desperdicio";
        const formulario = elementoCierrePhp("details", "cierre-semanal-lote-form cierre-semanal-lote-form-full");
        formulario.appendChild(elementoCierrePhp("summary", "cierre-semanal-operacion-titulo", titulo));
        const cuerpo = elementoCierrePhp("div", "cierre-semanal-operacion-cuerpo");
        if (tipo === "procesado") {
            const ubicacion = elementoCierrePhp("select", "form-select form-select-sm");
            ubicacion.dataset.cierreProcesadoUbicacion = lote.id;
            ubicacion.appendChild(elementoCierrePhp("option", "", "Seleccione ubicación..."));
            cierreSemanalPhp.opcionesProcesado.ubicaciones.forEach(item => {
                const opcion = elementoCierrePhp("option", "", item.descripcion);
                opcion.value = String(item.id);
                ubicacion.appendChild(opcion);
            });
            cuerpo.appendChild(ubicacion);
            const codigo = elementoCierrePhp("input", "form-control form-control-sm");
            codigo.type = "text";
            codigo.maxLength = 60;
            codigo.placeholder = "Nombre del lote de destino";
            codigo.setAttribute("list", `cierre-procesado-lotes-${lote.id}`);
            codigo.dataset.cierreProcesadoCodigo = lote.id;
            codigo.setAttribute("aria-label", codigo.placeholder);
            codigo.disabled = borradorLotesCierrePhp.guardando;
            cuerpo.appendChild(codigo);
            const datalist = elementoCierrePhp("datalist", "");
            datalist.id = `cierre-procesado-lotes-${lote.id}`;
            cuerpo.appendChild(datalist);
        }
        const restante = unidadesLoteCierre(lote.cubicaje) - unidadesLoteCierre(lote.consumido);
        const cantidad = elementoCierrePhp("input", "form-control form-control-sm");
        cantidad.type = "number";
        cantidad.step = "0.0001";
        if (tipo !== "desperdicio") cantidad.min = "0.0001";
        cantidad.value = decimalLoteCierreConSigno(restante);
        if (tipo === "procesado" && restante > 0) cantidad.max = decimalLoteCierre(restante);
        cantidad.setAttribute("aria-label", `M3 a ${tipo}`);
        cantidad.disabled = borradorLotesCierrePhp.guardando;
        cuerpo.appendChild(cantidad);
        const boton = elementoCierrePhp("button", `btn btn-sm btn-outline-${tipo === "procesado" ? "success" : "danger"}`, titulo);
        boton.type = "button";
        boton.dataset.cierrePhpSalida = tipo;
        boton.disabled = borradorLotesCierrePhp.guardando || restante === 0;
        cuerpo.appendChild(boton);
        formulario.appendChild(cuerpo);
        acciones.appendChild(formulario);
    }
    return acciones;
}

function pintarCambiosLotesCierrePhp() {
    const operaciones = borradorLotesCierrePhp.operaciones;
    const nota = document.getElementById("cierre-semanal-nota-acciones");
    if (nota) {
        nota.replaceChildren();
        nota.appendChild(elementoCierrePhp("div", "", operaciones.length ? `${operaciones.length} cambio(s) pendiente(s). Pulsa Actualizar cambios para guardarlos.` : "No hay cambios pendientes."));
        if (operaciones.length) {
            const lista = elementoCierrePhp("ol", "mb-0");
            const codigo = id => cierreSemanalPhp.lotes.find(lote => Number(lote.id) === id)?.codigo || id;
            operaciones.forEach(op => lista.appendChild(elementoCierrePhp("li", "", op.tipo === "finalizar"
                ? `Finalizar lote ${codigo(op.origen_id)}.`
                : (op.tipo === "consumo"
                    ? `Consumo: ${formatearNumeroFabricacion(op.cantidad)} m³ de ${codigo(op.origen_id)} a ${codigo(op.destino_id)}.`
                    : `Enviar ${formatearNumeroFabricacion(op.cantidad)} m³ de ${codigo(op.origen_id)} a ${op.tipo}${op.codigo_destino ? ` (${op.codigo_destino})` : ""}.`))));
            nota.appendChild(lista);
        }
    }
    for (const id of ["cierre-semanal-reset", "cierre-semanal-cerrar"]) {
        const boton = document.getElementById(id);
        if (boton) boton.disabled = borradorLotesCierrePhp.guardando || !operaciones.length;
    }
}

function restablecerLotesCierrePhp() {
    if (borradorLotesCierrePhp.guardando) return;
    iniciarBorradorLotesCierrePhp(borradorLotesCierrePhp.originales);
    pintarLotesCierrePhp();
}

function prepararEventosLotesCierrePhp() {
    const lista = document.getElementById("cierre-semanal-lotes");
    lista?.addEventListener("change", event => {
        const select = event.target.closest("[data-cierre-procesado-ubicacion]");
        if (!select) return;
        const input = select.closest("details")?.querySelector("[data-cierre-procesado-codigo]");
        rellenarLotesProcesadoPorUbicacion(select, input);
    });
    lista?.addEventListener("click", event => {
        const input = event.target.closest("[data-cierre-procesado-codigo]");
        if (!input) return;
        const select = input.closest("details")?.querySelector("[data-cierre-procesado-ubicacion]");
        rellenarLotesProcesadoPorUbicacion(select, input);
        input.showPicker?.();
    });
    lista?.addEventListener("click", event => {
        if (!cierreSemanalPhp.activo) return;
        const boton = event.target.closest("[data-cierre-php-reasignar], [data-cierre-php-salida]");
        if (!boton) return;
        const tarjeta = boton.closest("[data-lote-id]");
        const formulario = boton.closest("details");
        try {
            if (boton.dataset.cierrePhpSalida) {
                aplicarSalidaLoteCierrePhp(boton.dataset.cierrePhpSalida, tarjeta.dataset.loteId, formulario.querySelector('input[type="number"]').value, formulario.querySelector('input[type="text"]')?.value || "", formulario.querySelector('[data-cierre-procesado-ubicacion]')?.value || "");
            } else {
                aplicarReasignacionLoteCierrePhp(boton.dataset.cierrePhpReasignar, tarjeta.dataset.loteId, formulario.querySelector("select").value, formulario.querySelector("input").value);
            }
            pintarLotesCierrePhp();
        } catch (error) {
            alert(error.message);
        }
    });
}

async function confirmarLotesCierrePhp() {
    if (borradorLotesCierrePhp.guardando || !borradorLotesCierrePhp.operaciones.length) return;
    const ids = new Set(borradorLotesCierrePhp.operaciones.flatMap(op => [op.origen_id, op.destino_id]));
    const payload = {
        lotes_originales: borradorLotesCierrePhp.originales.filter(lote => ids.has(Number(lote.id))).map(({ id, cubicaje, consumido }) => ({ id: Number(id), cubicaje, consumido })),
        operaciones: borradorLotesCierrePhp.operaciones.map(op => ({ ...op })),
    };
    borradorLotesCierrePhp.guardando = true;
    pintarLotesCierrePhp();
    try {
        const url = "./api/cierre_semanal_lotes.php";
        console.info("[php] POST", url, payload);
        const token = window.SharedAuthToken?.getToken?.();
        const respuesta = await fetch(url, {
            method: "POST", credentials: "same-origin",
            headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            body: JSON.stringify(payload),
        });
        const datos = await respuesta.json();
        console.info("[php] POST respuesta", url, datos);
        if (!respuesta.ok || !datos.ok || !Array.isArray(datos.lotes)) throw new Error(datos.error || "No se pudieron guardar los cambios.");
        const recarga = await GET("./api/lotes_botas.php");
        if (!recarga?.ok || !Array.isArray(recarga.lotes)) {
            throw new Error("Los cambios se guardaron, pero no se pudo recargar la lista de lotes.");
        }
        iniciarBorradorLotesCierrePhp(recarga.lotes);
        console.info("[cierre-semanal PHP] cambios confirmados", datos);
    } catch (error) {
        console.error("[cierre-semanal PHP] error al guardar", error);
        alert(`${error.message} Los cambios siguen en memoria.`);
    } finally {
        borradorLotesCierrePhp.guardando = false;
        if (cierreSemanalPhp.activo) pintarLotesCierrePhp();
    }
}
