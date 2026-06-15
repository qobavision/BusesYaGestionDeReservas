from datetime import datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from pydantic import ValidationError
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.catalogo_vehiculos import (
    CAPACIDAD_MAXIMA_RESERVA,
    capacidad_por_tipo,
    sugerir_desde_catalogo,
)
from app.crud import cliente as crud_cliente
from app.crud import reserva as crud_reserva
from app.crud import viaje as crud_viaje
from app.database import obtener_sesion
from app.dependencies.auth import requiere_rol
from app.models.usuario import Usuario
from app.schemas.reserva import (
    ReservaConsulta,
    ReservaCreadaRespuesta,
    ReservaEstadoPublico,
    ReservaPanelActualizar,
    ReservaPanelLista,
    ReservaPublicaCrear,
    VehiculoSugeridoRespuesta,
    normalizar_estado_reserva,
)
from app.utils.archivos import guardar_comprobante

router = APIRouter(prefix="/reservas", tags=["Reservas"])

solo_admin_reservas = requiere_rol("admin", "administrador")
staff_reservas_panel = requiere_rol("admin", "administrador", "asesor")
staff_reservas_crear = requiere_rol("admin", "administrador", "asesor")


def _crear_reserva_desde_formulario(
    db: Session,
    datos: ReservaPublicaCrear,
    comprobante_ruta: str | None = None,
    *,
    registro_origen: str = "web",
):
    try:
        return crud_reserva.crear_desde_formulario_publico(
            db,
            datos,
            comprobante_ruta=comprobante_ruta,
            registro_origen=registro_origen,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(error),
        ) from error
    except IntegrityError as error:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Ya existe una reserva con ese código. "
                "No pulses Guardar varias veces; recarga la lista e intenta otra vez."
            ),
        ) from error


def _form_opcional_datetime(valor: str | None) -> datetime | None:
    """
    multipart/form-data puede mandar '' en datetime-local vacío;
    datetime | None = Form(None) a veces no interpreta bien el string vacío.
    """
    if valor is None:
        return None
    s = valor.strip()
    if not s:
        return None
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="La fecha de retorno no tiene un formato válido.",
        ) from err


def _parse_precio_total_opcional(valor: str | None) -> Decimal | None:
    if valor is None:
        return None
    s = str(valor).strip().replace(",", ".")
    if not s:
        return None
    try:
        d = Decimal(s)
        if d < 0:
            raise ValueError
        return d.quantize(Decimal("0.01"))
    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="El precio total no es válido.",
        ) from err


def _reserva_a_estado_publico(db: Session, reserva) -> ReservaEstadoPublico:
    cliente = crud_cliente.obtener_por_id(db, reserva.id_cliente) if reserva.id_cliente else None
    viaje = crud_viaje.obtener_por_id(db, reserva.id_viaje) if reserva.id_viaje else None
    tipo_solicitado = getattr(reserva, "tipo_vehiculo_solicitado", None)

    return ReservaEstadoPublico(
        codigo_reserva=reserva.codigo_reserva,
        estado=reserva.estado or "pendiente",
        cantidad_pasajeros=reserva.cantidad_pasajeros,
        precio_total=reserva.precio_total,
        fecha_reserva=reserva.fecha_reserva,
        cliente_nombre=f"{cliente.nombre} {cliente.apellido}".strip() if cliente else None,
        origen=viaje.origen if viaje else None,
        destino=viaje.destino if viaje else None,
        fecha_salida=viaje.fecha_salida if viaje else None,
        hora_salida=viaje.hora_salida if viaje else None,
        vehiculo_tipo=tipo_solicitado,
        vehiculo_capacidad=capacidad_por_tipo(tipo_solicitado),
    )


@router.get("/vehiculo-sugerido", response_model=VehiculoSugeridoRespuesta)
def vehiculo_sugerido(pasajeros: int):
    if pasajeros < 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ingresa al menos 1 pasajero.",
        )
    if pasajeros > CAPACIDAD_MAXIMA_RESERVA:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Máximo {CAPACIDAD_MAXIMA_RESERVA} pasajeros por reserva. "
                "Contáctanos para grupos más grandes."
            ),
        )

    sugerido = sugerir_desde_catalogo(pasajeros)
    if not sugerido:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Máximo {CAPACIDAD_MAXIMA_RESERVA} pasajeros por reserva.",
        )

    return VehiculoSugeridoRespuesta(
        tipo=sugerido["tipo"],
        capacidad=sugerido["capacidad"],
        mensaje=f"{sugerido['tipo']} · Capacidad: {sugerido['capacidad']} pasajeros",
    )


