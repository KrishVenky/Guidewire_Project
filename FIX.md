# FIX.md - RainReady Gaps, Decisions, and Test Scenarios

## 1. Final Decisions (Locked)

1. We are in MOCK mode only for now.
2. No real money movement in production-like flow for now (Razorpay mock only).
3. Keep policy pricing single-zone for MVP, but allow an "active shift zone" model to handle worker movement.
4. Registration and login must be separate from policy purchase.
5. Premium activation must happen only from dashboard, never during signup.

---

## 2. Core Gaps to Fix

### A. Time and Date Integrity
- All claim, disruption, and payout decisions must use server time only.
- Do not trust client timestamp for any financial or fraud decision.
- Add clear claim filing window rule (example: claim valid only if event ended <= 6 hours ago).
- Add simulation time override for test mode (admin/dev only).

### B. Worker Location vs Zone Logic
- Worker can move across city; this is expected behavior.
- Coverage must depend on active shift zone at event start time.
- If worker changes zone after event starts, that zone change should not affect that claim.
- Add border tolerance (example: within 1-2 km of zone boundary is still valid).

### C. Auth and Privacy
- Signup only: phone OTP + minimal profile.
- Login separate: phone OTP only.
- Policy activation later from dashboard with explicit consent.
- Avoid collecting sensitive details before user confirms policy purchase flow.

### D. Terms, Consent, and Validations
- Add Terms and Conditions page.
- Add Privacy Policy page (especially for location use).
- Capture consent timestamp (`terms_accepted_at`).
- Validate Indian mobile format and OTP verification strictly.

### E. Premium and Coverage Clarity
- Show exactly how premium is computed (base + multipliers).
- Show weekly deduction schedule.
- Show max coverage cap and per-event payout formula.
- Show what is covered and not covered in plain language.

### F. Fraud and Manual Review
- Build explicit manual review queue for flagged claims.
- Add reason codes visible to admin and worker (worker sees simplified reason).
- Add ring-detection simulation scenarios using synthetic users.

---

## 3. What We Discussed and Need to Add

1. Separate registration from policy activation.
2. Dashboard-only premium activation.
3. Server-time-only claim decisions.
4. Simulation date/time controls for testing edge cases.
5. Active shift zone snapshot at disruption start.
6. Terms + privacy + policy wording before activation.
7. Test users and test datasets for fraud ring behavior.
8. Clear claim stop condition when alert/event has ended.
9. Frontend revamp with explicit flows: signup -> login -> dashboard -> activate policy.

---

## 4. Minimum Data Additions Required

### Worker
- `primary_zone_id`
- `active_shift_zone_id`
- `last_zone_switch_at`
- `zone_switch_count_today`

### Claim
- `filed_at` (server timestamp)
- `event_started_at_snapshot`
- `event_ended_at_snapshot`
- `worker_zone_at_event_start`
- `worker_location_at_claim` (lat/lng if available)

### Policy
- `terms_accepted_at`
- `privacy_accepted_at`
- `activation_source` (must be DASHBOARD for MVP)

### Disruption/Event
- `event_start_time`
- `event_end_time`
- `is_active`
- `resolved_at`

---

## 5. Synthetic Test User Strategy (Fraud Ring Simulation)

Create at least 5 classes of test users:

1. Genuine low-frequency workers
- 1 claim/month max
- stable zone pattern

2. Genuine high-activity workers
- long shift hours
- normal but higher claim exposure during monsoon

3. Opportunistic switchers
- frequent zone switches near disruption windows

4. Coordinated fraud ring users
- multiple workers claiming same event with suspiciously synchronized behavior
- same device fingerprint/IP (if available in logs)

5. Honeypot-trigger users
- users who claim against known fake/honeypot events

Add at least 200 synthetic users total:
- 120 normal
- 40 edge but legitimate
- 40 suspicious/fraud-pattern

---

## 6. Scenario Matrix (Must Pass / Must Fail)

## Must Pass (Valid Outcomes)

1. Dual trigger true (T1 + T2), active policy, active shift zone matches event zone -> claim created.
2. Worker is near zone boundary but inside tolerance radius -> claim valid.
3. Worker switched zone before event start and cooldown respected -> new zone eligible.
4. Event ends, worker files claim within allowed filing window -> claim valid.
5. Fraud score below threshold -> auto-approved and payout mock initiated.
6. Missing external LLM key -> fallback template explanation still works.

## Must Fail (Reject / Manual Review)

1. Only T1 true but T2 false -> no payout.
2. Only T2 true but T1 false -> no payout.
3. Worker switched to event zone after event started -> reject or manual review.
4. Claim filed after filing window expiry -> reject.
5. Duplicate claim for same worker + same event -> quarantine/manual review.
6. Honeypot event claim attempt -> quarantine/manual review.
7. Excessive zone switching pattern in a day -> manual review.
8. Policy not active or premium unpaid for current cycle -> no payout.

---

## 7. Time-Based Edge Cases to Test

1. Event starts before midnight and ends after midnight.
2. Weekly premium deduction day boundary (Monday schedule).
3. Event resolved but stale alert still visible in UI.
4. Claim created while event active, then event resolves before payout.
5. Simulation with backdated event and current claim submission.

---

## 8. Zone Movement Rules (Clear Policy Wording)

1. Worker has one primary zone for pricing.
2. Worker can select one active shift zone at a time.
3. Coverage decision uses active shift zone at event start snapshot.
4. Zone changes after event start do not alter eligibility for that event.
5. Rapid zone hopping is fraud-sensitive and may trigger manual review.

---

## 9. Frontend Flow (Target)

1. Signup screen (phone + OTP + basic details only).
2. Login screen (phone + OTP).
3. Dashboard (policy status, premium preview, activation CTA).
4. Terms and privacy acceptance step.
5. Activate policy from dashboard only.
6. Claims page with status timeline and clear decision reason.

---

## 10. Payment and Coverage (Mock-Only MVP)

1. Razorpay mock used for deduction simulation.
2. Deduction event logged with reference ID.
3. Coverage amount and payout cap displayed before activation.
4. Failed deduction in mock should pause policy until resolved.

---

## 11. Missing Items Checklist

- [ ] Separate signup and login implementation
- [ ] Dashboard-only policy activation
- [ ] Terms and privacy acceptance logging
- [ ] Server-time-only decision engine
- [ ] Simulation time override endpoint (dev/admin)
- [ ] Active shift zone model
- [ ] Zone switch cooldown + max switches/day
- [ ] Boundary tolerance support
- [ ] Claim filing deadline enforcement
- [ ] Fraud ring synthetic dataset seeder
- [ ] Manual review queue UI + API filters
- [ ] Test matrix automation for pass/fail scenarios

---

## 12. Final Risk Notes

1. Biggest fairness risk: denying genuine workers who moved zones for delivery.
2. Biggest fraud risk: workers switching zones right after an alert is published.
3. Biggest trust risk: unclear policy wording on what location is actually covered.
4. Biggest ops risk: no simulation time controls means poor QA for date boundary bugs.

This FIX document is now the single source of truth for MVP corrections before scaling features.