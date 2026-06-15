"""
Crea todas las tablas en PostgreSQL según app/models/
(solo ejecutar si la base BusesYa ya existe y está vacía de tablas).

Uso (desde backend/, con .venv activado):
  python crear_tablas.py
"""

import sys
from pathlib import Path

# Asegura que Python encuentre el paquete app
sys.path.insert(0, str(Path(__file__).resolve().parent))

import app.database as base_datos
from app.database import inicializar_base_datos
from app.models import Base

# Importar modelos para que SQLAlchemy los registre
from app.models import (  # noqa: F401
    Cliente,
    Empleado,
    Pago,
    Reserva,
    Rol,
    Usuario,
    Vehiculo,
    Viaje,
)


def main():
    if not inicializar_base_datos():
        print("ERROR: Configura URL_BASE_DATOS en backend/.env")
        print("Ejemplo:")
        print(
            "  URL_BASE_DATOS=postgresql+psycopg2://postgres:TU_CLAVE@localhost:5432/BusesYa"
        )
        sys.exit(1)

    print("Creando tablas en PostgreSQL...")
    Base.metadata.create_all(bind=base_datos.motor)
    print("Listo. Tablas creadas:")
    for nombre in sorted(Base.metadata.tables.keys()):
        print(f"  - {nombre}")


if __name__ == "__main__":
    main()
