from datetime import datetime

from pydantic import BaseModel, Field


class DashboardActividadReciente(BaseModel):
    """Fila unificada: reserva reciente o viaje confirmado (código VI-xxx)."""

    tipo: str  # reserva | viaje
    codigo: str
    cliente_nombre: str
    origen: str
    destino: str
    fecha_salida: datetime
    estado: str
    estado_clave: str


class DashboardResumen(BaseModel):
    """Métricas agregadas para el panel administrador (una sola petición)."""

    reservas_hoy: int = Field(ge=0)
    reservas_mes: int = Field(ge=0)
    reservas_pendientes: int = Field(ge=0)
    reservas_confirmadas: int = Field(ge=0)
    ingresos_mes_soles: float = Field(
        ge=0,
        description="Suma de pagos verificados con fecha_pago en el mes actual.",
    )
    viajes_activos: int = Field(ge=0)
    viajes_completados: int = Field(ge=0)
    vehiculos_disponibles: int = Field(ge=0)
    actividad_reciente: list[DashboardActividadReciente] = Field(default_factory=list)
