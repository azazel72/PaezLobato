-- Conserva las reasignaciones existentes. El desperdicio afecta a un solo lote.
ALTER TABLE a_ajustes_consumo
    DROP CONSTRAINT chk_ajuste_cantidad,
    DROP CONSTRAINT chk_ajuste_lotes,
    DROP CONSTRAINT chk_ajuste_origen,
    DROP CONSTRAINT chk_ajuste_destino,
    ADD COLUMN tipo ENUM('reasignacion','desperdicio') NOT NULL DEFAULT 'reasignacion' AFTER orden,
    MODIFY destino_id INT NULL,
    MODIFY codigo_destino VARCHAR(60) NULL,
    MODIFY consumido_destino_antes DECIMAL(10,4) NULL,
    MODIFY consumido_destino_despues DECIMAL(10,4) NULL,
    ADD CONSTRAINT chk_ajuste_cantidad CHECK ((tipo='reasignacion' AND cantidad>0) OR (tipo='desperdicio' AND cantidad<>0)),
    ADD CONSTRAINT chk_ajuste_lotes CHECK (origen_id>0 AND (
        (tipo='reasignacion' AND destino_id IS NOT NULL AND destino_id>0 AND origen_id<>destino_id) OR
        (tipo='desperdicio' AND destino_id IS NULL AND codigo_destino IS NULL))),
    ADD CONSTRAINT chk_ajuste_origen CHECK (consumido_origen_antes>=0 AND consumido_origen_despues>=0 AND (
        (tipo='reasignacion' AND consumido_origen_antes-consumido_origen_despues=cantidad) OR
        (tipo='desperdicio' AND consumido_origen_despues-consumido_origen_antes=cantidad))),
    ADD CONSTRAINT chk_ajuste_destino CHECK (
        (tipo='reasignacion' AND consumido_destino_antes IS NOT NULL AND consumido_destino_despues IS NOT NULL
         AND consumido_destino_antes>=0 AND consumido_destino_despues-consumido_destino_antes=cantidad) OR
        (tipo='desperdicio' AND consumido_destino_antes IS NULL AND consumido_destino_despues IS NULL));
