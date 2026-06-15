from datetime import datetime, time
from decimal import Decimal

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.catalogo_vehiculos import CAPACIDAD_MAXIMA_RESERVA, sugerir_desde_catalogo
from app.crud import cliente as crud_cliente
from app.crud import empleado as crud_empleado
from app.crud import pago as crud_pago
from app.crud import vehiculo as crud_vehiculo
from app.crud import viaje as crud_viaje
from app.models.cliente import Cliente
from app.models.reserva import Reserva
from app.schemas.pago import PagoCrear
from app.schemas.reserva import (
    ReservaActualizar,
    ReservaConsulta,
    ReservaCrear,
    ReservaPanelActualizar,
    ReservaPanelLista,
    ReservaPublicaCrear,
    normalizar_estado_reserva,
)
from app.schemas.viaje import ViajeCrear


def _generar_codigo_reserva(db: Session) -> str:
    """RES-AAAA-NNNN: correlativo del año según códigos ya usados (no count())."""
    anio = datetime.now().year
    prefijo = f"RES-{anio}-"
    existentes = (
        db.query(Reserva.codigo_reserva)
        .filter(Reserva.codigo_reserva.like(f"{prefijo}%"))
        .all()
    )
    max_n = 0
    for (cod,) in existentes:
        if not cod or not str(cod).startswith(prefijo):
            continue
        sufijo = str(cod)[len(prefijo) :]
        try:
            max_n = max(max_n, int(sufijo))
        except ValueError:
            continue
    candidato = f"{prefijo}{max_n + 1:04d}"
    while obtener_por_codigo(db, candidato):
        max_n += 1
        candidato = f"{prefijo}{max_n + 1:04d}"
    return candidato


def _separar_nombre(nombre_completo: str) -> tuple[str, str]:
    partes = nombre_completo.strip().split(maxsplit=1)
    nombre = partes[0]
    apellido = partes[1] if len(partes) > 1 else ""
    return nombre, apellido


def _texto_nombre_cliente(nombre: str | None, apellido: str | None) -> str:
    """Nombre para panel: sin apellido ficticio «.» de registros antiguos."""
    nom = (nombre or "").strip()
    ape = (apellido or "").strip()
    if ape in (".", "-", "—"):
        ape = ""
    partes = [p for p in (nom, ape) if p]
    return " ".join(partes)


def obtener_por_id(db: Session, id_reserva: int) -> Reserva | None:
    return db.query(Reserva).filter(Reserva.id_reserva == id_reserva).first()


def obtener_por_codigo(db: Session, codigo: str) -> Reserva | None:
    return db.query(Reserva).filter(Reserva.codigo_reserva == codigo).first()


def listar(db: Session, estado: str | None = None) -> list[Reserva]:
    consulta = db.query(Reserva)
    if estado:
        consulta = consulta.filter(Reserva.estado == estado)
    return consulta.order_by(Reserva.fecha_reserva.desc()).all()


def crear(db: Session, datos: ReservaCrear) -> Reserva:
    reserva = Reserva(**datos.model_dump())
    db.add(reserva)
    db.commit()
    db.refresh(reserva)
    return reserva


