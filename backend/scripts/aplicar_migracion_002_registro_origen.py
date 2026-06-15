"""
Añade reserva.registro_origen (web | panel).

Uso (desde la carpeta backend):

    .venv\\Scripts\\python.exe scripts\\aplicar_migracion_002_registro_origen.py
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
      ADD COLUMN IF NOT EXISTS registro_origen VARCHAR(20)
    """,
    """
    COMMENT ON COLUMN reserva.registro_origen IS
      'web = formulario público; panel = creado desde panel staff.'
    """,
]


def main() -> None:
    engine = create_engine(URL)
    with engine.begin() as conn:
        for raw in STMTS:
            conn.execute(text(raw.strip()))
    print("Migración 002 aplicada: reserva.registro_origen.")


if __name__ == "__main__":
    main()
