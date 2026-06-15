"""
Conexión a PostgreSQL (SQLAlchemy).
"""

from typing import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.configuracion import URL_BASE_DATOS

motor = None
SesionLocal = None


def inicializar_base_datos() -> bool:
    """Crea motor y sesión si URL_BASE_DATOS está en .env."""
    global motor, SesionLocal

    if not URL_BASE_DATOS:
        return False

    motor = create_engine(
        URL_BASE_DATOS,
        connect_args={"connect_timeout": 10},
        pool_pre_ping=True,
    )
    SesionLocal = sessionmaker(autocommit=False, autoflush=False, bind=motor)
    return True


def obtener_sesion() -> Generator[Session, None, None]:
    """
    Dependencia para routers: db: Session = Depends(obtener_sesion)
    """
    if SesionLocal is None:
        raise RuntimeError(
            "Base de datos no configurada. Define URL_BASE_DATOS en backend/.env"
        )

    sesion = SesionLocal()
    try:
        yield sesion
    finally:
        sesion.close()
