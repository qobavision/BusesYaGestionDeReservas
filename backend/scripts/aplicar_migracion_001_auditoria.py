"""
Añade columnas de auditoría en PostgreSQL (reserva / pago).
Equivale a ejecutar migrations/001_reserva_pago_auditoria.sql.

Uso (desde la carpeta backend, con .env y URL_BASE_DATOS correctos):

    .venv\\Scripts\\python.exe scripts\\aplicar_migracion_001_auditoria.py
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine, text

BACKEND = Path(__file__).resolve().parent.parent
load_dotenv(BACKEND / ".env")

URL = (os.getenv("URL_BASE_DATOS") or "").strip()
if not URL:
    print("Error: define URL_BASE_DATOS en backend/.env", file=sys.stderr)
    sys.exit(1)

STMTS = [
    """
    ALTER TABLE reserva
      ADD COLUMN IF NOT EXISTS comprobante_subido_por_id INTEGER REFERENCES usuario (id_usuario)
    """,
    """
    ALTER TABLE pago
      ADD COLUMN IF NOT EXISTS verificado_por_id INTEGER REFERENCES usuario (id_usuario)
    """,
    """
    COMMENT ON COLUMN reserva.comprobante_subido_por_id IS
      'Usuario del panel que adjuntó/reemplazó el comprobante; NULL si solo cliente (web).'
    """,
    """
    COMMENT ON COLUMN pago.verificado_por_id IS
      'Usuario del sistema que marcó el pago como verificado.'
    """,
]


def main() -> None:
    engine = create_engine(URL)
    with engine.begin() as conn:
        for raw in STMTS:
            conn.execute(text(raw.strip()))
    print("Migración 001 aplicada: comprobante_subido_por_id (reserva), verificado_por_id (pago).")


if __name__ == "__main__":
    main()
