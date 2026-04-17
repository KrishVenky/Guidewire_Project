# Hermetical Phase 2 Gap Report + Demo Test Plan

Date: 2026-04-04
Scope reviewed:
- README Phase 2 deliverables
- FIX.md emergency requirements
- SIMULATION.md demo flow
- Current client/server implementation
- External map sources for weather/AQI visualization

## 1) Executive Summary

Current build is close to a strong hackathon demo, but not yet fully compliant with Phase 2 and FIX.md requirements.

High-priority gaps:
- Deterministic test user pack needs one-command bootstrap in all environments.
- GPS spoofing defenses are mostly rule placeholders; missing telemetry inputs and cluster analytics pipeline.
- Limited map intelligence in UI (zone list exists, but no live AQI/weather map layer).

## 2) Phase 2 Deliverables: Status and Required Fixes

| Deliverable | Current Status | Gap | Fix Needed |
|---|---|---|---|
| Project scaffold (FastAPI + React PWA) | Implemented | README checkboxes outdated | Update README/SYSTEM status to reflect actual build |
| DB schema + migrations | Partially implemented | No Alembic migrations flow; schema drift fixed via startup patch only | Add Alembic init + baseline + migration scripts |
| 90-day historical seeder | Implemented | Not wired into one-command compose bootstrap | Add `make seed` or compose one-shot seed service |
| Worker registration + phone OTP | Implemented | OTP is demo-static today (`123456`) | Replace with random OTP + SMS provider in production |
| Policy management (create/pause/cancel) | Partial | Create/pause/update present; cancel route/policy lifecycle rules incomplete | Add cancel endpoint + premium/refund logic |
| Dynamic premium (ML) | Implemented | Explainability and guardrails not surfaced in admin | Add model version + feature contributions in admin |
| 5 disruption triggers | Mostly implemented | Need proof dashboard + API health state per source | Add trigger-source status panel (Open-Meteo/WAQI/SACHET/order/bandh) |
| Dual-trigger claims with severity | Implemented | Add richer replay analytics panel | Date/duration controls + scenario presets implemented |
| Isolation Forest fraud detection | Partial | Model exists but runtime score currently optional/default 0 in pipeline | Integrate real isolation score per claim path |
| Earnings velocity profiling | Partial | Payout logic approximates hours; velocity model not exposed as first-class service output | Add per-worker velocity profile endpoint + audit fields |
| Razorpay mock payout | Implemented | Missing retry/rollback visibility in UI | Add payout timeline + retry count + failure reason |
| Post-payout Hinglish survey + trust score | Implemented | No admin trend chart over time | Add trend graph per zone/week |
| Groq LLM + fallback | Implemented | Missing abuse/rate limit guard and fallback telemetry | Add circuit breaker + fallback rate metric |
| Postman Phase 2 suite | Implemented | Needs deterministic data pack for claims/fraud scenarios | Add fixed test-data collection folder |

## 3) FIX.md Critical Items: Compliance Check

| Requirement (FIX.md) | Status | What is Missing |
|---|---|---|
| One alert per event, no duplicate payout | Partial | Need unique event fingerprint and idempotency key in claim creation |
| Claims include start/end/duration | Implemented | Need day-level summary in admin table |
| Event-based triggers not continuous spam | Partial | Scheduler runs correctly, but lacks event dedupe window by zone+type |
| Multi-day controlled simulation | Implemented now | Add UI presets: 1-day, 3-day, 7-day, 14-day |
| User sign-up/sign-in + admin separate | Implemented | Production hardening still needed | OTP+JWT+RBAC enforced across APIs |
| Fraud visibility in admin | Implemented baseline | Add anomaly trend + ring-cluster view |
| Loss ratio correctness | Partial | Values available, but needs clear denominator period labels and chart |
| Terms/consent flow | Partial | Worker consent fields exist on policy, admin evidence audit missing |
| WAQI use and AQI visualization | Partial | WAQI client exists; no map visualization in UI |
| Simulation README | Implemented | Needs update with new date-based simulation fields |

## 4) External Online Insurance/Trigger Map Sources (Recommended)

Use these in admin “Geo Risk Map” tab:

1. WAQI India map (AQI evidence)
- URL: https://aqicn.org/map/india/
- Use: visual proof for AQI trigger events and station context.

2. Open-Meteo API (weather overlays)
- Docs: https://open-meteo.com/en/docs
- Use: precipitation/temperature timeseries and zone overlays.

3. IMD warning/nowcast pages (official context)
- URL: https://mausam.imd.gov.in/imd_latest/contents/districtwise-warning.php
- Use: official warning corroboration for judge-facing evidence.

Map product to build in client:
- Base: OpenStreetMap tile layer.
- Overlay 1: zone polygons + risk multiplier color.
- Overlay 2: active disruptions with tier badges.
- Overlay 3: AQI station markers and current level.
- Overlay 4: claim hotspots + fraud-flag clusters.

## 5) Test User Matrix (Demo + Fraud Tracking)

