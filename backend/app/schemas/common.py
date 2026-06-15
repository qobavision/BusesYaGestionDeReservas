from pydantic import BaseModel


class MensajeRespuesta(BaseModel):
    mensaje: str
    exito: bool = True


class ErrorRespuesta(BaseModel):
    detalle: str
    exito: bool = False
