-- v3.0 - Tablas agregadas de lotes y movimientos

CREATE TABLE IF NOT EXISTS `a_lotes_stock` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `codigo` varchar(60) NOT NULL,
  `linea_entrada_id` int(11) DEFAULT NULL,
  `tipo_producto_id` int(11) DEFAULT NULL,
  `material_id` int(11) DEFAULT NULL,
  `cubicaje` decimal(10,4) NOT NULL DEFAULT 0.0000,
  `consumido` decimal(10,4) NOT NULL DEFAULT 0.0000,
  `contador_botas` int(11) NOT NULL DEFAULT 0,
  `estado` int(11) DEFAULT NULL,
  `ubicacion_id` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` timestamp NULL DEFAULT NULL,
  `is_deleted` tinyint(1) NOT NULL DEFAULT 0,
  `created_by` varchar(11) NOT NULL DEFAULT 'system',
  `updated_by` varchar(11) NOT NULL DEFAULT 'system',
  `deleted_by` varchar(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_a_lotes_stock_codigo` (`codigo`),
  KEY `idx_a_lotes_stock_estado` (`estado`),
  KEY `idx_a_lotes_stock_ubicacion_id` (`ubicacion_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `a_lotes_botas` LIKE `a_lotes_stock`;
CREATE TABLE IF NOT EXISTS `a_lotes_procesados` LIKE `a_lotes_stock`;

CREATE TABLE IF NOT EXISTS `a_lotes_fondos` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `codigo` varchar(60) NOT NULL,
  `linea_entrada_id` int(11) DEFAULT NULL,
  `tipo_producto_id` int(11) DEFAULT NULL,
  `material_id` int(11) DEFAULT NULL,
  `cubicaje` decimal(10,4) NOT NULL DEFAULT 0.0000,
  `consumido` decimal(10,4) NOT NULL DEFAULT 0.0000,
  `contador_fondos` int(11) NOT NULL DEFAULT 0,
  `estado` int(11) DEFAULT NULL,
  `ubicacion_id` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `deleted_at` timestamp NULL DEFAULT NULL,
  `is_deleted` tinyint(1) NOT NULL DEFAULT 0,
  `created_by` varchar(11) NOT NULL DEFAULT 'system',
  `updated_by` varchar(11) NOT NULL DEFAULT 'system',
  `deleted_by` varchar(11) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_a_lotes_fondos_codigo` (`codigo`),
  KEY `idx_a_lotes_fondos_estado` (`estado`),
  KEY `idx_a_lotes_fondos_ubicacion_id` (`ubicacion_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `a_movimientos` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `origen_id` int(11) NOT NULL,
  `situacion_origen` enum('stock','botas','fondos','procesado','','desperdicio') NOT NULL,
  `destino_id` int(11) NOT NULL,
  `situacion_destino` enum('stock','botas','fondos','procesado','','desperdicio') NOT NULL,
  `cantidad` decimal(10,4) NOT NULL DEFAULT 0.0000,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_a_movimientos_origen` (`origen_id`, `situacion_origen`),
  KEY `idx_a_movimientos_destino` (`destino_id`, `situacion_destino`),
  KEY `idx_a_movimientos_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `a_trazabilidad_botas` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `id_botas` int(11) NOT NULL,
  `id_lote_botas` int(11) NOT NULL,
  `lote` varchar(60) NOT NULL,
  `cantidad` decimal(10,4) NOT NULL DEFAULT 0.0000,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_a_trazabilidad_botas_botas` (`id_botas`),
  KEY `idx_a_trazabilidad_botas_lote` (`id_lote_botas`, `lote`),
  KEY `idx_a_trazabilidad_botas_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

CREATE TABLE IF NOT EXISTS `a_trazabilidad_fondos` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `id_bota` int(11) NOT NULL,
  `id_lote_fondos` int(11) NOT NULL,
  `lote` varchar(60) NOT NULL,
  `cantidad` decimal(10,4) NOT NULL DEFAULT 0.0000,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_a_trazabilidad_fondos_fondos` (`id_bota`),
  KEY `idx_a_trazabilidad_fondos_lote` (`id_lote_fondos`, `lote`),
  KEY `idx_a_trazabilidad_fondos_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
