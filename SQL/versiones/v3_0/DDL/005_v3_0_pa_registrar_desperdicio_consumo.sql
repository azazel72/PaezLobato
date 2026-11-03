DELIMITER $$
DROP PROCEDURE IF EXISTS pa_registrar_desperdicio_consumo$$
CREATE PROCEDURE pa_registrar_desperdicio_consumo(
    IN p_grupo CHAR(32), IN p_orden INT, IN p_origen_id INT,
    IN p_codigo_origen VARCHAR(60), IN p_cantidad DECIMAL(10,4),
    IN p_consumido_antes DECIMAL(10,4), IN p_consumido_despues DECIMAL(10,4),
    IN p_usuario_id INT, IN p_motivo VARCHAR(255)
)
MODIFIES SQL DATA
BEGIN
    IF p_grupo IS NULL OR CHAR_LENGTH(TRIM(p_grupo))<>32 OR p_orden IS NULL OR p_orden<1
       OR p_origen_id IS NULL OR p_origen_id<1 OR p_codigo_origen IS NULL OR TRIM(p_codigo_origen)=''
       OR p_cantidad IS NULL OR p_cantidad=0
       OR p_consumido_antes IS NULL OR p_consumido_antes<0
       OR p_consumido_despues IS NULL OR p_consumido_despues<0
       OR p_consumido_despues-p_consumido_antes<>p_cantidad
       OR (p_usuario_id IS NOT NULL AND p_usuario_id<1)
       OR p_motivo IS NULL OR TRIM(p_motivo)='' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Ajuste de desperdicio no valido.';
    END IF;
    INSERT INTO a_ajustes_consumo
        (grupo,orden,tipo,origen_id,destino_id,codigo_origen,codigo_destino,cantidad,
         consumido_origen_antes,consumido_origen_despues,consumido_destino_antes,consumido_destino_despues,usuario_id,motivo)
    VALUES (p_grupo,p_orden,'desperdicio',p_origen_id,NULL,p_codigo_origen,NULL,p_cantidad,
            p_consumido_antes,p_consumido_despues,NULL,NULL,p_usuario_id,TRIM(p_motivo));
END$$
DELIMITER ;
