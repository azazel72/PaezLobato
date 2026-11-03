-- Registra la auditoría; la transacción y la modificación de lotes las coordina PHP.
-- No ejecuta START TRANSACTION, COMMIT ni ROLLBACK.
DELIMITER $$
DROP PROCEDURE IF EXISTS pa_registrar_ajuste_consumo$$
CREATE PROCEDURE pa_registrar_ajuste_consumo(
    IN p_grupo CHAR(32),
    IN p_orden INT,
    IN p_origen_id INT,
    IN p_destino_id INT,
    IN p_codigo_origen VARCHAR(60),
    IN p_codigo_destino VARCHAR(60),
    IN p_cantidad DECIMAL(10,4),
    IN p_consumido_origen_antes DECIMAL(10,4),
    IN p_consumido_origen_despues DECIMAL(10,4),
    IN p_consumido_destino_antes DECIMAL(10,4),
    IN p_consumido_destino_despues DECIMAL(10,4),
    IN p_usuario_id INT,
    IN p_motivo VARCHAR(255)
)
MODIFIES SQL DATA
BEGIN
    IF p_grupo IS NULL OR CHAR_LENGTH(TRIM(p_grupo)) <> 32
       OR p_orden IS NULL OR p_orden < 1
       OR p_origen_id IS NULL OR p_origen_id < 1
       OR p_destino_id IS NULL OR p_destino_id < 1 OR p_origen_id = p_destino_id
       OR p_codigo_origen IS NULL OR TRIM(p_codigo_origen) = ''
       OR p_codigo_destino IS NULL OR TRIM(p_codigo_destino) = ''
       OR p_motivo IS NULL OR TRIM(p_motivo) = ''
       OR (p_usuario_id IS NOT NULL AND p_usuario_id < 1) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Datos de auditoria de consumo no validos.';
    END IF;
    IF p_cantidad IS NULL OR p_cantidad <= 0
       OR p_consumido_origen_antes IS NULL OR p_consumido_origen_antes < 0
       OR p_consumido_origen_despues IS NULL OR p_consumido_origen_despues < 0
       OR p_consumido_destino_antes IS NULL OR p_consumido_destino_antes < 0
       OR p_consumido_destino_despues IS NULL OR p_consumido_destino_despues < 0
       OR p_consumido_origen_antes - p_consumido_origen_despues <> p_cantidad
       OR p_consumido_destino_despues - p_consumido_destino_antes <> p_cantidad THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Los consumos no corresponden a la cantidad del ajuste.';
    END IF;

    INSERT INTO a_ajustes_consumo
        (grupo, orden, origen_id, destino_id, codigo_origen, codigo_destino, cantidad,
         consumido_origen_antes, consumido_origen_despues,
         consumido_destino_antes, consumido_destino_despues, usuario_id, motivo)
    VALUES
        (p_grupo, p_orden, p_origen_id, p_destino_id, p_codigo_origen, p_codigo_destino, p_cantidad,
         p_consumido_origen_antes, p_consumido_origen_despues,
         p_consumido_destino_antes, p_consumido_destino_despues, p_usuario_id, TRIM(p_motivo));
END$$
DELIMITER ;
