# Hermetical Phase 3 - Uniqueness + Execution Plan

Date: 16 Apr 2026
Goal: make the project genuinely differentiated and Phase 3-ready, not just feature-complete.

Update: 17 Apr 2026

Implemented from this plan during the phase:
- claim evidence receipt generation and download pathway
- consent receipt generation and download pathway
- claim timeline status visibility for worker/admin
- communication preferences controls
- insurer-style service-center UX updates across key pages

### Next Production Updates

1. Add basis-risk confidence scoring per claim and expose via API/UI.
2. Add notification delivery ledger with retry and status visibility.
3. Add manual evidence lane (non-parametric incidents) with SLA tracking.
4. Add immutable audit export and governance reporting.

---

## Positioning Shift You Need

Current positioning:
- "Parametric insurance for gig workers with AI + fraud checks"

Target positioning for Phase 3:
- "Evidence-first income continuity network for gig workers"

Why this is stronger:
- Judges already see many trigger-and-payout demos.
- You need to prove fairness, compliance, and sustainability with hard evidence.

---

## 6 Unique Ideas That Can Differentiate You

## 1) Claim Evidence Receipt (cryptographic transparency)
What:
- For every payout/rejection, generate a signed evidence receipt:
  - trigger values
  - thresholds
  - order-drop evidence
  - fraud score + reason codes
  - payout formula inputs

Why it is unique:
- Most teams show outcomes, not machine-verifiable rationale.
- This directly addresses trust, fairness, and auditability.

MVP implementation:
- Canonical JSON payload + SHA256 digest
- Store digest in DB and show in worker/admin UI
- Downloadable receipt PDF/JSON in dashboard

---

## 2) Basis-Risk Meter (per claim confidence score)
What:
- Show a per-claim "basis-risk confidence" score from 0-100.
- Include uncertainty bounds based on weather station distance, zone density, and data freshness.

Why it is unique:
- You acknowledge uncertainty instead of pretending perfect precision.
- This aligns with insurance realism and judge expectations.

MVP implementation:
- Feature inputs:
  - distance to station
  - source reliability weight
  - order proxy confidence
  - signal agreement consistency
- Display confidence badge in worker claim card and admin review table

---

## 3) Dual-Lane Claims: Parametric lane + Manual evidence lane
What:
- Keep your current auto parametric lane.
- Add a separate manual lane for incident-driven claims (for example pothole, sudden local block, safety incident).

Why it is unique:
- Matches the WhatsApp discussion concern directly.
- Lets you answer: "We automate what should be automated, and we keep humane review where required."

MVP implementation:
- New claim type enum: PARAMETRIC or MANUAL
- Manual claim form: photo upload, event reason, timestamp, geo-tag
- Admin queue with SLA and reasoned decision logs

---

## 4) Resilience Wallet (continuity over one-time payout)
What:
- Introduce a worker-side continuity wallet:
  - payout inflow
  - optional micro-savings top-up
  - automatic premium continuity on low-income weeks

Why it is unique:
- Shifts story from "claim paid" to "income continuity maintained".
- Strongly aligns with storytelling guidance: end with continuity.

MVP implementation:
- Ledger table for wallet debits/credits
- Auto-rule: if premium due and wallet balance sufficient, auto-deduct
- UI card showing continuity runway days

---

## 5) Fraud Ring Radar (graph-first anti-abuse)
What:
- Move beyond per-claim fraud scoring to cluster detection:
  - shared device signatures
  - shared payout endpoints
  - synchronized claim timing

Why it is unique:
- Most teams stop at single-claim anomaly score.
- Graph/ring view in admin dashboard is highly demo-worthy and practical.

MVP implementation:
- Build simple graph edges from existing claim metadata
- Surface "ring suspicion score" and top suspicious clusters
- Add quarantine actions at cluster level

---

## 6) Actuarial Live Lab (interactive reserve survival simulator)
What:
- Convert stress-test into an interactive model lab:
  - event frequency sliders
  - severity distribution changes
  - enrollment growth curve
  - reserve depletion timeline

Why it is unique:
- Judges want financial proof, not static numbers.
- This demonstrates insurance maturity and governance thinking.

MVP implementation:
- Expand current stress-test endpoint into scenario engine
- Add Monte Carlo mode with confidence bands
- Show break-even and shutdown guardrails visually

---

## Phase 3 Execution Plan (Fast, Practical, Judge-Friendly)

## Sprint A (Days 1-4): Trust and safety foundation
- Replace static OTP with real random OTP + rate limiting
- Move OTP state to Redis
- Protect phone lookup endpoint
- Add environment safety checks for secret key/admin pin/debug flags

Deliverable impact:
- Eliminates major red flags in code review.

## Sprint B (Days 5-8): Evidence and compliance layer
- Implement consent artifact versioning and immutable receipts
- Add claim evidence receipt generation and display
- Add PII access logs in admin actions

Deliverable impact:
- Strong answer to IRDAI/DPDP-style judge questions.

## Sprint C (Days 9-12): Uniqueness features
- Add manual claim lane (photo + reason + review SLA)
- Add basis-risk confidence meter
- Add ring radar panel in admin

Deliverable impact:
- Distinctive story beyond generic parametric demos.

## Sprint D (Days 13-15): Demo polish and submission readiness
- Add persona-based one-click story replay (person -> disruption -> loss -> protection -> relief)
- Prepare a 5-minute deterministic demo script
- Tighten README, architecture, and run instructions
- Add minimal automated test suite for critical paths

Deliverable impact:
- Better judge comprehension and confidence in execution quality.

---

## 5-Minute Demo Script to Maximize Score

1. Start with one named worker persona and exact weekly economics.
2. Trigger disruption and show dual-trigger evidence.
3. Show auto claim decision with evidence receipt hash.
4. Show one flagged case in Fraud Ring Radar and manual-review handling.
5. End with continuity outcome (wallet/premium continuity), not just payout.

Tagline for close:
- "We do not just pay claims. We preserve income continuity with auditable fairness."

---

## What To Cut (to stay focused)

- Do not build too many new trigger types now.
- Do not chase perfect ML sophistication before evidence transparency.
- Do not over-invest in UI cosmetics before trust/compliance/proof controls.

---

## Success Metrics for This Phase

Technical:
- 0 critical security defaults in runtime
- 90%+ pass rate on critical-path API tests
- deterministic demo script runnable in one command

Insurance quality:
- per-claim evidence receipt available
- basis-risk confidence shown for every payout decision
- reserve survival dashboard with scenario comparisons

Judge experience:
- clear 5-minute narrative with one persona and exact numbers
- visible differentiation from typical trigger-payout demos
- explicit answer for fairness, fraud, compliance, and sustainability
