from datetime import datetime
from sqlalchemy.orm import Session
from ..models.payout import Payout, PayoutStatus
from ..models.claim import Claim, ClaimStatus
from ..integrations.razorpay_mock import initiate_payout


def process_payout(claim: Claim, db: Session) -> Payout:
    worker = claim.worker

    result = initiate_payout(
        upi_id=worker.upi_id,
        amount=claim.payout_amount,
        reference=str(claim.id),
    )

    payout = Payout(
        claim_id=claim.id,
        worker_id=claim.worker_id,
        amount=claim.payout_amount,
        upi_id=worker.upi_id,
        razorpay_payment_id=result.payment_id,
        status=PayoutStatus.COMPLETED if result.success else PayoutStatus.FAILED,
        initiated_at=datetime.utcnow(),
        completed_at=datetime.utcnow() if result.success else None,
        failure_reason=result.failure_reason,
    )
    db.add(payout)

    if result.success:
        claim.status = ClaimStatus.PAID
        policy = claim.policy
        if policy:
            policy.total_payouts_received += claim.payout_amount

    db.commit()
    db.refresh(payout)
    return payout
