"""
Fraud detection service.
Deterministic rules + Isolation Forest anomaly scoring.
Score > 0.7 → MANUAL_REVIEW. Flagged claims are quarantined, never auto-denied.
"""
from dataclasses import dataclass, field
from typing import List, Optional
from datetime import datetime, timedelta
from uuid import UUID


@dataclass
class FraudResult:
    flagged: bool
    score: float
    flags: List[str] = field(default_factory=list)


REVIEW_THRESHOLD = 0.7


def evaluate(
    worker_zone_id: str,
    event_zone_id: str,
    worker_active_during_event: bool,
    claims_last_7_days: int,
    hours_since_event_ended: float,
    worker_income: float,
    zone_avg_income: float,
    existing_claim_for_event: bool,
    is_honeypot: bool,
    isolation_forest_score: float = 0.0,
    worker_trust_tier: str = "NEW_PARTNER",
    weather_inconsistency: bool = False,
    gps_impossible_jump: bool = False,
    event_source_untrusted: bool = False,
) -> FraudResult:
    score = 0.0
    flags: List[str] = []

    # Auto-quarantine cases
    if is_honeypot:
        return FraudResult(flagged=True, score=1.0, flags=["HONEYPOT_TRIGGERED"])

    if existing_claim_for_event:
        return FraudResult(flagged=True, score=1.0, flags=["DUPLICATE_CLAIM"])

    # Zone mismatch
    if str(worker_zone_id) != str(event_zone_id):
        score += 0.4
        flags.append("GPS_ZONE_MISMATCH")

    # Active during disruption
    if worker_active_during_event:
        score += 0.5
        flags.append("ACTIVE_DURING_DISRUPTION")

    # Claim velocity
    if claims_last_7_days > 2:
        score += 0.3
        flags.append("VELOCITY_BREACH")

    # Late filing
    if hours_since_event_ended > 6:
        score += 0.2
        flags.append("LATE_FILING")

    # Income anomaly
    if zone_avg_income > 0 and worker_income > zone_avg_income * 3:
        score += 0.2
        flags.append("INCOME_ANOMALY")

    # Isolation Forest
    if isolation_forest_score > 0.8:
        score += 0.3
        flags.append("ISOLATION_FOREST_ANOMALY")

    # Claimed weather intensity is inconsistent with external archive history.
    if weather_inconsistency:
        score += 0.45
        flags.append("HISTORICAL_WEATHER_MISMATCH")

    # Placeholder hook for future GPS trace ingestion (mobile SDK).
    if gps_impossible_jump:
        score += 0.45
        flags.append("GPS_SPOOF_SUSPECTED")

    if event_source_untrusted:
        score += 0.3
        flags.append("UNTRUSTED_EVENT_SOURCE")

    # Trusted partners get higher tolerance
    if worker_trust_tier == "TRUSTED_PARTNER":
        score = max(0.0, score - 0.2)

    return FraudResult(flagged=score >= REVIEW_THRESHOLD, score=round(score, 3), flags=flags)
