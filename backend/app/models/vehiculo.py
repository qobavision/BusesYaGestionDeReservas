from sqlalchemy import CheckConstraint, Column, Integer, String

from app.models.base import Base


class Vehiculo(Base):
    __tablename__ = "vehiculo"
    __table_args__ = (
        CheckConstraint(
            "capacidad > 0 AND capacidad <= 60",
            name="chk_capacidad",
        ),
    )

    id_vehiculo = Column(Integer, primary_key=True, autoincrement=True)
    placa = Column(String(10), nullable=False, unique=True)
    tipo = Column(String(20))
    marca = Column(String(30))
    modelo = Column(String(30))
    capacidad = Column(Integer, nullable=False)
    anio_fabricacion = Column(Integer)
    estado = Column(String(20))
