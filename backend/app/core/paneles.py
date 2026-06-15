"""
Redirección según rol del usuario.
"""

PANELES_POR_ROL = {
    "admin": "panel-admin.html",
    "administrador": "panel-admin.html",
    "asesor": "panel-asesor.html",
    "asesor de ventas": "panel-asesor.html",
    "asesor_ventas": "panel-asesor.html",
    "conductor": "panel-conductor.html",
}


def url_panel_por_rol(nombre_rol: str) -> str:
    clave = (nombre_rol or "").strip().lower()
    return PANELES_POR_ROL.get(clave, "panel-admin.html")
