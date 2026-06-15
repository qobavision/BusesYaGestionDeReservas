"""
Schemas Pydantic — validan JSON de entrada y salida de la API.

Crear   → datos que envía el cliente (POST)
Actualizar → datos parciales (PATCH/PUT)
Respuesta → datos que devuelve la API (GET)
"""

from app.schemas.cliente import (
    ClienteActualizar,
    ClienteCrear,
    ClienteRespuesta,
)
from app.schemas.common import ErrorRespuesta, MensajeRespuesta
from app.schemas.empleado import (
    EmpleadoActualizar,
    EmpleadoCrear,
    EmpleadoRespuesta,
)
from app.schemas.pago import PagoActualizar, PagoCrear, PagoRespuesta, PagoVerificar
from app.schemas.reserva import (
    ReservaActualizar,
    ReservaConsulta,
    ReservaCrear,
    ReservaDetalle,
    ReservaManualCrear,
    ReservaPublicaCrear,
    ReservaRespuesta,
)
from app.schemas.rol import RolActualizar, RolCrear, RolRespuesta
from app.schemas.usuario import (
    TokenRespuesta,
    UsuarioActualizar,
    UsuarioCrear,
    UsuarioLogin,
    UsuarioRespuesta,
)
from app.schemas.vehiculo import (
    VehiculoActualizar,
    VehiculoCrear,
    VehiculoRespuesta,
)
from app.schemas.viaje import ViajeActualizar, ViajeAsignar, ViajeCrear, ViajeRespuesta

__all__ = [
    "ClienteCrear",
    "ClienteActualizar",
    "ClienteRespuesta",
    "EmpleadoCrear",
    "EmpleadoActualizar",
    "EmpleadoRespuesta",
    "RolCrear",
    "RolActualizar",
    "RolRespuesta",
    "UsuarioLogin",
    "UsuarioCrear",
    "UsuarioActualizar",
    "UsuarioRespuesta",
    "TokenRespuesta",
    "VehiculoCrear",
    "VehiculoActualizar",
    "VehiculoRespuesta",
    "ViajeCrear",
    "ViajeActualizar",
    "ViajeAsignar",
    "ViajeRespuesta",
    "ReservaCrear",
    "ReservaPublicaCrear",
    "ReservaManualCrear",
    "ReservaActualizar",
    "ReservaConsulta",
    "ReservaRespuesta",
    "ReservaDetalle",
    "PagoCrear",
    "PagoVerificar",
    "PagoActualizar",
    "PagoRespuesta",
    "MensajeRespuesta",
    "ErrorRespuesta",
]
