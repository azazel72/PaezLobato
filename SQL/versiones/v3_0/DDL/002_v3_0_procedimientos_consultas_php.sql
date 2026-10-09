DELIMITER $$
DROP PROCEDURE IF EXISTS pa_obtener_fabricaciones_semanales_activas$$
CREATE PROCEDURE pa_obtener_fabricaciones_semanales_activas()
BEGIN
 SELECT fs.id,fs.pedido_id,fs.fecha_inicio,fs.tipo_producto_id,fs.material_id,fs.tostado_id,fs.cantidad,fs.cantidad_fabricada,fs.estado,p.cantidad AS pedido_cantidad,p.cantidad_fabricada AS pedido_cantidad_fabricada,COALESCE(p.descripcion,CONCAT('Pedido ',fs.pedido_id)) AS pedido_descripcion,tp.descripcion AS tipo_descripcion,m.descripcion AS material_descripcion,t.descripcion AS tostado_descripcion
 FROM fabricacion_semanal fs LEFT JOIN pedidos p ON p.id=fs.pedido_id LEFT JOIN tipos_producto tp ON tp.id=fs.tipo_producto_id LEFT JOIN materiales m ON m.id=fs.material_id LEFT JOIN tostados t ON t.id=fs.tostado_id
 WHERE fs.estado=2 AND UPPER(COALESCE(tp.tipo,''))='BOTA' ORDER BY fs.fecha_inicio DESC,fs.id DESC;
END$$
DROP PROCEDURE IF EXISTS pa_obtener_lotes_botas$$
CREATE PROCEDURE pa_obtener_lotes_botas()
BEGIN
 SELECT id,codigo,objetivo,tipo_producto_id,material_id,cubicaje,consumido,contador_botas,estado,ubicacion_id,created_at,updated_at FROM a_lotes WHERE objetivo='BOTAS' AND estado<2 AND is_deleted=0 ORDER BY codigo;
END$$
DROP PROCEDURE IF EXISTS pa_obtener_lotes_fondos$$
CREATE PROCEDURE pa_obtener_lotes_fondos()
BEGIN
 SELECT id,codigo,objetivo,tipo_producto_id,material_id,cubicaje,consumido,contador_fondos,estado,ubicacion_id,created_at,updated_at FROM a_lotes WHERE objetivo='FONDOS' AND estado<2 AND is_deleted=0 ORDER BY codigo;
END$$
DROP PROCEDURE IF EXISTS pa_obtener_lotes_consumo_stock$$
CREATE PROCEDURE pa_obtener_lotes_consumo_stock()
BEGIN
 SELECT l.*,tp.descripcion AS tipo_descripcion,m.descripcion AS material_descripcion,u.descripcion AS ubicacion_descripcion FROM a_lotes l LEFT JOIN tipos_producto tp ON tp.id=l.tipo_producto_id LEFT JOIN materiales m ON m.id=l.material_id LEFT JOIN ubicaciones u ON u.id=l.ubicacion_id WHERE l.objetivo IN ('STOCK','ALMACENADO') AND l.is_deleted=0 AND l.estado<2 ORDER BY l.codigo;
END$$
DROP PROCEDURE IF EXISTS pa_obtener_lotes_consumo_botas$$
CREATE PROCEDURE pa_obtener_lotes_consumo_botas()
BEGIN
 SELECT l.*,tp.descripcion AS tipo_descripcion,m.descripcion AS material_descripcion,u.descripcion AS ubicacion_descripcion FROM a_lotes l LEFT JOIN tipos_producto tp ON tp.id=l.tipo_producto_id LEFT JOIN materiales m ON m.id=l.material_id LEFT JOIN ubicaciones u ON u.id=l.ubicacion_id WHERE l.objetivo='BOTAS' AND l.is_deleted=0 AND l.estado<2 ORDER BY l.codigo;
END$$
DROP PROCEDURE IF EXISTS pa_obtener_lotes_consumo_fondos$$
CREATE PROCEDURE pa_obtener_lotes_consumo_fondos()
BEGIN
 SELECT l.*,tp.descripcion AS tipo_descripcion,m.descripcion AS material_descripcion,u.descripcion AS ubicacion_descripcion FROM a_lotes l LEFT JOIN tipos_producto tp ON tp.id=l.tipo_producto_id LEFT JOIN materiales m ON m.id=l.material_id LEFT JOIN ubicaciones u ON u.id=l.ubicacion_id WHERE l.objetivo='FONDOS' AND l.is_deleted=0 AND l.estado<2 ORDER BY l.codigo;
END$$
DROP PROCEDURE IF EXISTS pa_obtener_cubicajes_consumo$$
CREATE PROCEDURE pa_obtener_cubicajes_consumo()
BEGIN
 SELECT tipo_producto_id,cubicaje_estandar FROM cubicaje ORDER BY tipo_producto_id;
END$$
DELIMITER ;
