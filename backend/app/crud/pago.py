from datetime import datetime
from decimal import Decimal

from sqlalchemy.orm import Session

from app.models.pago import Pago
from app.schemas.pago import PagoActualizar, PagoCrear


def obtener_por_id(db: Session, id_pago: int) -> Pago | None:
    return db.query(Pago).filter(Pago.id_pago == id_pago).first()


def obtener_por_reserva(db: Session, id_reserva: int) -> Pago | None:
    return db.query(Pago).filter(Pago.id_reserva == id_reserva).first()


def listar(db: Session, estado: str | None = None) -> list[Pago]:
    consulta = db.query(Pago)
    if estado:
        consulta = consulta.filter(Pago.estado == estado)
    return consulta.order_by(Pago.id_pago.desc()).all()


def listar_pendientes(db: Session) -> list[Pago]:
    return listar(db, estado="pendiente")


def crear(db: Session, datos: PagoCrear) -> Pago:
    pago = Pago(**datos.model_dump())
    # fecha_pago solo cuando el asesor verifica el pago (estado verificado)
    if pago.estado == "verificado" and not pago.fecha_pago:
        pago.fecha_pago = datetime.now()
    db.add(pago)
    db.commit()
    db.refresh(pago)
    return pago


def verificar(db: Session, id_pago: int) -> Pago | None:
    pago = obtener_por_id(db, id_pago)
    if not pago:
        return None
    pago.estado = "verificado"
    if not pago.fecha_pago:
        pago.fecha_pago = datetime.now()
    db.commit()
    db.refresh(pago)
    return pago


def verificar_por_reserva(db: Session, id_reserva: int) -> Pago | None:
    pago = obtener_por_reserva(db, id_reserva)
    if not pago:
        return None
    return verificar(db, pago.id_pago)


def verificar_y_confirmar_reserva(
    db: Session, id_reserva: int, verificado_por_id: int | None = None
) -> Pago | None:
    """
    Panel asesor: marca pago verificado y confirma la reserva si estaba pendiente.
    """
    from app.crud import reserva as crud_reserva_mod
    from app.crud import viaje as crud_viaje_mod
    from app.schemas.reserva import normalizar_estado_reserva

    pago = obtener_por_reserva(db, id_reserva)
    if not pago:
        return None
    if (pago.estado or "").strip().lower() == "verificado":
        return pago

    pago.estado = "verificado"
    if not pago.fecha_pago:
        pago.fecha_pago = datetime.now()
    if verificado_por_id is not None:
        pago.verificado_por_id = verificado_por_id

    reserva = crud_reserva_mod.obtener_por_id(db, id_reserva)
    if reserva:
        est = normalizar_estado_reserva(reserva.estado)
        if est == "pendiente":
            reserva.estado = "confirmada"
            if reserva.precio_total is None or reserva.precio_total <= 0:
                if pago.monto and pago.monto > 0:
                    reserva.precio_total = pago.monto
            crud_viaje_mod.activar_para_reserva_confirmada(db, reserva)

    db.commit()
    db.refresh(pago)
    return pago


def sincronizar_pago_admin_confirmada(
    db: Session,
    id_reserva: int,
    monto: Decimal,
    metodo_pago: str | None = None,
    verificado_por_id: int | None = None,
) -> Pago:
    """
    Panel admin: reserva confirmada = cobro registrado.
    Crea o actualiza el pago como verificado (suma en ingresos del mes).
    """
    pago = obtener_por_reserva(db, id_reserva)
    metodo = (metodo_pago or "").strip() or "admin"
    if not pago:
        pago = Pago(
            monto=monto,
            metodo_pago=metodo[:20],
            id_reserva=id_reserva,
            estado="verificado",
            fecha_pago=datetime.now(),
            verificado_por_id=verificado_por_id,
        )
        db.add(pago)
        return pago

    pago.monto = monto
    if metodo_pago:
        pago.metodo_pago = metodo[:20]
    pago.estado = "verificado"
    if not pago.fecha_pago:
        pago.fecha_pago = datetime.now()
    if verificado_por_id is not None:
        pago.verificado_por_id = verificado_por_id
    return pago


def sincronizar_pago_al_estado_reserva(
    db: Session,
    id_reserva: int,
    estado_reserva: str,
    monto: Decimal,
    metodo_pago: str | None = None,
    verificado_por_id: int | None = None,
) -> None:
    """Alinea tabla pago con el estado de la reserva (flujo admin)."""
    est = (estado_reserva or "pendiente").strip().lower()
    if est == "confirmada":
        if monto <= 0:
            raise ValueError(
                "Para confirmar la reserva indica un monto mayor a cero (S/)."
            )
        sincronizar_pago_admin_confirmada(
            db, id_reserva, monto, metodo_pago, verificado_por_id=verificado_por_id
        )
        return

    pago = obtener_por_reserva(db, id_reserva)
    if not pago:
        return

    if est == "cancelada":
        pago.estado = "cancelado"
        pago.monto = monto if monto > 0 else pago.monto
        return

    # pendiente u otro: no contar como ingreso verificado
    if pago.estado == "verificado":
        pago.estado = "pendiente"
    if monto > 0:
        pago.monto = monto


def eliminar_por_reserva(db: Session, id_reserva: int) -> int:
    """Elimina todos los pagos vinculados a la reserva. Devuelve filas borradas."""
    return db.query(Pago).filter(Pago.id_reserva == id_reserva).delete(
        synchronize_session=False,
    )


def actualizar(db: Session, id_pago: int, datos: PagoActualizar) -> Pago | None:
    pago = obtener_por_id(db, id_pago)
    if not pago:
        return None
    for campo, valor in datos.model_dump(exclude_unset=True).items():
        setattr(pago, campo, valor)
    db.commit()
    db.refresh(pago)
    return pago
