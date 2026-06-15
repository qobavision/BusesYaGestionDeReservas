"""Estados operativos del viaje (panel + conductor)."""

ESTADOS_VIAJE_OPERATIVOS = frozenset({"pendiente", "en_camino", "finalizado"})


def normalizar_estado_viaje(valor: str | None) -> str:
    if not valor or not isinstance(valor, str):
        return "pendiente"
    x = valor.strip().lower().replace(" ", "_")
    mapa = {
        "programado": "pendiente",
        "pre_reserva": "pendiente",
        "confirmado": "pendiente",
        "confirmada": "pendiente",
        "asignado": "pendiente",
        "en_curso": "en_camino",
        "en_camino": "en_camino",
        "en_trayecto": "en_camino",
        "trayecto": "en_camino",
        "iniciado": "en_camino",
        "iniciando": "en_camino",
        "iniciando_viaje": "en_camino",
        "completado": "finalizado",
        "finalizado": "finalizado",
        "cancelado": "cancelado",
        "cancelada": "cancelado",
    }
    return mapa.get(x, x if x in ESTADOS_VIAJE_OPERATIVOS else "pendiente")


def etiqueta_estado_viaje(clave: str) -> str:
    return {
        "pendiente": "Pendiente",
        "en_camino": "En camino",
        "finalizado": "Finalizado",
        "cancelado": "Cancelado",
    }.get(clave, clave.replace("_", " ").capitalize())
