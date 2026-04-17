from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
import asyncio
import httpx
from datetime import datetime, timedelta

from database import get_db
from models.worker import Worker
from models.policy import Policy, PolicyStatus
from models.claim import Claim, ClaimStatus
from models.payout import Payout, PayoutStatus
from models.disruption_event import DisruptionEvent
from models.zone import Zone
from models.worker import PrivacyRequestStatus
from models.audit_log import AuditLog
from models.audit_log import TriggeredBy
from schemas.worker import WorkerResponse
from schemas.worker import PrivacyRetentionUpdate
from integrations.order_proxy import is_bandh_active
from services.premium_calculator import compute_payout
from services.audit_service import log_event
from auth import require_admin
from config import get_settings

settings = get_settings()

router = APIRouter(prefix="/api/admin", tags=["admin"], dependencies=[Depends(require_admin)])


@router.get("/dashboard")
def admin_dashboard(db: Session = Depends(get_db)):
    total_active_policies = db.query(Policy).filter(Policy.status == PolicyStatus.ACTIVE).count()
    total_workers = db.query(Worker).filter(Worker.is_active == True).count()

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

    premiums_collected = db.query(func.sum(Policy.weekly_premium)).filter(
        Policy.status == PolicyStatus.ACTIVE,
        Policy.current_week_start >= week_ago.date(),
    ).scalar() or 0.0

    loss_ratio = (payouts_this_week / premiums_collected) if premiums_collected > 0 else 0.0
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


@router.get("/predictive-claims")
async def predictive_claims(db: Session = Depends(get_db)):
    from integrations import open_meteo

    zones = db.query(Zone).all()
    rows = []

    for zone in zones:
        active_workers = db.query(Worker).filter(
            Worker.zone_id == zone.id,
            Worker.is_active == True,
        ).count()

        meteo = await open_meteo.get_current(zone.open_meteo_lat, zone.open_meteo_lng, zone.rain_threshold)
        breach_prob = float(meteo.forecast_breach_prob or 0.0)

        # Heuristic projection: only a fraction of threshold breaches create dual-trigger payouts.
        dual_trigger_factor = 0.38
        risk_amplifier = max(0.7, min(1.6, float(zone.risk_multiplier or 1.0)))
        projected_claims = round(active_workers * breach_prob * dual_trigger_factor * risk_amplifier, 1)

        avg_worker_income = db.query(func.avg(Worker.avg_weekly_income)).filter(
            Worker.zone_id == zone.id,
            Worker.is_active == True,
        ).scalar() or 3500.0
        avg_projected_payout = min((avg_worker_income * 0.6) * 0.75, 1500.0)

        rows.append({
            "zone_id": str(zone.id),
            "zone_name": zone.name,
            "active_workers": active_workers,
            "forecast_breach_probability": round(breach_prob, 3),
            "projected_claims_next_7d": projected_claims,
            "projected_payout_exposure": round(projected_claims * avg_projected_payout, 2),
        })

    total_projected_claims = round(sum(r["projected_claims_next_7d"] for r in rows), 1)
    total_exposure = round(sum(r["projected_payout_exposure"] for r in rows), 2)

    return {
        "generated_at": datetime.utcnow().isoformat(),
        "horizon_days": 7,
        "total_projected_claims": total_projected_claims,
        "total_projected_exposure": total_exposure,
        "zones": rows,
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
            "fraud_flags": c.fraud_flags or [],
            "decision_reason_code": c.decision_reason_code,
            "created_at": c.created_at.isoformat(),
        }
        for c in claims
    ]


