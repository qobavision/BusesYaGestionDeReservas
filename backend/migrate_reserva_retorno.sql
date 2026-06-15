-- Ejecutar en PostgreSQL si la tabla `reserva` ya existía antes de fecha/hora retorno.
ALTER TABLE reserva ADD COLUMN IF NOT EXISTS fecha_retorno DATE;
ALTER TABLE reserva ADD COLUMN IF NOT EXISTS hora_retorno TIME;
