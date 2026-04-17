from services.evidence_service import (
    build_claim_evidence_receipt,
    build_policy_consent_receipt,
)


def test_policy_consent_receipt_hash_is_stable():
    payload1, hash1 = build_policy_consent_receipt(
        worker_id="w1",
        terms_version="v1",
        privacy_version="v1",
        consent_text_hash="abc123",
        consent_source="ONBOARDING",
        ip_address="127.0.0.1",
        user_agent="pytest",
        accepted_at_iso="2026-04-17T00:00:00Z",
    )
    payload2, hash2 = build_policy_consent_receipt(
        worker_id="w1",
        terms_version="v1",
        privacy_version="v1",
        consent_text_hash="abc123",
        consent_source="ONBOARDING",
        ip_address="127.0.0.1",
        user_agent="pytest",
        accepted_at_iso="2026-04-17T00:00:00Z",
    )

    assert payload1 == payload2
    assert hash1 == hash2


def test_claim_evidence_receipt_changes_with_decision_values():
    payload1, hash1 = build_claim_evidence_receipt(
        claim_id="c1",
        worker_id="w1",
        policy_id="p1",
        event_id="e1",
        event_type="HEAVY_RAIN",
        event_source="OPEN_METEO",
        raw_value=72.5,
        threshold_breached=50.0,
        order_drop_pct=68.2,
        payout_tier="FULL",
        claimed_hours=4.0,
        avg_weekly_income=4200.0,
        declared_weekly_hours=48,
        coverage_amount=1500.0,
        payout_amount=350.0,
        fraud_score=0.1,
        fraud_flags=[],
        decision_reason_code="AUTO_CLEAN",
    )

    payload2, hash2 = build_claim_evidence_receipt(
        claim_id="c1",
        worker_id="w1",
        policy_id="p1",
        event_id="e1",
        event_type="HEAVY_RAIN",
        event_source="OPEN_METEO",
        raw_value=72.5,
        threshold_breached=50.0,
        order_drop_pct=68.2,
        payout_tier="FULL",
        claimed_hours=4.0,
        avg_weekly_income=4200.0,
        declared_weekly_hours=48,
        coverage_amount=1500.0,
        payout_amount=0.0,
        fraud_score=0.9,
        fraud_flags=["ISOLATION_FOREST_ANOMALY"],
        decision_reason_code="MANUAL_REVIEW",
    )

    assert payload1["decision"]["payout_amount"] != payload2["decision"]["payout_amount"]
    assert hash1 != hash2
