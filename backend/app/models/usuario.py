from sqlalchemy import Boolean, Column, ForeignKey, Integer, String

from app.models.base import Base


class Usuario(Base):
    __tablename__ = "usuario"

    id_usuario = Column(Integer, primary_key=True, autoincrement=True)
    nombre_usuario = Column(String(50), nullable=False)
    correo = Column(String(100), nullable=False)
    password = Column(String(255), nullable=False)
    estado = Column(Boolean, default=True)
    id_empleado = Column(Integer, ForeignKey("empleado.id_empleado"), unique=True)
    id_rol = Column(Integer, ForeignKey("rol.id_rol"))
