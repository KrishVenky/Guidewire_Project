import uuid
from sqlalchemy import Column, String, Float, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class Zone(Base):
    __tablename__ = "zones"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String, nullable=False, unique=True)
    city = Column(String, nullable=False, default="Bengaluru")
    lat_center = Column(Float, nullable=False)
    lng_center = Column(Float, nullable=False)

    # Risk scores (0.0–1.0)
    flood_risk_score = Column(Float, default=0.5)
    heat_risk_score = Column(Float, default=0.5)
    aqi_risk_score = Column(Float, default=0.5)
    risk_multiplier = Column(Float, default=1.0)  # 0.8–1.4

    # API identifiers
    open_meteo_lat = Column(Float, nullable=False)
    open_meteo_lng = Column(Float, nullable=False)
    waqi_station_id = Column(String, default="")
    sachet_district = Column(String, default="Bengaluru Urban")

    # Thresholds (recalibrated weekly in Phase 3)
    rain_threshold = Column(Float, default=50.0)       # mm/hr
    heat_threshold = Column(Float, default=44.0)       # °C
    aqi_threshold = Column(Float, default=300.0)       # AQI value
    order_drop_threshold = Column(Float, default=60.0) # % drop

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    workers = relationship("Worker", back_populates="zone")
    disruption_events = relationship("DisruptionEvent", back_populates="zone")
