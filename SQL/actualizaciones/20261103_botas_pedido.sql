-- Ejecutar una vez en la BBDD de la aplicación. No cambia su número de versión.
-- Reejecutable: nunca reconstruye el pedido actual tras haber añadido la columna.
DELIMITER $$
DROP PROCEDURE IF EXISTS pa_migrar_botas_pedido$$
CREATE PROCEDURE pa_migrar_botas_pedido()
BEGIN
    DECLARE nueva INT DEFAULT 0;
    IF NOT EXISTS (SELECT 1 FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='productos' AND COLUMN_NAME='pedido_id') THEN
        ALTER TABLE productos ADD pedido_id INT NOT NULL DEFAULT 0,
            ADD pedido_fabricacion_id INT NOT NULL DEFAULT 0,
            ADD INDEX idx_producto_pedido_estado (pedido_id,estado,is_deleted);
        SET nueva=1;
    END IF;
    IF nueva=1 THEN
        CREATE TEMPORARY TABLE tmp_pedido_historico AS
            SELECT tpr.producto_id, MIN(tf.fabricacion_semanal_id) AS fabricacion_id
            FROM trazabilidad_producto tpr JOIN trazabilidad_fabricacion tf ON tf.id=tpr.trazabilidad_fabricacion_id
            WHERE tpr.is_deleted=0 AND tf.is_deleted=0 GROUP BY tpr.producto_id;
        UPDATE productos p
        LEFT JOIN fabricacion_semanal fs ON fs.id=p.produccion_id
        LEFT JOIN tmp_pedido_historico h ON h.producto_id=p.id
        LEFT JOIN fabricacion_semanal antigua ON antigua.id=h.fabricacion_id
        LEFT JOIN pedidos pe ON pe.id=COALESCE(fs.pedido_id,antigua.pedido_id) AND pe.is_deleted=0
        SET p.pedido_id=CASE WHEN UPPER(TRIM(pe.destino)) IN('C','CLIENTE','E','ENVINADO') THEN pe.id ELSE 0 END,
            p.pedido_fabricacion_id=COALESCE(fs.pedido_id,antigua.pedido_id,0)
        WHERE p.tipo='BOTA';
        DROP TEMPORARY TABLE tmp_pedido_historico;
    END IF;
END$$
CALL pa_migrar_botas_pedido()$$
DROP PROCEDURE pa_migrar_botas_pedido$$
DELIMITER ;
