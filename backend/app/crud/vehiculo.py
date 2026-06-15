from sqlalchemy.orm import Session

from app.models.viaje import Viaje
from app.models.vehiculo import Vehiculo
from app.schemas.vehiculo import VehiculoActualizar, VehiculoCrear


def obtener_por_id(db: Session, id_vehiculo: int) -> Vehiculo | None:
    return db.query(Vehiculo).filter(Vehiculo.id_vehiculo == id_vehiculo).first()


def obtener_por_placa(db: Session, placa: str) -> Vehiculo | None:
    return db.query(Vehiculo).filter(Vehiculo.placa == placa).first()


def obtener_por_tipo(db: Session, tipo: str) -> Vehiculo | None:
    return (
        db.query(Vehiculo)
        .filter(Vehiculo.tipo.ilike(tipo.strip()))
        .first()
    )


def obtener_minimo_para_pasajeros(db: Session, pasajeros: int) -> Vehiculo | None:
    """Menor vehículo disponible cuya capacidad cubre la cantidad de pasajeros."""
    return (
        db.query(Vehiculo)
        .filter(Vehiculo.capacidad >= pasajeros)
        .order_by(Vehiculo.capacidad.asc())
        .first()
    )


def listar(db: Session, estado: str | None = None) -> list[Vehiculo]:
    consulta = db.query(Vehiculo)
    if estado:
        consulta = consulta.filter(Vehiculo.estado == estado)
    return consulta.order_by(Vehiculo.placa).all()


def listar_disponibles(db: Session) -> list[Vehiculo]:
    return listar(db, estado="disponible")


def cuenta_viajes_con_vehiculo(db: Session, id_vehiculo: int) -> int:
    return (
        db.query(Viaje)
        .filter(Viaje.id_vehiculo == id_vehiculo)
        .count()
    )


def crear(db: Session, datos: VehiculoCrear) -> Vehiculo:
    vehiculo = Vehiculo(**datos.model_dump())
    db.add(vehiculo)
    db.commit()
    db.refresh(vehiculo)
    return vehiculo


def actualizar(db: Session, id_vehiculo: int, datos: VehiculoActualizar) -> Vehiculo | None:
    vehiculo = obtener_por_id(db, id_vehiculo)
    if not vehiculo:
        return None
    for campo, valor in datos.model_dump(exclude_unset=True).items():
        setattr(vehiculo, campo, valor)
    db.commit()
    db.refresh(vehiculo)
    return vehiculo


def eliminar(db: Session, id_vehiculo: int) -> bool:
    """Elimina el vehículo. Comprueba antes que no hubiera viajes asociados."""
    vehiculo = obtener_por_id(db, id_vehiculo)
    if not vehiculo:
        return False
    db.delete(vehiculo)
    db.commit()
    return True
