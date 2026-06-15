from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.crud import dashboard as crud_dashboard
from app.database import obtener_sesion
from app.dependencies.auth import requiere_rol
from app.models.usuario import Usuario
from app.schemas.dashboard import DashboardResumen

router = APIRouter(prefix="/admin", tags=["Administración"])

_requiere_admin = requiere_rol("admin", "administrador")


@router.get(
    "/dashboard",
    response_model=DashboardResumen,
    summary="Resumen para dashboard (admin)",
)
def resumen_dashboard(
    _: Usuario = Depends(_requiere_admin),
    db: Session = Depends(obtener_sesion),
):
    return crud_dashboard.obtener_resumen_admin(db)
