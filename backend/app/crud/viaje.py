from datetime import date, datetime, time
from decimal import Decimal

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.cargos_empleado import canonizar_cargo
from app.core.estados_viaje import (
    ESTADOS_VIAJE_OPERATIVOS,
    etiqueta_estado_viaje,
    normalizar_estado_viaje,
)
from app.crud import empleado as crud_empleado
from app.crud import vehiculo as crud_vehiculo
from app.models.cliente import Cliente
from app.models.reserva import Reserva
from app.models.viaje import Viaje
from app.schemas.viaje import (
    ViajeActualizar,
    ViajeAsignar,
    ViajeCrear,
    ViajePanelLista,
)


def _generar_codigo_viaje(db: Session) -> str:
    """VI-NNNN — VI (viaje) + correlativo de 4 dígitos (ej. VI-0001)."""
    prefijo = "VI-"
    existentes = (
        db.query(Viaje.codigo_viaje)
        .filter(Viaje.codigo_viaje.isnot(None), Viaje.codigo_viaje.like("VI-%"))
        .all()
    )
    max_n = 0
    for (cod,) in existentes:
        if not cod:
            continue
        partes = str(cod).upper().strip().split("-")
        if not partes or partes[0] != "VI":
            continue
        try:
            max_n = max(max_n, int(partes[-1]))
        except ValueError:
            continue
    candidato = f"{prefijo}{max_n + 1:04d}"
    while db.query(Viaje).filter(Viaje.codigo_viaje == candidato).first():
        max_n += 1
        candidato = f"{prefijo}{max_n + 1:04d}"
    return candidato


def activar_para_reserva_confirmada(db: Session, reserva: Reserva) -> Viaje | None:
    """Al confirmar la reserva: código VI-NNNN y estado pendiente (panel Viajes)."""
    if reserva.id_viaje is None:
        return None
    viaje = obtener_por_id(db, reserva.id_viaje)
    if not viaje:
        return None
    if not viaje.codigo_viaje:
        viaje.codigo_viaje = _generar_codigo_viaje(db)
    viaje.estado = "pendiente"
    return viaje


def desactivar_para_reserva_cancelada(db: Session, reserva: Reserva) -> None:
    """Al cancelar: quita código para que no aparezca en el listado de viajes."""
    if reserva.id_viaje is None:
        return
    viaje = obtener_por_id(db, reserva.id_viaje)
    if not viaje:
        return
    viaje.codigo_viaje = None
    viaje.estado = "cancelado"
    viaje.id_vehiculo = None
    viaje.id_empleado = None


def obtener_por_id(db: Session, id_viaje: int) -> Viaje | None:
    return db.query(Viaje).filter(Viaje.id_viaje == id_viaje).first()


def listar(db: Session, estado: str | None = None) -> list[Viaje]:
    consulta = db.query(Viaje)
    if estado:
        consulta = consulta.filter(Viaje.estado == estado)
    return consulta.order_by(Viaje.fecha_salida.desc()).all()


def crear(db: Session, datos: ViajeCrear) -> Viaje:
    viaje = Viaje(**datos.model_dump())
    db.add(viaje)
    db.commit()
    db.refresh(viaje)
    return viaje


