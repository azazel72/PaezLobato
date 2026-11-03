'use strict';
const trasladoBotasPedido = { pedidos: [], guardando: false };

function codigosTrasladoBotas(texto) {
    return String(texto || '').split(/[\s,;|]+/).filter(Boolean);
}

function prepararEventosMoverBotasPedido() {
    const modal = document.getElementById('modalMoverBotasPedido');
    const form = document.getElementById('mover-botas-form');
    document.getElementById('destino-lista')?.addEventListener('click', event => {
        if (!event.target.closest('[data-mover-botas-pedido]')) return;
        event.preventDefault(); event.stopPropagation(); abrirModalMoverBotasPedido();
    });
    modal?.addEventListener('hide.bs.modal', event => { if (trasladoBotasPedido.guardando) event.preventDefault(); });
    document.getElementById('mover-botas-origen')?.addEventListener('change', actualizarOrigenTrasladoBotas);
    document.getElementById('mover-botas-anadir')?.addEventListener('click', anadirCodigoTrasladoBotas);
    document.getElementById('mover-botas-disponibles')?.addEventListener('click', event => {
        const boton = event.target.closest('[data-codigo-traslado]');
        if (!boton || trasladoBotasPedido.guardando) return;
        document.getElementById('mover-botas-codigo').value = boton.dataset.codigoTraslado;
        anadirCodigoTrasladoBotas();
    });
    const scan = document.getElementById('mover-botas-codigo');
    scan?.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); anadirCodigoTrasladoBotas(); } });
    prepararAutoinsercionCodigo(scan, anadirCodigoTrasladoBotas);
    form?.addEventListener('submit', confirmarTrasladoBotasPedido);
}

async function abrirModalMoverBotasPedido() {
    const form = document.getElementById('mover-botas-form'); form.reset();
    const status = document.getElementById('mover-botas-estado'); status.textContent = 'Cargando pedidos...';
    const confirmar = document.getElementById('mover-botas-confirmar'); confirmar.disabled = true;
    bootstrap.Modal.getOrCreateInstance(document.getElementById('modalMoverBotasPedido')).show();
    try {
        const data = await GET('../api/terminal/destino_resumen.php');
        if (!data?.ok) throw new Error('No se pudieron cargar los pedidos.');
        trasladoBotasPedido.pedidos = data.pedidos;
        const origen = document.getElementById('mover-botas-origen'); origen.replaceChildren();
        for (const grupo of data.pedidos) {
            if (!grupo.codigos.length) continue;
            const option = document.createElement('option'); option.value = grupo.pedidoId;
            option.textContent = `${grupo.pedidoNumero} (${grupo.codigos.length} botas disponibles)`; origen.append(option);
        }
        const disponibles = data.pedidos.filter(grupo => grupo.codigos.length > 0);
        origen.value = String(disponibles.find(grupo => !grupo.pedidoId)?.pedidoId ?? disponibles[0]?.pedidoId ?? '');
        actualizarOrigenTrasladoBotas();
        status.textContent = disponibles.length ? '' : 'No hay pedidos con botas disponibles para trasladar.';
        confirmar.disabled = !disponibles.length;
    } catch (error) { status.textContent = error.message; }
}

function actualizarOrigenTrasladoBotas() {
    const origen = document.getElementById('mover-botas-origen').value;
    const destino = document.getElementById('mover-botas-destino'); destino.replaceChildren();
    const empty = document.createElement('option'); empty.value = ''; empty.textContent = 'Seleccione pedido destino...'; destino.append(empty);
    for (const grupo of trasladoBotasPedido.pedidos) {
        if (String(grupo.pedidoId) === origen || !grupo.activo) continue;
        const option = document.createElement('option'); option.value = grupo.pedidoId; option.textContent = grupo.pedidoNumero; destino.append(option);
    }
    document.getElementById('mover-botas-codigos').value = '';
    document.getElementById('mover-botas-codigo').value = '';
    const grupo = trasladoBotasPedido.pedidos.find(item => String(item.pedidoId) === origen);
    const list = document.getElementById('mover-botas-disponibles'); list.replaceChildren();
    document.getElementById('mover-botas-disponibles-panel').open = false;
    for (const codigo of grupo?.codigos || []) {
        const boton = document.createElement('button'); boton.type = 'button';
        boton.className = 'list-group-item list-group-item-action';
        boton.dataset.codigoTraslado = codigo; boton.textContent = codigo; list.append(boton);
    }
    document.getElementById('mover-botas-disponibles-total').textContent = `Botas disponibles (${grupo?.codigos.length || 0})`;
}

function anadirCodigoTrasladoBotas() {
    const input = document.getElementById('mover-botas-codigo');
    const codigo = input.value.trim(); if (!codigo) return;
    const origen = document.getElementById('mover-botas-origen').value;
    const grupo = trasladoBotasPedido.pedidos.find(item => String(item.pedidoId) === origen);
    const status = document.getElementById('mover-botas-estado');
    if (!grupo?.codigos.includes(codigo)) { status.textContent = 'El código no está disponible en el pedido origen.'; return; }
    const area = document.getElementById('mover-botas-codigos'); const codigos = codigosTrasladoBotas(area.value);
    if (codigos.includes(codigo)) { status.textContent = 'Ese código ya está añadido.'; return; }
    area.value = [...codigos,codigo].join('\n'); input.value = ''; status.textContent = ''; input.focus();
}

async function confirmarTrasladoBotasPedido(event) {
    event.preventDefault(); if (trasladoBotasPedido.guardando) return;
    const form = event.currentTarget;
    const status = document.getElementById('mover-botas-estado');
    const origen = document.getElementById('mover-botas-origen').value;
    const destino = document.getElementById('mover-botas-destino').value;
    const codigos = codigosTrasladoBotas(document.getElementById('mover-botas-codigos').value);
    const grupo = trasladoBotasPedido.pedidos.find(item => String(item.pedidoId) === origen);
    if (destino === '' || destino === origen || !codigos.length || codigos.length > 500 || new Set(codigos).size !== codigos.length || codigos.some(codigo => !grupo?.codigos.includes(codigo))) {
        status.textContent = 'Selecciona otro destino e indica entre 1 y 500 códigos distintos disponibles en el origen.'; return;
    }
    const payload = { origen_id:Number(origen), destino_id:Number(destino), codigos };
    trasladoBotasPedido.guardando = true; status.textContent = 'Guardando traslado...';
    const controls = [...form.querySelectorAll('input,select,textarea,button')]; controls.forEach(control => { control.disabled = true; });
    try {
        const response = await fetch('../api/terminal/trasladar_botas_pedido.php',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
        const data = await response.json(); if (!response.ok || !data.ok) throw new Error(data.error || 'No se pudo confirmar el traslado.');
        trasladoBotasPedido.guardando = false;
        bootstrap.Modal.getOrCreateInstance(document.getElementById('modalMoverBotasPedido')).hide();
        await cargarResumenPedidosDestino();
        alert(`${data.cantidad} bota(s) correctamente transferida(s).`);
    } catch (error) { status.textContent = error.message; }
    finally { trasladoBotasPedido.guardando = false; controls.forEach(control => { control.disabled = false; }); }
}