@router.post("", response_model=ReservaCreadaRespuesta, status_code=status.HTTP_201_CREATED)
async def crear_reserva_publica(
    direccion_partida: str = Form(...),
    direccion_llegada: str = Form(...),
    fecha_partida: datetime = Form(...),
    numero_personas: int = Form(...),
    nombre_cliente: str = Form(...),
    dni: str = Form(...),
    telefono: str = Form(...),
    email: str = Form(...),
    metodo_pago: str = Form(...),
    fecha_retorno: str | None = Form(default=None),
    comprobante: UploadFile | None = File(None),
    db: Session = Depends(obtener_sesion),
):
    """
    Formulario público reservas.html.
    Crea cliente + viaje (origen/destino) + reserva (cantidad_pasajeros) + pago.
    """
    fecha_retorno_dt = _form_opcional_datetime(fecha_retorno)
    try:
        datos = ReservaPublicaCrear(
            direccion_partida=direccion_partida,
            direccion_llegada=direccion_llegada,
            fecha_partida=fecha_partida,
            fecha_retorno=fecha_retorno_dt,
            numero_personas=numero_personas,
            nombre_cliente=nombre_cliente,
            dni=dni,
            telefono=telefono,
            email=email,
            metodo_pago=metodo_pago,
        )
    except ValidationError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=error.errors(),
        ) from error

    ruta_comprobante = None
    if comprobante and comprobante.filename:
        ruta_comprobante = guardar_comprobante(comprobante)

    reserva = _crear_reserva_desde_formulario(db, datos, ruta_comprobante)

    tipo_solicitado = reserva.tipo_vehiculo_solicitado

    return ReservaCreadaRespuesta(
        mensaje="Reserva registrada correctamente. Guarda tu código para consultar el estado.",
        codigo_reserva=reserva.codigo_reserva,
        estado=reserva.estado or "pendiente",
        id_reserva=reserva.id_reserva,
        vehiculo_tipo=tipo_solicitado,
        vehiculo_capacidad=capacidad_por_tipo(tipo_solicitado),
    )


@router.post(
    "/admin",
    response_model=ReservaCreadaRespuesta,
    status_code=status.HTTP_201_CREATED,
    summary="Panel — crear reserva (admin / asesor)",
)
async def crear_reserva_staff(
    direccion_partida: str = Form(...),
    direccion_llegada: str = Form(...),
    fecha_partida: datetime = Form(...),
    numero_personas: int = Form(...),
    nombre_cliente: str = Form(...),
    dni: str = Form(...),
    telefono: str = Form(...),
    email: str | None = Form(default=None),
    metodo_pago: str = Form(...),
    fecha_retorno: str | None = Form(default=None),
    precio_total: str | None = Form(default=None),
    comprobante: UploadFile = File(...),
    usuario: Usuario = Depends(staff_reservas_crear),
    db: Session = Depends(obtener_sesion),
):
    """
    Mismo flujo que el formulario público, con precio total opcional (se guarda en la reserva).
    """
    fecha_retorno_dt = _form_opcional_datetime(fecha_retorno)
    email_txt = (email or "").strip() or None
    try:
        datos = ReservaPublicaCrear(
            direccion_partida=direccion_partida,
            direccion_llegada=direccion_llegada,
            fecha_partida=fecha_partida,
            fecha_retorno=fecha_retorno_dt,
            numero_personas=numero_personas,
            nombre_cliente=nombre_cliente,
            dni=dni,
            telefono=telefono,
            email=email_txt,
            metodo_pago=metodo_pago,
        )
    except ValidationError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=error.errors(),
        ) from error

    if not comprobante or not (comprobante.filename or "").strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Debe adjuntar el comprobante de pago.",
        )
    ruta_comprobante = guardar_comprobante(comprobante)

    reserva = _crear_reserva_desde_formulario(
        db, datos, ruta_comprobante, registro_origen="panel"
    )

    r0 = crud_reserva.obtener_por_id(db, reserva.id_reserva)
    if r0:
        r0.comprobante_subido_por_id = usuario.id_usuario
        db.commit()
        db.refresh(r0)
        reserva = r0

    px = _parse_precio_total_opcional(precio_total)
    if px is not None:
        r2 = crud_reserva.obtener_por_id(db, reserva.id_reserva)
        if r2:
            r2.precio_total = px
            if r2.id_viaje is not None:
                v2 = crud_viaje.obtener_por_id(db, r2.id_viaje)
                if v2:
                    v2.precio = Decimal("0")
            db.commit()
            db.refresh(r2)
            reserva = r2

    tipo_solicitado = reserva.tipo_vehiculo_solicitado

    return ReservaCreadaRespuesta(
        mensaje="Reserva creada correctamente.",
        codigo_reserva=reserva.codigo_reserva,
        estado=reserva.estado or "pendiente",
        id_reserva=reserva.id_reserva,
        vehiculo_tipo=tipo_solicitado,
        vehiculo_capacidad=capacidad_por_tipo(tipo_solicitado),
    )


