"""
Añade columnas nuevas sin borrar datos.
Ejecutar: python actualizar_bd.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from sqlalchemy import text

import app.database as base_datos
from app.database import inicializar_base_datos


def main():
    if not inicializar_base_datos():
        print("ERROR: Configura URL_BASE_DATOS en .env")
        sys.exit(1)

    sentencias = [
        "ALTER TABLE reserva "
        "ADD COLUMN IF NOT EXISTS tipo_vehiculo_solicitado VARCHAR(20)",
        "ALTER TABLE reserva ADD COLUMN IF NOT EXISTS fecha_retorno DATE",
        "ALTER TABLE reserva ADD COLUMN IF NOT EXISTS hora_retorno TIME",
        "ALTER TABLE viaje ADD COLUMN IF NOT EXISTS codigo_viaje VARCHAR(20)",
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_viaje_codigo_viaje "
        "ON viaje (codigo_viaje) WHERE codigo_viaje IS NOT NULL",
        "UPDATE vehiculo SET tipo = 'Omnibus' WHERE LOWER(TRIM(tipo)) = 'longibus'",
        "UPDATE reserva SET tipo_vehiculo_solicitado = 'Omnibus' "
        "WHERE tipo_vehiculo_solicitado IS NOT NULL "
        "AND LOWER(TRIM(tipo_vehiculo_solicitado)) = 'longibus'",
    ]

    with base_datos.motor.connect() as conexion:
        for sql in sentencias:
            conexion.execute(text(sql))
        conexion.commit()

    from app.crud import viaje as crud_viaje
    from app.models.reserva import Reserva
    from app.schemas.reserva import normalizar_estado_reserva

    if base_datos.SesionLocal is None:
        print("AVISO: no se pudo activar códigos VI-xxx (sin sesión BD).")
    else:
        with base_datos.SesionLocal() as db:
            confirmadas = db.query(Reserva).all()
            n = 0
            for r in confirmadas:
                if normalizar_estado_reserva(r.estado) == "confirmada" and r.id_viaje:
                    crud_viaje.activar_para_reserva_confirmada(db, r)
                    n += 1
            db.commit()
            print(f"Viajes activados (código VI-NNNN) para {n} reserva(s) confirmada(s).")

    print(
        "Listo. Columnas: reserva (tipo_vehiculo, fechas retorno), viaje (codigo_viaje)."
    )


if __name__ == "__main__":
    main()
