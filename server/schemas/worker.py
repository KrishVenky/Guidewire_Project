from pydantic import BaseModel, Field
from uuid import UUID
from datetime import datetime
from typing import Optional
from models.worker import Platform, TrustTier, PrivacyRequestStatus


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
    pii_retention_until: Optional[datetime] = None
    deletion_requested_at: Optional[datetime] = None
    deletion_request_reason: Optional[str] = None
    deletion_request_status: PrivacyRequestStatus
    deleted_at: Optional[datetime] = None
    preferred_language: str
    whatsapp_opt_in: bool
    sms_opt_in: bool
    email_opt_in: bool
    proactive_alerts_opt_in: bool
    quiet_hours_start: Optional[int] = None
    quiet_hours_end: Optional[int] = None
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


class PrivacyDeletionRequest(BaseModel):
    reason: str = Field(min_length=3, max_length=300)


class PrivacyRetentionUpdate(BaseModel):
    retention_days: int = Field(ge=1, le=3650)


class PrivacyStatusResponse(BaseModel):
    worker_id: UUID
    pii_retention_until: Optional[datetime] = None
    deletion_requested_at: Optional[datetime] = None
    deletion_request_reason: Optional[str] = None
    deletion_request_status: PrivacyRequestStatus
    deleted_at: Optional[datetime] = None


class CommunicationPreferencesUpdate(BaseModel):
    preferred_language: Optional[str] = Field(default=None, min_length=2, max_length=12)
    whatsapp_opt_in: Optional[bool] = None
    sms_opt_in: Optional[bool] = None
    email_opt_in: Optional[bool] = None
    proactive_alerts_opt_in: Optional[bool] = None
    quiet_hours_start: Optional[int] = Field(default=None, ge=0, le=23)
    quiet_hours_end: Optional[int] = Field(default=None, ge=0, le=23)


class CommunicationPreferencesResponse(BaseModel):
    worker_id: UUID
    preferred_language: str
    whatsapp_opt_in: bool
    sms_opt_in: bool
    email_opt_in: bool
    proactive_alerts_opt_in: bool
    quiet_hours_start: Optional[int] = None
    quiet_hours_end: Optional[int] = None