def crear_desde_formulario_publico(
    db: Session,
    datos: ReservaPublicaCrear,
    comprobante_ruta: str | None = None,
    precio_inicial: Decimal = Decimal("0"),
    *,
    registro_origen: str | None = "web",
) -> Reserva:
    """
    Flujo: cliente + viaje + reserva (+ pago opcional).
    Usado por el formulario público (web) y por el panel (staff); el canal se indica con registro_origen.
    """
    nombre, apellido = _separar_nombre(datos.nombre_cliente)
    cliente = crud_cliente.obtener_o_crear(
        db,
        nombre=nombre,
        apellido=apellido,
        dni=datos.dni,
        telefono=datos.telefono,
        email=str(datos.email) if datos.email else None,
    )

    if datos.numero_personas > CAPACIDAD_MAXIMA_RESERVA:
        raise ValueError(
            f"Máximo {CAPACIDAD_MAXIMA_RESERVA} pasajeros por reserva. "
            "Contáctanos para grupos más grandes."
        )

    sugerido = sugerir_desde_catalogo(datos.numero_personas)
    if not sugerido:
        raise ValueError(
            f"Máximo {CAPACIDAD_MAXIMA_RESERVA} pasajeros por reserva. "
            "Contáctanos para grupos más grandes."
        )

    viaje = crud_viaje.crear(
        db,
        ViajeCrear(
            origen=datos.direccion_partida[:50],
            destino=datos.direccion_llegada[:50],
            fecha_salida=datos.fecha_partida.date(),
            hora_salida=datos.fecha_partida.time(),
            precio=precio_inicial,
            estado="programado",
            id_vehiculo=None,
        ),
    )

    canal = (registro_origen or "web").strip().lower()
    if canal not in ("web", "panel"):
        canal = "web"

    reserva: Reserva | None = None
    for _intento in range(8):
        codigo = _generar_codigo_reserva(db)
        candidata = Reserva(
            codigo_reserva=codigo,
            cantidad_pasajeros=datos.numero_personas,
            precio_total=precio_inicial,
            estado="pendiente",
            comprobante_pago=comprobante_ruta,
            registro_origen=canal,
            tipo_vehiculo_solicitado=sugerido["tipo"],
            id_cliente=cliente.id_cliente,
            id_viaje=viaje.id_viaje,
        )
        if datos.fecha_retorno:
            candidata.fecha_retorno = datos.fecha_retorno.date()
            candidata.hora_retorno = datos.fecha_retorno.time()
        db.add(candidata)
        try:
            db.commit()
            db.refresh(candidata)
            reserva = candidata
            break
        except IntegrityError as err:
            db.rollback()
            if "codigo_reserva" not in str(err).lower():
                raise
    if reserva is None:
        raise ValueError(
            "No se pudo generar un código de reserva único. Intenta de nuevo."
        )

    if datos.metodo_pago:
        crud_pago.crear(
            db,
            PagoCrear(
                monto=precio_inicial,
                metodo_pago=datos.metodo_pago,
                id_reserva=reserva.id_reserva,
                estado="pendiente",
            ),
        )

    return reserva


def consultar(db: Session, datos: ReservaConsulta) -> list[Reserva]:
    consulta = (
        db.query(Reserva)
        .join(Cliente, Reserva.id_cliente == Cliente.id_cliente)
        .filter(Cliente.dni == datos.dni)
    )
    if datos.codigo_reserva:
        consulta = consulta.filter(Reserva.codigo_reserva == datos.codigo_reserva)
    return consulta.order_by(Reserva.fecha_reserva.desc()).all()


def actualizar(db: Session, id_reserva: int, datos: ReservaActualizar) -> Reserva | None:
    reserva = obtener_por_id(db, id_reserva)
    if not reserva:
        return None
    for campo, valor in datos.model_dump(exclude_unset=True).items():
        setattr(reserva, campo, valor)
    db.commit()
    db.refresh(reserva)
    return reserva


def actualizar_comprobante(
    db: Session,
    id_reserva: int,
    ruta_comprobante: str,
    id_usuario_subio: int | None = None,
) -> Reserva | None:
    reserva = obtener_por_id(db, id_reserva)
    if not reserva:
        return None
    reserva.comprobante_pago = ruta_comprobante
    if id_usuario_subio is not None:
        reserva.comprobante_subido_por_id = id_usuario_subio
    db.commit()
    db.refresh(reserva)
    return reserva


def _nombre_mostrado_usuario_panel(db: Session, id_usuario: int | None) -> str | None:
    """Nombre legible del usuario del sistema (empleado vinculado o nombre de usuario)."""
    if id_usuario is None:
        return None
    from app.crud import empleado as crud_empleado
    from app.crud import usuario as crud_usuario

    u = crud_usuario.obtener_por_id(db, id_usuario)
    if not u:
        return None
    if u.id_empleado is not None:
        emp = crud_empleado.obtener_por_id(db, u.id_empleado)
        if emp:
            txt = f"{emp.nombre or ''} {emp.apellido or ''}".strip()
            if txt:
                return txt
    return (u.nombre_usuario or "").strip() or None


