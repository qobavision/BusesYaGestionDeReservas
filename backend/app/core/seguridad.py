"""
Tokens JWT para login y rutas protegidas.
"""

from datetime import datetime, timedelta, timezone

from jose import JWTError, jwt

from app.configuracion import CLAVE_SECRETA, TIEMPO_TOKEN_MINUTOS

ALGORITMO = "HS256"


def crear_token(id_usuario: int, id_rol: int, nombre_rol: str) -> str:
    expira = datetime.now(timezone.utc) + timedelta(minutes=TIEMPO_TOKEN_MINUTOS)
    payload = {
        "sub": str(id_usuario),
        "id_rol": id_rol,
        "rol": nombre_rol,
        "exp": expira,
    }
    return jwt.encode(payload, CLAVE_SECRETA, algorithm=ALGORITMO)


def decodificar_token(token: str) -> dict | None:
    try:
        return jwt.decode(token, CLAVE_SECRETA, algorithms=[ALGORITMO])
    except JWTError:
        return None
