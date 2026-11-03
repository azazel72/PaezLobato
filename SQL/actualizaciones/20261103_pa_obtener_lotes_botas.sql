-- Ejecutar sobre la base de datos de la aplicación antes de usar el PHP simplificado.
-- Conserva todos los campos y filtros anteriores; añade tipo_descripcion.
-- No cambia la versión de la BBDD ni modifica datos de lotes.
DELIMITER $$

DROP PROCEDURE IF EXISTS pa_obtener_lotes_botas$$
CREATE PROCEDURE pa_obtener_lotes_botas()
BEGIN
    SELECT
        l.id,
        l.codigo,
        l.objetivo,
        l.tipo_producto_id,
        l.material_id,
        l.cubicaje,
        l.consumido,
        l.contador_botas,
        l.estado,
        l.ubicacion_id,
        l.created_at,
        l.updated_at,
        COALESCE(tp.descripcion, '') AS tipo_descripcion
    FROM a_lotes l
    LEFT JOIN tipos_producto tp ON tp.id = l.tipo_producto_id
    WHERE l.objetivo = 'BOTAS'
      AND l.estado < 2
      AND l.is_deleted = 0
    ORDER BY l.codigo;
END$$

DELIMITER ;
