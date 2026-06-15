from sqlalchemy import Boolean, CheckConstraint, Column, DateTime, Integer, String, func

from app.models.base import Base


class Cliente(Base):
    __tablename__ = "cliente"
    __table_args__ = (
        CheckConstraint("dni ~ '^[0-9]+$'", name="chk_cliente_dni"),
    )

    id_cliente = Column(Integer, primary_key=True, autoincrement=True)
    nombre = Column(String(50), nullable=False)
    apellido = Column(String(50), nullable=False)
    dni = Column(String(8), nullable=False, unique=True)
    telefono = Column(String(15))
    email = Column(String(100))
    fecha_registro = Column(DateTime, server_default=func.now())
    estado = Column(Boolean, default=True)
