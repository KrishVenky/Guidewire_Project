from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID
from datetime import date
from typing import List

from sqlalchemy import func

from database import get_db
from models.worker import Worker
from models.policy import Policy, PolicyStatus
from models.payout import Payout, PayoutStatus
from models.zone import Zone
from schemas.policy import PolicyCreate, PolicyUpdate, PolicyResponse, PremiumBreakdown
from services.premium_calculator import calculate

LOSS_RATIO_SUSPEND_THRESHOLD = 0.85


def _current_loss_ratio(db: Session) -> float:
    total_premiums = db.query(func.sum(Policy.total_premiums_paid)).scalar() or 0.0
    if total_premiums == 0:
        return 0.0
    total_payouts = db.query(func.sum(Payout.amount)).filter(
        Payout.status == PayoutStatus.COMPLETED
    ).scalar() or 0.0
    return total_payouts / total_premiums

router = APIRouter(prefix="/api/policies", tags=["policies"])


@router.get("/premium/calculate", response_model=PremiumBreakdown)
def calculate_premium(worker_id: UUID, db: Session = Depends(get_db)):
    worker = db.query(Worker).filter(Worker.id == worker_id).first()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")

    zone = db.query(Zone).filter(Zone.id == worker.zone_id).first()
    if not zone:
        raise HTTPException(status_code=404, detail="Zone not found")

    breakdown = calculate(
        avg_weekly_income=worker.avg_weekly_income,
        declared_weekly_hours=worker.declared_weekly_hours,
        tenure_weeks=worker.tenure_weeks,
        flood_risk_score=zone.flood_risk_score,
        heat_risk_score=zone.heat_risk_score,
        aqi_risk_score=zone.aqi_risk_score,
    )
    return breakdown


@router.post("/create", response_model=PolicyResponse, status_code=201)
def create_policy(body: PolicyCreate, db: Session = Depends(get_db)):
    worker = db.query(Worker).filter(Worker.id == body.worker_id).first()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")

    existing_active = db.query(Policy).filter(
        Policy.worker_id == body.worker_id,
        Policy.status == PolicyStatus.ACTIVE,
    ).first()
    if existing_active:
        raise HTTPException(status_code=409, detail="Worker already has an active policy")

    loss_ratio = _current_loss_ratio(db)
    if loss_ratio > LOSS_RATIO_SUSPEND_THRESHOLD:
        raise HTTPException(
            status_code=503,
            detail=f"New enrolments suspended: loss ratio {loss_ratio:.0%} exceeds 85% actuarial threshold. Existing policies unaffected.",
        )

    zone = db.query(Zone).filter(Zone.id == worker.zone_id).first()
    if not zone:
        raise HTTPException(status_code=404, detail="Zone not found")

    breakdown = calculate(
        avg_weekly_income=worker.avg_weekly_income,
        declared_weekly_hours=worker.declared_weekly_hours,
        tenure_weeks=worker.tenure_weeks,
        flood_risk_score=zone.flood_risk_score,
        heat_risk_score=zone.heat_risk_score,
        aqi_risk_score=zone.aqi_risk_score,
    )

    from datetime import datetime, timezone
    now = datetime.now(timezone.utc)
    today = date.today()
    policy = Policy(
        worker_id=worker.id,
        weekly_premium=breakdown.weekly_premium,
        coverage_amount=breakdown.coverage_amount,
        status=PolicyStatus.ACTIVE,
        start_date=today,
        current_week_start=today,
        premium_paid_this_week=False,
        activation_source="DASHBOARD",
        terms_accepted_at=now,
        privacy_accepted_at=now,
    )
    db.add(policy)
    db.commit()
    db.refresh(policy)
    return policy


@router.get("/{policy_id}", response_model=PolicyResponse)
def get_policy(policy_id: UUID, db: Session = Depends(get_db)):
    policy = db.query(Policy).filter(Policy.id == policy_id).first()
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    return policy


@router.put("/{policy_id}/pause", response_model=PolicyResponse)
def pause_policy(policy_id: UUID, db: Session = Depends(get_db)):
    policy = db.query(Policy).filter(Policy.id == policy_id).first()
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    policy.status = PolicyStatus.PAUSED
    db.commit()
    db.refresh(policy)
    return policy


@router.put("/{policy_id}", response_model=PolicyResponse)
def update_policy(policy_id: UUID, body: PolicyUpdate, db: Session = Depends(get_db)):
    policy = db.query(Policy).filter(Policy.id == policy_id).first()
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    if body.status:
        policy.status = body.status
    db.commit()
    db.refresh(policy)
    return policy


@router.get("/worker/{worker_id}", response_model=List[PolicyResponse])
def get_worker_policies(worker_id: UUID, db: Session = Depends(get_db)):
    return db.query(Policy).filter(Policy.worker_id == worker_id).all()