def asignar_vehiculo_conductor(
    db: Session, id_viaje: int, id_vehiculo: int, id_empleado: int
) -> Viaje | None:
    """Asesor: vincula flota y conductor (viaje ya confirmado con código VI-xxx)."""
    viaje = obtener_por_id(db, id_viaje)
    if not viaje or not viaje.codigo_viaje:
        return None

    veh = crud_vehiculo.obtener_por_id(db, id_vehiculo)
    if not veh:
        raise ValueError("El vehículo seleccionado no existe.")

    emp = crud_empleado.obtener_por_id(db, id_empleado)
    if not emp:
        raise ValueError("El conductor seleccionado no existe.")
    cargo = canonizar_cargo(emp.cargo or "")
    if cargo != "conductor":
        raise ValueError("El empleado asignado debe tener cargo de conductor.")

    dia_salida = viaje.fecha_salida
    if isinstance(dia_salida, datetime):
        dia_salida = dia_salida.date()
    if not isinstance(dia_salida, date):
        raise ValueError("El viaje no tiene una fecha de salida válida.")

    base_conflicto = (
        db.query(Viaje)
        .join(Reserva, Reserva.id_viaje == Viaje.id_viaje)
        .filter(
            Viaje.id_viaje != id_viaje,
            Viaje.codigo_viaje.isnot(None),
            Viaje.fecha_salida == dia_salida,
            func.lower(func.trim(Reserva.estado)) == "confirmada",
        )
    )
    if (
        base_conflicto.filter(Viaje.id_vehiculo == id_vehiculo).first()
        is not None
    ):
        raise ValueError(
            "Esa unidad ya está asignada a otro viaje con la misma fecha de salida."
        )
    if (
        base_conflicto.filter(Viaje.id_empleado == id_empleado).first()
        is not None
    ):
        raise ValueError(
            "Ese conductor ya está asignado a otro viaje con la misma fecha de salida."
        )

    viaje.id_vehiculo = id_vehiculo
    viaje.id_empleado = id_empleado
    if normalizar_estado_viaje(viaje.estado) == "cancelado":
        viaje.estado = "pendiente"
    db.commit()
    db.refresh(viaje)
    return viaje


def asignar(db: Session, id_viaje: int, datos: ViajeAsignar) -> Viaje | None:
    viaje = obtener_por_id(db, id_viaje)
    if not viaje:
        return None
    viaje.id_vehiculo = datos.id_vehiculo
    viaje.id_empleado = datos.id_empleado
    viaje.precio = Decimal("0")
    if datos.fecha_salida:
        viaje.fecha_salida = datos.fecha_salida
    if datos.hora_salida:
        viaje.hora_salida = datos.hora_salida
    if datos.estado:
        viaje.estado = datos.estado
    for res in (
        db.query(Reserva).filter(Reserva.id_viaje == id_viaje).all()
    ):
        res.precio_total = datos.precio
    db.commit()
    db.refresh(viaje)
    return viaje


def actualizar_estado_por_conductor(
    db: Session, id_viaje: int, id_empleado: int, estado_solicitado: str
) -> Viaje | None:
    """Solo el conductor asignado; estados: pendiente, en_camino, finalizado."""
    viaje = obtener_por_id(db, id_viaje)
    if viaje is None:
        return None
    if viaje.id_empleado != id_empleado:
        return None
    if not (viaje.codigo_viaje or "").strip():
        return None
    actual = normalizar_estado_viaje(viaje.estado)
    if actual == "cancelado":
        raise ValueError("No se puede cambiar el estado de un viaje cancelado.")
    clave = normalizar_estado_viaje(estado_solicitado)
    if clave not in ESTADOS_VIAJE_OPERATIVOS:
        raise ValueError(
            "Estado no permitido. Use: pendiente, en_camino o finalizado."
        )
    viaje.estado = clave
    db.commit()
    db.refresh(viaje)
    return viaje


def actualizar(db: Session, id_viaje: int, datos: ViajeActualizar) -> Viaje | None:
    viaje = obtener_por_id(db, id_viaje)
    if not viaje:
        return None
    for campo, valor in datos.model_dump(exclude_unset=True).items():
        setattr(viaje, campo, valor)
    db.commit()
    db.refresh(viaje)
    return viaje


def eliminar(db: Session, id_viaje: int) -> bool:
    viaje = obtener_por_id(db, id_viaje)
    if not viaje:
        return False
    db.delete(viaje)
    db.commit()
    return True


