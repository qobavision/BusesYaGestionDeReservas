from sqlalchemy import case
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from pydantic import ValidationError

from app.core.cargos_empleado import canonizar_cargo
from app.models.empleado import Empleado
from app.models.usuario import Usuario
from app.models.viaje import Viaje
from app.schemas.empleado import EmpleadoActualizar, EmpleadoCrear, EmpleadoRespuesta


def obtener_por_id(db: Session, id_empleado: int) -> Empleado | None:
    return db.query(Empleado).filter(Empleado.id_empleado == id_empleado).first()


def obtener_por_dni(db: Session, dni: str) -> Empleado | None:
    return db.query(Empleado).filter(Empleado.dni == dni).first()


def _orden_sql_por_cargo():
    return case(
        (Empleado.cargo == "administrador", 1),
        (Empleado.cargo == "asesor_ventas", 2),
        (Empleado.cargo == "conductor", 3),
        else_=99,
    )


def listar_todos_ordenados(db: Session) -> list[Empleado]:
    """Panel admin: todos los empleados ordenados por tipo de cargo."""
    return (
        db.query(Empleado)
        .order_by(
            _orden_sql_por_cargo(),
            Empleado.apellido,
            Empleado.nombre,
        )
        .all()
    )


def listar_sin_cuenta_sistema(db: Session) -> list[Empleado]:
    """Empleados que aún no tienen usuario vinculado (alta usuario en panel admin)."""
    ids_ocupados = [
        tid
        for (tid,) in db.query(Usuario.id_empleado)
        .filter(Usuario.id_empleado.isnot(None))
        .distinct()
    ]
    q = db.query(Empleado).order_by(
        _orden_sql_por_cargo(),
        Empleado.apellido,
        Empleado.nombre,
    )
    if ids_ocupados:
        q = q.filter(~Empleado.id_empleado.in_(ids_ocupados))
    return q.all()


def listar(db: Session, cargo: str | None = None, solo_activos: bool = True) -> list[Empleado]:
    consulta = db.query(Empleado)
    if solo_activos:
        consulta = consulta.filter(Empleado.estado.is_(True))
    if cargo:
        consulta = consulta.filter(Empleado.cargo == cargo)
    return consulta.order_by(Empleado.apellido, Empleado.nombre).all()


def listar_conductores_disponibles(db: Session) -> list[Empleado]:
    return listar(db, cargo="conductor", solo_activos=True)


def _fusion_actualizar_para_validar(empleado: Empleado, valores: dict) -> dict:
    """Combina BD + PATCH para validar con EmpleadoCrear."""
    telef_db = empleado.telefono if empleado.telefono else ""

    fus = dict(
        nombre=valores.get("nombre", empleado.nombre),
        apellido=valores.get("apellido", empleado.apellido),
        dni=valores.get("dni", empleado.dni),
        telefono=valores.get("telefono", telef_db),
        email=valores["email"] if "email" in valores else empleado.email,
        cargo=valores.get("cargo", empleado.cargo),
        licencia=(
            valores["licencia"]
            if "licencia" in valores
            else empleado.licencia
        ),
    )

    carg_fin = canonizar_cargo(fus["cargo"]) or fus["cargo"]
    if carg_fin != "conductor":
        fus["licencia"] = None
    elif fus["licencia"] is not None:
        fus["licencia"] = str(fus["licencia"]).strip() or None

    return fus


def crear(db: Session, datos: EmpleadoCrear) -> Empleado:
    empleado = Empleado(**datos.model_dump())
    db.add(empleado)
    db.commit()
    db.refresh(empleado)
    return empleado


def actualizar(db: Session, id_empleado: int, datos: EmpleadoActualizar) -> Empleado | None:
    empleado = obtener_por_id(db, id_empleado)
    if not empleado:
        return None

    valores = datos.model_dump(exclude_unset=True)
    estado_nuevo = valores.pop("estado", None)

    try:
        fusion = _fusion_actualizar_para_validar(empleado, valores)
        validado = EmpleadoCrear.model_validate(fusion)
    except ValidationError as err:
        msg = err.errors()[0].get("msg", "Datos no válidos") if err.errors() else str(err)
        raise ValueError(msg) from err

    dump = validado.model_dump()
    for campo, val in dump.items():
        setattr(empleado, campo, val)

    if estado_nuevo is not None:
        empleado.estado = estado_nuevo

    db.commit()
    db.refresh(empleado)
    return empleado


def cuenta_usuarios_vinculados(db: Session, id_empleado: int) -> int:
    return (
        db.query(Usuario)
        .filter(Usuario.id_empleado == id_empleado)
        .count()
    )


def cuenta_viajes_con_empleado(db: Session, id_empleado: int) -> int:
    return (
        db.query(Viaje)
        .filter(Viaje.id_empleado == id_empleado)
        .count()
    )


def eliminar(db: Session, id_empleado: int) -> bool:
    empleado = obtener_por_id(db, id_empleado)
    if not empleado:
        return False
    db.delete(empleado)
    db.commit()
    return True


def eliminar_con_cascada_admin(
    db: Session,
    id_empleado: int,
    id_usuario_operador: int | None = None,
) -> bool:
    """
    Elimina empleado aunque tenga usuario del sistema y/o viajes como conductor:
    - borra usuarios vinculados (no puede ser el usuario que ejecuta la acción);
    - deja viajes sin conductor asignado (id_empleado = NULL).
    """
    from app.crud import usuario as crud_usuario

    empleado = obtener_por_id(db, id_empleado)
    if not empleado:
        return False

    usuarios = db.query(Usuario).filter(Usuario.id_empleado == id_empleado).all()
    for u in usuarios:
        if id_usuario_operador is not None and u.id_usuario == id_usuario_operador:
            raise ValueError(
                "No puedes eliminar un empleado vinculado a tu propia cuenta. "
                "Pide a otro administrador que lo haga o desvincula antes tu usuario."
            )
        crud_usuario.anular_referencias_hacia_usuario(db, u.id_usuario)
        db.delete(u)

    db.query(Viaje).filter(Viaje.id_empleado == id_empleado).update(
        {Viaje.id_empleado: None},
        synchronize_session=False,
    )

    db.delete(empleado)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise
    return True
