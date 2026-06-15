from sqlalchemy.orm import Session

from app.models.rol import Rol
from app.schemas.rol import RolActualizar, RolCrear


def obtener_por_id(db: Session, id_rol: int) -> Rol | None:
    return db.query(Rol).filter(Rol.id_rol == id_rol).first()


def obtener_por_nombre(db: Session, nombre_rol: str) -> Rol | None:
    return db.query(Rol).filter(Rol.nombre_rol == nombre_rol).first()


def listar(db: Session) -> list[Rol]:
    return db.query(Rol).order_by(Rol.id_rol).all()


def crear(db: Session, datos: RolCrear) -> Rol:
    rol = Rol(**datos.model_dump())
    db.add(rol)
    db.commit()
    db.refresh(rol)
    return rol


def actualizar(db: Session, id_rol: int, datos: RolActualizar) -> Rol | None:
    rol = obtener_por_id(db, id_rol)
    if not rol:
        return None
    for campo, valor in datos.model_dump(exclude_unset=True).items():
        setattr(rol, campo, valor)
    db.commit()
    db.refresh(rol)
    return rol
