'use strict';

const GestionVistasOperaciones = {
    ambientes: GestionAmbiente, entradas: GestionEntradas, lineas_entrada: GestionLineasEntrada,
    entradas_flejes: GestionEntradasFlejes, analiticas: GestionAnaliticas, palets: GestionPalets,
    productos: GestionProductos, trazabilidad_procesado: GestionTrazabilidadProcesado,
    trazabilidad_fabricacion: GestionTrazabilidadFabricacion, trazabilidad_producto: GestionTrazabilidadProducto,
    consumos: GestionConsumos, a_consumos: GestionConsumosProducto, cubicaje: GestionCubicaje, planificacion_entradas: GestionPlanificacionEntradas,
    planificacion_pedidos: GestionPlanificacionPedidos, documentos_envinados: GestionDocumentosEnvinados,
};

document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => {
    const view = button.dataset.view;
    if (view === 'pedidos') void GestionPedidos.open();
    else if (view === 'fabricacion_semanal') void GestionFabricacion.open();
    else if (view === 'cuadrantes') void GestionCuadranteCompleto.open();
    else if (GestionListados.titles[view]) void GestionListados.open(view);
    else if (GestionVistasOperaciones[view]) void GestionVistasOperaciones[view].open();
    else void GestionCatalogo.open(view);
}));
