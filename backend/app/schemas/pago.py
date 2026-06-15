from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class PagoBase(BaseModel):
    monto: Decimal = Field(ge=0)
    metodo_pago: str | None = Field(default=None, max_length=20)
    codigo_operacion: str | None = Field(default=None, max_length=50)
    id_reserva: int


class PagoCrear(PagoBase):
    estado: str | None = Field(default="pendiente", max_length=20)


class PagoVerificar(BaseModel):
    """Marcar pago como verificado (panel asesor)."""

    id_pago: int


class PagoActualizar(BaseModel):
    monto: Decimal | None = Field(default=None, ge=0)
    metodo_pago: str | None = Field(default=None, max_length=20)
    codigo_operacion: str | None = Field(default=None, max_length=50)
    estado: str | None = Field(default=None, max_length=20)


class PagoRespuesta(PagoBase):
    id_pago: int
    fecha_pago: datetime | None = None
    estado: str | None
    model_config = ConfigDict(from_attributes=True)


class PagoPendientePanel(BaseModel):
    """Fila tabla «Verificar pago» del panel asesor."""

    id_pago: int
    id_reserva: int
    codigo_reserva: str
    cliente_nombre: str
    monto: Decimal = Field(ge=0)
    metodo_pago: str | None = None
    comprobante_pago: str | None = None
    fecha_registro: datetime
