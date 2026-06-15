from sqlalchemy import CheckConstraint, Column, Date, ForeignKey, Integer, Numeric, String, Time

from app.models.base import Base


class Viaje(Base):
    __tablename__ = "viaje"
    __table_args__ = (
        CheckConstraint("precio >= 0", name="chk_precio"),
    )

    id_viaje = Column(Integer, primary_key=True, autoincrement=True)
    codigo_viaje = Column(String(20), unique=True, nullable=True)
    origen = Column(String(50), nullable=False)
    destino = Column(String(50), nullable=False)
    fecha_salida = Column(Date, nullable=False)
    hora_salida = Column(Time, nullable=False)
    precio = Column(Numeric(10, 2), nullable=False)
    estado = Column(String(20))
    id_vehiculo = Column(Integer, ForeignKey("vehiculo.id_vehiculo"))
    id_empleado = Column(Integer, ForeignKey("empleado.id_empleado"))
