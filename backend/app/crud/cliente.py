from sqlalchemy.orm import Session

from app.models.cliente import Cliente
from app.schemas.cliente import ClienteActualizar, ClienteCrear


def obtener_por_id(db: Session, id_cliente: int) -> Cliente | None:
    return db.query(Cliente).filter(Cliente.id_cliente == id_cliente).first()


def obtener_por_dni(db: Session, dni: str) -> Cliente | None:
    return db.query(Cliente).filter(Cliente.dni == dni).first()


def listar(db: Session, solo_activos: bool = True) -> list[Cliente]:
    consulta = db.query(Cliente)
    if solo_activos:
        consulta = consulta.filter(Cliente.estado.is_(True))
    return consulta.order_by(Cliente.apellido, Cliente.nombre).all()


def crear(db: Session, datos: ClienteCrear) -> Cliente:
    cliente = Cliente(**datos.model_dump())
    db.add(cliente)
    db.commit()
    db.refresh(cliente)
    return cliente


def obtener_o_crear(
    db: Session,
    nombre: str,
    apellido: str,
    dni: str,
    telefono: str | None = None,
    email: str | None = None,
) -> Cliente:
    existente = obtener_por_dni(db, dni)
    if existente:
        if telefono:
            existente.telefono = telefono
        if email:
            existente.email = str(email)
        existente.nombre = nombre
        existente.apellido = apellido
        db.commit()
        db.refresh(existente)
        return existente
    return crear(
        db,
        ClienteCrear(
            nombre=nombre,
            apellido=apellido,
            dni=dni,
            telefono=telefono,
            email=email,
        ),
    )


def actualizar(db: Session, id_cliente: int, datos: ClienteActualizar) -> Cliente | None:
    cliente = obtener_por_id(db, id_cliente)
    if not cliente:
        return None
    for campo, valor in datos.model_dump(exclude_unset=True).items():
        setattr(cliente, campo, valor)
    db.commit()
    db.refresh(cliente)
    return cliente
