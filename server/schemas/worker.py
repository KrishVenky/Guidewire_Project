from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime
from typing import Optional
from models.worker import Platform, TrustTier


class WorkerCreate(BaseModel):
    full_name: str
    phone: str
    upi_id: str
    platform: Platform
    zone_id: UUID
    avg_weekly_income: float = Field(default=3500.0, ge=0)
    declared_weekly_hours: int = Field(default=48, ge=1, le=100)


class WorkerUpdate(BaseModel):
    full_name: Optional[str] = None
    upi_id: Optional[str] = None
    avg_weekly_income: Optional[float] = None
    declared_weekly_hours: Optional[int] = None
    platform: Optional[Platform] = None


class WorkerResponse(BaseModel):
    id: UUID
    full_name: str
    phone: str
    upi_id: str
    platform: Platform
    zone_id: UUID
    avg_weekly_income: float
    declared_weekly_hours: int
    is_active: bool
    kyc_verified: bool
    tenure_weeks: int
    trust_tier: TrustTier
    registration_date: datetime

    class Config:
        from_attributes = True


class WorkerDashboard(BaseModel):
    worker: WorkerResponse
    active_policy: Optional[dict] = None
    recent_claims: list = []
    active_disruptions: list = []
    earnings_protected: float = 0.0

    class Config:
        from_attributes = True
