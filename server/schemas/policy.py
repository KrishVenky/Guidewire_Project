from pydantic import BaseModel
from uuid import UUID
from datetime import date, datetime
from typing import Optional
from models.policy import PolicyStatus


class PolicyCreate(BaseModel):
    worker_id: UUID
    terms_accepted: bool = False
    privacy_accepted: bool = False
    terms_version: str = "v1"
    privacy_version: str = "v1"
    consent_text_hash: str = ""
    consent_source: str = "ONBOARDING"


class PolicyUpdate(BaseModel):
    status: Optional[PolicyStatus] = None


class PremiumBreakdown(BaseModel):
    base_rate: float
    zone_multiplier: float
    season_factor: float
    tenure_discount: float
    earnings_velocity_factor: float
    weekly_premium: float
    coverage_amount: float


class PolicyResponse(BaseModel):
    id: UUID
    worker_id: UUID
    weekly_premium: float
    coverage_amount: float
    coverage_hours_per_week: int
    status: PolicyStatus
    start_date: date
    current_week_start: date
    premium_paid_this_week: bool
    total_premiums_paid: float
    total_payouts_received: float
    consent_artifact: Optional[dict] = None
    consent_receipt_hash: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
