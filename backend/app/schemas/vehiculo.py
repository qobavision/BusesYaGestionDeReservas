from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.catalogo_vehiculos import CATALOGO_VEHICULOS
from app.core.placa_pe import normalizar_placa_peru

ESTADOS_VEHICULO = frozenset({"disponible", "reservado", "mantenimiento"})
_ANIO_MAX = datetime.now().year + 1


def _canonizar_tipo(tipo: str) -> str | None:
    if not tipo or not tipo.strip():
        return None
    clave = tipo.strip().lower()
    for item in CATALOGO_VEHICULOS:
        if item["tipo"].lower() == clave:
            return item["tipo"]
    # Tilde o nombre anterior "Longibus"
    if clave == "ómnibus":
        return "Omnibus"
    if clave == "longibus":
        return "Omnibus"
    return None


class VehiculoBase(BaseModel):
    placa: str = Field(max_length=10)
    tipo: str | None = Field(default=None, max_length=20)
    marca: str | None = Field(default=None, max_length=30)
    modelo: str | None = Field(default=None, max_length=30)
    capacidad: int = Field(gt=0, le=60)
    anio_fabricacion: int | None = Field(default=None, ge=1970, le=_ANIO_MAX)


class VehiculoCrear(VehiculoBase):
    """Alta de vehículo: tipo del catálogo BusesYa y capacidad libre dentro del modelo (≤60)."""

    tipo: str = Field(min_length=2, max_length=20)
    marca: str = Field(min_length=1, max_length=30)
    estado: str | None = Field(default="disponible", max_length=20)

    @field_validator("placa")
    @classmethod
    def validar_placa(cls, valor: str) -> str:
        return normalizar_placa_peru(valor)

    @field_validator("tipo")
    @classmethod
    def validar_tipo(cls, valor: str) -> str:
        canon = _canonizar_tipo(valor)
        if not canon:
            tipos = ", ".join(v["tipo"] for v in CATALOGO_VEHICULOS)
            raise ValueError(f"Tipo no válido. Elija uno: {tipos}.")
        return canon

    @field_validator("estado")
    @classmethod
    def validar_estado(cls, valor: str | None) -> str:
        escogido = (valor or "disponible").strip().lower()
        if escogido not in ESTADOS_VEHICULO:
            raise ValueError(
                "Estado no válido. Use: disponible, reservado o mantenimiento."
            )
        return escogido

    @field_validator("marca", "modelo", mode="before")
    @classmethod
    def recortar_texto(cls, valor):
        if valor is None:
            return None
        if isinstance(valor, str):
            texto = valor.strip()
            return texto or None
        return valor


class VehiculoActualizar(BaseModel):
    placa: str | None = Field(default=None, max_length=10)
    tipo: str | None = Field(default=None, max_length=20)
    marca: str | None = Field(default=None, max_length=30)
    modelo: str | None = Field(default=None, max_length=30)
    capacidad: int | None = Field(default=None, gt=0, le=60)
    anio_fabricacion: int | None = Field(default=None, ge=1970, le=_ANIO_MAX)
    estado: str | None = Field(default=None, max_length=20)

    @field_validator("placa")
    @classmethod
    def validar_placa(cls, valor: str | None) -> str | None:
        if valor is None:
            return None
        return normalizar_placa_peru(valor)

    @field_validator("tipo")
    @classmethod
    def validar_tipo(cls, valor: str | None) -> str | None:
        if valor is None:
            return None
        canon = _canonizar_tipo(valor)
        if not canon:
            tipos = ", ".join(v["tipo"] for v in CATALOGO_VEHICULOS)
            raise ValueError(f"Tipo no válido. Elija uno: {tipos}.")
        return canon

    @field_validator("estado")
    @classmethod
    def validar_estado(cls, valor: str | None) -> str | None:
        if valor is None:
            return None
        escogido = valor.strip().lower()
        if escogido not in ESTADOS_VEHICULO:
            raise ValueError(
                "Estado no válido. Use: disponible, reservado o mantenimiento."
            )
        return escogido

    @field_validator("marca", "modelo", mode="before")
    @classmethod
    def recortar_opcional(cls, valor):
        if valor is None:
            return None
        if isinstance(valor, str):
            texto = valor.strip()
            return texto or None
        return valor


class VehiculoRespuesta(VehiculoBase):
    id_vehiculo: int
    estado: str | None
    model_config = ConfigDict(from_attributes=True)
