<?php
declare(strict_types=1);
function gMeses(): array { return ['ene' => 'enero', 'feb' => 'febrero', 'mar' => 'marzo', 'abr' => 'abril', 'may' => 'mayo', 'jun' => 'junio', 'jul' => 'julio', 'ago' => 'agosto', 'sep' => 'septiembre', 'oct' => 'octubre', 'nov' => 'noviembre', 'dic' => 'diciembre']; }
function gPlanificacionCatalogo(): array
{
    $year = ['año' => gCampo('Año', 'number', ['required' => true, 'min' => 1970, 'maxValue' => 2155])];
    $totals = ['total_pactados' => gNumero('Pactados'), 'total_descontar' => gNumero('A descontar')];
    $c = [
        'plan_camiones' => ['title' => 'Plan de camiones', 'fields' => $year + ['proveedor_id' => gReferencia('Proveedor', 'proveedores', true)] + $totals],
        'plan_material' => ['title' => 'Plan de materiales', 'fields' => $year + ['tipo_material' => gCampo('Material', 'select', ['required' => true, 'options' => ['FLEJE' => 'Fleje', 'REMACHES' => 'Remaches', 'PUNTAFITAS' => 'Puntafitas']])] + $totals],
        'plan_facturacion' => ['title' => 'Plan de facturación', 'fields' => $year],
    ];
    foreach (gMeses() as $short => $month) {
        $c['plan_camiones']['fields'][$short . '_previsto'] = gNumero(ucfirst($month) . ' · Previsto');
        $c['plan_camiones']['fields'][$short . '_confirmado'] = gNumero(ucfirst($month) . ' · Confirmado');
        $c['plan_material']['fields'][$month] = gNumero(ucfirst($month), 2, 0, 99999999.99);
        $c['plan_facturacion']['fields'][$month] = gNumero(ucfirst($month) . ' (€)', 2, 0, 9999999999999.99);
    }
    foreach (['plan_camiones', 'plan_material'] as $table) {
        $c[$table]['computed']['total_previstos'] = 'COALESCE(total_pactados,0) - COALESCE(total_descontar,0)';
        $terms = array_map(fn($short, $month) => 'COALESCE(`' . ($table === 'plan_camiones' ? $short . '_confirmado' : $month) . '`,0)', array_keys(gMeses()), array_values(gMeses()));
        $c[$table]['computed']['total_entregados'] = implode(' + ', $terms);
        $c[$table]['fields'] += ['total_previstos' => gNumero('Total previsto', 2) + ['readonly' => true], 'total_entregados' => gNumero('Total entregado', 2) + ['readonly' => true]];
    }
    return $c;
}
