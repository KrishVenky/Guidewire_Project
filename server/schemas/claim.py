from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from typing import Optional, List
from ..models.claim import ClaimStatus


class ClaimReviewRequest(BaseModel):
    action: str  # "APPROVE" or "REJECT"
    reviewer_note: Optional[str] = None


class TrustSurveyRequest(BaseModel):
    understood_reason: bool
    payout_correct: bool
    trust_score: int  # 1–5


class ClaimResponse(BaseModel):
    id: UUID
    worker_id: UUID
    policy_id: UUID
    disruption_event_id: UUID
    status: ClaimStatus
    claimed_hours_lost: float
    estimated_income_lost: float
    payout_amount: float
    fraud_score: float
    fraud_flags: List[str]
    auto_initiated: bool
    llm_explanation: str
    created_at: datetime
    reviewed_at: Optional[datetime] = None
    trust_survey_response: Optional[dict] = None

    class Config:
        from_attributes = True
