from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List

from ..database import get_db
from ..models.worker import Worker
from ..models.policy import Policy, PolicyStatus
from ..models.claim import Claim, ClaimStatus
from ..models.payout import Payout, PayoutStatus
from ..models.disruption_event import DisruptionEvent
from ..models.zone import Zone
from ..schemas.worker import WorkerResponse

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/dashboard")
def admin_dashboard(db: Session = Depends(get_db)):
    total_active_policies = db.query(Policy).filter(Policy.status == PolicyStatus.ACTIVE).count()
    total_workers = db.query(Worker).filter(Worker.is_active == True).count()

    from datetime import datetime, timedelta
    week_ago = datetime.utcnow() - timedelta(days=7)

    disruptions_this_week = db.query(DisruptionEvent).filter(
        DisruptionEvent.started_at >= week_ago,
        DisruptionEvent.dual_trigger_fired == True,
    ).count()

    claims_this_week = db.query(Claim).filter(Claim.created_at >= week_ago).count()

    payouts_this_week = db.query(func.sum(Payout.amount)).filter(
        Payout.initiated_at >= week_ago,
        Payout.status == PayoutStatus.COMPLETED,
    ).scalar() or 0.0

    premiums_this_week = db.query(func.sum(Policy.weekly_premium)).filter(
        Policy.status == PolicyStatus.ACTIVE
    ).scalar() or 0.0

    loss_ratio = (payouts_this_week / premiums_this_week) if premiums_this_week > 0 else 0.0
    pending_review = db.query(Claim).filter(Claim.status == ClaimStatus.MANUAL_REVIEW).count()

    return {
        "total_active_policies": total_active_policies,
        "total_workers": total_workers,
        "disruptions_this_week": disruptions_this_week,
        "total_claims_this_week": claims_this_week,
        "total_payouts_this_week": round(payouts_this_week, 2),
        "loss_ratio": round(loss_ratio, 4),
        "pending_review_count": pending_review,
    }


@router.get("/claims/pending")
def pending_claims(db: Session = Depends(get_db)):
    claims = db.query(Claim).filter(Claim.status == ClaimStatus.MANUAL_REVIEW).all()
    return [
        {
            "id": str(c.id),
            "worker_id": str(c.worker_id),
            "status": c.status.value,
            "payout_amount": c.payout_amount,
            "fraud_score": c.fraud_score,
            "fraud_flags": c.fraud_flags,
            "created_at": c.created_at.isoformat(),
        }
        for c in claims
    ]


@router.get("/workers", response_model=List[WorkerResponse])
def all_workers(db: Session = Depends(get_db)):
    return db.query(Worker).filter(Worker.is_active == True).all()


@router.get("/financial-summary")
def financial_summary(db: Session = Depends(get_db)):
    total_premiums = db.query(func.sum(Policy.total_premiums_paid)).scalar() or 0.0
    total_payouts = db.query(func.sum(Payout.amount)).filter(
        Payout.status == PayoutStatus.COMPLETED
    ).scalar() or 0.0

    loss_ratio = (total_payouts / total_premiums) if total_premiums > 0 else 0.0

    claims_by_status = {}
    for status in ClaimStatus:
        count = db.query(Claim).filter(Claim.status == status).count()
        claims_by_status[status.value] = count

    zones = db.query(Zone).all()
    payouts_by_zone = []
    for zone in zones:
        zone_payout = db.query(func.sum(Payout.amount)).join(
            Claim, Claim.id == Payout.claim_id
        ).join(
            DisruptionEvent, DisruptionEvent.id == Claim.disruption_event_id
        ).filter(
            DisruptionEvent.zone_id == zone.id,
            Payout.status == PayoutStatus.COMPLETED,
        ).scalar() or 0.0

        payouts_by_zone.append({
            "zone_id": str(zone.id),
            "zone_name": zone.name,
            "total_payout": round(zone_payout, 2),
        })

    return {
        "total_premiums_collected": round(total_premiums, 2),
        "total_payouts_disbursed": round(total_payouts, 2),
        "loss_ratio": round(loss_ratio, 4),
        "claims_by_status": claims_by_status,
        "payouts_by_zone": payouts_by_zone,
    }


@router.get("/zone-trust-scores")
def zone_trust_scores(db: Session = Depends(get_db)):
    zones = db.query(Zone).all()
    result = []

    for zone in zones:
        surveys = (
            db.query(Claim.trust_survey_response)
            .join(DisruptionEvent, DisruptionEvent.id == Claim.disruption_event_id)
            .filter(
                DisruptionEvent.zone_id == zone.id,
                Claim.trust_survey_response != None,
            )
            .all()
        )

        scores = [
            s[0]["trust_score"]
            for s in surveys
            if s[0] and "trust_score" in s[0]
        ]
        avg_score = round(sum(scores) / len(scores), 2) if scores else None

        result.append({
            "zone_id": str(zone.id),
            "zone_name": zone.name,
            "survey_count": len(scores),
            "avg_trust_score": avg_score,
        })

    return result


@router.get("/zones")
def list_zones(db: Session = Depends(get_db)):
    zones = db.query(Zone).all()
    return [
        {
            "id": str(z.id),
            "name": z.name,
            "city": z.city,
            "risk_multiplier": z.risk_multiplier,
            "lat_center": z.lat_center,
            "lng_center": z.lng_center,
        }
        for z in zones
    ]
