from sqlalchemy import CheckConstraint, Column, Date, DateTime, ForeignKey, Integer, Numeric, String, Text, Time, func

from app.models.base import Base


class Reserva(Base):
    __tablename__ = "reserva"
    __table_args__ = (
        CheckConstraint("cantidad_pasajeros > 0", name="chk_pasajeros"),
        CheckConstraint("precio_total >= 0", name="chk_precio_total"),
    )

    id_reserva = Column(Integer, primary_key=True, autoincrement=True)
    codigo_reserva = Column(String(50), nullable=False, unique=True)
    fecha_reserva = Column(DateTime, server_default=func.now())
    cantidad_pasajeros = Column(Integer, nullable=False)
    precio_total = Column(Numeric(10, 2), nullable=False)
    estado = Column(String(20))
    comprobante_pago = Column(Text)
    registro_origen = Column(String(20), nullable=True)
    comprobante_subido_por_id = Column(Integer, ForeignKey("usuario.id_usuario"), nullable=True)
    tipo_vehiculo_solicitado = Column(String(20))
    id_cliente = Column(Integer, ForeignKey("cliente.id_cliente"))
    id_viaje = Column(Integer, ForeignKey("viaje.id_viaje"))
    fecha_retorno = Column(Date, nullable=True)
    hora_retorno = Column(Time, nullable=True)
