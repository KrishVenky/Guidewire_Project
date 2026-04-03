# FIX.md - Final Gap Log and Action Plan (Mock MVP)

## 1. Scope and Locked Decisions

1. Product mode is MOCK only.
2. No real bank deduction in MVP; payout and deduction are simulated through gateway mocks.
3. Keep single-zone pricing, but support one active shift zone to handle worker movement.
4. Signup and login are separate from policy purchase.
5. Policy activation happens only from dashboard.

---

## 2. Biggest Gaps (Priority Order)

## P0 - Must Fix Before Demo

1. Time integrity is not strict enough.
- Every claim decision must use server timestamp only.
- Claim filing window must be hard-enforced.

2. Zone movement coverage is ambiguous.
- Worker movement across regions is normal.
- Eligibility must use active shift zone snapshot at event start time.

3. Signup flow is overloaded.
- Signup currently mixes identity capture and policy purchase intent.
- This leaks too much detail too early and hurts trust.

4. Terms and consent are missing in product flow.
- Need terms acceptance and privacy acceptance timestamp before policy activation.

## P1 - Must Fix for Reliability and Fairness

1. Fraud-ring simulation dataset is missing.
2. Manual review queue and reason-code visibility are incomplete.
3. Payout failure rollback and retry logic are not clearly defined.
4. Coverage wording is not explicit for moved workers and border cases.

## P2 - Must Fix for Judge Alignment

1. Actuarial guardrails are not explicit (BCR / loss-ratio thresholds).
2. Active-hours matching is not clearly enforced in payout eligibility.
3. Trigger granularity should move toward ward-level where possible.

---

## 3. Required Rule Changes

1. Claim eligibility = dual trigger + active policy + active shift zone snapshot + within filing window.
2. Zone change after event start does not alter eligibility for that event.
3. Introduce zone-switch cooldown and daily switch cap.
4. Add boundary tolerance for near-edge deliveries.
5. If premium unpaid for cycle, claim should not be paid.

---

## 4. Data Fields to Add

## Worker
- `primary_zone_id`
- `active_shift_zone_id`
- `last_zone_switch_at`
- `zone_switch_count_today`

## Claim
- `filed_at` (server-generated)
- `event_started_at_snapshot`
- `event_ended_at_snapshot`
- `worker_zone_at_event_start`
- `worker_location_at_claim`
- `decision_reason_code`

## Policy
- `terms_accepted_at`
- `privacy_accepted_at`
- `activation_source` (must be DASHBOARD)

## Disruption Event
- `event_start_time`
- `event_end_time`
- `resolved_at`
- `is_active`

---

## 5. Fraud-Ring Test User Plan

Create synthetic users by behavior class:

1. Clean workers
- stable zone pattern, low claim frequency

2. High exposure but legitimate workers
- long active hours, valid zone shifts

3. Opportunistic switchers
- frequent pre-alert zone movement

4. Coordinated ring users
- synchronized claims, repeated co-claiming clusters

5. Honeypot responders
- users who claim fake events

Minimum dataset target:
- 200 users total
- 120 clean
- 40 edge legitimate
- 40 suspicious

---

## 6. Scenario Matrix - Must Pass

1. T1 and T2 true, policy active, zone snapshot matches -> claim created.
2. Worker at zone boundary within tolerance -> claim valid.
3. Worker switched zone before event and cooldown respected -> claim valid in new zone.
4. Claim filed within deadline after event end -> claim valid.
5. Fraud score below threshold -> auto-approve and payout mock processed.
6. LLM key unavailable -> explanation fallback template still works.
7. UPI transfer mock fails once, retry succeeds -> payout completes and logs reconcile.

---

## 7. Scenario Matrix - Must Fail or Manual Review

1. Only T1 true -> no payout.
2. Only T2 true -> no payout.
3. Worker changed zone after event started -> reject/manual review.
4. Filing window expired -> reject.
5. Duplicate claim same worker and event -> quarantine/manual review.
6. Honeypot claim attempt -> quarantine/manual review.
7. Zone hopping beyond cap -> manual review.
8. Premium unpaid in current cycle -> reject.
9. Worker inactive in trigger window -> reject/manual review.
10. Ring cluster detected across multiple accounts -> manual review.

---

## 8. Time and Simulation Cases

1. Event crosses midnight.
2. Monday premium deduction boundary.
3. Event resolved but stale UI alert present.
4. Claim created while event active, payout after event closure.
5. Backdated event simulation with current-time claim submission.
6. Clock override in dev mode only; never enabled in production mode.

---

## 9. Frontend Gaps and Required Flow

1. Signup: phone + OTP + basic profile only.
2. Login: phone + OTP only.
3. Dashboard: premium preview, coverage summary, activate CTA.
4. Consent step: terms + privacy + location policy before activation.
5. Claim timeline page: reason codes, timestamps, final state.
6. Zone selector: active shift zone with cooldown and warning messages.

---

## 10. Payments, Payouts, and Mock Behavior

1. Premium deduction and payout are simulated; no real transfer.
2. Every transfer must have reference id + retry count + status transitions.
3. Fallback path should exist in mock logic (UPI fail -> IMPS mock path).
4. Reconciliation log must always update final state.

---

## 11. Slide Alignment Gaps (From DevTrails Guidance)

1. Underwriting gating needs explicit active-days rule before cover starts.
2. Trigger should map to worker city/zone and active work window.
3. Pricing needs affordability + sustainability guardrails.
4. Actuarial controls need target BCR and emergency brakes.
5. Settlement should be zero-touch, fast, and failure-safe.

Suggested control thresholds for MVP:
- Target BCR: 0.55 to 0.70
- If loss ratio > 0.85 for rolling period: pause new enrollments and reprice

---

## 12. Missing Items Checklist

- [ ] Server-time-only enforcement in claim engine
- [ ] Filing window hard rule
- [ ] Active shift zone snapshot logic
- [ ] Zone cooldown and daily switch cap
- [ ] Terms and privacy acceptance capture
- [ ] Signup vs login separation
- [ ] Dashboard-only policy activation
- [ ] Fraud ring synthetic data seeder
- [ ] Manual review queue with reason-code filters
- [ ] Payout retry and fallback state machine
- [ ] Simulation time override for dev/admin only
- [ ] Pass/fail automation for all scenarios listed above

---

## 13. Final Risks if Unfixed

1. Fairness risk: genuine workers denied when they move zones.
2. Fraud risk: workers gaming zone switches around alerts.
3. Trust risk: unclear wording on what is actually covered.
4. Financial risk: no actuarial guardrails can break sustainability.
5. Ops risk: weak simulation controls leave date-boundary bugs undetected.

This file is the final implementation gap tracker for the mock MVP.