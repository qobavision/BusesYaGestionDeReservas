from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class ClienteBase(BaseModel):
    nombre: str = Field(max_length=50)
    apellido: str = Field(max_length=50)
    dni: str = Field(min_length=8, max_length=8, pattern=r"^\d{8}$")
    telefono: str | None = Field(default=None, max_length=15)
    email: EmailStr | str | None = Field(default=None, max_length=100)


class ClienteCrear(ClienteBase):
    pass


class ClienteActualizar(BaseModel):
    nombre: str | None = Field(default=None, max_length=50)
    apellido: str | None = Field(default=None, max_length=50)
    telefono: str | None = Field(default=None, max_length=15)
    email: EmailStr | str | None = Field(default=None, max_length=100)
    estado: bool | None = None


class ClienteRespuesta(ClienteBase):
    id_cliente: int
    fecha_registro: datetime | None = None
    estado: bool
    model_config = ConfigDict(from_attributes=True)
