'use strict';

let pedidosResumenDestino = null;

function prepararFiltroPedidosDestino() {
    document.getElementById('destino-ocultar-sin-pendientes')?.addEventListener('change', pintarResumenPedidosDestino);
}

function pintarResumenPedidosDestino() {
    if (!pedidosResumenDestino) return;
    const lista = document.getElementById('destino-lista');
    const resumen = document.getElementById('destino-resumen');
    const ocultar = document.getElementById('destino-ocultar-sin-pendientes')?.checked;
    const visibles = pedidosResumenDestino.filter(grupo => !grupo.pedidoId || !ocultar || grupo.codigos.length > 0);
    lista.innerHTML = visibles.map(renderizarResumenPedidoDestino).join('') || '<div class="destino-productos-vacio">No hay pedidos con botas pendientes de destino.</div>';
    resumen.textContent = `${visibles.reduce((sum, grupo) => sum + grupo.codigos.length, 0)} botas pendientes de destino`;
}

async function cargarResumenPedidosDestino() {
    const lista = document.getElementById('destino-lista');
    const resumen = document.getElementById('destino-resumen');
    if (!lista || !resumen) return;
    pedidosResumenDestino = null;
    lista.innerHTML = '<div class="destino-productos-vacio">Cargando pedidos...</div>';
    resumen.textContent = '';
    try {
        const result = await GET('../api/terminal/destino_resumen.php');
        if (!result?.ok || !Array.isArray(result.pedidos)) throw new Error(result?.error || 'Respuesta no válida.');
        pedidosResumenDestino = result.pedidos;
        pintarResumenPedidosDestino();
    } catch (error) {
        console.error('No se pudo cargar Destino:', error);
        lista.innerHTML = '<div class="destino-productos-vacio">No se pudieron cargar los pedidos.</div>';
    }
}

function renderizarResumenPedidoDestino(grupo) {
    const escape = escapeHtmlDestinoProductos;
    const destino = String(grupo.pedidoDestino).trim().toUpperCase();
    const clase = !grupo.pedidoId ? 'anonimo' : (['C','CLIENTE'].includes(destino) ? 'cliente' : 'envinado');
    const boton = !grupo.pedidoId
        ? '<button type="button" class="btn btn-sm destino-pedido-accion" data-mover-botas-pedido="1" title="Mover botas entre pedidos" aria-label="Mover botas entre pedidos"><i class="bi bi-arrow-repeat" aria-hidden="true"></i></button>'
        : (grupo.codigos.length ? renderizarAccionPedidoDestino(grupo) : '');
    const cifras = grupo.pedidoId
        ? `Solicitadas: ${grupo.solicitadas ?? '—'} · Fabricadas: ${grupo.fabricadas} · ${clase === 'cliente' ? `Expedidas: ${grupo.enviadasCliente}` : `Envinadas: ${grupo.envinadas ?? 0}`}`
        : '';
    return `<details class="destino-pedido-card destino-pedido-card-${clase}">
        <summary class="destino-pedido-resumen">
            <div class="destino-pedido-resumen-main"><strong>${escape(grupo.pedidoNumero)}</strong><span>${escape(grupo.cliente || 'Sin cliente')}</span>${cifras ? `<span class="destino-pedido-cifras">${escape(cifras)}</span>` : ''}</div>
            <div class="destino-pedido-resumen-lateral"><div class="destino-pedido-resumen-total">${grupo.codigos.length} botas</div>${boton}</div>
        </summary>
        <div class="destino-pedido-codigos">${grupo.botas.length ? grupo.botas.map(bota => `<div class="destino-pedido-codigo">${escape(bota.codigo)}</div>`).join('') : '<div class="destino-productos-vacio">Sin botas pendientes de destino.</div>'}</div>
    </details>`;
}
