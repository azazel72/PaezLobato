<?php
declare(strict_types=1);
require_once __DIR__ . '/../lib/database.php';

function listarResumenDestino(PDO $pdo): array
{
    $crearGrupo = static function (?array $pedido): array {
        return [
            'pedidoId' => $pedido ? (int)$pedido['id'] : 0,
            'activo' => !$pedido || (int)$pedido['estado'] === 2,
            'pedidoNumero' => $pedido ? ($pedido['numero'] ?: $pedido['descripcion']) : 'ANÓNIMO',
            'cliente' => $pedido['cliente'] ?? 'Sin pedido o sin destino',
            'pedidoDestino' => $pedido['destino'] ?? 'ANONIMO',
            'solicitadas' => $pedido ? (int)$pedido['cantidad'] : null,
            'fabricadas' => $pedido ? (int)$pedido['cantidad_fabricada'] : 0,
            'enviadasCliente' => 0, 'enviadasEnvinar' => 0, 'envinadas' => 0, 'codigos' => [], 'botas' => [],
        ];
    };
    $grupos = [0 => $crearGrupo(null)];
    $pedidos = fabricacionProcedimientoFilas($pdo, 'pa_destino_pedidos');
    foreach ($pedidos as $pedido) {
        if (in_array(strtoupper(trim($pedido['destino'] ?? '')), ['C','CLIENTE','E','ENVINADO'], true)) {
            $grupos[(int)$pedido['id']] = $crearGrupo($pedido);
        }
    }
    $filas = fabricacionProcedimientoFilas($pdo, 'pa_destino_botas');
    foreach ($filas as $fila) {
        $anonimo = (int)$fila['pedido_id'] === 0;
        $id = $anonimo ? 0 : (int)$fila['pedido_id'];
        if (!isset($grupos[$id])) continue;
        if ($anonimo) $grupos[0]['fabricadas']++;
        $estado = (int)$fila['estado'];
        if ($estado === 6) $grupos[$id]['enviadasCliente']++;
        if ($estado === 4) $grupos[$id]['envinadas']++;
        if (in_array($estado, [3,4], true)) $grupos[$id]['enviadasEnvinar']++;
        if (!in_array($estado, [1,2], true)) continue;
        $grupos[$id]['codigos'][] = $fila['codigo'];
        $grupos[$id]['botas'][] = [
            'id' => (int)$fila['id'], 'codigo' => $fila['codigo'],
            'fabricacion_semanal_id' => $fila['fabricacion_semanal_id'] === null ? null : (int)$fila['fabricacion_semanal_id'],
            'pedido_id' => (int)$fila['pedido_id'],
            'pedido_fabricacion_id' => (int)$fila['pedido_fabricacion_id'],
        ];
    }
    return ['ok' => true, 'pedidos' => array_values($grupos)];
}