def _construir_item_panel(db: Session, r: Reserva) -> ReservaPanelLista:
    cli = (
        crud_cliente.obtener_por_id(db, r.id_cliente)
        if r.id_cliente is not None
        else None
    )
    via = (
        crud_viaje.obtener_por_id(db, r.id_viaje) if r.id_viaje is not None else None
    )
    nombre = _texto_nombre_cliente(cli.nombre, cli.apellido) if cli else ""
    dni_txt = cli.dni if cli and cli.dni else ""
    tel_txt = ""
    if cli and cli.telefono:
        tel_txt = str(cli.telefono).strip()
    origen_txt = via.origen if via and via.origen else ""
    destino_txt = via.destino if via and via.destino else ""
    if via:
        partida = datetime.combine(via.fecha_salida, via.hora_salida)
    else:
        partida = datetime.now()

    retorno_dt: datetime | None = None
    if r.fecha_retorno is not None:
        hm = (
            r.hora_retorno
            if r.hora_retorno is not None
            else time(0, 0)
        )
        retorno_dt = datetime.combine(r.fecha_retorno, hm)

    pago_vinc = crud_pago.obtener_por_reserva(db, r.id_reserva)
    estado_pago_txt = (
        (pago_vinc.estado or "pendiente").strip().lower() if pago_vinc else "pendiente"
    )
    registro_canal = (getattr(r, "registro_origen", None) or "").strip().lower()
    if registro_canal not in ("web", "panel"):
        registro_canal = None
    comp_ruta = (r.comprobante_pago or "").strip()
    subido_por_id = r.comprobante_subido_por_id
    comprobante_subido_nom = _nombre_mostrado_usuario_panel(db, subido_por_id)
    if comprobante_subido_nom is None and comp_ruta:
        comprobante_subido_nom = "Cliente (web)"
    elif not comp_ruta:
        comprobante_subido_nom = None

    verif_por_id = pago_vinc.verificado_por_id if pago_vinc else None
    pago_verificado_nom = _nombre_mostrado_usuario_panel(db, verif_por_id)
    codigo_viaje_txt = via.codigo_viaje if via and via.codigo_viaje else None
    flota_ok = bool(
        via
        and via.id_vehiculo is not None
        and via.id_empleado is not None
    )

    vehiculo_txt: str | None = None
    conductor_txt: str | None = None
    if via and via.id_vehiculo is not None:
        veh = crud_vehiculo.obtener_por_id(db, via.id_vehiculo)
        if veh:
            pl = (veh.placa or "").strip()
            tp = (veh.tipo or "").strip()
            vehiculo_txt = (f"{pl} · {tp}" if pl else tp) or None
    if via and via.id_empleado is not None:
        emp = crud_empleado.obtener_por_id(db, via.id_empleado)
        if emp:
            ape = (emp.apellido or "").strip()
            if ape in (".", "-", "—"):
                ape = ""
            conductor_txt = f"{emp.nombre or ''} {ape}".strip() or None

    return ReservaPanelLista(
        id_reserva=r.id_reserva,
        codigo_reserva=r.codigo_reserva,
        fecha_registro_reserva=r.fecha_reserva,
        cliente_nombre=nombre or "—",
        cliente_dni=dni_txt or "—",
        cliente_telefono=tel_txt or "—",
        origen=origen_txt or "—",
        destino=destino_txt or "—",
        cantidad_pasajeros=r.cantidad_pasajeros,
        precio_total=r.precio_total if r.precio_total is not None else Decimal("0"),
        fecha_partida=partida,
        fecha_retorno=retorno_dt,
        estado=normalizar_estado_reserva(r.estado),
        registro_origen=registro_canal,
        estado_pago=estado_pago_txt,
        metodo_pago=pago_vinc.metodo_pago if pago_vinc else None,
        comprobante_pago=r.comprobante_pago,
        id_pago=pago_vinc.id_pago if pago_vinc else None,
        comprobante_subido_nombre=comprobante_subido_nom,
        pago_verificado_nombre=pago_verificado_nom,
        codigo_viaje=codigo_viaje_txt,
        flota_asignada=flota_ok,
        vehiculo_texto=vehiculo_txt,
        conductor_texto=conductor_txt,
    )


def listar_para_panel(db: Session) -> list[ReservaPanelLista]:
    reservas = db.query(Reserva).order_by(Reserva.fecha_reserva.desc()).all()
    return [_construir_item_panel(db, x) for x in reservas]


