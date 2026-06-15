from sqlalchemy import CheckConstraint, Column, DateTime, ForeignKey, Integer, Numeric, String

from app.models.base import Base


class Pago(Base):
    __tablename__ = "pago"
    __table_args__ = (
        CheckConstraint("monto >= 0", name="chk_monto"),
    )

    id_pago = Column(Integer, primary_key=True, autoincrement=True)
    monto = Column(Numeric(10, 2), nullable=False)
    metodo_pago = Column(String(20))
    fecha_pago = Column(DateTime)
    codigo_operacion = Column(String(50))
    estado = Column(String(20))
    id_reserva = Column(Integer, ForeignKey("reserva.id_reserva"))
    verificado_por_id = Column(Integer, ForeignKey("usuario.id_usuario"), nullable=True)
