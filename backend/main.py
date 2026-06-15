"""
Punto de entrada BusEasy — une toda la aplicación.
Ejecutar desde backend/:
  .venv\\Scripts\\Activate.ps1
  uvicorn main:app --reload
"""

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.configuracion import (
    CARPETA_COMPROBANTES,
    CARPETA_UPLOADS,
    CORS_ORIGIN_REGEX_LOCAL,
    NOMBRE_APP,
    ORIGENES_PERMITIDOS,
    VERSION_APP,
)
from app.database import inicializar_base_datos
from app.routers import router_api


@asynccontextmanager
async def ciclo_vida(app: FastAPI):
    print(
        "[BusesYa API] archivo main.py cargado desde:",
        Path(__file__).resolve(),
        flush=True,
    )
    CARPETA_UPLOADS.mkdir(parents=True, exist_ok=True)
    CARPETA_COMPROBANTES.mkdir(parents=True, exist_ok=True)
    inicializar_base_datos()
    yield


app = FastAPI(
    title=NOMBRE_APP,
    version=VERSION_APP,
    description="API BusesYa — reservas de transporte",
    lifespan=ciclo_vida,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ORIGENES_PERMITIDOS,
    allow_origin_regex=CORS_ORIGIN_REGEX_LOCAL,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router_api)

# Crear antes del mount: en Render/local la carpeta puede no existir aún
# (lifespan corre después de importar este módulo).
CARPETA_UPLOADS.mkdir(parents=True, exist_ok=True)
CARPETA_COMPROBANTES.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(CARPETA_UPLOADS)), name="uploads")


def _rutas_panel_reservas() -> list[str]:
    """Rutas /reservas/admin vía OpenAPI (FastAPI ya no las expone planas en app.routes)."""
    return sorted(
        path
        for path in app.openapi().get("paths", {})
        if "/reservas/admin" in path
    )


@app.get("/")
def inicio():
    return {
        "mensaje": "BusesYa API funcionando",
        "version": VERSION_APP,
        "documentacion": "/docs",
    }


@app.get("/salud")
def salud(response: Response):
    """
    Comprueba estado y que este proceso cargó las rutas del panel de reservas.
    Si reservas_panel_rutas sale vacío, NO estás ejecutando este código desde backend/
    o corres otro proceso en el puerto 8000.
    """
    response.headers["Cache-Control"] = "no-store, max-age=0"
    admin_rutas = _rutas_panel_reservas()
    return {
        "estado": "ok",
        "version_app": VERSION_APP,
        "reservas_panel_rutas": admin_rutas,
        "hay_panel_reservas": len(admin_rutas) > 0,
        "main_py": str(Path(__file__).resolve()),
    }


@app.get("/api-alive-calidadpag", include_in_schema=False)
def api_alive_calidadpag(response: Response):
    """Nombre único: si esta URL no aparece / responde distinto, el puerto no usa este proyecto."""
    response.headers["Cache-Control"] = "no-store, max-age=0"
    rutas_panel = _rutas_panel_reservas()
    return {
        "proyecto": "CALIDAD_PAG_BACKEND",
        "main_py_en_ejecucion": str(Path(__file__).resolve()),
        "tiene_reservas_admin": len(rutas_panel) > 0,
        "reservas_admin_rutas": sorted(set(rutas_panel)),
    }