def listar_ultimas_para_panel(db: Session, limite: int = 8) -> list[ReservaPanelLista]:
    """Últimas reservas por fecha de registro (para dashboard sin cargar todo el listado)."""
    n = max(1, min(int(limite), 50))
    reservas = (
        db.query(Reserva).order_by(Reserva.fecha_reserva.desc()).limit(n).all()
    )
    return [_construir_item_panel(db, x) for x in reservas]


def obtener_item_panel(db: Session, id_reserva: int) -> ReservaPanelLista | None:
    r = obtener_por_id(db, id_reserva)
    if not r:
        return None
    return _construir_item_panel(db, r)


def actualizar_desde_panel(
    db: Session,
    id_reserva: int,
    datos: ReservaPanelActualizar,
    panel_usuario_id: int | None = None,
) -> Reserva | None:
    """Actualiza datos de negocio de la reserva y del viaje vinculado (un solo commit)."""
    reserva = obtener_por_id(db, id_reserva)
    if not reserva:
        return None

    valores = datos.model_dump(exclude_unset=True)
    if not valores:
        return reserva

    if "estado" in valores and valores["estado"] is not None:
        reserva.estado = normalizar_estado_reserva(valores["estado"])

    if "cantidad_pasajeros" in valores and valores["cantidad_pasajeros"] is not None:
        reserva.cantidad_pasajeros = valores["cantidad_pasajeros"]

    if "precio_total" in valores and valores["precio_total"] is not None:
        reserva.precio_total = valores["precio_total"]

    if "fecha_retorno" in valores:
        fr = valores["fecha_retorno"]
        if fr is None:
            reserva.fecha_retorno = None
            reserva.hora_retorno = None
        else:
            reserva.fecha_retorno = fr.date()
            reserva.hora_retorno = fr.time()

    viaje = (
        crud_viaje.obtener_por_id(db, reserva.id_viaje)
        if reserva.id_viaje is not None
        else None
    )

    if viaje is not None:
        if "origen" in valores and valores["origen"] is not None:
            viaje.origen = valores["origen"]
        if "destino" in valores and valores["destino"] is not None:
            viaje.destino = valores["destino"]
        if "fecha_partida" in valores and valores["fecha_partida"] is not None:
            fp = valores["fecha_partida"]
            viaje.fecha_salida = fp.date()
            viaje.hora_salida = fp.time()
        if "precio_total" in valores and valores["precio_total"] is not None:
            viaje.precio = Decimal("0")

    estado_efectivo = normalizar_estado_reserva(reserva.estado)
    precio_efectivo = (
        reserva.precio_total
        if reserva.precio_total is not None
        else Decimal("0")
    )
    pago_vinc = crud_pago.obtener_por_reserva(db, id_reserva)
    metodo_existente = pago_vinc.metodo_pago if pago_vinc else None

    if (
        "estado" in valores
        or "precio_total" in valores
        or estado_efectivo == "confirmada"
    ):
        crud_pago.sincronizar_pago_al_estado_reserva(
            db,
            id_reserva,
            estado_efectivo,
            precio_efectivo,
            metodo_existente,
            verificado_por_id=panel_usuario_id,
        )

    if "estado" in valores:
        if estado_efectivo == "confirmada":
            crud_viaje.activar_para_reserva_confirmada(db, reserva)
        elif estado_efectivo == "cancelada":
            crud_viaje.desactivar_para_reserva_cancelada(db, reserva)

    try:
        db.flush()
        vis = _construir_item_panel(db, reserva)
        if (
            vis.fecha_retorno is not None
            and vis.fecha_retorno < vis.fecha_partida
        ):
            db.rollback()
            raise ValueError(
                "La fecha de retorno no puede ser anterior a la fecha de partida."
            )
        db.commit()
    except ValueError:
        raise
    except Exception:
        db.rollback()
        raise

    db.refresh(reserva)
    return reserva


def eliminar_desde_panel(db: Session, id_reserva: int) -> bool:
    """Borra pagos, reserva y el viaje si ya no tiene más reservas."""
    r = obtener_por_id(db, id_reserva)
    if not r:
        return False
    vid = r.id_viaje
    crud_pago.eliminar_por_reserva(db, id_reserva)
    db.delete(r)
    db.commit()

    if vid is None:
        return True

    quedan = db.query(Reserva).filter(Reserva.id_viaje == vid).count()
    if quedan == 0:
        crud_viaje.eliminar(db, vid)

    return True