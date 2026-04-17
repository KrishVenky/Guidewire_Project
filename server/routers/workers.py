from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID
from datetime import datetime, timedelta, timezone

from database import get_db
from models.zone import Zone
from models.worker import Worker, PrivacyRequestStatus
from models.policy import Policy, PolicyStatus
from models.claim import Claim, ClaimStatus
from models.disruption_event import DisruptionEvent
from models.audit_log import TriggeredBy
from schemas.worker import (
    WorkerCreate,
    WorkerUpdate,
    WorkerResponse,
    WorkerDashboard,
    PrivacyDeletionRequest,
    PrivacyStatusResponse,
    CommunicationPreferencesUpdate,
    CommunicationPreferencesResponse,
)
from auth import require_worker_or_admin, require_admin, AuthPrincipal
from services.audit_service import log_event

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
def lookup_worker_by_phone(
    phone: str,
    db: Session = Depends(get_db),
    _: AuthPrincipal = Depends(require_admin),
):
    worker = db.query(Worker).filter(Worker.phone == phone).first()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")
    log_event(
        db=db,
        entity_type="worker",
        entity_id=worker.id,
        action="PII_LOOKUP_BY_PHONE",
        triggered_by=TriggeredBy.ADMIN,
        new_value={"phone_query_suffix": phone[-2:]},
    )
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
    if principal.role == "admin":
        log_event(
            db=db,
            entity_type="worker",
            entity_id=worker.id,
            action="PII_PROFILE_VIEW",
            triggered_by=TriggeredBy.ADMIN,
            new_value={"view": "worker_profile"},
        )
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
            DisruptionEvent.dual_trigger_fired == True,
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
            "consent_receipt_hash": active_policy.consent_receipt_hash,
        }

    return WorkerDashboard(
        worker=worker,
        operating_area={
            "zone_id": str(worker.zone.id),
            "zone_name": worker.zone.name,
            "city": worker.zone.city,
        } if worker.zone else None,
        active_policy=policy_dict,
        recent_claims=[
            {
                "id": str(c.id),
                "status": c.status.value,
                "payout_amount": c.payout_amount,
                "duration_hours": c.duration_hours,
                "auto_initiated": c.auto_initiated,
                "event_started_at": c.event_started_at.isoformat() if c.event_started_at else None,
                "event_ended_at": c.event_ended_at.isoformat() if c.event_ended_at else None,
                "llm_explanation": c.llm_explanation,
                "created_at": c.created_at.isoformat(),
                "trust_survey_response": c.trust_survey_response,
                "evidence_receipt_hash": c.evidence_receipt_hash,
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


@router.post("/{worker_id}/privacy/request-deletion", response_model=PrivacyStatusResponse)
def request_privacy_deletion(
    worker_id: UUID,
    body: PrivacyDeletionRequest,
    db: Session = Depends(get_db),
    principal: AuthPrincipal = Depends(require_worker_or_admin),
):
    if principal.role == "worker" and principal.worker_id != worker_id:
        raise HTTPException(status_code=403, detail="Access denied")

    worker = db.query(Worker).filter(Worker.id == worker_id).first()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")

    if worker.deleted_at:
        raise HTTPException(status_code=409, detail="Worker PII already redacted")

    now = datetime.now(timezone.utc)
    worker.deletion_requested_at = now
    worker.deletion_request_reason = body.reason.strip()
    worker.deletion_request_status = PrivacyRequestStatus.PENDING

    if worker.pii_retention_until is None:
        worker.pii_retention_until = now + timedelta(days=365)

    db.commit()
    db.refresh(worker)

    log_event(
        db=db,
        entity_type="worker",
        entity_id=worker.id,
        action="PRIVACY_DELETION_REQUESTED",
        triggered_by=TriggeredBy.WORKER if principal.role == "worker" else TriggeredBy.ADMIN,
        new_value={"reason": worker.deletion_request_reason[:120]},
    )

    return PrivacyStatusResponse(
        worker_id=worker.id,
        pii_retention_until=worker.pii_retention_until,
        deletion_requested_at=worker.deletion_requested_at,
        deletion_request_reason=worker.deletion_request_reason,
        deletion_request_status=worker.deletion_request_status,
        deleted_at=worker.deleted_at,
    )


@router.get("/{worker_id}/privacy/status", response_model=PrivacyStatusResponse)
def get_privacy_status(
    worker_id: UUID,
    db: Session = Depends(get_db),
    principal: AuthPrincipal = Depends(require_worker_or_admin),
):
    if principal.role == "worker" and principal.worker_id != worker_id:
        raise HTTPException(status_code=403, detail="Access denied")

    worker = db.query(Worker).filter(Worker.id == worker_id).first()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")

    if principal.role == "admin":
        log_event(
            db=db,
            entity_type="worker",
            entity_id=worker.id,
            action="PRIVACY_STATUS_VIEW",
            triggered_by=TriggeredBy.ADMIN,
            new_value={"status": str(worker.deletion_request_status)},
        )

    return PrivacyStatusResponse(
        worker_id=worker.id,
        pii_retention_until=worker.pii_retention_until,
        deletion_requested_at=worker.deletion_requested_at,
        deletion_request_reason=worker.deletion_request_reason,
        deletion_request_status=worker.deletion_request_status,
        deleted_at=worker.deleted_at,
    )


@router.get("/{worker_id}/communication-preferences", response_model=CommunicationPreferencesResponse)
def get_communication_preferences(
    worker_id: UUID,
    db: Session = Depends(get_db),
    principal: AuthPrincipal = Depends(require_worker_or_admin),
):
    if principal.role == "worker" and principal.worker_id != worker_id:
        raise HTTPException(status_code=403, detail="Access denied")

    worker = db.query(Worker).filter(Worker.id == worker_id).first()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")

    if principal.role == "admin":
        log_event(
            db=db,
            entity_type="worker",
            entity_id=worker.id,
            action="COMM_PREFS_VIEW",
            triggered_by=TriggeredBy.ADMIN,
            new_value={"channel": "all"},
        )

    return CommunicationPreferencesResponse(
        worker_id=worker.id,
        preferred_language=worker.preferred_language,
        whatsapp_opt_in=worker.whatsapp_opt_in,
        sms_opt_in=worker.sms_opt_in,
        email_opt_in=worker.email_opt_in,
        proactive_alerts_opt_in=worker.proactive_alerts_opt_in,
        quiet_hours_start=worker.quiet_hours_start,
        quiet_hours_end=worker.quiet_hours_end,
    )


@router.put("/{worker_id}/communication-preferences", response_model=CommunicationPreferencesResponse)
def update_communication_preferences(
    worker_id: UUID,
    body: CommunicationPreferencesUpdate,
    db: Session = Depends(get_db),
    principal: AuthPrincipal = Depends(require_worker_or_admin),
):
    if principal.role == "worker" and principal.worker_id != worker_id:
        raise HTTPException(status_code=403, detail="Access denied")

    worker = db.query(Worker).filter(Worker.id == worker_id).first()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")

    updates = body.model_dump(exclude_none=True)
    has_quiet_start = "quiet_hours_start" in updates
    has_quiet_end = "quiet_hours_end" in updates
    if has_quiet_start != has_quiet_end:
        raise HTTPException(status_code=400, detail="quiet_hours_start and quiet_hours_end must be updated together")

    for field, value in updates.items():
        if field == "preferred_language" and isinstance(value, str):
            value = value.strip().lower()
        setattr(worker, field, value)

    db.commit()
    db.refresh(worker)

    log_event(
        db=db,
        entity_type="worker",
        entity_id=worker.id,
        action="COMM_PREFS_UPDATED",
        triggered_by=TriggeredBy.WORKER if principal.role == "worker" else TriggeredBy.ADMIN,
        new_value={k: v for k, v in updates.items()},
    )

    return CommunicationPreferencesResponse(
        worker_id=worker.id,
        preferred_language=worker.preferred_language,
        whatsapp_opt_in=worker.whatsapp_opt_in,
        sms_opt_in=worker.sms_opt_in,
        email_opt_in=worker.email_opt_in,
        proactive_alerts_opt_in=worker.proactive_alerts_opt_in,
        quiet_hours_start=worker.quiet_hours_start,
        quiet_hours_end=worker.quiet_hours_end,
    )
