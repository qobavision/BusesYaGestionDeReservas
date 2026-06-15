from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


def normalizar_correo_busesya(valor: object) -> object:
    """
    Convierte local@busesya en local@busesya.com para pasar EmailStr.
    También uniforma minúsculas en usuario y dominio.
    """
    if valor is None or not isinstance(valor, str):
        return valor
    texto = valor.strip().lower()
    if "@" not in texto:
        return valor
    local, _, dominio = texto.partition("@")
    local = local.strip()
    dominio = dominio.strip()
    if not local:
        return valor
    if dominio == "busesya":
        return f"{local}@busesya.com"
    return f"{local}@{dominio}"


class UsuarioLogin(BaseModel):
    """Datos del formulario login.html"""

    email: EmailStr
    password: str = Field(min_length=6)

    @field_validator("email", mode="before")
    @classmethod
    def normalizar_email_login(cls, v: object) -> object:
        return normalizar_correo_busesya(v)


class UsuarioCrear(BaseModel):
    nombre_usuario: str = Field(max_length=50)
    correo: EmailStr
    password: str = Field(min_length=6)
    id_rol: int
    id_empleado: int | None = None

    @field_validator("correo", mode="before")
    @classmethod
    def normalizar_correo_crear(cls, v: object) -> object:
        return normalizar_correo_busesya(v)


class UsuarioAdministradorCrear(BaseModel):
    """Alta desde panel administrador (siempre enlazado a una ficha de empleado)."""

    nombre_usuario: str = Field(max_length=50, min_length=1)
    correo: EmailStr
    password: str = Field(min_length=6)
    id_rol: int
    id_empleado: int = Field(gt=0)

    @field_validator("nombre_usuario")
    @classmethod
    def recortar_nombre_usuario(cls, v: str) -> str:
        t = v.strip()
        if not t:
            raise ValueError("El nombre de usuario no puede quedar vacío.")
        return t

    @field_validator("correo", mode="before")
    @classmethod
    def normalizar_correo_admin_crear(cls, v: object) -> object:
        return normalizar_correo_busesya(v)


class UsuarioAdministradorLista(BaseModel):
    """Fila tabla panel admin usuarios."""

    id_usuario: int
    nombre_usuario: str
    correo: EmailStr
    id_rol: int | None
    nombre_rol: str
    id_empleado: int | None
    nombre_empleado: str
    estado: bool


class UsuarioAdministradorActualizar(BaseModel):
    """PATCH desde panel (no cambia el vínculo con empleado)."""

    nombre_usuario: str | None = Field(default=None, max_length=50, min_length=1)
    correo: EmailStr | None = None
    password: str | None = Field(default=None, min_length=6)
    id_rol: int | None = None
    estado: bool | None = None

    @field_validator("nombre_usuario")
    @classmethod
    def recortar_nombre_si_hay(cls, v: str | None) -> str | None:
        if v is None:
            return None
        t = v.strip()
        if not t:
            raise ValueError("El nombre de usuario no puede quedar vacío.")
        return t

    @field_validator("correo", mode="before")
    @classmethod
    def normalizar_correo_admin_patch(cls, v: object) -> object:
        if v is None:
            return None
        return normalizar_correo_busesya(v)

    @field_validator("password", mode="before")
    @classmethod
    def contrasena_vacia_sin_cambiar(cls, v: object) -> object:
        if v is None:
            return None
        if isinstance(v, str) and not v.strip():
            return None
        return v


class UsuarioActualizar(BaseModel):
    nombre_usuario: str | None = Field(default=None, max_length=50)
    correo: EmailStr | None = None
    password: str | None = Field(default=None, min_length=6)
    id_rol: int | None = None
    id_empleado: int | None = None
    estado: bool | None = None

    @field_validator("correo", mode="before")
    @classmethod
    def normalizar_correo_actualizar(cls, v: object) -> object:
        if v is None:
            return None
        return normalizar_correo_busesya(v)


class UsuarioRespuesta(BaseModel):
    id_usuario: int
    nombre_usuario: str
    correo: EmailStr
    id_rol: int | None
    id_empleado: int | None
    estado: bool
    model_config = ConfigDict(from_attributes=True)


class TokenRespuesta(BaseModel):
    access_token: str
    token_type: str = "bearer"
    nombre_usuario: str
    rol: str
    id_rol: int
    id_usuario: int
    panel_url: str
    id_empleado: int | None = None
