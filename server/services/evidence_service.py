import hashlib
import json
from datetime import datetime
from typing import Any


def _canonical_hash(payload: dict[str, Any]) -> str:
    raw = json.dumps(payload, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def build_policy_consent_receipt(
    worker_id: str,
    terms_version: str,
    privacy_version: str,
    consent_text_hash: str,
    consent_source: str,
    ip_address: str,
    user_agent: str,
    accepted_at_iso: str,
) -> tuple[dict[str, Any], str]:
    payload = {
        "type": "POLICY_CONSENT",
        "worker_id": worker_id,
        "terms_version": terms_version,
        "privacy_version": privacy_version,
        "consent_text_hash": consent_text_hash,
        "consent_source": consent_source,
        "ip_address": ip_address,
        "user_agent": user_agent,
        "accepted_at": accepted_at_iso,
    }
    return payload, _canonical_hash(payload)


def build_claim_evidence_receipt(
    claim_id: str,
    worker_id: str,
    policy_id: str,
    event_id: str,
    event_type: str,
    event_source: str,
    raw_value: float,
    threshold_breached: float,
    order_drop_pct: float,
    payout_tier: str,
    claimed_hours: float,
    avg_weekly_income: float,
    declared_weekly_hours: int,
    coverage_amount: float,
    payout_amount: float,
    fraud_score: float,
    fraud_flags: list[str],
    decision_reason_code: str,
) -> tuple[dict[str, Any], str]:
    hourly_rate = avg_weekly_income / max(declared_weekly_hours, 1)

    payload = {
        "type": "CLAIM_DECISION_EVIDENCE",
        "generated_at": datetime.utcnow().isoformat(),
        "claim_id": claim_id,
        "worker_id": worker_id,
        "policy_id": policy_id,
        "event": {
            "event_id": event_id,
            "event_type": event_type,
            "event_source": event_source,
            "raw_value": raw_value,
            "threshold_breached": threshold_breached,
            "order_drop_pct": order_drop_pct,
            "payout_tier": payout_tier,
        },
        "formula_inputs": {
            "claimed_hours": round(claimed_hours, 2),
            "avg_weekly_income": round(avg_weekly_income, 2),
            "declared_weekly_hours": int(declared_weekly_hours),
            "hourly_rate": round(hourly_rate, 2),
            "coverage_amount": round(coverage_amount, 2),
        },
        "decision": {
            "payout_amount": round(payout_amount, 2),
            "fraud_score": round(fraud_score, 3),
            "fraud_flags": fraud_flags,
            "decision_reason_code": decision_reason_code,
        },
    }

    return payload, _canonical_hash(payload)
