from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID
from datetime import datetime
from typing import List

from database import get_db
from models.claim import Claim, ClaimStatus
from schemas.claim import ClaimResponse, ClaimReviewRequest, TrustSurveyRequest
from auth import require_admin, require_worker_or_admin, AuthPrincipal

router = APIRouter(prefix="/api/claims", tags=["claims"])


@router.get("/worker/{worker_id}", response_model=List[ClaimResponse])
def get_worker_claims(worker_id: UUID, db: Session = Depends(get_db), principal: AuthPrincipal = Depends(require_worker_or_admin)):
    if principal.role == "worker" and principal.worker_id != worker_id:
        raise HTTPException(status_code=403, detail="Access denied")
    return (
        db.query(Claim)
        .filter(Claim.worker_id == worker_id)
        .order_by(Claim.created_at.desc())
        .all()
    )


@router.get("/{claim_id}", response_model=ClaimResponse)
def get_claim(claim_id: UUID, db: Session = Depends(get_db), principal: AuthPrincipal = Depends(require_worker_or_admin)):
    claim = db.query(Claim).filter(Claim.id == claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    if principal.role == "worker" and principal.worker_id != claim.worker_id:
        raise HTTPException(status_code=403, detail="Access denied")
    return claim


@router.post("/{claim_id}/review", response_model=ClaimResponse)
def review_claim(claim_id: UUID, body: ClaimReviewRequest, db: Session = Depends(get_db), _: AuthPrincipal = Depends(require_admin)):
    claim = db.query(Claim).filter(Claim.id == claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")

    if body.action.upper() == "APPROVE":
        claim.status = ClaimStatus.APPROVED
        claim.reviewed_at = datetime.utcnow()

        # Trigger payout if not already paid
        if claim.payout_amount > 0 and not claim.payout:
            from services.payout_service import process_payout
            from models.worker import Worker
            worker = db.query(Worker).filter(Worker.id == claim.worker_id).first()
            process_payout(claim, worker, db)
    elif body.action.upper() == "REJECT":
        claim.status = ClaimStatus.REJECTED
        claim.reviewed_at = datetime.utcnow()
    else:
        raise HTTPException(status_code=400, detail="action must be APPROVE or REJECT")

    db.commit()
    db.refresh(claim)
    return claim


@router.post("/{claim_id}/survey")
def submit_trust_survey(claim_id: UUID, body: TrustSurveyRequest, db: Session = Depends(get_db), principal: AuthPrincipal = Depends(require_worker_or_admin)):
    claim = db.query(Claim).filter(Claim.id == claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    if principal.role == "worker" and principal.worker_id != claim.worker_id:
        raise HTTPException(status_code=403, detail="Access denied")

    if body.trust_score < 1 or body.trust_score > 5:
        raise HTTPException(status_code=400, detail="trust_score must be 1–5")

    claim.trust_survey_response = body.model_dump()
    db.commit()
    return {"survey_recorded": True, "claim_id": str(claim_id)}
