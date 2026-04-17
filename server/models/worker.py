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


class PrivacyRequestStatus(str, enum.Enum):
    NONE = "NONE"
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    COMPLETED = "COMPLETED"


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

    pii_retention_until = Column(DateTime(timezone=True), nullable=True)
    deletion_requested_at = Column(DateTime(timezone=True), nullable=True)
    deletion_request_reason = Column(String, nullable=True)
    deletion_request_status = Column(SAEnum(PrivacyRequestStatus), default=PrivacyRequestStatus.NONE)
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    preferred_language = Column(String, default="en")
    whatsapp_opt_in = Column(Boolean, default=True)
    sms_opt_in = Column(Boolean, default=True)
    email_opt_in = Column(Boolean, default=False)
    proactive_alerts_opt_in = Column(Boolean, default=True)
    quiet_hours_start = Column(Integer, nullable=True)
    quiet_hours_end = Column(Integer, nullable=True)

    zone = relationship("Zone", back_populates="workers")
    policies = relationship("Policy", back_populates="worker")
    claims = relationship("Claim", back_populates="worker")
    payouts = relationship("Payout", back_populates="worker")
