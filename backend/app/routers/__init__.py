from fastapi import APIRouter

from app.routers import (
    admin_dashboard,
    auth,
    clientes,
    empleados,
    pagos,
    reservas,
    roles,
    usuarios,
    vehiculos,
    viajes,
)
router_api = APIRouter(prefix="/api")

router_api.include_router(auth.router)
router_api.include_router(clientes.router)
router_api.include_router(empleados.router)
router_api.include_router(roles.router)
router_api.include_router(usuarios.router)
router_api.include_router(vehiculos.router)
router_api.include_router(viajes.router)
router_api.include_router(reservas.router)
router_api.include_router(pagos.router)
router_api.include_router(admin_dashboard.router)
__all__ = ["router_api"]
