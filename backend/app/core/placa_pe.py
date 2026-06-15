"""
Normalización y validación de placas al estilo habitual en Perú.

Formato aceptado aquí: tres letras + tres dígitos (vehículos particulares típicos),
ejemplo ``ABC-123``. Se acepta también ``ABC123`` y se devuelve siempre ``AAA-NNN``.
Otros formatos (p. ej. Mercosur extendido) se pueden agregar más adelante.
"""

import re


def normalizar_placa_peru(placa: str) -> str:
    if not placa or not isinstance(placa, str):
        raise ValueError("La placa es obligatoria.")

    limpio = re.sub(r"\s+", "", placa.strip()).upper().replace("-", "")

    if len(limpio) != 6:
        raise ValueError(
            "La placa debe tener 6 caracteres: 3 letras y 3 números. Ejemplo: ABC-123."
        )

    if not re.fullmatch(r"[A-Z]{3}\d{3}", limpio):
        raise ValueError(
            "Formato de placa no válido. Use 3 letras (A-Z) y 3 números (0-9). Ejemplo: ABC-123."
        )

    return f"{limpio[:3]}-{limpio[3:]}"