@router.get("/workers", response_model=List[WorkerResponse])
def all_workers(db: Session = Depends(get_db)):
    workers = db.query(Worker).filter(Worker.is_active == True).all()
    log_event(
        db=db,
        entity_type="worker",
        entity_id=None,
        action="PII_BULK_WORKER_DIRECTORY_VIEW",
        triggered_by=TriggeredBy.ADMIN,
        new_value={"count": len(workers)},
    )
    return workers


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

    avg_seconds = db.query(func.avg(Payout.seconds_to_complete)).filter(
        Payout.status == PayoutStatus.COMPLETED,
        Payout.seconds_to_complete != None,
    ).scalar()

    return {
        "total_premiums_collected": round(total_premiums, 2),
        "total_payouts_disbursed": round(total_payouts, 2),
        "loss_ratio": round(loss_ratio, 4),
        "claims_by_status": claims_by_status,
        "payouts_by_zone": payouts_by_zone,
        "avg_payout_seconds": round(avg_seconds, 2) if avg_seconds else None,
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


@router.get("/stress-test")
def stress_test(
    scenario: str = "monsoon_14day",
    db: Session = Depends(get_db),
):
    """
    Actuarial stress test: project total claims + payouts + BCR for a sustained
    disruption scenario across all active policies.

    scenario options:
      monsoon_14day  — 14-day sustained heavy rain (payout tier FULL, 3 events/day)
      heatwave_7day  — 7-day extreme heat (payout tier THREE_QUARTER, 2 events/day)
      aqi_spike_3day — 3-day hazardous AQI (payout tier HALF, 1 event/day)
    """
    SCENARIOS = {
        "monsoon_14day": {"days": 14, "events_per_day": 3, "payout_tier": "FULL",
                          "disruption_hours": 4.0, "label": "14-day Monsoon"},
        "heatwave_7day": {"days": 7, "events_per_day": 2, "payout_tier": "THREE_QUARTER",
                          "disruption_hours": 5.0, "label": "7-day Heatwave"},
        "aqi_spike_3day": {"days": 3, "events_per_day": 1, "payout_tier": "HALF",
                           "disruption_hours": 8.0, "label": "3-day Hazardous AQI"},
    }
    if scenario not in SCENARIOS:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail=f"Unknown scenario. Choose from: {list(SCENARIOS)}")

    s = SCENARIOS[scenario]
    total_events = s["days"] * s["events_per_day"]

    active_policies = db.query(Policy).filter(Policy.status == PolicyStatus.ACTIVE).all()
    total_premiums = sum(p.weekly_premium for p in active_policies)
    weekly_premium_pool = total_premiums  # one week of collected premiums

    total_projected_payout = 0.0
    per_zone = {}

    for policy in active_policies:
        worker = db.query(Worker).filter(Worker.id == policy.worker_id).first()
        if not worker:
            continue

        # Each event fires once per worker per event (duplicate guard in real pipeline)
        payout_per_event = compute_payout(
            payout_tier=s["payout_tier"],
            claimed_hours=s["disruption_hours"],
            avg_weekly_income=worker.avg_weekly_income,
            declared_weekly_hours=worker.declared_weekly_hours,
            coverage_amount=policy.coverage_amount,
        )
        worker_total = payout_per_event * total_events
        total_projected_payout += worker_total

        zone_name = str(worker.zone_id)
        per_zone[zone_name] = per_zone.get(zone_name, 0.0) + worker_total

    # BCR = total projected claims / premiums collected over scenario duration
    scenario_weeks = s["days"] / 7
    premiums_over_period = weekly_premium_pool * scenario_weeks
    bcr = (total_projected_payout / premiums_over_period) if premiums_over_period > 0 else 0.0

    return {
        "scenario": s["label"],
        "days": s["days"],
        "total_events_projected": total_events,
        "active_policies": len(active_policies),
        "total_projected_payout": round(total_projected_payout, 2),
        "premiums_over_period": round(premiums_over_period, 2),
        "bcr": round(bcr, 4),
        "bcr_healthy": bcr <= 0.70,
        "bcr_warning": 0.70 < bcr <= 0.85,
        "bcr_critical": bcr > 0.85,
        "enrolment_suspend_triggered": bcr > 0.85,
        "interpretation": (
            "HEALTHY — within BCR target (0.55–0.70)" if bcr <= 0.70 else
            "WARNING — approaching actuarial limit (0.70–0.85)" if bcr <= 0.85 else
            "CRITICAL — BCR exceeds 85%, new enrolments would be suspended"
        ),
    }


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
            "bandh_active": is_bandh_active(str(z.id)),
        }
        for z in zones
    ]


