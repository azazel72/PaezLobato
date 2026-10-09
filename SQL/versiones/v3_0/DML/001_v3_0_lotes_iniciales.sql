-- v3.0 - Carga inicial de lotes
--
-- Los lotes se identifican por la parte izquierda del codigo antes de '#'.
-- La carga de botas usa palets distintos vinculados a trazabilidad de fabricacion,
-- independientemente del estado de seleccion de sus trazas.

INSERT INTO `a_lotes` (
  `codigo`, `objetivo`, `tipo_producto_id`, `material_id`, `cubicaje`, `consumido`, `estado`, `ubicacion_id`, `created_by`, `updated_by`
)
SELECT
  LEFT(SUBSTRING_INDEX(TRIM(p.`codigo`), '#', 1), 60) AS `codigo`,
  'STOCK' AS `objetivo`,
  CAST(SUBSTRING_INDEX(GROUP_CONCAT(p.`tipo_producto_id` ORDER BY GREATEST(COALESCE(p.`cubicaje`, 0) - COALESCE(p.`consumido`, 0), 0) DESC, p.`id` SEPARATOR ','), ',', 1) AS UNSIGNED) AS `tipo_producto_id`,
  CAST(SUBSTRING_INDEX(GROUP_CONCAT(p.`material_id` ORDER BY GREATEST(COALESCE(p.`cubicaje`, 0) - COALESCE(p.`consumido`, 0), 0) DESC, p.`id` SEPARATOR ','), ',', 1) AS UNSIGNED) AS `material_id`,
  SUM(GREATEST(COALESCE(p.`cubicaje`, 0) - COALESCE(p.`consumido`, 0), 0)) AS `cubicaje`,
  0.0000 AS `consumido`,
  0 AS `estado`,
  CAST(SUBSTRING_INDEX(GROUP_CONCAT(p.`ubicacion_id` ORDER BY GREATEST(COALESCE(p.`cubicaje`, 0) - COALESCE(p.`consumido`, 0), 0) DESC, p.`id` SEPARATOR ','), ',', 1) AS UNSIGNED) AS `ubicacion_id`,
  'v3.0' AS `created_by`,
  'v3.0' AS `updated_by`
FROM `palets` p
WHERE p.`procesado` = 0
  AND GREATEST(COALESCE(p.`cubicaje`, 0) - COALESCE(p.`consumido`, 0), 0) > 0
  AND TRIM(COALESCE(p.`codigo`, '')) <> ''
GROUP BY LEFT(SUBSTRING_INDEX(TRIM(p.`codigo`), '#', 1), 60);

INSERT INTO `a_lotes` (
  `codigo`, `objetivo`, `cubicaje`, `consumido`, `estado`, `created_by`, `updated_by`
)
SELECT DISTINCT
  LEFT(TRIM(pr.`nombre`), 60) AS `codigo`,
  'FONDOS' AS `objetivo`,
  0.0000 AS `cubicaje`,
  0.0000 AS `consumido`,
  0 AS `estado`,
  'v3.0' AS `created_by`,
  'v3.0' AS `updated_by`
FROM `proveedores` pr
WHERE TRIM(COALESCE(pr.`nombre`, '')) <> '';

INSERT INTO `a_lotes` (
  `codigo`, `objetivo`, `tipo_producto_id`, `material_id`, `cubicaje`, `consumido`, `estado`, `ubicacion_id`, `created_by`, `updated_by`
)
SELECT
  LEFT(SUBSTRING_INDEX(TRIM(p.`codigo`), '#', 1), 60) AS `codigo`,
  'BOTAS' AS `objetivo`,
  CAST(SUBSTRING_INDEX(GROUP_CONCAT(p.`tipo_producto_id` ORDER BY GREATEST(COALESCE(p.`cubicaje`, 0) - COALESCE(p.`consumido`, 0), 0) DESC, p.`id` SEPARATOR ','), ',', 1) AS UNSIGNED) AS `tipo_producto_id`,
  CAST(SUBSTRING_INDEX(GROUP_CONCAT(p.`material_id` ORDER BY GREATEST(COALESCE(p.`cubicaje`, 0) - COALESCE(p.`consumido`, 0), 0) DESC, p.`id` SEPARATOR ','), ',', 1) AS UNSIGNED) AS `material_id`,
  SUM(GREATEST(COALESCE(p.`cubicaje`, 0) - COALESCE(p.`consumido`, 0), 0)) AS `cubicaje`,
  0.0000 AS `consumido`,
  0 AS `estado`,
  CAST(SUBSTRING_INDEX(GROUP_CONCAT(p.`ubicacion_id` ORDER BY GREATEST(COALESCE(p.`cubicaje`, 0) - COALESCE(p.`consumido`, 0), 0) DESC, p.`id` SEPARATOR ','), ',', 1) AS UNSIGNED) AS `ubicacion_id`,
  'v3.0' AS `created_by`,
  'v3.0' AS `updated_by`
FROM `palets` p
INNER JOIN (
  SELECT DISTINCT tf.`palet_id`
  FROM `trazabilidad_fabricacion` tf
  LEFT JOIN `fabricacion_semanal` fs ON fs.`id` = tf.`fabricacion_semanal_id`
  WHERE tf.`palet_id` IS NOT NULL
    AND (tf.`fabricacion_semanal_id` IS NULL OR fs.`estado` IS NULL OR fs.`estado` <> 3)
) tf ON tf.`palet_id` = p.`id`
WHERE TRIM(COALESCE(p.`codigo`, '')) <> ''
  AND COALESCE(p.`estado`, -1) <> 0
GROUP BY LEFT(SUBSTRING_INDEX(TRIM(p.`codigo`), '#', 1), 60);
