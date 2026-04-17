import uuid
from sqlalchemy import Column, String, Float, Integer, Boolean, Date, DateTime, Enum as SAEnum, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from database import Base


class PolicyStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    PAUSED = "PAUSED"
    CANCELLED = "CANCELLED"
    EXPIRED = "EXPIRED"


class Policy(Base):
    __tablename__ = "policies"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    worker_id = Column(UUID(as_uuid=True), ForeignKey("workers.id"), nullable=False, index=True)

    weekly_premium = Column(Float, nullable=False)
    coverage_amount = Column(Float, nullable=False)
    coverage_hours_per_week = Column(Integer, default=48)
    status = Column(SAEnum(PolicyStatus), default=PolicyStatus.ACTIVE)

    start_date = Column(Date, nullable=False)
    current_week_start = Column(Date, nullable=False)
    premium_paid_this_week = Column(Boolean, default=False)
    total_premiums_paid = Column(Float, default=0.0)
    total_payouts_received = Column(Float, default=0.0)

    terms_accepted_at = Column(DateTime(timezone=True), nullable=True)
    privacy_accepted_at = Column(DateTime(timezone=True), nullable=True)
    consent_artifact = Column(JSON, nullable=True)
    consent_receipt_hash = Column(String, nullable=True)
    activation_source = Column(String, default="DASHBOARD")  # must always be DASHBOARD

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    worker = relationship("Worker", back_populates="policies")
    claims = relationship("Claim", back_populates="policy")
