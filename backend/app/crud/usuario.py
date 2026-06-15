import bcrypt
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.usuario import Usuario
from app.schemas.usuario import UsuarioActualizar, UsuarioCrear


def anular_referencias_hacia_usuario(db: Session, id_usuario: int) -> None:
    """Quita FKs opcionales que apuntan a este usuario (poder borrar la cuenta desde panel admin)."""
    from app.models.pago import Pago
    from app.models.reserva import Reserva

    db.query(Reserva).filter(Reserva.comprobante_subido_por_id == id_usuario).update(
        {Reserva.comprobante_subido_por_id: None},
        synchronize_session=False,
    )
    db.query(Pago).filter(Pago.verificado_por_id == id_usuario).update(
        {Pago.verificado_por_id: None},
        synchronize_session=False,
    )


def eliminar_por_id(db: Session, id_usuario: int) -> bool:
    """Elimina usuario tras limpiar referencias (reservas/pagos)."""
    usuario = obtener_por_id(db, id_usuario)
    if not usuario:
        return False
    try:
        anular_referencias_hacia_usuario(db, id_usuario)
        db.delete(usuario)
        db.commit()
        return True
    except IntegrityError:
        db.rollback()
        raise


def encriptar_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verificar_password(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(
        password.encode("utf-8"),
        password_hash.encode("utf-8"),
    )


def obtener_por_id(db: Session, id_usuario: int) -> Usuario | None:
    return db.query(Usuario).filter(Usuario.id_usuario == id_usuario).first()


def obtener_por_correo(db: Session, correo: str) -> Usuario | None:
    return db.query(Usuario).filter(Usuario.correo == correo).first()


def obtener_por_nombre_usuario(db: Session, nombre_usuario: str) -> Usuario | None:
    return db.query(Usuario).filter(Usuario.nombre_usuario == nombre_usuario).first()


def obtener_por_id_empleado(db: Session, id_empleado: int) -> Usuario | None:
    return db.query(Usuario).filter(Usuario.id_empleado == id_empleado).first()


def listar_filas_para_admin(db: Session):
    from app.models.empleado import Empleado
    from app.models.rol import Rol

    return (
        db.query(Usuario, Empleado, Rol)
        .outerjoin(Rol, Rol.id_rol == Usuario.id_rol)
        .outerjoin(Empleado, Empleado.id_empleado == Usuario.id_empleado)
        .order_by(Usuario.nombre_usuario)
        .all()
    )


def listar(db: Session, solo_activos: bool = True) -> list[Usuario]:
    consulta = db.query(Usuario)
    if solo_activos:
        consulta = consulta.filter(Usuario.estado.is_(True))
    return consulta.order_by(Usuario.nombre_usuario).all()


def crear(db: Session, datos: UsuarioCrear) -> Usuario:
    datos_dict = datos.model_dump()
    datos_dict["password"] = encriptar_password(datos_dict.pop("password"))
    usuario = Usuario(**datos_dict)
    db.add(usuario)
    db.commit()
    db.refresh(usuario)
    return usuario


def actualizar(db: Session, id_usuario: int, datos: UsuarioActualizar) -> Usuario | None:
    usuario = obtener_por_id(db, id_usuario)
    if not usuario:
        return None
    cambios = datos.model_dump(exclude_unset=True)
    if "password" in cambios:
        cambios["password"] = encriptar_password(cambios.pop("password"))
    for campo, valor in cambios.items():
        setattr(usuario, campo, valor)
    db.commit()
    db.refresh(usuario)
    return usuario


def autenticar(db: Session, correo: str, password: str) -> Usuario | None:
    usuario = obtener_por_correo(db, correo)
    if not usuario or not usuario.estado:
        return None
    if not verificar_password(password, usuario.password):
        return None
    return usuario
