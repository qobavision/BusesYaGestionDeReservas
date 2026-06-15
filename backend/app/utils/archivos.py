import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile, status

from app.configuracion import CARPETA_COMPROBANTES

EXTENSIONES_PERMITIDAS = {".jpg", ".jpeg", ".png", ".pdf"}
MAX_BYTES = 5 * 1024 * 1024


def guardar_comprobante(archivo: UploadFile) -> str:
    nombre_original = archivo.filename or ""
    extension = Path(nombre_original).suffix.lower()

    if extension not in EXTENSIONES_PERMITIDAS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tipo de archivo no permitido. Usa JPG, PNG o PDF.",
        )

    contenido = archivo.file.read()
    if len(contenido) > MAX_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El archivo es demasiado grande. Máximo 5MB.",
        )

    CARPETA_COMPROBANTES.mkdir(parents=True, exist_ok=True)
    nombre_guardado = f"{uuid.uuid4().hex}{extension}"
    ruta = CARPETA_COMPROBANTES / nombre_guardado
    ruta.write_bytes(contenido)

    return f"comprobantes/{nombre_guardado}"
