"""
Operaciones CRUD — acceso a la base de datos.
Usar desde routers: from app.crud import cliente, reserva, usuario
"""

from app.crud import (
    cliente,
    empleado,
    pago,
    reserva,
    rol,
    usuario,
    vehiculo,
    viaje,
)

__all__ = [
    "cliente",
    "empleado",
    "rol",
    "usuario",
    "vehiculo",
    "viaje",
    "reserva",
    "pago",
]
