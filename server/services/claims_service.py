"""
End-to-end claims pipeline:
DisruptionEvent → fraud check → Claim → Payout → LLM explanation
"""
import asyncio
from datetime import datetime, timedelta
from uuid import UUID
from sqlalchemy.orm import Session

from ..models.claim import Claim, ClaimStatus
from ..models.policy import Policy, PolicyStatus
from ..models.disruption_event import DisruptionEvent
from ..models.worker import Worker
from ..services import fraud_detector, premium_calculator, payout_service, llm_service


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

    # Get all active policies in this zone
    workers_in_zone = (
        db.query(Worker)
        .filter(Worker.zone_id == event.zone_id, Worker.is_active == True)
        .all()
    )

    zone_avg_income = 3500.0
    if workers_in_zone:
        zone_avg_income = sum(w.avg_weekly_income for w in workers_in_zone) / len(workers_in_zone)

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

        # Compute payout amount
        disruption_hours = 3.0  # estimated disruption duration
        payout_amount = premium_calculator.compute_payout(
            payout_tier=event.payout_tier.value,
            claimed_hours=disruption_hours,
            avg_weekly_income=worker.avg_weekly_income,
            declared_weekly_hours=worker.declared_weekly_hours,
            coverage_amount=active_policy.coverage_amount,
        )

        status = ClaimStatus.MANUAL_REVIEW if fraud_result.flagged else ClaimStatus.AUTO_APPROVED

        claim = Claim(
            worker_id=worker.id,
            policy_id=active_policy.id,
            disruption_event_id=event.id,
            status=status,
            claimed_hours_lost=disruption_hours,
            estimated_income_lost=round(
                (worker.avg_weekly_income / max(worker.declared_weekly_hours, 1)) * disruption_hours, 2
            ),
            payout_amount=payout_amount,
            fraud_score=fraud_result.score,
            fraud_flags=fraud_result.flags,
            auto_initiated=True,
        )
        db.add(claim)
        db.flush()

        # Generate LLM explanation
        explanation, _ = await llm_service.generate_claim_explanation(
            status=status.value,
            zone_name=event.zone.name if event.zone else "your zone",
            event_type=event.event_type.value,
            payout_amount=payout_amount,
            upi_id=worker.upi_id,
        )
        claim.llm_explanation = explanation

        # Initiate payout if clean
        if not fraud_result.flagged and payout_amount > 0:
            db.commit()
            db.refresh(claim)
            payout_service.process_payout(claim, db)
        else:
            db.commit()

        claims_created += 1

    event.affected_worker_count = claims_created
    db.commit()

    return {"claims_created": claims_created, "skipped_workers": skipped}
