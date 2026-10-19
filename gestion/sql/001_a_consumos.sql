-- Consumos por tipo de producto. Ejecutar sobre la base de datos del proyecto.
-- Creación independiente: no sustituye ni modifica la tabla consumos.
CREATE TABLE IF NOT EXISTS `a_consumos` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `tipo_producto_id` INT NOT NULL,
    `consumo_duelas` DECIMAL(12,4) NOT NULL DEFAULT 0.0000,
    `consumo_fleje_40` DECIMAL(12,4) NOT NULL DEFAULT 0.0000,
    `consumo_fleje_70` DECIMAL(12,4) NOT NULL DEFAULT 0.0000,
    `consumo_fondo` DECIMAL(12,4) NOT NULL DEFAULT 0.0000,
    `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_a_consumos_tipo_producto` (`tipo_producto_id`),
    CONSTRAINT `fk_a_consumos_tipo_producto` FOREIGN KEY (`tipo_producto_id`)
        REFERENCES `tipos_producto` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
    CONSTRAINT `chk_a_consumos_no_negativos` CHECK (
        `consumo_duelas` >= 0 AND `consumo_fleje_40` >= 0
        AND `consumo_fleje_70` >= 0 AND `consumo_fondo` >= 0
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
