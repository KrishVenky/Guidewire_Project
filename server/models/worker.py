import uuid
from sqlalchemy import Column, String, Float, Integer, Boolean, DateTime, Enum as SAEnum, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from database import Base


class Platform(str, enum.Enum):
    ZOMATO = "ZOMATO"
    SWIGGY = "SWIGGY"
    BLINKIT = "BLINKIT"
    INSTAMART = "INSTAMART"
    MULTIPLE = "MULTIPLE"


class TrustTier(str, enum.Enum):
    NEW_PARTNER = "NEW_PARTNER"
    RISING_PARTNER = "RISING_PARTNER"
    TRUSTED_PARTNER = "TRUSTED_PARTNER"


class Worker(Base):
    __tablename__ = "workers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    full_name = Column(String, nullable=False)
    phone = Column(String, unique=True, nullable=False, index=True)
    upi_id = Column(String, nullable=False)
    platform = Column(SAEnum(Platform), nullable=False)
    zone_id = Column(UUID(as_uuid=True), ForeignKey("zones.id"), nullable=False, index=True)

    avg_weekly_income = Column(Float, default=3500.0)
    declared_weekly_hours = Column(Integer, default=48)

    registration_date = Column(DateTime(timezone=True), server_default=func.now())
    is_active = Column(Boolean, default=True)
    kyc_verified = Column(Boolean, default=False)
    tenure_weeks = Column(Integer, default=0)
    trust_tier = Column(SAEnum(TrustTier), default=TrustTier.NEW_PARTNER)

    zone = relationship("Zone", back_populates="workers")
    policies = relationship("Policy", back_populates="worker")
    claims = relationship("Claim", back_populates="worker")
    payouts = relationship("Payout", back_populates="worker")
