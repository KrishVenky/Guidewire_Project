"""
End-to-end claims pipeline:
DisruptionEvent → fraud check → Claim → Payout → LLM explanation
"""
import asyncio
from datetime import datetime, timedelta
from uuid import UUID
from sqlalchemy.orm import Session

from models.claim import Claim, ClaimStatus
from models.policy import Policy, PolicyStatus
from models.disruption_event import DisruptionEvent
from models.worker import Worker
from services import fraud_detector, premium_calculator, payout_service, llm_service


async def process_disruption_event(
    event: DisruptionEvent,
    db: Session,
) -> dict:
    """
    For a fired disruption event, find all eligible workers in the zone,
    run fraud checks, create claims, initiate payouts, generate LLM explanations.
    Returns summary dict.
    """
    claims_created = 0
    skipped = 0

    # Capture zone_name before any commits detach relationships
    from models.zone import Zone
    zone = db.query(Zone).filter(Zone.id == event.zone_id).first()
    zone_name = zone.name if zone else "your zone"

    # Get all active policies in this zone
    workers_in_zone = (
        db.query(Worker)
        .filter(Worker.zone_id == event.zone_id, Worker.is_active == True)
        .all()
    )

    zone_avg_income = 3500.0
    if workers_in_zone:
        zone_avg_income = sum(w.avg_weekly_income for w in workers_in_zone) / len(workers_in_zone)

    # Filing window: skip if event ended more than 6 hours ago
    from datetime import timezone as tz
    if event.ended_at:
        event_end_utc = event.ended_at
        if event_end_utc.tzinfo is None:
            event_end_utc = event_end_utc.replace(tzinfo=tz.utc)
        hours_since_end = (datetime.utcnow().replace(tzinfo=tz.utc) - event_end_utc).total_seconds() / 3600
        if hours_since_end > 6:
            return {"claims_created": 0, "skipped_workers": len(workers_in_zone), "skip_reason": "FILING_WINDOW_EXPIRED"}

    for worker in workers_in_zone:
        active_policy = (
            db.query(Policy)
            .filter(Policy.worker_id == worker.id, Policy.status == PolicyStatus.ACTIVE)
            .first()
        )
        if not active_policy:
            skipped += 1
            continue

        # Check for duplicate claim on this event
        existing = (
            db.query(Claim)
            .filter(Claim.worker_id == worker.id, Claim.disruption_event_id == event.id)
            .first()
        )

        # Recent claims count
        week_ago = datetime.utcnow() - timedelta(days=7)
        recent_claims = (
            db.query(Claim)
            .filter(Claim.worker_id == worker.id, Claim.created_at >= week_ago)
            .count()
        )

        fraud_result = fraud_detector.evaluate(
            worker_zone_id=str(worker.zone_id),
            event_zone_id=str(event.zone_id),
            worker_active_during_event=False,  # Phase 3: real GPS validation
            claims_last_7_days=recent_claims,
            hours_since_event_ended=0.0,
            worker_income=worker.avg_weekly_income,
            zone_avg_income=zone_avg_income,
            existing_claim_for_event=existing is not None,
            is_honeypot=event.is_honeypot,
            worker_trust_tier=worker.trust_tier.value,
        )

        # Compute disruption duration from event window
        from datetime import timezone
        event_start = event.started_at
        event_end = event.ended_at or datetime.utcnow().replace(tzinfo=timezone.utc)
        if event_start.tzinfo is None:
            event_start = event_start.replace(tzinfo=timezone.utc)
        disruption_hours = max(1.0, (event_end - event_start).total_seconds() / 3600)
        payout_amount = premium_calculator.compute_payout(
            payout_tier=event.payout_tier.value,
            claimed_hours=disruption_hours,
            avg_weekly_income=worker.avg_weekly_income,
            declared_weekly_hours=worker.declared_weekly_hours,
            coverage_amount=active_policy.coverage_amount,
        )

        status = ClaimStatus.MANUAL_REVIEW if fraud_result.flagged else ClaimStatus.AUTO_APPROVED

        # Decision reason code
        if fraud_result.flagged and fraud_result.flags:
            reason_code = fraud_result.flags[0]
        else:
            reason_code = "AUTO_CLEAN"

        claim = Claim(
            worker_id=worker.id,
            policy_id=active_policy.id,
            disruption_event_id=event.id,
            status=status,
            event_started_at=event_start,
            event_ended_at=event_end,
            duration_hours=round(disruption_hours, 2),
            claimed_hours_lost=disruption_hours,
            estimated_income_lost=round(
                (worker.avg_weekly_income / max(worker.declared_weekly_hours, 1)) * disruption_hours, 2
            ),
            payout_amount=payout_amount,
            fraud_score=fraud_result.score,
            fraud_flags=fraud_result.flags,
            auto_initiated=True,
            decision_reason_code=reason_code,
            worker_zone_at_event_start=worker.zone_id,
        )
        db.add(claim)
        db.flush()

        # Generate LLM explanation
        explanation, _ = await llm_service.generate_claim_explanation(
            status=status.value,
            zone_name=zone_name,
            event_type=event.event_type.value,
            payout_amount=payout_amount,
            upi_id=worker.upi_id,
        )
        claim.llm_explanation = explanation

        # Initiate payout if clean
        if not fraud_result.flagged and payout_amount > 0:
            db.commit()
            db.refresh(claim)
            payout_service.process_payout(claim, worker, db)
        else:
            db.commit()

        claims_created += 1

    event.affected_worker_count = claims_created
    db.commit()

    return {"claims_created": claims_created, "skipped_workers": skipped}