def listar_para_panel(
    db: Session,
    id_empleado_conductor: int | None = None,
) -> list[ViajePanelLista]:
    """
    Solo viajes con código VI-NNNN (reserva confirmada).
    Origen/destino/salida del viaje; retorno desde la reserva vinculada.
    Si id_empleado_conductor está definido, solo viajes asignados a ese conductor.
    """
    consulta = (
        db.query(Viaje)
        .join(Reserva, Reserva.id_viaje == Viaje.id_viaje)
        .filter(
            Viaje.codigo_viaje.isnot(None),
            func.lower(func.trim(Reserva.estado)) == "confirmada",
        )
    )
    if id_empleado_conductor is not None:
        consulta = consulta.filter(Viaje.id_empleado == id_empleado_conductor)
    viajes = (
        consulta.distinct()
        .order_by(Viaje.fecha_salida.desc(), Viaje.id_viaje.desc())
        .all()
    )
    ids = [v.id_viaje for v in viajes]
    primera_reserva: dict[int, Reserva] = {}
    if ids:
        for r in db.query(Reserva).filter(
            Reserva.id_viaje.in_(ids),
            func.lower(func.trim(Reserva.estado)) == "confirmada",
        ).all():
            if r.id_viaje not in primera_reserva:
                primera_reserva[r.id_viaje] = r

    cliente_ids = {
        r.id_cliente
        for r in primera_reserva.values()
        if r and r.id_cliente is not None
    }
    clientes_map: dict[int, str] = {}
    telefonos_map: dict[int, str | None] = {}
    if cliente_ids:
        for c in db.query(Cliente).filter(Cliente.id_cliente.in_(cliente_ids)).all():
            ape = (c.apellido or "").strip()
            if ape in (".", "-"):
                ape = ""
            clientes_map[c.id_cliente] = f"{c.nombre or ''} {ape}".strip() or "—"
            tel = (c.telefono or "").strip()
            telefonos_map[c.id_cliente] = tel or None

    out: list[ViajePanelLista] = []
    for v in viajes:
        r = primera_reserva.get(v.id_viaje)
        retorno_dt = None
        if r and r.fecha_retorno:
            retorno_dt = datetime.combine(r.fecha_retorno, r.hora_retorno or time(0, 0))

        veh = crud_vehiculo.obtener_por_id(db, v.id_vehiculo) if v.id_vehiculo else None
        veh_placa: str | None = None
        if veh:
            tp = (veh.tipo or "").strip()
            veh_txt = tp or "—"
            pl = (veh.placa or "").strip()
            veh_placa = pl if pl else None
        else:
            veh_txt = "—"

        emp = crud_empleado.obtener_por_id(db, v.id_empleado) if v.id_empleado else None
        if emp:
            ape = (emp.apellido or "").strip()
            if ape in (".", "-"):
                ape = ""
            cond_txt = f"{emp.nombre or ''} {ape}".strip() or "—"
        else:
            cond_txt = "—"

        partida = datetime.combine(v.fecha_salida, v.hora_salida)
        est = normalizar_estado_viaje(v.estado)
        cod_res = None
        pax = None
        cliente_txt = "—"
        cliente_tel: str | None = None
        monto_total = None
        if r:
            cod_res = (r.codigo_reserva or "").strip() or None
            pax = r.cantidad_pasajeros
            monto_total = r.precio_total
            if r.id_cliente is not None:
                cliente_txt = clientes_map.get(r.id_cliente, "—")
                cliente_tel = telefonos_map.get(r.id_cliente)
        elif v.precio is not None:
            monto_total = v.precio

        out.append(
            ViajePanelLista(
                id_viaje=v.id_viaje,
                codigo_viaje=v.codigo_viaje or "—",
                cliente_nombre=cliente_txt,
                cliente_telefono=cliente_tel,
                codigo_reserva=cod_res,
                cantidad_pasajeros=pax,
                origen=v.origen or "—",
                destino=v.destino or "—",
                fecha_salida=partida,
                fecha_retorno=retorno_dt,
                vehiculo_texto=veh_txt,
                conductor_texto=cond_txt,
                estado=etiqueta_estado_viaje(est),
                estado_codigo=est,
                id_vehiculo=v.id_vehiculo,
                id_empleado=v.id_empleado,
                vehiculo_placa=veh_placa,
                monto_total=monto_total,
            )
        )
    return out
