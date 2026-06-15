from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.crud import cliente as crud_cliente
from app.crud import pago as crud_pago
from app.crud import reserva as crud_reserva
from app.database import obtener_sesion
from app.dependencies.auth import requiere_rol
from app.models.usuario import Usuario
from app.schemas.pago import PagoPendientePanel, PagoRespuesta

router = APIRouter(prefix="/pagos", tags=["Pagos"])

_staff_pagos = requiere_rol("admin", "administrador", "asesor")


def _item_pendiente(db: Session, pago) -> PagoPendientePanel | None:
    reserva = crud_reserva.obtener_por_id(db, pago.id_reserva)
    if not reserva:
        return None
    cli = (
        crud_cliente.obtener_por_id(db, reserva.id_cliente)
        if reserva.id_cliente is not None
        else None
    )
    nombre = "—"
    if cli:
        nombre = f"{cli.nombre} {cli.apellido}".strip() or "—"
    return PagoPendientePanel(
        id_pago=pago.id_pago,
        id_reserva=reserva.id_reserva,
        codigo_reserva=reserva.codigo_reserva,
        cliente_nombre=nombre,
        monto=pago.monto if pago.monto is not None else 0,
        metodo_pago=pago.metodo_pago,
        comprobante_pago=reserva.comprobante_pago,
        fecha_registro=reserva.fecha_reserva,
    )


@router.get(
    "/pendientes",
    response_model=list[PagoPendientePanel],
    summary="Panel asesor — pagos con comprobante por verificar",
)
def listar_pagos_pendientes(
    _: Usuario = Depends(_staff_pagos),
    db: Session = Depends(obtener_sesion),
):
    filas = []
    for pago in crud_pago.listar_pendientes(db):
        reserva = crud_reserva.obtener_por_id(db, pago.id_reserva)
        if not reserva or not reserva.comprobante_pago:
            continue
        item = _item_pendiente(db, pago)
        if item:
            filas.append(item)
    filas.sort(key=lambda x: x.fecha_registro, reverse=True)
    return filas


@router.post(
    "/reserva/{id_reserva}/verificar",
    response_model=PagoRespuesta,
    summary="Panel asesor — verificar pago y confirmar reserva",
)
def verificar_pago_reserva(
    id_reserva: int,
    usuario: Usuario = Depends(_staff_pagos),
    db: Session = Depends(obtener_sesion),
):
    reserva = crud_reserva.obtener_por_id(db, id_reserva)
    if not reserva:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Reserva no encontrada.",
        )
    pago = crud_pago.verificar_y_confirmar_reserva(
        db, id_reserva, verificado_por_id=usuario.id_usuario
    )
    if not pago:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No hay pago registrado para esta reserva.",
        )
    return pago
