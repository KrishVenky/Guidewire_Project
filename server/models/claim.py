import uuid
from sqlalchemy import Column, String, Float, Boolean, DateTime, Enum as SAEnum, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from database import Base


class ClaimStatus(str, enum.Enum):
    AUTO_APPROVED = "AUTO_APPROVED"
    MANUAL_REVIEW = "MANUAL_REVIEW"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    PAID = "PAID"


class Claim(Base):
    __tablename__ = "claims"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    worker_id = Column(UUID(as_uuid=True), ForeignKey("workers.id"), nullable=False, index=True)
    policy_id = Column(UUID(as_uuid=True), ForeignKey("policies.id"), nullable=False)
    disruption_event_id = Column(UUID(as_uuid=True), ForeignKey("disruption_events.id"), nullable=False, index=True)

    status = Column(SAEnum(ClaimStatus), default=ClaimStatus.AUTO_APPROVED)
    claimed_hours_lost = Column(Float, default=0.0)
    estimated_income_lost = Column(Float, default=0.0)
    payout_amount = Column(Float, default=0.0)

    fraud_score = Column(Float, default=0.0)
    fraud_flags = Column(JSON, default=list)
    auto_initiated = Column(Boolean, default=True)

    event_started_at = Column(DateTime(timezone=True), nullable=True)
    event_ended_at = Column(DateTime(timezone=True), nullable=True)
    duration_hours = Column(Float, default=0.0)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    llm_explanation = Column(String, default="")
    trust_survey_response = Column(JSON, nullable=True)

    worker = relationship("Worker", back_populates="claims")
    policy = relationship("Policy", back_populates="claims")
    disruption_event = relationship("DisruptionEvent", back_populates="claims")
    payout = relationship("Payout", back_populates="claim", uselist=False)
