-- Auditoría: quién adjuntó comprobante (panel) y quién verificó el pago.
-- Ejecutar una vez contra la base PostgreSQL del proyecto.

ALTER TABLE reserva
  ADD COLUMN IF NOT EXISTS comprobante_subido_por_id INTEGER REFERENCES usuario (id_usuario);

ALTER TABLE pago
  ADD COLUMN IF NOT EXISTS verificado_por_id INTEGER REFERENCES usuario (id_usuario);

COMMENT ON COLUMN reserva.comprobante_subido_por_id IS 'Usuario del panel que adjuntó/reemplazó el comprobante; NULL si solo cliente (web).';
COMMENT ON COLUMN pago.verificado_por_id IS 'Usuario del sistema que marcó el pago como verificado.';
