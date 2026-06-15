from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.crud import rol as crud_rol
from app.database import obtener_sesion
from app.dependencies.auth import requiere_rol
from app.models.usuario import Usuario
from app.schemas.rol import RolRespuesta

router = APIRouter(prefix="/roles", tags=["Roles"])

admin_o_administrador = requiere_rol("admin", "administrador")


@router.get("", response_model=list[RolRespuesta])
def listar_roles(
    _: Usuario = Depends(admin_o_administrador),
    db: Session = Depends(obtener_sesion),
):
    return crud_rol.listar(db)
