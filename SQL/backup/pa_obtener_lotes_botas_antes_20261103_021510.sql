DELIMITER $$
DROP PROCEDURE IF EXISTS pa_obtener_lotes_botas$$
CREATE DEFINER=`root`@`localhost` PROCEDURE `pa_obtener_lotes_botas`()
BEGIN
 SELECT id,codigo,objetivo,tipo_producto_id,material_id,cubicaje,consumido,contador_botas,estado,ubicacion_id,created_at,updated_at FROM a_lotes WHERE objetivo='BOTAS' AND estado<2 AND is_deleted=0 ORDER BY codigo;
END$$
DELIMITER ;