Create these fixed test users so every run is reproducible.

| User ID | Persona | Zone | Weekly Income | Expected Coverage Days/Scenario | Fraud Scenario | Expected Claim Outcome |
|---|---|---:|---:|---:|---|---|
| U001 | Clean baseline worker | Whitefield | 3500 | 1 day | None | AUTO_APPROVED, paid |
| U002 | High-income worker | Koramangala | 9000 | 1 day | INCOME_ANOMALY check | MANUAL_REVIEW if threshold breached |
| U003 | Frequent claimant | HSR Layout | 4200 | 3 days | VELOCITY_BREACH (>2 claims/7d) | MANUAL_REVIEW |
| U004 | Zone mismatch profile | Indiranagar | 3800 | 1 day | GPS_ZONE_MISMATCH | MANUAL_REVIEW |
| U005 | Duplicate claimant | Whitefield | 3600 | 1 day | DUPLICATE_CLAIM same event replay | MANUAL_REVIEW, duplicate blocked |
| U006 | Trusted long-tenure | Koramangala | 4800 | 7 days | borderline anomalies | usually AUTO_APPROVED (trust discount) |
| U007 | Honeypot attacker | HSR Layout | 3400 | 1 day | HONEYPOT_TRIGGERED | immediate quarantine |
| U008 | Systemic stress worker | Whitefield | 3000 | 14 days | market-wide stress test | paid until suspension threshold logic applies |

Suggested policy/demo durations:
- Normal city disruption demo: 1 day.
- Fraud behavior demo: 3 days (to show velocity and duplicate patterns).
- Actuarial stress demo: 14 days (monsoon scenario).

## 6) Date Simulation Strategy (Day-by-Day Demonstration)

Recommended approach for judge demos:
- Use `simulation_start_at` + `simulation_duration_days` in `/api/disruptions/simulate`.
- Replay same user/day sequence with deterministic timestamps.
- Show daily claims timeline in admin + worker dashboard.

Recommended flow:
1. Day 1 event: show AUTO_APPROVED payout.
2. Day 2 repeat event same user: show duplicate handling.
3. Day 3 extra events: show velocity breach -> MANUAL_REVIEW.
4. Day 4 honeypot event: show quarantine and held payout.

What is most appropriate?
- For product UX: event-based real-time simulation (minutes) is best.
- For actuarial/fraud explanation: day-by-day simulation is best.
- Keep both modes: `real_time_demo` and `timeline_replay`.

## 7) GPS Spoofing Defense Plan (Practical + Demo-Friendly)

Current status:
- Rule framework exists (`GPS_ZONE_MISMATCH`, `DUPLICATE`, `HONEYPOT`, velocity checks).
- Missing rich telemetry and anti-spoof confidence scoring.

Must-add controls:
1. Multi-signal location attestation
- GPS + cell-tower coarse location + IP ASN/city + device fingerprint.
- Reject impossible combinations (e.g., GPS Bengaluru, IP Delhi).

2. Trajectory consistency checks
- Random interval pings, speed/teleport checks, dwell-time in zone.

3. Device integrity and emulator detection
- Root/jailbreak flags, mock-location enabled, emulator signatures.

4. Fraud ring detection
- Shared device fingerprint/UPI/IP clusters.
- Burst claim timing graph alerts in admin.

5. Human fallback
- Quarantine not rejection, manual review queue with reason code.

## 8) Market Crash / Systemic Event Handling ("market crash thingy")

For prolonged citywide/nationwide disruption, add financial circuit breakers:

- Tier 1: Exposure cap per zone/day.
- Tier 2: Dynamic payout haircut when BCR exceeds warning band.
- Tier 3: New enrollment suspension at loss ratio > 85% (already present).
- Tier 4: Solidarity pool drawdown with transparent reserve meter.
- Tier 5: Manual adjudication mode for systemic black-swan events.

Required admin widgets:
- Real-time reserve health bar.
- BCR trend with warning/critical markers.
- Projected runway days at current burn.

## 9) Extra Advice (High-Impact, Low-Complexity)

1. Add a deterministic demo seed command
- Seed same users, policies, and events every run.
- Run with: `make seed-demo`

2. Add Explainability receipts
- Every claim should display: trigger values, thresholds, fraud score, payout formula.

3. Add scenario presets in admin
- `clean_day`, `duplicate_attempt`, `velocity_attack`, `honeypot`, `14_day_monsoon`.

4. Add a single “Judge Mode” switch
- Auto-runs a 4-step scripted simulation and opens key panels in order.

5. Add RBAC now (even basic JWT)
- This is the biggest credibility jump for production readiness.

## 10) Immediate Next Sprint (Recommended Order)

1. Security/auth hardening: OTP + JWT + RBAC.
2. Deterministic test-data pack + scripted scenarios.
3. Geo Risk Map tab (AQI + weather + zone overlays).
4. Fraud telemetry expansion (device/IP/cell consistency).
5. Admin timeline replay mode and claim evidence receipts.
