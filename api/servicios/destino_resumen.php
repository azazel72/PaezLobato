<?php
declare(strict_types=1);
require_once __DIR__ . '/../lib/database.php';

function listarResumenDestino(PDO $pdo): array
{
    $crearGrupo = static function (?array $pedido): array {
        return [
            'pedidoId' => $pedido ? (int)$pedido['id'] : 0,
            'pedidoNumero' => $pedido ? ($pedido['numero'] ?: $pedido['descripcion']) : 'ANÓNIMO',
            'cliente' => $pedido['cliente'] ?? 'Sin pedido o sin destino',
            'pedidoDestino' => $pedido['destino'] ?? 'ANONIMO',
            'solicitadas' => $pedido ? (int)$pedido['cantidad'] : null,
            'fabricadas' => $pedido ? (int)$pedido['cantidad_fabricada'] : 0,
            'enviadasCliente' => 0, 'enviadasEnvinar' => 0, 'envinadas' => 0, 'codigos' => [], 'botas' => [],
        ];
    };
    $grupos = [0 => $crearGrupo(null)];
    // Conservar los pedidos activos aunque ya no tengan botas pendientes de destino.
    $pedidos = $pdo->query("SELECT pe.*, c.nombre AS cliente FROM pedidos pe
        LEFT JOIN clientes c ON c.id = pe.cliente_id
        WHERE pe.is_deleted = 0 AND pe.estado = 2 ORDER BY pe.numero")->fetchAll();
    foreach ($pedidos as $pedido) {
        if (in_array(strtoupper(trim($pedido['destino'] ?? '')), ['C','CLIENTE','E','ENVINADO'], true)) {
            $grupos[(int)$pedido['id']] = $crearGrupo($pedido);
        }
    }
    // El vínculo directo tiene prioridad. La trazabilidad mantiene compatibilidad
    // con botas antiguas; escoger una sola relación evita duplicar cantidades.
    $filas = $pdo->query("SELECT p.id, p.codigo, p.estado, fs.id AS fabricacion_semanal_id,
            pe.id AS pedido_id, pe.destino AS pedido_destino, pe.estado AS pedido_estado
        FROM productos p
        LEFT JOIN fabricacion_semanal fs ON fs.id = COALESCE(
            (SELECT directa.id FROM fabricacion_semanal directa WHERE directa.id = p.produccion_id AND directa.is_deleted = 0),
            (SELECT tf.fabricacion_semanal_id FROM trazabilidad_producto tpr
             JOIN trazabilidad_fabricacion tf ON tf.id = tpr.trazabilidad_fabricacion_id AND tf.is_deleted = 0
             JOIN fabricacion_semanal antigua ON antigua.id = tf.fabricacion_semanal_id AND antigua.is_deleted = 0
             WHERE tpr.producto_id = p.id AND tpr.is_deleted = 0 ORDER BY tpr.id LIMIT 1))
        LEFT JOIN pedidos pe ON pe.id = fs.pedido_id AND pe.is_deleted = 0
        WHERE p.tipo = 'BOTA' AND p.is_deleted = 0 ORDER BY p.codigo, p.id")->fetchAll();
    foreach ($filas as $fila) {
        $anonimo = !$fila['pedido_id'] || !in_array(strtoupper(trim($fila['pedido_destino'] ?? '')), ['C','CLIENTE','E','ENVINADO'], true);
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
            'pedido_id' => $fila['pedido_id'] === null ? null : (int)$fila['pedido_id'],
        ];
    }
    return ['ok' => true, 'pedidos' => array_values($grupos)];
}
