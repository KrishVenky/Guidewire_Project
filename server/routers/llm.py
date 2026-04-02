from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from uuid import UUID
from typing import List, Optional

from database import get_db
from models.claim import Claim
from models.worker import Worker
from services.llm_service import generate_claim_explanation, onboarding_chat

router = APIRouter(prefix="/api/llm", tags=["llm"])


class ExplainClaimRequest(BaseModel):
    claim_id: UUID


class OnboardingChatRequest(BaseModel):
    message: str
    worker_id: UUID
    conversation_history: List[dict] = []


@router.post("/explain-claim")
async def explain_claim(body: ExplainClaimRequest, db: Session = Depends(get_db)):
    claim = db.query(Claim).filter(Claim.id == body.claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")

    event = claim.disruption_event
    zone_name = event.zone.name if event and event.zone else "your zone"
    event_type = event.event_type.value if event else "HEAVY_RAIN"

    explanation, used_fallback = await generate_claim_explanation(
        status=claim.status.value,
        zone_name=zone_name,
        event_type=event_type,
        payout_amount=claim.payout_amount,
        upi_id=claim.worker.upi_id if claim.worker else "your UPI",
    )

    # Update claim with latest explanation
    claim.llm_explanation = explanation
    db.commit()

    return {"explanation": explanation, "used_fallback": used_fallback}


@router.post("/onboarding-chat")
async def chat(body: OnboardingChatRequest, db: Session = Depends(get_db)):
    worker = db.query(Worker).filter(Worker.id == body.worker_id).first()

    worker_context = {}
    if worker:
        zone = worker.zone
        worker_context = {
            "platform": worker.platform.value,
            "zone": zone.name if zone else "Bengaluru",
            "avg_weekly_income": worker.avg_weekly_income,
        }

    response, used_fallback = await onboarding_chat(
        message=body.message,
        worker_context=worker_context,
        conversation_history=body.conversation_history,
    )

    return {"message": response, "used_fallback": used_fallback}
