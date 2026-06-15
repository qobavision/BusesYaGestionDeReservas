from datetime import date, datetime, time
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class ViajeBase(BaseModel):
    origen: str = Field(max_length=50)
    destino: str = Field(max_length=50)
    fecha_salida: date
    hora_salida: time
    precio: Decimal = Field(ge=0)
    estado: str | None = Field(default="programado", max_length=20)
    id_vehiculo: int | None = None
    id_empleado: int | None = None


class ViajeCrear(ViajeBase):
    pass


class ViajeActualizar(BaseModel):
    origen: str | None = Field(default=None, max_length=50)
    destino: str | None = Field(default=None, max_length=50)
    fecha_salida: date | None = None
    hora_salida: time | None = None
    precio: Decimal | None = Field(default=None, ge=0)
    estado: str | None = Field(default=None, max_length=20)
    id_vehiculo: int | None = None
    id_empleado: int | None = None


class ViajeAsignar(BaseModel):
    """Cuando el asesor asigna vehículo, conductor y precio."""
    id_vehiculo: int
    id_empleado: int
    fecha_salida: date | None = None
    hora_salida: time | None = None
    precio: Decimal = Field(ge=0)
    estado: str | None = Field(default="confirmado", max_length=20)


class ViajeRespuesta(ViajeBase):
    id_viaje: int
    model_config = ConfigDict(from_attributes=True)


class ViajeAsignarPanel(BaseModel):
    """Asesor: asigna vehículo y conductor a un viaje confirmado."""

    id_vehiculo: int
    id_empleado: int


class ViajeEstadoConductorPatch(BaseModel):
    """Conductor: solo estados operativos del viaje."""

    estado: str = Field(..., max_length=30)


class ViajePanelLista(BaseModel):
    """Listado panel: salida en viaje; retorno desde reserva vinculada (si existe)."""

    id_viaje: int
    codigo_viaje: str
    cliente_nombre: str = "—"
    cliente_telefono: str | None = None
    codigo_reserva: str | None = None
    cantidad_pasajeros: int | None = None
    origen: str
    destino: str
    fecha_salida: datetime
    fecha_retorno: datetime | None = None
    vehiculo_texto: str
    conductor_texto: str
    estado: str
    estado_codigo: str = "pendiente"
    id_vehiculo: int | None = None
    id_empleado: int | None = None
    vehiculo_placa: str | None = None
    monto_total: Decimal | None = None
