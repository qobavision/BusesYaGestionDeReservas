"""
Dependencia: usuario autenticado mediante JWT.
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.seguridad import decodificar_token
from app.crud import rol as crud_rol
from app.crud import usuario as crud_usuario
from app.database import obtener_sesion
from app.models.usuario import Usuario

esquema_bearer = HTTPBearer(auto_error=False)


def obtener_usuario_actual(
    credenciales: HTTPAuthorizationCredentials | None = Depends(esquema_bearer),
    db: Session = Depends(obtener_sesion),
) -> Usuario:
    if not credenciales or not credenciales.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No autenticado. Inicia sesión de nuevo.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decodificar_token(credenciales.credentials)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Sesión expirada o token inválido",
            headers={"WWW-Authenticate": "Bearer"},
        )

    id_usuario = int(payload.get("sub", 0))
    usuario = crud_usuario.obtener_por_id(db, id_usuario)
    if not usuario or not usuario.estado:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario no válido",
        )
    return usuario


def _rol_coincide_con_permitido(nombre_rol_bd: str | None, permitido: str) -> bool:
    """
    Compara el nombre de rol en BD con uno de los permitidos.
    Acepta alias habituales (p. ej. «asesor de ventas» = asesor del panel).
    """
    n = (nombre_rol_bd or "").strip().lower()
    p = (permitido or "").strip().lower()
    if n == p:
        return True
    if p == "asesor" and n in (
        "asesor de ventas",
        "asesor_ventas",
        "asesor ventas",
    ):
        return True
    if p == "admin" and n == "administrador":
        return True
    if p == "administrador" and n == "admin":
        return True
    return False


def requiere_rol(*roles_permitidos: str):
    """Dependencia factory: solo permite ciertos roles."""

    def _verificar(
        usuario: Usuario = Depends(obtener_usuario_actual),
        db: Session = Depends(obtener_sesion),
    ) -> Usuario:
        rol = crud_rol.obtener_por_id(db, usuario.id_rol)
        nombre_bd = rol.nombre_rol if rol else ""
        if not any(
            _rol_coincide_con_permitido(nombre_bd, p) for p in roles_permitidos
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tienes permiso para esta acción",
            )
        return usuario

    return _verificar
