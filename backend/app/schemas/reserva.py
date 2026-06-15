from datetime import date, datetime, time
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

ESTADOS_RESERVA_NORMALIZADOS = frozenset({"pendiente", "confirmada", "cancelada"})


def normalizar_estado_reserva(valor: str | None) -> str:
    """Unifica valores antiguos a pendiente | confirmada | cancelada."""
    if not valor or not isinstance(valor, str):
        return "pendiente"
    x = valor.strip().lower()
    if x in ESTADOS_RESERVA_NORMALIZADOS:
        return x
    if x in ("confirmado", "confirmed"):
        return "confirmada"
    if x in ("cancelado", "canceled", "cancelled"):
        return "cancelada"
    if x in ("pending",):
        return "pendiente"
    return "pendiente"


def etiqueta_estado_reserva(clave: str) -> str:
    return {"pendiente": "Pendiente", "confirmada": "Confirmada", "cancelada": "Cancelada"}.get(
        clave, clave.capitalize()
    )


class ReservaPanelLista(BaseModel):
    """Fila completa para panel administrador y asesor."""

    id_reserva: int
    codigo_reserva: str
    fecha_registro_reserva: datetime
    cliente_nombre: str
    cliente_dni: str
    cliente_telefono: str
    origen: str
    destino: str
    cantidad_pasajeros: int
    precio_total: Decimal = Field(ge=0)
    fecha_partida: datetime
    fecha_retorno: datetime | None = None
    estado: str
    registro_origen: str | None = None
    estado_pago: str = "pendiente"
    metodo_pago: str | None = None
    comprobante_pago: str | None = None
    id_pago: int | None = None
    comprobante_subido_nombre: str | None = None
    pago_verificado_nombre: str | None = None
    codigo_viaje: str | None = None
    flota_asignada: bool = False
    vehiculo_texto: str | None = None
    conductor_texto: str | None = None
    model_config = ConfigDict(from_attributes=True)


class ReservaPanelActualizar(BaseModel):
    cantidad_pasajeros: int | None = Field(default=None, gt=0)
    precio_total: Decimal | None = Field(default=None, ge=0)
    origen: str | None = Field(default=None, max_length=50)
    destino: str | None = Field(default=None, max_length=50)
    fecha_partida: datetime | None = None
    fecha_retorno: datetime | None = None
    estado: str | None = Field(default=None, max_length=30)

    @field_validator("precio_total")
    @classmethod
    def precio_redondeo(cls, v: Decimal | None) -> Decimal | None:
        if v is None:
            return None
        return v.quantize(Decimal("0.01"))

    @field_validator("origen", "destino")
    @classmethod
    def recortar_viaje_txt(cls, v: str | None) -> str | None:
        if v is None:
            return None
        t = v.strip()
        return t[:50] if t else None

    @field_validator("estado")
    @classmethod
    def estado_permitido(cls, v: str | None) -> str | None:
        if v is None:
            return None
        n = normalizar_estado_reserva(v)
        if n not in ESTADOS_RESERVA_NORMALIZADOS:
            raise ValueError(
                'El estado debe ser "pendiente", "confirmada" o "cancelada".'
            )
        return n

    @model_validator(mode="after")
    def fechas_logicas(self) -> "ReservaPanelActualizar":
        if (
            self.fecha_partida is not None
            and self.fecha_retorno is not None
            and self.fecha_retorno < self.fecha_partida
        ):
            raise ValueError("La fecha de retorno no puede ser anterior a la de partida.")
        return self


class ReservaCrear(BaseModel):
    """Crear reserva cuando ya existen cliente y viaje."""

    codigo_reserva: str = Field(max_length=50)
    cantidad_pasajeros: int = Field(gt=0)
    precio_total: Decimal = Field(ge=0)
    id_cliente: int
    id_viaje: int
    estado: str | None = Field(default="pendiente", max_length=20)
    comprobante_pago: str | None = None


class ReservaPublicaCrear(BaseModel):
    """
    Formulario público reservas.html (sin archivo).
    El backend creará cliente + viaje + reserva.
    """
    direccion_partida: str = Field(max_length=255)
    direccion_llegada: str = Field(max_length=255)
    fecha_partida: datetime
    fecha_retorno: datetime | None = None
    numero_personas: int = Field(gt=0, le=50)
    nombre_cliente: str = Field(max_length=100)
    dni: str = Field(min_length=8, max_length=8, pattern=r"^\d{8}$")
    telefono: str = Field(min_length=9, max_length=15, pattern=r"^\d{9}$")
    email: EmailStr | str | None = None
    metodo_pago: str = Field(max_length=30)

    @field_validator("fecha_partida")
    @classmethod
    def validar_fecha_partida(cls, valor: datetime) -> datetime:
        if valor < datetime.now():
            raise ValueError("La fecha de partida no puede ser anterior a la actual.")
        return valor

    @model_validator(mode="after")
    def validar_fecha_retorno(self):
        if self.fecha_retorno and self.fecha_retorno < self.fecha_partida:
            raise ValueError(
                "La fecha de retorno no puede ser anterior a la fecha de partida."
            )
        return self


class ReservaManualCrear(ReservaPublicaCrear):
    """Reserva por teléfono (panel asesor)."""
    canal: str | None = Field(default="telefono", max_length=20)
    notas: str | None = None


class ReservaActualizar(BaseModel):
    cantidad_pasajeros: int | None = Field(default=None, gt=0)
    precio_total: Decimal | None = Field(default=None, ge=0)
    estado: str | None = Field(default=None, max_length=20)
    comprobante_pago: str | None = None
    id_viaje: int | None = None


class ReservaConsulta(BaseModel):
    """Consultar estado: DNI + código opcional."""
    dni: str = Field(min_length=8, max_length=8, pattern=r"^\d{8}$")
    codigo_reserva: str | None = Field(default=None, max_length=50)


class ReservaRespuesta(BaseModel):
    id_reserva: int
    codigo_reserva: str
    fecha_reserva: datetime
    cantidad_pasajeros: int
    precio_total: Decimal
    estado: str | None
    comprobante_pago: str | None = None
    id_cliente: int | None
    id_viaje: int | None
    model_config = ConfigDict(from_attributes=True)


class ReservaDetalle(ReservaRespuesta):
    """Reserva con datos del cliente y viaje (para paneles)."""
    cliente_nombre: str | None = None
    cliente_telefono: str | None = None
    origen: str | None = None
    destino: str | None = None


class ReservaCreadaRespuesta(BaseModel):
    mensaje: str
    codigo_reserva: str
    estado: str
    id_reserva: int
    vehiculo_tipo: str | None = None
    vehiculo_capacidad: int | None = None


class ReservaEstadoPublico(BaseModel):
    codigo_reserva: str
    estado: str
    cantidad_pasajeros: int
    precio_total: Decimal
    fecha_reserva: datetime
    cliente_nombre: str | None = None
    origen: str | None = None
    destino: str | None = None
    fecha_salida: date | None = None
    hora_salida: time | None = None
    vehiculo_tipo: str | None = None
    vehiculo_capacidad: int | None = None


class VehiculoSugeridoRespuesta(BaseModel):
    tipo: str
    capacidad: int
    mensaje: str
