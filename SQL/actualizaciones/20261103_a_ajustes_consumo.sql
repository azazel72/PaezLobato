-- Auditoría de reasignaciones de consumo, separada de movimientos materiales.
-- No modifica registros históricos ni la versión de la BBDD.
CREATE TABLE IF NOT EXISTS a_ajustes_consumo (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    grupo CHAR(32) NOT NULL,
    orden INT UNSIGNED NOT NULL,
    origen_id INT NOT NULL,
    destino_id INT NOT NULL,
    codigo_origen VARCHAR(60) NOT NULL,
    codigo_destino VARCHAR(60) NOT NULL,
    cantidad DECIMAL(10,4) NOT NULL,
    consumido_origen_antes DECIMAL(10,4) NOT NULL,
    consumido_origen_despues DECIMAL(10,4) NOT NULL,
    consumido_destino_antes DECIMAL(10,4) NOT NULL,
    consumido_destino_despues DECIMAL(10,4) NOT NULL,
    usuario_id INT DEFAULT NULL,
    motivo VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_ajuste_grupo_orden (grupo, orden),
    KEY idx_ajuste_origen_fecha (origen_id, created_at),
    KEY idx_ajuste_destino_fecha (destino_id, created_at),
    CONSTRAINT chk_ajuste_cantidad CHECK (cantidad > 0),
    CONSTRAINT chk_ajuste_lotes CHECK (origen_id <> destino_id),
    CONSTRAINT chk_ajuste_origen CHECK (consumido_origen_antes - consumido_origen_despues = cantidad),
    CONSTRAINT chk_ajuste_destino CHECK (consumido_destino_despues - consumido_destino_antes = cantidad)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
