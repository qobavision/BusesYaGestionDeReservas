"""
Catálogo fijo de vehículos BusesYa.
El menor vehículo cuya capacidad cubre la cantidad de pasajeros es el asignado.
"""

CAPACIDAD_MAXIMA_RESERVA = 50

CATALOGO_VEHICULOS = [
    {"tipo": "Minivan", "capacidad": 10},
    {"tipo": "Van", "capacidad": 20},
    {"tipo": "Coaster", "capacidad": 30},
    {"tipo": "Omnibus", "capacidad": 50},
]

# Variante con tilde o nombre anterior equivocado
_CAPACIDAD_TIPO_LEGACY = {
    "ómnibus": 50,
    "longibus": 50,
}


def sugerir_desde_catalogo(cantidad_pasajeros: int) -> dict | None:
    if cantidad_pasajeros < 1:
        return None
    for vehiculo in sorted(CATALOGO_VEHICULOS, key=lambda v: v["capacidad"]):
        if vehiculo["capacidad"] >= cantidad_pasajeros:
            return vehiculo
    return None


def capacidad_por_tipo(tipo: str | None) -> int | None:
    if not tipo:
        return None
    clave = tipo.strip().lower()
    for vehiculo in CATALOGO_VEHICULOS:
        if vehiculo["tipo"].lower() == clave:
            return vehiculo["capacidad"]
    return _CAPACIDAD_TIPO_LEGACY.get(clave)
