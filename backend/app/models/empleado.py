from sqlalchemy import Boolean, CheckConstraint, Column, Integer, String

from app.models.base import Base


class Empleado(Base):
    __tablename__ = "empleado"
    __table_args__ = (
        CheckConstraint("dni ~ '^[0-9]+$'", name="chk_empleado_dni"),
    )

    id_empleado = Column(Integer, primary_key=True, autoincrement=True)
    nombre = Column(String(50), nullable=False)
    apellido = Column(String(50), nullable=False)
    dni = Column(String(8), nullable=False, unique=True)
    telefono = Column(String(15))
    email = Column(String(100))
    cargo = Column(String(30), nullable=False)
    licencia = Column(String(30))
    estado = Column(Boolean, default=True)
