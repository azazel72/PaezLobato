'use strict';

function aplicarEnvioRestanteCierrePhp(origenId, destinoId, valor) {
    if (borradorLotesCierrePhp.guardando) throw new Error('Espera a que terminen de guardarse los cambios.');
    const origen = cierreSemanalPhp.lotes.find(lote => Number(lote.id) === Number(origenId));
    const destino = cierreSemanalPhp.lotes.find(lote => Number(lote.id) === Number(destinoId));
    if (!origen || !destino || origen === destino) throw new Error('Selecciona otro lote de destino.');
    if (origen.finalizarPendiente || destino.finalizarPendiente) throw new Error('No se puede modificar un lote pendiente de finalizar.');
    const cantidad = unidadesLoteCierre(valor);
    const cubicaje = unidadesLoteCierre(origen.cubicaje);
    const restante = cubicaje - unidadesLoteCierre(origen.consumido);
    if (cantidad <= 0 || cantidad > restante) throw new Error('Indica una cantidad positiva que no supere el restante del origen.');
    const cubicajeDestino = unidadesLoteCierre(destino.cubicaje) + cantidad;
    if (cubicajeDestino > 9999999999) throw new Error('El lote de destino superaría el cubicaje permitido.');
    origen.cubicaje = decimalLoteCierre(cubicaje - cantidad);
    destino.cubicaje = decimalLoteCierre(cubicajeDestino);
    borradorLotesCierrePhp.operaciones.push({ tipo: 'restante', origen_id: Number(origen.id), destino_id: Number(destino.id), cantidad: decimalLoteCierre(cantidad) });
}

