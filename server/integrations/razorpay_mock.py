"""
Mock Razorpay payout gateway.
Simulates the API shape with 95% success / 5% failure rate.
Replace this class with real Razorpay SDK in Phase 3.
"""
import uuid
import random
from dataclasses import dataclass
from typing import Optional


@dataclass
class PayoutResult:
    success: bool
    payment_id: str
    failure_reason: Optional[str] = None


def initiate_payout(upi_id: str, amount: float, reference: str) -> PayoutResult:
    if random.random() < 0.05:
        return PayoutResult(
            success=False,
            payment_id="",
            failure_reason="UPI_TIMEOUT",
        )

    payment_id = f"rzp_mock_{uuid.uuid4().hex[:16]}"
    return PayoutResult(
        success=True,
        payment_id=payment_id,
        failure_reason=None,
    )