@router.get("/trigger-sources")
def trigger_sources_status(db: Session = Depends(get_db)):
    zone = db.query(Zone).first()

    if settings.mock_mode:
        return {
            "mock_mode": True,
            "open_meteo": {
                "configured": True,
                "reachable": True,
                "note": "Deterministic offline mock weather data",
            },
            "waqi": {
                "configured": True,
                "reachable": True,
                "note": "Deterministic offline mock AQI data",
            },
            "sachet": {
                "configured": True,
                "reachable": True,
                "note": "Official alerts disabled in mock mode",
            },
            "order_proxy": {"configured": True, "reachable": True, "note": "Mock"},
            "bandh_mock": {"configured": True, "reachable": True, "note": "Mock"},
        }

    async def _check_open_meteo():
        if not zone:
            return {"configured": False, "reachable": False, "note": "No zones configured"}
        from integrations.open_meteo import get_current
        try:
            _ = await get_current(zone.open_meteo_lat, zone.open_meteo_lng)
            return {"configured": True, "reachable": True}
        except Exception as e:
            return {"configured": True, "reachable": False, "note": str(e)}

    async def _check_waqi():
        configured = bool(settings.waqi_api_token)
        if not zone or not configured:
            return {"configured": configured, "reachable": False if configured else None}
        from integrations.waqi import get_current
        try:
            _ = await get_current(zone.waqi_station_id)
            return {"configured": True, "reachable": True}
        except Exception as e:
            return {"configured": True, "reachable": False, "note": str(e)}

    async def _check_sachet():
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get("https://sachet.ndma.gov.in/cap_public_website/FeedPage")
                return {"configured": True, "reachable": resp.status_code == 200}
        except Exception as e:
            return {"configured": True, "reachable": False, "note": str(e)}

    open_meteo = asyncio.run(_check_open_meteo())
    waqi = asyncio.run(_check_waqi())
    sachet = asyncio.run(_check_sachet())

    return {
        "open_meteo": open_meteo,
        "waqi": waqi,
        "sachet": sachet,
        "order_proxy": {"configured": True, "reachable": True},
        "bandh_mock": {"configured": True, "reachable": True},
    }


@router.get("/privacy/deletion-requests")
def list_privacy_deletion_requests(
    status: str = "PENDING",
    db: Session = Depends(get_db),
):
    try:
        status_enum = PrivacyRequestStatus(status.upper())
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid status")

    workers = db.query(Worker).filter(Worker.deletion_request_status == status_enum).all()
    log_event(
        db=db,
        entity_type="worker",
        entity_id=None,
        action="PRIVACY_DELETION_QUEUE_VIEW",
        triggered_by=TriggeredBy.ADMIN,
        new_value={"status": status_enum.value, "count": len(workers)},
    )
    return [
        {
            "worker_id": str(w.id),
            "full_name": w.full_name,
            "phone": w.phone,
            "deletion_requested_at": w.deletion_requested_at.isoformat() if w.deletion_requested_at else None,
            "deletion_request_reason": w.deletion_request_reason,
            "deletion_request_status": w.deletion_request_status.value if w.deletion_request_status else None,
            "pii_retention_until": w.pii_retention_until.isoformat() if w.pii_retention_until else None,
            "deleted_at": w.deleted_at.isoformat() if w.deleted_at else None,
        }
        for w in workers
    ]


@router.post("/privacy/deletion-requests/{worker_id}/review")
def review_privacy_deletion_request(
    worker_id: str,
    action: str,
    db: Session = Depends(get_db),
):
    worker = db.query(Worker).filter(Worker.id == worker_id).first()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")

    normalized = action.upper().strip()
    if normalized not in {"APPROVE", "REJECT"}:
        raise HTTPException(status_code=400, detail="action must be APPROVE or REJECT")

    worker.deletion_request_status = (
        PrivacyRequestStatus.APPROVED if normalized == "APPROVE" else PrivacyRequestStatus.REJECTED
    )
    db.commit()
    db.refresh(worker)

    log_event(
        db=db,
        entity_type="worker",
        entity_id=worker.id,
        action="PRIVACY_DELETION_REQUEST_REVIEWED",
        triggered_by=TriggeredBy.ADMIN,
        new_value={"action": normalized, "status": worker.deletion_request_status.value},
    )

    return {
        "worker_id": str(worker.id),
        "deletion_request_status": worker.deletion_request_status.value,
    }


