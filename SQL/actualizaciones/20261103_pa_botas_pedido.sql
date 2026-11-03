DELIMITER $$
DROP PROCEDURE IF EXISTS pa_destino_pedidos$$
CREATE PROCEDURE pa_destino_pedidos()
BEGIN
    SELECT pe.*,c.nombre AS cliente FROM pedidos pe LEFT JOIN clientes c ON c.id=pe.cliente_id
    WHERE pe.is_deleted=0 AND UPPER(TRIM(pe.destino)) IN ('C','CLIENTE','E','ENVINADO')
      AND pe.estado=2
    ORDER BY pe.numero;
END$$
DROP PROCEDURE IF EXISTS pa_destino_botas$$
CREATE PROCEDURE pa_destino_botas()
BEGIN
    SELECT p.id,p.codigo,p.estado,p.pedido_id,p.pedido_fabricacion_id,
        COALESCE(NULLIF(p.produccion_id,0),(SELECT MIN(tf.fabricacion_semanal_id) FROM trazabilidad_producto tpr
            JOIN trazabilidad_fabricacion tf ON tf.id=tpr.trazabilidad_fabricacion_id
            WHERE tpr.producto_id=p.id AND tpr.is_deleted=0 AND tf.is_deleted=0)) AS fabricacion_semanal_id,
        pe.destino AS pedido_destino,pe.estado AS pedido_estado
    FROM productos p LEFT JOIN pedidos pe ON pe.id=p.pedido_id AND pe.is_deleted=0
    WHERE p.tipo='BOTA' AND p.is_deleted=0 ORDER BY p.codigo,p.id;
END$$
DROP PROCEDURE IF EXISTS pa_crear_producto_bota$$
CREATE PROCEDURE pa_crear_producto_bota(IN p_codigo VARCHAR(60),IN p_tipo INT,IN p_material INT,IN p_tostado INT,IN p_fabricacion INT)
BEGIN
    DECLARE pedido INT DEFAULT NULL;
    SELECT pedido_id INTO pedido FROM fabricacion_semanal WHERE id=p_fabricacion AND is_deleted=0 AND estado=2 FOR UPDATE;
    IF pedido IS NULL THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Fabricacion no activa.'; END IF;
    INSERT INTO productos(tipo,codigo,tipo_producto_id,material_id,tostado_id,produccion_id,pedido_id,pedido_fabricacion_id,estado)
        VALUES('BOTA',p_codigo,p_tipo,p_material,p_tostado,p_fabricacion,COALESCE(pedido,0),COALESCE(pedido,0),1);
    SELECT LAST_INSERT_ID() AS producto_id;
END$$
DROP PROCEDURE IF EXISTS pa_trasladar_botas_pedido$$
CREATE PROCEDURE pa_trasladar_botas_pedido(IN p_origen INT,IN p_destino INT,IN p_codigos LONGTEXT)
principal: BEGIN
    DECLARE n INT; DECLARE i INT DEFAULT 0; DECLARE codigo VARCHAR(60) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
    DECLARE destino_valido INT DEFAULT 0;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN
        ROLLBACK; DROP TEMPORARY TABLE IF EXISTS tmp_codigos_traslado; RESIGNAL;
    END;
    IF p_origen IS NULL OR p_destino IS NULL OR p_origen<0 OR p_destino<0 OR p_origen=p_destino THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Datos de traslado no validos.'; END IF;
    IF p_codigos IS NULL OR NOT JSON_VALID(p_codigos) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Lista de codigos no valida.'; END IF;
    SET n=JSON_LENGTH(p_codigos);
    IF JSON_TYPE(p_codigos)<>'ARRAY' OR n<1 OR n>500 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Indica entre 1 y 500 codigos.'; END IF;
    CREATE TEMPORARY TABLE tmp_codigos_traslado(codigo VARCHAR(60) NOT NULL PRIMARY KEY) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
    WHILE i<n DO
        IF JSON_TYPE(JSON_EXTRACT(p_codigos,CONCAT('$[',i,']')))<>'STRING'
           OR CHAR_LENGTH(TRIM(JSON_UNQUOTE(JSON_EXTRACT(p_codigos,CONCAT('$[',i,']'))))) NOT BETWEEN 1 AND 60 THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Codigo de bota no valido.';
        END IF;
        SET codigo=TRIM(JSON_UNQUOTE(JSON_EXTRACT(p_codigos,CONCAT('$[',i,']'))));
        IF EXISTS(SELECT 1 FROM tmp_codigos_traslado t WHERE t.codigo=codigo) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Hay codigos duplicados.'; END IF;
        INSERT INTO tmp_codigos_traslado VALUES(codigo); SET i=i+1;
    END WHILE;
    START TRANSACTION;
    IF p_destino<>0 THEN
        SELECT COUNT(*) INTO destino_valido FROM pedidos WHERE id=p_destino AND is_deleted=0 AND estado=2
            AND UPPER(TRIM(destino)) IN('C','CLIENTE','E','ENVINADO') FOR UPDATE;
        IF destino_valido<>1 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='El pedido destino no esta activo.'; END IF;
    END IF;
    UPDATE productos p JOIN tmp_codigos_traslado t ON t.codigo=p.codigo
        SET p.pedido_id=p_destino
        WHERE p.tipo='BOTA' AND p.is_deleted=0 AND p.estado IN(1,2) AND p.pedido_id=p_origen;
    IF ROW_COUNT()<>n THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Algun codigo no pertenece al origen, no existe o ya fue enviado a cliente o envinado. Recarga los datos.'; END IF;
    COMMIT; DROP TEMPORARY TABLE tmp_codigos_traslado;
    SELECT 1 AS ok,n AS cantidad;
END$$
DELIMITER ;
