from datetime import datetime
import logging
from sqlalchemy.orm import Session
from models.payout import Payout, PayoutStatus
from models.claim import Claim, ClaimStatus
from integrations.razorpay_mock import initiate_payout

logger = logging.getLogger(__name__)

MAX_RETRIES = 3


def process_payout(claim: Claim, worker, db: Session) -> Payout:
    initiated_at = datetime.utcnow()

    result = None
    for attempt in range(1, MAX_RETRIES + 1):
        result = initiate_payout(
            upi_id=worker.upi_id,
            amount=claim.payout_amount,
            reference=str(claim.id),
        )
        if result.success:
            break
        logger.warning(
            f"[Payout] Attempt {attempt}/{MAX_RETRIES} failed for claim {claim.id}: {result.failure_reason}"
        )

    completed_at = datetime.utcnow()
    seconds_to_complete = (completed_at - initiated_at).total_seconds()

    payout = Payout(
        claim_id=claim.id,
        worker_id=claim.worker_id,
        amount=claim.payout_amount,
        upi_id=worker.upi_id,
        razorpay_payment_id=result.payment_id,
        status=PayoutStatus.COMPLETED if result.success else PayoutStatus.FAILED,
        initiated_at=initiated_at,
        completed_at=completed_at if result.success else None,
        failure_reason=result.failure_reason,
        seconds_to_complete=round(seconds_to_complete, 3) if result.success else None,
    )
    db.add(payout)

    if result.success:
        claim.status = ClaimStatus.PAID
        policy = claim.policy
        if policy:
            policy.total_payouts_received += claim.payout_amount
        logger.info(
            f"[Payout] SUCCESS claim={claim.id} amount=₹{claim.payout_amount} "
            f"upi={worker.upi_id} in {seconds_to_complete:.1f}s"
        )
    else:
        # Rollback: reset claim to AUTO_APPROVED so it remains retriable
        claim.status = ClaimStatus.AUTO_APPROVED
        logger.error(
            f"[Payout] FAILED after {MAX_RETRIES} attempts claim={claim.id} "
            f"reason={result.failure_reason} — rolled back to AUTO_APPROVED"
        )

    db.commit()
    db.refresh(payout)
    return payout
