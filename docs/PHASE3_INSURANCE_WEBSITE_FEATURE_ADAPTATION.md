# Phase 3: Insurance Website Feature Adaptation

This document maps external insurance UX patterns to concrete implementation choices for Hermetical.

## Websites Reviewed

- Policybazaar
- Progressive
- ACKO
- Digit
- HDFC ERGO
- Niva Bupa
- Bajaj General Insurance
- ICICI Prudential

## Patterns Observed

1. Claim status clarity is a major trust lever.
2. Customer-controlled communication preferences are common.
3. Service centers bundle policy docs, claim tracking, and contact updates.
4. Public trust cues are repeated: transparency reports, claim speed metrics, grievance links.
5. App-first insurers offer proactive alerts and user-selected channels.

## Implemented in Code (This Sprint)

### 1) Claim Timeline API (Claim Tracking UX)

Inspired by: Digit claim status tracking, HDFC ERGO self-help claim tracking.

What was added:
- Endpoint: `GET /api/claims/{claim_id}/timeline`
- Returns a chronological event feed:
  - claim created
  - fraud screening complete
  - manual review queued (if applicable)
  - approved/rejected
  - payout initiated/completed/failed
- Role-safe access (worker-own claim or admin)
- Admin timeline views are audit logged

Business value:
- Fewer support questions ("Where is my payout?")
- Better trust through transparent progress state
- Frontend-ready for timeline UI component

### 2) Communication Preferences API (Service Center Pattern)

Inspired by: Policy service centers and communication preference controls on mature insurer portals.

What was added:
- Worker model fields:
  - `preferred_language`
  - `whatsapp_opt_in`
  - `sms_opt_in`
  - `email_opt_in`
  - `proactive_alerts_opt_in`
  - `quiet_hours_start`
  - `quiet_hours_end`
- Endpoints:
  - `GET /api/workers/{worker_id}/communication-preferences`
  - `PUT /api/workers/{worker_id}/communication-preferences`
- Validation:
  - quiet hour start/end must be updated together
- Access controls:
  - worker can update self, admin can view/update any worker
- Audit event for updates and admin views
- Idempotent schema backfill in `database.py`

Business value:
- User control over notifications reduces churn and annoyance
- Better readiness for WhatsApp/SMS nudges during disruptions
- Compliance and consent posture improved

## Recommended Next Features (Ranked)

1. Policy Document Vault
- One endpoint for worker policy artifacts, consent receipts, and downloadable claim receipts.
- Low effort, high perceived maturity.

2. Notification Delivery Ledger
- Store every outbound alert with channel, timestamp, and delivery status.
- Helps dispute handling and trust.

3. Self-Serve Contact/Profile Change Queue
- Worker-initiated profile updates with admin review history.
- Mirrors insurer service portal patterns.

4. Transparency Dashboard Endpoint
- Publish aggregate claim SLA metrics and payout velocity.
- Strong trust signal for judges/users.

5. Proactive Risk Advice Feed
- Zone-level preventive advisories (rain/heat/air quality prep steps)
- Useful content pattern seen across insurer knowledge hubs.

## Why This Fits Hermetical

Hermetical is already strongest at trigger-based automation and explainability.
The added features improve user confidence in operations and communications,
which is what mature insurer platforms do very well.

## Addendum: Follow-Through Completed in This Phase

### UI Implementation Follow-Through

- Worker dashboard now surfaces claim timeline actions, communication settings, and receipt download actions in a service-center style layout.
- Admin dashboard navigation improved for both desktop (section rail) and mobile (scrollable tab controls).
- Home, worker login, and onboarding flows were redesigned for clearer role routing and reduced friction.

### Trust Artifact Follow-Through

- Policy consent receipt endpoint is integrated in worker UX.
- Claim evidence receipt endpoint is integrated in worker UX.
- Hash display and JSON download affordances were added to increase transparency.

## Next Production Updates from This Adaptation Track

1. Notification delivery ledger with per-channel status (sent, failed, retried).
2. Service request queue for profile/contact update approvals.
3. Public-facing transparency metrics endpoint (claim SLA and payout speed).
4. Full E2E tests for timeline, preferences, and receipt downloads.
