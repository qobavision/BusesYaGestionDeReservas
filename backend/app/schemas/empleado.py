import re

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

from app.core.cargos_empleado import CARGOS_PERMITIDOS, canonizar_cargo

_PATRON_LICENCIA = re.compile(r"^[A-Z]{2}-\d{4}$")


class EmpleadoBase(BaseModel):
    nombre: str = Field(max_length=50)
    apellido: str = Field(max_length=50)
    dni: str = Field(min_length=8, max_length=8, pattern=r"^\d{8}$")
    telefono: str = Field(min_length=9, max_length=15, pattern=r"^\d{9}$")
    email: EmailStr | str | None = Field(default=None, max_length=100)
    cargo: str = Field(max_length=30)
    licencia: str | None = Field(default=None, max_length=7)

    @field_validator("nombre", "apellido")
    @classmethod
    def recortar_nombres(cls, valor: str) -> str:
        return valor.strip()


class EmpleadoCrear(EmpleadoBase):
    """Alta empleado."""

    estado: bool = Field(default=True)

    @model_validator(mode="after")
    def licencia_y_cargo(self):
        canon = canonizar_cargo(self.cargo)
        if not canon:
            from app.core.cargos_empleado import ROTULOS_CARGO

            etiquetas = ", ".join(sorted(ROTULOS_CARGO[c] for c in sorted(CARGOS_PERMITIDOS)))
            raise ValueError(f"Cargo no válido. Opciones: {etiquetas}.")

        lic = None if self.licencia is None else (str(self.licencia).strip() or None)
        if lic is not None:
            compacto = "".join(c for c in lic.upper() if c.isalnum())
            coincide = re.fullmatch(r"([A-Z]{2})(\d{4})", compacto)
            if coincide:
                lic = f"{coincide.group(1)}-{coincide.group(2)}"
            else:
                lic = lic.upper()

        object.__setattr__(self, "cargo", canon)

        if canon != "conductor":
            if lic is not None:
                raise ValueError("La licencia solo corresponde a conductores.")
            object.__setattr__(self, "licencia", None)
        else:
            if not lic:
                raise ValueError("Los conductores deben tener número de licencia.")
            if not _PATRON_LICENCIA.fullmatch(lic):
                raise ValueError(
                    "La licencia debe ser dos letras mayúsculas, guión y cuatro números (ej. AB-0000)."
                )
            object.__setattr__(self, "licencia", lic)
        return self


class EmpleadoActualizar(BaseModel):
    nombre: str | None = Field(default=None, max_length=50)
    apellido: str | None = Field(default=None, max_length=50)
    dni: str | None = Field(default=None, min_length=8, max_length=8, pattern=r"^\d{8}$")
    telefono: str | None = Field(default=None, min_length=9, max_length=15, pattern=r"^\d{9}$")
    email: EmailStr | str | None = Field(default=None, max_length=100)
    cargo: str | None = Field(default=None, max_length=30)
    licencia: str | None = Field(default=None, max_length=7)
    estado: bool | None = None

    @field_validator("nombre", "apellido")
    @classmethod
    def recortar_opt(cls, valor: str | None) -> str | None:
        if valor is None:
            return None
        return valor.strip()


class EmpleadoRespuesta(EmpleadoBase):
    id_empleado: int
    estado: bool
    model_config = ConfigDict(from_attributes=True)