@router.get("/consultar", response_model=list[ReservaEstadoPublico])
def consultar_reserva(
    dni: str,
    codigo_reserva: str | None = None,
    db: Session = Depends(obtener_sesion),
):
    try:
        datos = ReservaConsulta(dni=dni, codigo_reserva=codigo_reserva or None)
    except ValidationError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=error.errors(),
        ) from error

    reservas = crud_reserva.consultar(db, datos)
    if not reservas:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No se encontró ninguna reserva con esos datos.",
        )

    return [_reserva_a_estado_publico(db, r) for r in reservas]


# ----- Panel administrador (JWT admin / administrador) -----


@router.get(
    "/admin",
    response_model=list[ReservaPanelLista],
    summary="Panel — listar reservas (admin / asesor)",
)
def reservas_panel_listar(
    _: Usuario = Depends(staff_reservas_panel),
    db: Session = Depends(obtener_sesion),
):
    return crud_reserva.listar_para_panel(db)


@router.get(
    "/admin/{id_reserva}",
    response_model=ReservaPanelLista,
    summary="Panel — obtener una reserva (admin / asesor)",
)
def reservas_panel_obtener(
    id_reserva: int,
    _: Usuario = Depends(staff_reservas_panel),
    db: Session = Depends(obtener_sesion),
):
    item = crud_reserva.obtener_item_panel(db, id_reserva)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Reserva no encontrada."
        )
    return item


@router.post(
    "/admin/{id_reserva}/comprobante",
    response_model=ReservaPanelLista,
    summary="Panel — subir comprobante de pago (admin / asesor)",
)
async def reservas_subir_comprobante_panel(
    id_reserva: int,
    comprobante: UploadFile = File(...),
    usuario: Usuario = Depends(staff_reservas_panel),
    db: Session = Depends(obtener_sesion),
):
    if not comprobante or not (comprobante.filename or "").strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Selecciona un archivo de comprobante.",
        )
    ruta = guardar_comprobante(comprobante)
    res = crud_reserva.actualizar_comprobante(
        db, id_reserva, ruta, id_usuario_subio=usuario.id_usuario
    )
    if not res:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Reserva no encontrada."
        )
    resultado = crud_reserva.obtener_item_panel(db, id_reserva)
    if not resultado:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No se pudo leer la reserva después de guardar el comprobante.",
        )
    return resultado


@router.patch(
    "/admin/{id_reserva}",
    response_model=ReservaPanelLista,
    summary="Panel — editar reserva (admin / asesor)",
)
def reservas_panel_actualizar(
    id_reserva: int,
    datos: ReservaPanelActualizar,
    usuario: Usuario = Depends(staff_reservas_panel),
    db: Session = Depends(obtener_sesion),
):
    if not datos.model_dump(exclude_unset=True):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No hay cambios por aplicar.",
        )
    actual = crud_reserva.obtener_por_id(db, id_reserva)
    if not actual:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Reserva no encontrada."
        )
    if datos.estado is not None:
        nuevo = normalizar_estado_reserva(datos.estado)
        prev = normalizar_estado_reserva(actual.estado)
        if prev == "pendiente" and nuevo == "confirmada":
            comp = (actual.comprobante_pago or "").strip()
            if not comp:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Para confirmar la reserva adjunta primero el comprobante de pago.",
                )
    try:
        actualizada = crud_reserva.actualizar_desde_panel(
            db, id_reserva, datos, panel_usuario_id=usuario.id_usuario
        )
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(err)
        ) from err

    if not actualizada:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Reserva no encontrada."
        )
    resultado = crud_reserva.obtener_item_panel(db, id_reserva)
    if not resultado:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No se pudo leer la reserva después de guardar.",
        )
    return resultado


@router.delete(
    "/admin/{id_reserva}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Panel — eliminar reserva (admin / asesor)",
)
def reservas_panel_eliminar(
    id_reserva: int,
    _: Usuario = Depends(staff_reservas_panel),
    db: Session = Depends(obtener_sesion),
):
    if not crud_reserva.eliminar_desde_panel(db, id_reserva):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Reserva no encontrada."
        )
    return None
