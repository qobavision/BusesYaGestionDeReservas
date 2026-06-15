from pydantic import BaseModel, ConfigDict, Field


class RolBase(BaseModel):
    nombre_rol: str = Field(max_length=20, examples=["admin"])
    descripcion: str | None = Field(default=None, max_length=100)


class RolCrear(RolBase):
    pass


class RolActualizar(BaseModel):
    nombre_rol: str | None = Field(default=None, max_length=20)
    descripcion: str | None = Field(default=None, max_length=100)


class RolRespuesta(RolBase):
    id_rol: int
    model_config = ConfigDict(from_attributes=True)
