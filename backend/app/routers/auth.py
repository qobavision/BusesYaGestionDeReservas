from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.paneles import url_panel_por_rol
from app.core.seguridad import crear_token
from app.crud import rol as crud_rol
from app.crud import usuario as crud_usuario
from app.database import obtener_sesion
from app.dependencies.auth import obtener_usuario_actual
from app.models.usuario import Usuario
from app.schemas.usuario import TokenRespuesta, UsuarioLogin, UsuarioRespuesta

router = APIRouter(prefix="/auth", tags=["Autenticación"])


@router.post("/login", response_model=TokenRespuesta)
def iniciar_sesion(datos: UsuarioLogin, db: Session = Depends(obtener_sesion)):
    usuario = crud_usuario.autenticar(db, datos.email, datos.password)
    if not usuario:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Correo o contraseña incorrectos",
        )

    rol = crud_rol.obtener_por_id(db, usuario.id_rol)
    nombre_rol = rol.nombre_rol if rol else "admin"
    token = crear_token(usuario.id_usuario, usuario.id_rol, nombre_rol)

    return TokenRespuesta(
        access_token=token,
        nombre_usuario=usuario.nombre_usuario,
        rol=nombre_rol,
        id_rol=usuario.id_rol,
        id_usuario=usuario.id_usuario,
        panel_url=url_panel_por_rol(nombre_rol),
        id_empleado=usuario.id_empleado,
    )


@router.get("/me", response_model=UsuarioRespuesta)
def usuario_actual(usuario: Usuario = Depends(obtener_usuario_actual)):
    return usuario
