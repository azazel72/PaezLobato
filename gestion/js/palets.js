'use strict';

const GestionPalets = {
    open() { return GestionOperaciones.open('palets', 'Palets', { icon: 'boxes', refs: ['linea_entrada_id', 'tipo_producto_id', 'material_id', 'ubicacion_id', 'estado'], form(form, controls, row) { controls.linea_entrada_id.addEventListener('change', () => { const source = windows.get('palets'); const line = source?.lookups.lineas_entrada?.find(item => String(item.value) === controls.linea_entrada_id.value)?.data; controls.tipo_producto_id.value = line?.tipo_producto_id ?? ''; controls.material_id.value = line?.material_id ?? ''; }); } }); },
};
