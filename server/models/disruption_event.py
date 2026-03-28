import uuid
from sqlalchemy import Column, String, Float, Integer, Boolean, DateTime, Enum as SAEnum, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from ..database import Base


class EventType(str, enum.Enum):
    HEAVY_RAIN = "HEAVY_RAIN"
    EXTREME_HEAT = "EXTREME_HEAT"
    HIGH_AQI = "HIGH_AQI"
    NDMA_ALERT = "NDMA_ALERT"
    ORDER_DROP = "ORDER_DROP"
    BANDH = "BANDH"


class EventSource(str, enum.Enum):
    OPEN_METEO = "OPEN_METEO"
    WAQI = "WAQI"
    SACHET = "SACHET"
    ORDER_PROXY = "ORDER_PROXY"
    BANDH_MOCK = "BANDH_MOCK"
    SIMULATION = "SIMULATION"


class PayoutTier(str, enum.Enum):
    NONE = "NONE"
    HALF = "HALF"
    THREE_QUARTER = "THREE_QUARTER"
    FULL = "FULL"


class DisruptionEvent(Base):
    __tablename__ = "disruption_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    zone_id = Column(UUID(as_uuid=True), ForeignKey("zones.id"), nullable=False, index=True)

    event_type = Column(SAEnum(EventType), nullable=False)
    source = Column(SAEnum(EventSource), nullable=False)
    severity_score = Column(Float, default=0.0)  # 0–100
    raw_value = Column(Float, default=0.0)
    threshold_breached = Column(Float, default=0.0)
    order_drop_pct = Column(Float, default=0.0)

    t1_confirmed = Column(Boolean, default=False)
    t2_confirmed = Column(Boolean, default=False)
    dual_trigger_fired = Column(Boolean, default=False)
    payout_tier = Column(SAEnum(PayoutTier), default=PayoutTier.NONE)
    is_honeypot = Column(Boolean, default=False)

    affected_worker_count = Column(Integer, default=0)
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    ended_at = Column(DateTime(timezone=True), nullable=True)

    zone = relationship("Zone", back_populates="disruption_events")
    claims = relationship("Claim", back_populates="disruption_event")
