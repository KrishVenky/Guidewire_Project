from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID
from datetime import datetime

from database import get_db
from models.worker import Worker
from models.zone import Zone
from models.policy import Policy, PolicyStatus
from models.claim import Claim, ClaimStatus
from models.disruption_event import DisruptionEvent
from schemas.worker import WorkerCreate, WorkerUpdate, WorkerResponse, WorkerDashboard
from auth import require_worker_or_admin, AuthPrincipal

router = APIRouter(prefix="/api/workers", tags=["workers"])


@router.get("/zones")
def list_public_zones(db: Session = Depends(get_db)):
    zones = db.query(Zone).order_by(Zone.name.asc()).all()
    return [
        {
            "id": str(zone.id),
            "name": zone.name,
            "city": zone.city,
        }
        for zone in zones
    ]


@router.get("/lookup", response_model=WorkerResponse)
def lookup_worker_by_phone(phone: str, db: Session = Depends(get_db)):
    worker = db.query(Worker).filter(Worker.phone == phone).first()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")
    return worker


@router.post("/register", response_model=WorkerResponse, status_code=201)
def register_worker(body: WorkerCreate, db: Session = Depends(get_db)):
    existing = db.query(Worker).filter(Worker.phone == body.phone).first()
    if existing:
        raise HTTPException(status_code=409, detail="Phone number already registered")

    worker = Worker(**body.model_dump())
    db.add(worker)
    db.commit()
    db.refresh(worker)
    return worker


@router.get("/{worker_id}", response_model=WorkerResponse)
def get_worker(worker_id: UUID, db: Session = Depends(get_db), principal: AuthPrincipal = Depends(require_worker_or_admin)):
    if principal.role == "worker" and principal.worker_id != worker_id:
        raise HTTPException(status_code=403, detail="Access denied")
    worker = db.query(Worker).filter(Worker.id == worker_id).first()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")
    return worker


@router.put("/{worker_id}", response_model=WorkerResponse)
def update_worker(worker_id: UUID, body: WorkerUpdate, db: Session = Depends(get_db), principal: AuthPrincipal = Depends(require_worker_or_admin)):
    if principal.role == "worker" and principal.worker_id != worker_id:
        raise HTTPException(status_code=403, detail="Access denied")
    worker = db.query(Worker).filter(Worker.id == worker_id).first()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(worker, field, value)

    db.commit()
    db.refresh(worker)
    return worker


@router.get("/{worker_id}/dashboard", response_model=WorkerDashboard)
def get_dashboard(worker_id: UUID, db: Session = Depends(get_db), principal: AuthPrincipal = Depends(require_worker_or_admin)):
    if principal.role == "worker" and principal.worker_id != worker_id:
        raise HTTPException(status_code=403, detail="Access denied")
    worker = db.query(Worker).filter(Worker.id == worker_id).first()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")

    active_policy = (
        db.query(Policy)
        .filter(Policy.worker_id == worker_id, Policy.status == PolicyStatus.ACTIVE)
        .first()
    )

    recent_claims = (
        db.query(Claim)
        .filter(Claim.worker_id == worker_id)
        .order_by(Claim.created_at.desc())
        .limit(5)
        .all()
    )

    active_disruptions = (
        db.query(DisruptionEvent)
        .filter(
            DisruptionEvent.zone_id == worker.zone_id,
            DisruptionEvent.ended_at == None,
        )
        .order_by(DisruptionEvent.started_at.desc())
        .limit(3)
        .all()
    )

    earnings_protected = sum(
        c.payout_amount for c in db.query(Claim).filter(
            Claim.worker_id == worker_id,
            Claim.status == ClaimStatus.PAID,
        ).all()
    )

    policy_dict = None
    if active_policy:
        policy_dict = {
            "id": str(active_policy.id),
            "weekly_premium": active_policy.weekly_premium,
            "coverage_amount": active_policy.coverage_amount,
            "status": active_policy.status.value,
            "total_premiums_paid": active_policy.total_premiums_paid,
            "total_payouts_received": active_policy.total_payouts_received,
        }

    return WorkerDashboard(
        worker=worker,
        active_policy=policy_dict,
        recent_claims=[
            {
                "id": str(c.id),
                "status": c.status.value,
                "payout_amount": c.payout_amount,
                "duration_hours": c.duration_hours,
                "event_started_at": c.event_started_at.isoformat() if c.event_started_at else None,
                "event_ended_at": c.event_ended_at.isoformat() if c.event_ended_at else None,
                "llm_explanation": c.llm_explanation,
                "created_at": c.created_at.isoformat(),
                "trust_survey_response": c.trust_survey_response,
            }
            for c in recent_claims
        ],
        active_disruptions=[
            {
                "id": str(d.id),
                "event_type": d.event_type.value,
                "severity_score": d.severity_score,
                "payout_tier": d.payout_tier.value,
                "started_at": d.started_at.isoformat(),
            }
            for d in active_disruptions
        ],
        earnings_protected=round(earnings_protected, 2),
    )
