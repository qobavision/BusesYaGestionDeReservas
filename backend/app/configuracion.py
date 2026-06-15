"""
Variables de entorno (.env en la carpeta backend).
"""

import os
from pathlib import Path

from dotenv import load_dotenv

CARPETA_BACKEND = Path(__file__).resolve().parent.parent
ARCHIVO_ENV = CARPETA_BACKEND / ".env"
CARPETA_UPLOADS = CARPETA_BACKEND / "uploads"
CARPETA_COMPROBANTES = CARPETA_UPLOADS / "comprobantes"

load_dotenv(ARCHIVO_ENV)


def obtener_variable(nombre: str, valor_por_defecto: str = "") -> str:
    return os.getenv(nombre, valor_por_defecto)


NOMBRE_APP = obtener_variable("NOMBRE_APP", "BusesYa API")
VERSION_APP = obtener_variable("VERSION_APP", "1.0.0")

HOST = obtener_variable("HOST", "127.0.0.1")
PUERTO = int(obtener_variable("PUERTO", "8000"))
RECARGA_AUTOMATICA = obtener_variable("RECARGA_AUTOMATICA", "true").lower() == "true"

CLAVE_SECRETA = obtener_variable("CLAVE_SECRETA", "clave-temporal-solo-desarrollo")
TIEMPO_TOKEN_MINUTOS = int(obtener_variable("TIEMPO_TOKEN_MINUTOS", "480"))

URL_BASE_DATOS = obtener_variable("URL_BASE_DATOS", "")

FRONTEND_URL = obtener_variable("FRONTEND_URL", "http://127.0.0.1:5500")
_origenes_extra = obtener_variable("FRONTEND_URLS_EXTRA", "")
ORIGENES_PERMITIDOS = [FRONTEND_URL]
if _origenes_extra:
    ORIGENES_PERMITIDOS.extend([u.strip() for u in _origenes_extra.split(",") if u.strip()])

# Desarrollo: Live Server suele usar 127.0.0.1 o localhost según configuración.
# - "null": algunos navegadores envían Origin: null al abrir el HTML como file://
#   (solo útil en local; en producción define FRONTEND_URL único).
_DEV_ALIASES_HTTP = [
    "http://127.0.0.1:5500",
    "http://localhost:5500",
    "http://127.0.0.1:5501",
    "http://localhost:5501",
    "http://127.0.0.1:8080",
    "http://localhost:8080",
    "null",
]
ORIGENES_PERMITIDOS = list(dict.fromkeys(ORIGENES_PERMITIDOS + _DEV_ALIASES_HTTP))

# Loopback y red local (RFC1918) en cualquier puerto: Live Server, otra máquina en LAN, etc.
# En producción limita FRONTEND_URL y evita exponer el API sin autenticación adecuada.
CORS_ORIGIN_REGEX_LOCAL = (
    r"^https?://("
    r"127\.0\.0\.1|\[::1\]|localhost|"
    r"10\.\d{1,3}\.\d{1,3}\.\d{1,3}|"
    r"192\.168\.\d{1,3}\.\d{1,3}|"
    r"172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}"
    r")(?::\d{1,5})?$"
)
