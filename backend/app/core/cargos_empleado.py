"""
Cargos de empleados BusesYa (valor guardado en empleado.cargo).
Orden de listado: administradores → asesores de ventas → conductores.
"""

from __future__ import annotations

ORDEN_CARGOS: tuple[tuple[str, int], ...] = (
    ("administrador", 1),
    ("asesor_ventas", 2),
    ("conductor", 3),
)

CARGOS_PERMITIDOS = frozenset(c for c, _ in ORDEN_CARGOS)
PRIORIDAD_CARGO = {c: i for c, i in ORDEN_CARGOS}

ROTULOS_CARGO: dict[str, str] = {
    "administrador": "Administrador",
    "asesor_ventas": "Asesor de ventas",
    "conductor": "Conductor",
}


def canonizar_cargo(cargo: str) -> str | None:
    """Normaliza a slug interno; None si vacío."""
    if not cargo or not str(cargo).strip():
        return None
    c = str(cargo).strip().lower().replace("-", "_").replace(" ", "_")
    if c == "asesor":
        c = "asesor_ventas"
    elif c == "admin":
        c = "administrador"
    if c not in CARGOS_PERMITIDOS:
        return None
    return c