@router.post("/privacy/deletion-requests/{worker_id}/execute-redaction")
def execute_privacy_redaction(worker_id: str, db: Session = Depends(get_db)):
    worker = db.query(Worker).filter(Worker.id == worker_id).first()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")

    if worker.deletion_request_status != PrivacyRequestStatus.APPROVED:
        raise HTTPException(status_code=409, detail="Deletion request must be APPROVED before redaction")

    if worker.deleted_at:
        return {"worker_id": str(worker.id), "status": "already_redacted"}

    now = datetime.utcnow()
    redacted_suffix = str(worker.id).split("-")[0]
    worker.full_name = "REDACTED"
    worker.phone = f"redacted-{redacted_suffix}"
    worker.upi_id = "redacted@upi"
    worker.is_active = False
    worker.kyc_verified = False
    worker.deleted_at = now
    worker.deletion_request_status = PrivacyRequestStatus.COMPLETED

    db.commit()
    db.refresh(worker)

    log_event(
        db=db,
        entity_type="worker",
        entity_id=worker.id,
        action="PRIVACY_REDACTION_EXECUTED",
        triggered_by=TriggeredBy.ADMIN,
        new_value={"deleted_at": worker.deleted_at.isoformat()},
    )

    return {
        "worker_id": str(worker.id),
        "deletion_request_status": worker.deletion_request_status.value,
        "deleted_at": worker.deleted_at.isoformat() if worker.deleted_at else None,
    }


@router.put("/privacy/retention/{worker_id}")
def update_privacy_retention(worker_id: str, body: PrivacyRetentionUpdate, db: Session = Depends(get_db)):
    worker = db.query(Worker).filter(Worker.id == worker_id).first()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")

    worker.pii_retention_until = datetime.utcnow() + timedelta(days=body.retention_days)
    db.commit()
    db.refresh(worker)

    log_event(
        db=db,
        entity_type="worker",
        entity_id=worker.id,
        action="PRIVACY_RETENTION_UPDATED",
        triggered_by=TriggeredBy.ADMIN,
        new_value={"pii_retention_until": worker.pii_retention_until.isoformat(), "retention_days": body.retention_days},
    )

    return {
        "worker_id": str(worker.id),
        "pii_retention_until": worker.pii_retention_until.isoformat() if worker.pii_retention_until else None,
    }


@router.get("/privacy/retention-due")
def list_retention_due_workers(db: Session = Depends(get_db)):
    now = datetime.utcnow()
    workers = db.query(Worker).filter(
        Worker.pii_retention_until != None,
        Worker.pii_retention_until <= now,
        Worker.deleted_at == None,
    ).all()

    return [
        {
            "worker_id": str(w.id),
            "full_name": w.full_name,
            "pii_retention_until": w.pii_retention_until.isoformat() if w.pii_retention_until else None,
            "deletion_request_status": w.deletion_request_status.value if w.deletion_request_status else None,
        }
        for w in workers
    ]


@router.get("/audit-logs")
def view_audit_logs(
    entity_type: str | None = None,
    action: str | None = None,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    safe_limit = max(1, min(limit, 500))
    q = db.query(AuditLog)
    if entity_type:
        q = q.filter(AuditLog.entity_type == entity_type)
    if action:
        q = q.filter(AuditLog.action == action)

    logs = q.order_by(AuditLog.timestamp.desc()).limit(safe_limit).all()
    return [
        {
            "id": str(l.id),
            "entity_type": l.entity_type,
            "entity_id": str(l.entity_id),
            "action": l.action,
            "old_value": l.old_value,
            "new_value": l.new_value,
            "triggered_by": l.triggered_by.value if l.triggered_by else None,
            "timestamp": l.timestamp.isoformat() if l.timestamp else None,
        }
        for l in logs
    ]
