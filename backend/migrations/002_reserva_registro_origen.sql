-- Origen del registro: web (formulario público) vs panel (asesor/admin).
ALTER TABLE reserva
  ADD COLUMN IF NOT EXISTS registro_origen VARCHAR(20);

COMMENT ON COLUMN reserva.registro_origen IS 'web = formulario público; panel = creado desde panel staff.';
