from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID
from datetime import datetime
from typing import List

from database import get_db
from models.claim import Claim, ClaimStatus
from models.payout import PayoutStatus
from models.audit_log import TriggeredBy
from schemas.claim import ClaimResponse, ClaimReviewRequest, TrustSurveyRequest
from auth import require_admin, require_worker_or_admin, AuthPrincipal
from services.audit_service import log_event

router = APIRouter(prefix="/api/claims", tags=["claims"])


@router.get("/worker/{worker_id}", response_model=List[ClaimResponse])
def get_worker_claims(worker_id: UUID, db: Session = Depends(get_db), principal: AuthPrincipal = Depends(require_worker_or_admin)):
    if principal.role == "worker" and principal.worker_id != worker_id:
        raise HTTPException(status_code=403, detail="Access denied")
    claims = (
        db.query(Claim)
        .filter(Claim.worker_id == worker_id)
        .order_by(Claim.created_at.desc())
        .all()
    )
    if principal.role == "admin":
        log_event(
            db=db,
            entity_type="claim",
            entity_id=worker_id,
            action="PII_WORKER_CLAIMS_VIEW",
            triggered_by=TriggeredBy.ADMIN,
            new_value={"claim_count": len(claims)},
        )
    return claims


@router.get("/{claim_id}", response_model=ClaimResponse)
def get_claim(claim_id: UUID, db: Session = Depends(get_db), principal: AuthPrincipal = Depends(require_worker_or_admin)):
    claim = db.query(Claim).filter(Claim.id == claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    if principal.role == "worker" and principal.worker_id != claim.worker_id:
        raise HTTPException(status_code=403, detail="Access denied")
    if principal.role == "admin":
        log_event(
            db=db,
            entity_type="claim",
            entity_id=claim.id,
            action="PII_CLAIM_VIEW",
            triggered_by=TriggeredBy.ADMIN,
            new_value={"worker_id": str(claim.worker_id)},
        )
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


@router.get("/{claim_id}/timeline")
def get_claim_timeline(claim_id: UUID, db: Session = Depends(get_db), principal: AuthPrincipal = Depends(require_worker_or_admin)):
    claim = db.query(Claim).filter(Claim.id == claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    if principal.role == "worker" and principal.worker_id != claim.worker_id:
        raise HTTPException(status_code=403, detail="Access denied")

    events = [
        {
            "code": "CLAIM_CREATED",
            "label": "Claim auto-filed",
            "timestamp": claim.created_at.isoformat() if claim.created_at else None,
            "detail": "Disruption trigger generated your claim automatically." if claim.auto_initiated else "Claim filed manually.",
        },
        {
            "code": "FRAUD_SCREENING_COMPLETED",
            "label": "Fraud checks completed",
            "timestamp": claim.created_at.isoformat() if claim.created_at else None,
            "detail": f"score={round(claim.fraud_score, 3)}; flags={claim.fraud_flags or []}",
        },
    ]

    if claim.status == ClaimStatus.MANUAL_REVIEW or claim.reviewed_at:
        events.append(
            {
                "code": "MANUAL_REVIEW_QUEUED",
                "label": "Queued for manual review",
                "timestamp": claim.created_at.isoformat() if claim.created_at else None,
                "detail": "Flagged for operations review.",
            }
        )

    if claim.reviewed_at and claim.status in {ClaimStatus.APPROVED, ClaimStatus.PAID}:
        events.append(
            {
                "code": "CLAIM_APPROVED",
                "label": "Claim approved",
                "timestamp": claim.reviewed_at.isoformat(),
                "detail": claim.decision_reason_code or "Approved after review.",
            }
        )

    if claim.reviewed_at and claim.status == ClaimStatus.REJECTED:
        events.append(
            {
                "code": "CLAIM_REJECTED",
                "label": "Claim rejected",
                "timestamp": claim.reviewed_at.isoformat(),
                "detail": claim.decision_reason_code or "Rejected after review.",
            }
        )

    if claim.payout:
        events.append(
            {
                "code": "PAYOUT_INITIATED",
                "label": "Payout initiated",
                "timestamp": claim.payout.initiated_at.isoformat() if claim.payout.initiated_at else None,
                "detail": f"amount={round(claim.payout.amount, 2)} via UPI",
            }
        )

        if claim.payout.status == PayoutStatus.COMPLETED:
            events.append(
                {
                    "code": "PAYOUT_COMPLETED",
                    "label": "Payout completed",
                    "timestamp": claim.payout.completed_at.isoformat() if claim.payout.completed_at else None,
                    "detail": f"payment_id={claim.payout.razorpay_payment_id or 'mock'}",
                }
            )
        elif claim.payout.status == PayoutStatus.FAILED:
            events.append(
                {
                    "code": "PAYOUT_FAILED",
                    "label": "Payout failed",
                    "timestamp": (claim.payout.completed_at or claim.payout.initiated_at).isoformat() if (claim.payout.completed_at or claim.payout.initiated_at) else None,
                    "detail": claim.payout.failure_reason or "Provider error",
                }
            )

    events = sorted(events, key=lambda e: (e["timestamp"] is None, e["timestamp"] or ""))

    if principal.role == "admin":
        log_event(
            db=db,
            entity_type="claim",
            entity_id=claim.id,
            action="CLAIM_TIMELINE_VIEW",
            triggered_by=TriggeredBy.ADMIN,
            new_value={"worker_id": str(claim.worker_id)},
        )

    return {
        "claim_id": str(claim.id),
        "worker_id": str(claim.worker_id),
        "current_status": claim.status.value,
        "events": events,
    }


@router.get("/{claim_id}/evidence-receipt")
def get_claim_evidence_receipt(
    claim_id: UUID,
    db: Session = Depends(get_db),
    principal: AuthPrincipal = Depends(require_worker_or_admin),
):
    claim = db.query(Claim).filter(Claim.id == claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    if principal.role == "worker" and principal.worker_id != claim.worker_id:
        raise HTTPException(status_code=403, detail="Access denied")

    if not claim.evidence_payload or not claim.evidence_receipt_hash:
        raise HTTPException(status_code=404, detail="Evidence receipt not available")

    return {
        "claim_id": str(claim.id),
        "worker_id": str(claim.worker_id),
        "evidence_receipt_hash": claim.evidence_receipt_hash,
        "evidence_payload": claim.evidence_payload,
    }
