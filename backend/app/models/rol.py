from sqlalchemy import Column, Integer, String

from app.models.base import Base


class Rol(Base):
    __tablename__ = "rol"

    id_rol = Column(Integer, primary_key=True, autoincrement=True)
    nombre_rol = Column(String(20), nullable=False)
    descripcion = Column(String(100))
