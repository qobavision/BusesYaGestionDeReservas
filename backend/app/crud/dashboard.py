"""Agregados para el dashboard del administrador."""



from datetime import date, datetime, time

from decimal import Decimal



from sqlalchemy import Date, cast, extract, func, or_

from sqlalchemy.orm import Session



from app.core.estados_viaje import etiqueta_estado_viaje, normalizar_estado_viaje

from app.crud.reserva import _texto_nombre_cliente

from app.models.cliente import Cliente
from app.models.pago import Pago

from app.models.reserva import Reserva

from app.models.vehiculo import Vehiculo

from app.models.viaje import Viaje

from app.schemas.dashboard import DashboardActividadReciente, DashboardResumen

from app.schemas.reserva import (
    etiqueta_estado_reserva,
    normalizar_estado_reserva,
)





def _listar_actividad_reciente(
    db: Session, limite: int = 12
) -> list[DashboardActividadReciente]:
    """
    Actividad unificada: cada fila refleja su registro.
    RES-* → estado de reserva (pendiente, confirmada, cancelada).
    VI-* → estado de viaje (pendiente, en camino, finalizado).
    """
    n = max(1, min(int(limite), 30))
    ordenados: list[tuple[int, DashboardActividadReciente]] = []

    reservas = (
        db.query(Reserva).order_by(Reserva.id_reserva.desc()).limit(n * 3).all()
    )
    if not reservas:
        return []

    ids_viaje = {r.id_viaje for r in reservas if r.id_viaje is not None}
    ids_cliente = {r.id_cliente for r in reservas if r.id_cliente is not None}

    viajes_map: dict[int, Viaje] = {}
    if ids_viaje:
        for v in db.query(Viaje).filter(Viaje.id_viaje.in_(ids_viaje)).all():
            viajes_map[v.id_viaje] = v

    clientes_map: dict[int, Cliente] = {}
    if ids_cliente:
        for c in db.query(Cliente).filter(Cliente.id_cliente.in_(ids_cliente)).all():
            clientes_map[c.id_cliente] = c

    for r in reservas:
        cli = clientes_map.get(r.id_cliente)
        via = viajes_map.get(r.id_viaje) if r.id_viaje else None
        nombre = (
            _texto_nombre_cliente(cli.nombre, cli.apellido) if cli else "—"
        ) or "—"
        origen = (via.origen if via and via.origen else "—") or "—"
        destino = (via.destino if via and via.destino else "—") or "—"
        if via:
            partida = datetime.combine(via.fecha_salida, via.hora_salida)
        else:
            partida = datetime.now()

        est_res = normalizar_estado_reserva(r.estado)
        ordenados.append(
            (
                r.id_reserva * 10,
                DashboardActividadReciente(
                    tipo="reserva",
                    codigo=r.codigo_reserva or "—",
                    cliente_nombre=nombre,
                    origen=origen,
                    destino=destino,
                    fecha_salida=partida,
                    estado=etiqueta_estado_reserva(est_res),
                    estado_clave=est_res,
                ),
            )
        )

        if not via or not via.codigo_viaje:
            continue
        est_via = normalizar_estado_viaje(via.estado)
        ordenados.append(
            (
                via.id_viaje * 10 + 1,
                DashboardActividadReciente(
                    tipo="viaje",
                    codigo=via.codigo_viaje,
                    cliente_nombre=nombre,
                    origen=origen,
                    destino=destino,
                    fecha_salida=partida,
                    estado=etiqueta_estado_viaje(est_via),
                    estado_clave=est_via,
                ),
            )
        )

    ordenados.sort(key=lambda par: par[0], reverse=True)
    return [par[1] for par in ordenados[:n]]





def obtener_resumen_admin(db: Session) -> DashboardResumen:

    hoy = date.today()



    reservas_hoy = (

        db.query(func.count(Reserva.id_reserva))

        .filter(cast(Reserva.fecha_reserva, Date) == hoy)

        .scalar()

        or 0

    )



    reservas_mes = (

        db.query(func.count(Reserva.id_reserva))

        .filter(

            extract("year", Reserva.fecha_reserva) == hoy.year,

            extract("month", Reserva.fecha_reserva) == hoy.month,

        )

        .scalar()

        or 0

    )



    reservas_pendientes = (

        db.query(func.count(Reserva.id_reserva))

        .filter(

            or_(

                Reserva.estado.is_(None),

                func.trim(Reserva.estado) == "",

                func.lower(Reserva.estado) == "pendiente",

            )

        )

        .scalar()

        or 0

    )



    reservas_confirmadas = (

        db.query(func.count(Reserva.id_reserva))

        .filter(func.lower(Reserva.estado) == "confirmada")

        .scalar()

        or 0

    )



    ing_raw = (

        db.query(func.coalesce(func.sum(Pago.monto), 0))

        .filter(

            Pago.estado == "verificado",

            Pago.fecha_pago.isnot(None),

            extract("year", Pago.fecha_pago) == hoy.year,

            extract("month", Pago.fecha_pago) == hoy.month,

        )

        .scalar()

    )

    ingresos_mes = float(Decimal(str(ing_raw)) if ing_raw is not None else Decimal("0"))



    viajes_completados = (

        db.query(func.count(Viaje.id_viaje))

        .filter(

            Viaje.codigo_viaje.isnot(None),

            func.lower(func.trim(Viaje.estado)).in_(["completado", "finalizado"]),

        )

        .scalar()

        or 0

    )



    viajes_activos = (

        db.query(func.count(Viaje.id_viaje))

        .filter(

            Viaje.codigo_viaje.isnot(None),

            func.lower(func.trim(Viaje.estado)).in_(["pendiente", "en_camino"]),

        )

        .scalar()

        or 0

    )



    vehiculos_disponibles = (

        db.query(func.count(Vehiculo.id_vehiculo))

        .filter(func.lower(func.coalesce(Vehiculo.estado, "")) == "disponible")

        .scalar()

        or 0

    )



    return DashboardResumen(

        reservas_hoy=int(reservas_hoy),

        reservas_mes=int(reservas_mes),

        reservas_pendientes=int(reservas_pendientes),

        reservas_confirmadas=int(reservas_confirmadas),

        ingresos_mes_soles=ingresos_mes,

        viajes_activos=int(viajes_activos),

        viajes_completados=int(viajes_completados),

        vehiculos_disponibles=int(vehiculos_disponibles),

        actividad_reciente=_listar_actividad_reciente(db, 12),

    )