function crearAccionEnviarRestanteCierrePhp(lote) {
    const restante = unidadesLoteCierre(lote.cubicaje) - unidadesLoteCierre(lote.consumido);
    if (restante === 0 || lote.finalizarPendiente) return null;
    const form = elementoCierrePhp('details', 'cierre-semanal-lote-form cierre-semanal-lote-form-full');
    form.appendChild(elementoCierrePhp('summary', 'cierre-semanal-operacion-titulo', 'Enviar restante'));
    const body = elementoCierrePhp('div', 'cierre-semanal-operacion-cuerpo');
    const tipo = elementoCierrePhp('select', 'form-select form-select-sm');
    tipo.dataset.cierreEnvioTipo = '1';
    tipo.setAttribute('aria-label', 'Destino del restante');
    for (const [value, label] of [['restante', 'A otro lote'], ['procesado', 'A almacenado'], ['desperdicio', 'A desperdicio']]) {
        const option = elementoCierrePhp('option', '', label); option.value = value;
        option.disabled = restante < 0 && value !== 'desperdicio'; tipo.appendChild(option);
    }
    tipo.value = restante > 0 ? 'restante' : 'desperdicio';
    tipo.disabled = borradorLotesCierrePhp.guardando; body.appendChild(tipo);
    const select = elementoCierrePhp('select', 'form-select form-select-sm');
    select.dataset.cierreEnvioLote = '1';
    select.setAttribute('aria-label', `Lote destino del restante de ${lote.codigo}`);
    const empty = elementoCierrePhp('option', '', 'Seleccione lote destino...'); empty.value = ''; select.appendChild(empty);
    for (const destino of cierreSemanalPhp.lotes) {
        if (Number(destino.id) === Number(lote.id) || destino.finalizarPendiente) continue;
        const option = elementoCierrePhp('option', '', etiquetaLoteComboCierrePhp(destino));
        option.value = String(destino.id); select.appendChild(option);
    }
    select.disabled = borradorLotesCierrePhp.guardando;
    const input = elementoCierrePhp('input', 'form-control form-control-sm');
    input.dataset.cierreEnvioCantidad = '1';
    input.type = 'number'; input.min = '0.0001'; input.step = '0.0001';
    input.max = input.value = decimalLoteCierre(restante);
    input.setAttribute('aria-label', 'M³ de restante a enviar');
    input.disabled = borradorLotesCierrePhp.guardando;
    const inline = elementoCierrePhp('div', 'cierre-semanal-lote-inline'); inline.appendChild(input); body.appendChild(inline);
    const button = elementoCierrePhp('button', 'btn btn-sm btn-outline-primary', 'Enviar restante');
    button.type = 'button'; button.dataset.cierrePhpRestante = '1'; button.disabled = true;
    inline.appendChild(button);
    body.appendChild(select);
    const procesado = elementoCierrePhp('div', 'cierre-semanal-operacion-cuerpo mt-0');
    const ubicacion = elementoCierrePhp('select', 'form-select form-select-sm');
    ubicacion.dataset.cierreProcesadoUbicacion = lote.id;
    ubicacion.setAttribute('aria-label', 'Ubicación del lote almacenado');
    const sinUbicacion = elementoCierrePhp('option', '', 'Seleccione ubicación...'); sinUbicacion.value = ''; ubicacion.appendChild(sinUbicacion);
    for (const item of cierreSemanalPhp.opcionesProcesado.ubicaciones) {
        const option = elementoCierrePhp('option', '', item.descripcion); option.value = String(item.id); ubicacion.appendChild(option);
    }
    ubicacion.disabled = borradorLotesCierrePhp.guardando; procesado.appendChild(ubicacion);
    const codigo = elementoCierrePhp('input', 'form-control form-control-sm');
    codigo.type = 'text'; codigo.maxLength = 60; codigo.placeholder = 'Nombre del lote de destino';
    codigo.dataset.cierreProcesadoCodigo = lote.id;
    codigo.setAttribute('aria-label', codigo.placeholder);
    codigo.setAttribute('list', `cierre-procesado-lotes-${lote.id}`);
    codigo.disabled = borradorLotesCierrePhp.guardando; procesado.appendChild(codigo);
    const datalist = elementoCierrePhp('datalist', ''); datalist.id = `cierre-procesado-lotes-${lote.id}`; procesado.appendChild(datalist);
    body.appendChild(procesado);
    const actualizar = () => {
        const desperdicio = tipo.value === 'desperdicio';
        select.hidden = tipo.value !== 'restante';
        procesado.hidden = tipo.value !== 'procesado';
        input.readOnly = desperdicio;
        input.min = desperdicio ? decimalLoteCierreConSigno(restante) : '0.0001';
        input.max = input.value = decimalLoteCierreConSigno(restante);
        button.textContent = { restante: 'Enviar a otro lote', procesado: 'Enviar a almacenado', desperdicio: 'Enviar a desperdicio' }[tipo.value];
        button.disabled = borradorLotesCierrePhp.guardando || (tipo.value === 'restante' && !select.value);
    };
    tipo.addEventListener('change', actualizar);
    select.addEventListener('change', () => { button.disabled = borradorLotesCierrePhp.guardando || !select.value; });
    actualizar();
    form.appendChild(body); return form;
}

function prepararEventosEnviarRestanteCierrePhp() {
    document.getElementById('cierre-semanal-lotes')?.addEventListener('click', event => {
        if (!cierreSemanalPhp.activo) return;
        const button = event.target.closest('[data-cierre-php-restante]');
        if (!button || button.disabled) return;
        const form = button.closest('details');
        try {
            const origenId = button.closest('[data-lote-id]').dataset.loteId;
            const tipo = form.querySelector('[data-cierre-envio-tipo]').value;
            const cantidad = form.querySelector('[data-cierre-envio-cantidad]').value;
            if (tipo === 'restante') aplicarEnvioRestanteCierrePhp(origenId, form.querySelector('[data-cierre-envio-lote]').value, cantidad);
            else if (tipo === 'procesado' || tipo === 'desperdicio') aplicarSalidaLoteCierrePhp(tipo, origenId, cantidad, form.querySelector('[data-cierre-procesado-codigo]').value, form.querySelector('[data-cierre-procesado-ubicacion]').value);
            else throw new Error('Selecciona un destino válido.');
            pintarLotesCierrePhp();
        } catch (error) { alert(error.message); }
    });
}
