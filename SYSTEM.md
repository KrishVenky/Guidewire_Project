# SYSTEM.md — Hermetical Internal System Brain

> **FOR:** Developers, coding agents, LLMs working on this codebase
> **PURPOSE:** Complete implementation reference. Every component, endpoint, data model, directory, integration, and test status documented here. Read this before touching any file.
> **RULE:** Every time a component reaches stable status, this document is updated. Never let SYSTEM.md fall behind the codebase.

## Current Implementation Delta (April 2026)

- Authentication is OTP + JWT based via `/api/auth/*` routes.
- Role-based access is enforced across worker/admin endpoints.
- Runtime is mock-first by default (`MOCK_MODE=true` in Docker), with deterministic offline integration behavior for Open-Meteo, WAQI, and SACHET.
- Admin dashboard includes:
    - Trigger source health panel (mock-aware)
    - Claims fraud review panel
    - Simulation presets with timeline replay controls
    - **Workers tab** for fetching, searching, and inspecting driver details

---

## Table of Contents
1. [System Philosophy](#1-system-philosophy)
2. [Repository Structure](#2-repository-structure)
3. [Data Models](#3-data-models)
4. [Backend — Server](#4-backend--server)
5. [Frontend — Client](#5-frontend--client)
6. [External Integrations](#6-external-integrations)
7. [LLM Layer](#7-llm-layer)
8. [Trigger Engine](#8-trigger-engine)
9. [Premium Calculator](#9-premium-calculator)
10. [Fraud Detection](#10-fraud-detection)
11. [Environment Variables](#11-environment-variables)
12. [Docker Setup](#12-docker-setup)
13. [Testing Guide](#13-testing-guide)
14. [Build Status](#14-build-status)
15. [Known Issues & Tech Debt](#15-known-issues--tech-debt)

---

## 1. System Philosophy

### The Golden Rule of This Codebase
**The LLM never makes financial decisions. Ever.**

The trigger engine is deterministic rules only. The premium calculator is deterministic math only. The fraud detector is rule + statistical only. The LLM (Llama 3.1 8B via Groq API) exists in exactly one place: the communication layer that explains decisions already made, in Hinglish, to the worker.

If you find yourself routing a financial decision through the LLM — stop. That is a bug.

### Dual-Trigger Parametric Model (DTPM)
A payout is initiated ONLY when both triggers fire simultaneously:
- **T1:** An official disruption signal from a verified external source (SACHET/Open-Meteo/WAQI)
- **T2:** Zone-level order activity drop >60% vs the 7-day rolling average for that zone/hour

Neither trigger alone is sufficient. This is the core insurance architecture decision and must not be changed without updating the premium model accordingly.

### Data Flow (High Level)
```
External APIs (SACHET, Open-Meteo, WAQI)
    → APScheduler Jobs (every 5 min per zone)
        → Trigger Engine (rules evaluation)
            → If BOTH T1 + T2 fire:
                → Fraud Check
                    → If clean: Claim created, Payout initiated (Razorpay mock)
                    → If flagged: Claim created, status = MANUAL_REVIEW
            → Regardless: LLM generates worker notification message (Groq API)
                → Push to worker dashboard + simulated SMS (fallback to template if no key)
```

---

## 2. Repository Structure

```
Guidewire_Project/
│
├── README.md                         # Hackathon submission doc (public)
├── SYSTEM.md                         # This file (internal brain)
├── docker-compose.yml                # Spins up: server, client, postgres, redis
├── Makefile                          # Convenience targets (up/down/seed-demo)
├── .env.example                      # Copy to .env and fill values
│
├── client/                           # React 18 + Vite + TailwindCSS (Phase 2 PWA)
│   ├── src/
│   │   ├── main.jsx                  # Entry point
│   │   ├── App.jsx                   # Router root
│   │   ├── pages/                    # Route-level page components
│   │   │   ├── Onboarding/           # Worker registration flow
│   │   │   ├── WorkerLogin/          # Worker OTP login flow
│   │   │   ├── WorkerDashboard/      # Worker-facing dashboard
│   │   │   ├── AdminDashboard/       # Insurer/admin dashboard
│   │   │   └── Home/                 # Landing and role entrypoints
│   │   ├── api/                      # Axios client + endpoint functions
│   │   │   └── index.js              # All API calls defined here
│   │   ├── store/                    # Zustand global state
│   │   │   └── index.js
│   │   └── index.css
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json
│
├── server/                           # FastAPI Python backend
│   ├── main.py                       # FastAPI app entry, router registration, APScheduler startup
│   ├── config.py                     # Settings via pydantic-settings (.env reader)
│   ├── database.py                   # SQLAlchemy engine + session factory
│   │
│   ├── models/                       # SQLAlchemy ORM models (source of truth for DB schema)
│   │   ├── worker.py
│   │   ├── policy.py
│   │   ├── claim.py
│   │   ├── payout.py
│   │   ├── zone.py
│   │   ├── disruption_event.py
│   │   └── audit_log.py
│   │
│   ├── schemas/                      # Pydantic schemas (request/response validation)
│   │   ├── worker.py
│   │   ├── policy.py
│   │   ├── claim.py
│   │   └── disruption.py
│   │
│   ├── routers/                      # FastAPI route handlers
│   │   ├── auth.py                   # /api/auth/* (OTP/admin login + JWT)
│   │   ├── workers.py                # /api/workers/*
│   │   ├── policies.py               # /api/policies/*
│   │   ├── claims.py                 # /api/claims/*
│   │   ├── disruptions.py            # /api/disruptions/*
│   │   ├── admin.py                  # /api/admin/*
│   │   └── llm.py                    # /api/llm/* (communication only)
│   │
│   ├── services/                     # Business logic layer
│   │   ├── trigger_engine.py         # DTPM dual-trigger evaluation
│   │   ├── premium_calculator.py     # Weekly premium computation
│   │   ├── fraud_detector.py         # Fraud rule evaluation
│   │   ├── payout_service.py         # Razorpay mock integration
│   │   ├── claims_service.py         # Claims generation + fraud + payout orchestration
│   │   ├── llm_service.py            # Groq client (comm layer only) + template fallback
│   │   └── trigger_engine.py         # Signal normalization + tier mapping
│   │
│   ├── integrations/                 # External API clients
│   │   ├── sachet.py                 # SACHET NDMA RSS feed parser
│   │   ├── open_meteo.py             # Open-Meteo weather client (free, no key)
│   │   ├── waqi.py                   # WAQI AQI API client
│   │   ├── order_proxy.py            # Simulated zone order-rate microservice
│   │   └── razorpay_mock.py          # Mock payout gateway
│   │
│   ├── jobs/                         # APScheduler background jobs
│   │   └── scheduler.py              # APScheduler instance + job registration
│   │
│   ├── ml/                           # ML models (trained offline, loaded at startup)
│   │   ├── train_premium_model.py    # XGBoost training script (run once)
│   │   ├── premium_model.joblib      # Serialized XGBoost model
│   │   ├── fraud_model.py            # Isolation Forest anomaly scorer
│   │   └── isolation_forest.joblib   # Serialized fraud model
│   │
│   ├── seeds/                        # Dev seed data
│   │   ├── zones.py                  # Bengaluru zones seed (4 zones)
│   │   └── demo_users.py             # Deterministic U001–U008 seed pack
│   │
│   ├── requirements.txt
│   └── Dockerfile
│
├── postman/                          # API test suite
│   ├── Hermetical_Phase2.postman_collection.json   # Full Phase 2 endpoint coverage
│   └── Hermetical.postman_environment.json         # Environment (base_url, auto-captured IDs)
│
└── scripts/
    └── seed_historical_data.py       # Standalone seeder (can run outside Docker)
```

---

## 3. Data Models

### Worker
```python
class Worker:
    id: UUID (PK)
    full_name: str
    phone: str (unique, used as login)
    upi_id: str
    platform: enum [ZOMATO, SWIGGY, BLINKIT, INSTAMART, MULTIPLE]
    zone_id: UUID (FK → Zone)
    avg_weekly_income: float          # Self-reported at onboarding, used for premium base
    declared_weekly_hours: int        # Self-reported, used for hourly rate calculation
    registration_date: datetime
    is_active: bool
    kyc_verified: bool
    tenure_weeks: int                 # Computed weekly, used for tenure discount
    trust_tier: enum [NEW_PARTNER, RISING_PARTNER, TRUSTED_PARTNER]  # Phase 3 active
```

### Zone
```python
class Zone:
    id: UUID (PK)
    name: str                         # e.g. "Whitefield", "Koramangala"
    city: str                         # e.g. "Bengaluru"
    lat_center: float
    lng_center: float
    flood_risk_score: float           # 0.0–1.0, historical data
    heat_risk_score: float
    aqi_risk_score: float
    risk_multiplier: float            # Derived: 0.8–1.4, used in premium calc
    open_meteo_lat: float             # Lat for Open-Meteo API call
    open_meteo_lng: float             # Lng for Open-Meteo API call
    waqi_station_id: str              # Nearest WAQI monitoring station
    sachet_district: str              # District name for SACHET alert matching
    rain_threshold: float             # mm/hr — from zone_config, recalibrated weekly
    heat_threshold: float             # °C — from zone_config, recalibrated weekly
    aqi_threshold: float              # AQI value — from zone_config, recalibrated weekly
    order_drop_threshold: float       # % drop — from zone_config, recalibrated weekly
```

### Policy
```python
class Policy:
    id: UUID (PK)
    worker_id: UUID (FK → Worker)
    weekly_premium: float             # Recalculated every Monday
    coverage_amount: float            # Max payout per disruption event
    coverage_hours_per_week: int      # How many work-hours are insured
    status: enum [ACTIVE, PAUSED, CANCELLED, EXPIRED]
    start_date: date
    current_week_start: date
    premium_paid_this_week: bool
    total_premiums_paid: float
    total_payouts_received: float
```

### DisruptionEvent
```python
class DisruptionEvent:
    id: UUID (PK)
    zone_id: UUID (FK → Zone)
    event_type: enum [HEAVY_RAIN, EXTREME_HEAT, HIGH_AQI, NDMA_ALERT, ORDER_DROP, BANDH]
    source: enum [SACHET, OPEN_METEO, WAQI, ORDER_PROXY, BANDH_MOCK]
    severity_score: float             # 0–100, computed from T1 intensity + T2 magnitude
    raw_value: float                  # e.g. rainfall mm/hr, temp °C, AQI value
    threshold_breached: float         # Zone-specific threshold that was exceeded
    order_drop_pct: float             # T2 — how far below baseline (e.g. 72.3%)
    t1_confirmed: bool
    t2_confirmed: bool
    dual_trigger_fired: bool          # Both T1 + T2 = True → payout eligible
    payout_tier: enum [NONE, HALF, THREE_QUARTER, FULL]  # Derived from severity_score
    is_honeypot: bool                 # True = fake alert for fraud detection
    started_at: datetime
    ended_at: datetime (nullable)
    affected_worker_count: int
```

### Claim
```python
class Claim:
    id: UUID (PK)
    worker_id: UUID (FK → Worker)
    policy_id: UUID (FK → Policy)
    disruption_event_id: UUID (FK → DisruptionEvent)
    status: enum [AUTO_APPROVED, MANUAL_REVIEW, APPROVED, REJECTED, PAID]
    claimed_hours_lost: float         # Auto-calculated from disruption duration
    estimated_income_lost: float      # claimed_hours × (avg_weekly_income / active_hours)
    payout_amount: float              # Actual approved payout (after severity tier)
    fraud_score: float                # 0.0–1.0 (>0.7 = MANUAL_REVIEW)
    fraud_flags: list[str]            # e.g. ["GPS_MISMATCH", "VELOCITY_BREACH"]
    auto_initiated: bool              # True = system-generated, False = manual
    created_at: datetime
    reviewed_at: datetime (nullable)
    llm_explanation: str              # Hinglish message shown to worker
    trust_survey_response: JSON       # 3-tap post-payout survey (nullable)
```

### Payout
```python
class Payout:
    id: UUID (PK)
    claim_id: UUID (FK → Claim)
    worker_id: UUID (FK → Worker)
    amount: float
    upi_id: str                       # Worker UPI at time of payout
    razorpay_payment_id: str          # Mock gateway reference (rzp_mock_ prefix)
    status: enum [PENDING, PROCESSING, COMPLETED, FAILED]
    initiated_at: datetime
    completed_at: datetime (nullable)
    failure_reason: str (nullable)
```

### AuditLog
```python
class AuditLog:
    id: UUID (PK)
    entity_type: str                  # "claim", "policy", "payout", "worker"
    entity_id: UUID
    action: str                       # "created", "status_changed", "fraud_flagged"
    old_value: JSON (nullable)
    new_value: JSON (nullable)
    triggered_by: enum [SYSTEM, ADMIN, WORKER]
    timestamp: datetime
```

---

## 4. Backend — Server

### Entry Point: `server/main.py`
- Creates FastAPI app instance
- Registers all routers with `/api` prefix
- Registers CORS middleware (allow all origins in dev)
- On startup: initializes DB tables, seeds zone data if empty, starts APScheduler

### Config: `server/config.py`
Reads from `.env` via pydantic-settings. Key variables listed in Section 11.

### API Endpoints Reference

#### Workers — `/api/workers`
| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/register` | Create new worker account | None |
| GET | `/{worker_id}` | Get worker profile | Worker |
| PUT | `/{worker_id}` | Update worker profile | Worker |
| GET | `/{worker_id}/dashboard` | Full dashboard data | Worker |

#### Policies — `/api/policies`
| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/create` | Create policy for worker | Worker |
| GET | `/{policy_id}` | Get policy details | Worker |
| PUT | `/{policy_id}/pause` | Pause active policy | Worker |
| GET | `/worker/{worker_id}` | Get all policies for worker | Worker |
| GET | `/premium/calculate` | Preview premium before buying | None |

#### Claims — `/api/claims`
| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/worker/{worker_id}` | Get all claims for worker | Worker |
| GET | `/{claim_id}` | Get single claim + explanation | Worker |
| POST | `/{claim_id}/review` | Admin: approve/reject claim | Admin |

#### Disruptions — `/api/disruptions`
| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/active` | Get all currently active disruptions | Worker/Admin |
| GET | `/zone/{zone_id}` | Disruptions for specific zone | Worker/Admin |
| POST | `/simulate` | Dev only — trigger a mock disruption | Admin |
| POST | `/bandh/toggle` | Toggle bandh signal for a zone | Admin |

#### Admin — `/api/admin`
| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/dashboard` | Full insurer metrics | Admin |
| GET | `/claims/pending` | All claims awaiting review | Admin |
| GET | `/workers` | All registered workers | Admin |
| GET | `/financial-summary` | Loss ratios, payout totals | Admin |
| GET | `/zone-trust-scores` | Post-payout survey trust scores per zone | Admin |
| GET | `/trigger-sources` | Source health and mock-mode status | Admin |
| GET | `/stress-test` | Scenario BCR stress simulation | Admin |

#### LLM — `/api/llm`
| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/explain-claim` | Generate Hinglish claim explanation | Worker/Admin |
| POST | `/onboarding-chat` | Conversational onboarding Q&A | Worker/Admin |

#### Health
| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Server health + DB connectivity check |

---

## 5. Frontend — Client

### Routing Structure (`App.jsx`)
```
/                         → Home (role entry)
/worker/register          → Worker registration flow
/worker/login             → Worker OTP login flow
/onboarding               → Redirect to /worker/register
/dashboard/*              → WorkerDashboard (requires worker token)
/admin                    → AdminDashboard (requires admin token)
```

### Key Pages

#### Onboarding (`/pages/Onboarding/`)
Registration-only flow:
1. Mobile number capture
2. Personal, zone, income and UPI details
3. Registration success and redirect to Worker Login

Login is handled in `/pages/WorkerLogin/` using OTP request + verify API.

#### WorkerDashboard (`/pages/WorkerDashboard/`)
Shows:
- Active policy status + this week's premium
- Coverage amount remaining
- Recent claims with status badges
- Live disruption alerts for worker's zone
- Earnings protected (cumulative payout total)
- Post-payout survey (fires after payout completes)

Data source: `GET /api/workers/{id}/dashboard` (single aggregated endpoint)

#### AdminDashboard (`/pages/AdminDashboard/`)
Shows:
- Total active policies
- This week's disruption events
- Claims pipeline (auto-approved / pending review / paid)
- Trigger-source health (mock-aware)
- Zone trust scores from post-payout surveys
- Bandh signal toggle per zone
- Timeline simulation controls + scenario presets
- Fraud intelligence panel
- Workers tab: fetch/search/inspect driver details

#### DisruptionMap (`/pages/DisruptionMap/`)
Styled zone grid — each Bengaluru zone color-coded (green/yellow/orange/red) based on active disruption level. No Google Maps dependency.

---

## 6. External Integrations

### Open-Meteo (`server/integrations/open_meteo.py`)
- **Source:** https://api.open-meteo.com — completely free, no API key required
- **Method:** REST GET, JSON response per lat/lng
- **Poll frequency:** Every 5 minutes via APScheduler
- **What we extract:** `precipitation` (mm/hr), `temperature_2m` (°C), `apparent_temperature`, `wind_speed_10m`, hourly forecast next 6hr
- **Trigger condition (rain):** precipitation > zone.rain_threshold (default 50mm/hr), sustained 45min (3 consecutive polls)
- **Trigger condition (heat):** temperature_2m > zone.heat_threshold (default 44°C) for 3+ consecutive polls
- **Forecast Shield:** 6-hour forecast with >70% probability of threshold breach → proactive alert (Phase 3)

### WAQI AQI (`server/integrations/waqi.py`)
- **Source:** api.waqi.info — free token via aqicn.org/api
- **Method:** REST GET, JSON response
- **Poll frequency:** Every 5 minutes
- **What we extract:** `aqi` (overall AQI), `dominant_pollutant`, `pm25`, `pm10`
- **Trigger condition:** aqi > zone.aqi_threshold (default 300, Hazardous per NAQI scale)

### SACHET NDMA (`server/integrations/sachet.py`)
- **Source:** https://sachet.ndma.gov.in/ — public RSS/XML, no auth required
- **Method:** RSS feed parsing (feedparser library)
- **Poll frequency:** Every 5 minutes
- **What we extract:** Alert type, severity, affected districts, issued_at
- **Mapping:** District → Zone via lookup table in `seeds/zones.py`
- **Trigger condition:** severity in [ORANGE, RED] and district matches any active zone

### Order Proxy (`server/integrations/order_proxy.py`)
- **Not a real platform API** — simulated microservice built into the backend
- Returns `zone_order_rate` using: seeded 90-day historical baseline + weather-correlated noise formula
- Exposes: `GET /internal/order-rate/{zone_id}` — returns current rate vs 7-day rolling average
- T2 fires when drop_pct ≥ zone.order_drop_threshold (default 60%)

### Bandh Signal (`server/integrations/bandh_signal.py`)
- Mock JSON endpoint togglable from admin dashboard
- `POST /api/disruptions/bandh/toggle` with `{ "zone_id": "...", "active": true }`
- When active, fires T1 for social disruption type in that zone
- Stored in DB as disruption_event with source=BANDH_MOCK

### Razorpay Mock (`server/integrations/razorpay_mock.py`)
- NOT real Razorpay SDK — simulates the API shape
- Generates fake `payment_id` with `rzp_mock_` prefix
- Simulates 95% success rate, 5% random failure (realistic testing)
- Records payout in local DB only
- Phase 3: swap this class for real Razorpay test mode SDK with Twilio SMS sandbox

---

## 7. LLM Layer

### Model: Llama 3.1 8B via Groq API
- **Provider:** Groq Cloud (groq.com — free tier, fast inference)
- **Env var:** `GROQ_API_KEY` — if not set, system falls back to template strings automatically
- **Model ID:** `llama-3.1-8b-instant`
- **Fallback:** Hardcoded Hinglish template strings in `llm_service.py` — app is fully functional without a Groq key

### LLM Service (`server/services/llm_service.py`)

Two functions only:

#### `generate_claim_explanation(claim, disruption_event, worker) → str`
Called after a claim is created. Returns a Hinglish explanation of:
- What happened (disruption type, zone, time)
- Why the claim was approved or flagged
- How much will be paid and when
- What to do if disputed

**System prompt template:**
```
You are Hermetical's assistant. Explain the following insurance claim decision
to a delivery worker in simple Hindi-English mix (Hinglish).
Be warm, clear, and under 100 words. Do not use technical terms.
Never suggest the decision could be wrong.
Facts: {claim_json}
```

**Fallback template (no API key):**
```
"Aaj {zone_name} mein {event_type_hindi} ki wajah se orders band the.
Tera claim approved hai. ₹{payout_amount} tera UPI {upi_id} mein
{eta} mein aa jayega. Koi sawaal? App mein help section check karo."
```

#### `onboarding_chat(message, conversation_history, worker_context) → str`
Handles conversational onboarding. Answers questions about coverage, premium, payouts.

**System prompt template:**
```
You are Hermetical's onboarding assistant for delivery workers.
Answer only questions about Hermetical insurance.
Speak in simple Hinglish. Be brief (under 80 words per reply).
Worker context: {worker_context}
If asked anything not related to Hermetical, politely redirect.
```

### What the LLM Must NEVER Do
- Calculate or suggest premium amounts
- Approve or reject claims
- Evaluate fraud
- Access the database directly
- Make API calls to external services

---

## 8. Trigger Engine

**File:** `server/services/trigger_engine.py`

This is the most critical service in the system. It is pure deterministic logic — zero ML, zero LLM.

### Evaluation Flow (runs every 5 min via APScheduler)
```python
for each zone in active_zones:
    t1 = evaluate_t1(zone)     # Check external disruption signals
    t2 = evaluate_t2(zone)     # Check zone activity drop

    if t1 and t2:
        severity = compute_severity(t1, t2)  # 0–100
        payout_tier = severity_to_tier(severity)  # NONE/HALF/THREE_QUARTER/FULL

        if payout_tier != NONE:
            event = create_disruption_event(zone, t1, t2, severity)
            eligible_workers = get_active_policy_workers_in_zone(zone)
            for worker in eligible_workers:
                fraud_result = fraud_detector.evaluate(worker, event)
                claim = create_claim(worker, event, fraud_result)
                if not fraud_result.flagged:
                    payout_service.initiate(claim)
                notification_service.notify(worker, claim)
                llm_service.generate_claim_explanation(claim, event, worker)
```

### T1 Evaluation Logic
```python
def evaluate_t1(zone) -> T1Result:
    # Priority order — first match wins
    if sachet.has_active_alert(zone.sachet_district, severity=['ORANGE','RED']):
        return T1Result(confirmed=True, source='SACHET', ...)

    if bandh_signal.is_active(zone.id):
        return T1Result(confirmed=True, source='BANDH_MOCK', ...)

    meteo = open_meteo.get_current(zone.open_meteo_lat, zone.open_meteo_lng)
    if meteo.precipitation_mm_hr > zone.rain_threshold and consecutive_rain_polls >= 3:
        return T1Result(confirmed=True, source='OPEN_METEO_RAIN', ...)
    if meteo.temperature_2m > zone.heat_threshold and consecutive_heat_polls >= 3:
        return T1Result(confirmed=True, source='OPEN_METEO_HEAT', ...)

    aqi = waqi.get_current(zone.waqi_station_id)
    if aqi.value > zone.aqi_threshold:
        return T1Result(confirmed=True, source='WAQI', ...)

    return T1Result(confirmed=False)
```

### T2 Evaluation Logic
```python
def evaluate_t2(zone) -> T2Result:
    current_rate = order_proxy.get_current_order_rate(zone.id)
    baseline = order_proxy.get_rolling_baseline(zone.id, days=7)
    drop_pct = (baseline - current_rate) / baseline * 100

    # T2 Manufacturing Attack detection — compare drop shape vs historical curve
    if drop_pct >= zone.order_drop_threshold:
        cliff_score = fraud_detector.cliff_edge_score(zone.id)
        if cliff_score > 0.85:
            # Coordinated offline attack detected — do not fire T2
            log_t2_manufacturing_attempt(zone)
            return T2Result(confirmed=False, cliff_detected=True, drop_pct=drop_pct)
        return T2Result(confirmed=True, drop_pct=drop_pct)

    return T2Result(confirmed=False, drop_pct=drop_pct)
```

### Severity Score Computation
```python
def compute_severity(t1: T1Result, t2: T2Result) -> float:
    # T1 intensity component (0–60 points)
    t1_score = min(60, (t1.raw_value / t1.threshold) * 40)
    # T2 magnitude component (0–40 points)
    t2_score = min(40, (t2.drop_pct / 60) * 40)
    return t1_score + t2_score

def severity_to_tier(score: float) -> PayoutTier:
    if score <= 40:   return PayoutTier.NONE
    if score <= 60:   return PayoutTier.HALF
    if score <= 80:   return PayoutTier.THREE_QUARTER
    return PayoutTier.FULL
```

---

## 9. Premium Calculator

**File:** `server/services/premium_calculator.py`

### Formula
```
weekly_premium = base_rate × zone_risk_multiplier × season_factor × tenure_discount × earnings_velocity_factor

base_rate = 35.0  # ₹35 base per week

zone_risk_multiplier:
  Derived from zone.flood_risk_score, zone.heat_risk_score, zone.aqi_risk_score
  Weighted: flood 50%, heat 30%, aqi 20%
  Range: 0.8 (safest) → 1.4 (highest risk)

season_factor (Bengaluru calendar):
  Jan–Feb: 0.9   (dry, cool)
  Mar–May: 1.1   (pre-monsoon heat)
  Jun–Sep: 1.5   (monsoon peak)
  Oct:     1.2   (retreating monsoon)
  Nov–Dec: 0.95  (post-monsoon)

tenure_discount:
  < 3 months:   1.0  (no discount)
  3–6 months:   0.95
  6–12 months:  0.90
  > 12 months:  0.80 (max 20% discount)

earnings_velocity_factor:
  Based on worker.avg_weekly_income vs zone median income
  Below median: 0.90 (lower premium, proportionally lower coverage)
  At median:    1.00
  1.5× median:  1.15
  2× median+:   1.25 (capped)
```

XGBoost model (`ml/premium_model.joblib`) is trained on seeded historical data and used to produce the final weekly_premium. The formula above defines the features; XGBoost learns the interaction weights.

### Coverage Amount Calculation
```python
coverage_amount = min(avg_weekly_income × 0.6, 1500)  # Cap at ₹1500/week
hourly_rate = avg_weekly_income / declared_weekly_hours
payout_per_disruption = hourly_rate × disruption_duration_hours × payout_tier_multiplier
# payout_tier_multiplier: HALF=0.5, THREE_QUARTER=0.75, FULL=1.0
```

---

## 10. Fraud Detection

**File:** `server/services/fraud_detector.py`

Returns `FraudResult(flagged: bool, score: float, flags: list[str])`

Score > 0.7 → MANUAL_REVIEW status on claim. Flagged claims are quarantined, never auto-denied.

### Checks (additive scoring)

| Check | Score Added | Flag |
|-------|-------------|------|
| Worker GPS zone not matching disrupted zone | +0.4 | `GPS_ZONE_MISMATCH` |
| Worker had active deliveries during disruption window | +0.5 | `ACTIVE_DURING_DISRUPTION` |
| Same disruption event claimed by same worker twice | +1.0 (auto-quarantine) | `DUPLICATE_CLAIM` |
| More than 2 claims in past 7 days | +0.3 | `VELOCITY_BREACH` |
| Claim filed >6 hours after event ended | +0.2 | `LATE_FILING` |
| Worker income declared > 3σ above zone average | +0.2 | `INCOME_ANOMALY` |
| T2 cliff-edge score > 0.85 | +0.6 | `T2_MANUFACTURING_ATTACK` |
| Claim on honeypot event | +1.0 (auto-quarantine + flag all history) | `HONEYPOT_TRIGGERED` |
| Isolation Forest anomaly score > 0.8 | +0.3 | `ISOLATION_FOREST_ANOMALY` |

### Isolation Forest (`ml/fraud_model.py`)
- Trained per-worker on their own claim/activity history
- Cold start: new workers with <4 weeks history use zone-wide model
- Features: claim_time_of_day, gap_since_last_claim, income_declared, zone_order_rate_at_claim
- Scores 0–1: >0.8 adds to fraud score

---

## 11. Environment Variables

Copy `.env.example` to `.env`:

```bash
# Runtime mode
MOCK_MODE=true

# Database (local docker default)
DATABASE_URL=postgresql://hermetical:hermetical@localhost:5432/hermetical

# Redis (for Phase 3 Celery migration — also used for API response caching in Phase 2)
REDIS_URL=redis://localhost:6379/0

# External APIs
WAQI_API_TOKEN=your_token_here          # Free at aqicn.org/api
# Open-Meteo: NO KEY REQUIRED — works with empty string

# LLM (optional — app falls back to Hinglish templates if not set)
GROQ_API_KEY=your_key_here              # Free at console.groq.com

# Razorpay (mock — any string works in dev)
RAZORPAY_KEY_ID=mock_key
RAZORPAY_KEY_SECRET=mock_secret

# App
SECRET_KEY=change_this_in_production
JWT_EXP_MINUTES=480
OTP_EXP_MINUTES=5
ADMIN_PIN=admin123
AUTH_DEBUG_RETURN_OTP=true
DEBUG=true
CORS_ORIGINS=http://localhost:5173
```

---

## 12. Docker Setup

### `docker-compose.yml` Services
```yaml
services:
  postgres:    # Port 5432
  redis:       # Port 6379 (caching in Phase 2, Celery broker in Phase 3)
  server:      # Port 8000 (FastAPI + APScheduler)
  client:      # Port 5173 (Vite dev server)
```

Note: No `ollama` service. LLM runs via Groq API (cloud). No GPU passthrough needed.

### One-Command Start
```bash
docker compose up -d --build
```

### Seeding (first run)
```bash
make seed-demo
```

---

## 13. Testing Guide

### Backend Unit Tests (Pytest)
```bash
cd server
pytest tests/ -v
```

#### Test: Trigger Engine (`tests/test_trigger_engine.py`)
- `test_both_triggers_required` — Payout does NOT fire on T1 alone
- `test_both_triggers_required_t2_alone` — Payout does NOT fire on T2 alone
- `test_dual_trigger_fires_claim` — Happy path: both triggers → claim created
- `test_sachet_red_alert_sets_t1` — SACHET red alert correctly sets T1
- `test_rain_threshold_t1` — Rain above threshold sets T1, below does not
- `test_severity_tiers` — Severity score maps to correct payout tier
- `test_cliff_edge_blocks_t2` — T2 Manufacturing Attack is detected and blocked
- `test_honeypot_quarantines_claim` — Honeypot event auto-quarantines claimant

#### Test: Premium Calculator (`tests/test_premium_calculator.py`)
- `test_monsoon_premium_higher_than_dry`
- `test_tenure_discount_applied`
- `test_high_risk_zone_higher_premium`
- `test_coverage_cap_at_1500`
- `test_earnings_velocity_factor_above_median`

#### Test: Fraud Detector (`tests/test_fraud_detector.py`)
- `test_duplicate_claim_auto_quarantined`
- `test_gps_mismatch_raises_score`
- `test_clean_claim_passes`
- `test_velocity_breach_flagged`
- `test_isolation_forest_new_worker_uses_zone_model`

#### Test: API Endpoints (`tests/test_api_endpoints.py`)
- `test_health_check`
- `test_worker_registration_success`
- `test_worker_registration_duplicate_phone_409`
- `test_policy_create_and_retrieve`
- `test_premium_calculate_preview`
- `test_disruption_simulate_triggers_claim`

### Postman API Test Suite
Located in `postman/`. Import both files into Postman:

1. **`Hermetical_Phase2.postman_collection.json`** — Full Phase 2 endpoint coverage
   - Organized into folders: Health, Worker Registration, Policy Management, Claims, Disruptions, Admin, LLM
   - Auto-captures `worker_id`, `policy_id`, `claim_id`, `zone_id` from responses into environment variables
   - Each request includes `pm.test()` assertions on status codes, response schema, and business logic
   - Run via Collection Runner in sequence for full happy path + simulation pipeline

2. **`Hermetical.postman_environment.json`** — Pre-configured environment
   - `base_url`: `http://localhost:8000`
   - All IDs initially empty — populated automatically by test scripts during run
   - `koramangala_zone_id`: seeded value (update after first seed run)

**Key test flow (Collection Runner order):**
```
Health Check → Register Worker → Calculate Premium → Create Policy
→ Get Active Disruptions → Simulate Disruption (HEAVY_RAIN, force_t2=true)
→ Get Worker Claims → Get Claim Detail → Admin: Review Pending Claims
→ Admin: Financial Summary → LLM: Explain Claim
```

The Simulate Disruption request triggers the full DTPM pipeline: disruption event created, eligible workers evaluated, claims auto-generated, fraud checked, payout mock initiated, LLM explanation generated.

**Phase 3 additions (planned):** Solidarity Pool endpoints, Forecast Shield opt-in, Trust Tier promotion, Income Smoothing toggle, React Native GPS validation test.

### Manual Simulation via curl
```bash
curl -X POST http://localhost:8000/api/disruptions/simulate \
  -H "Content-Type: application/json" \
  -d '{
    "zone_id": "uuid-of-koramangala-zone",
    "event_type": "HEAVY_RAIN",
    "raw_value": 72.5,
    "force_t2": true
  }'
```

---

## 14. Build Status

> Updated manually every time a component reaches stable status.

| Component | Status | Notes |
|-----------|--------|-------|
| README.md | ✅ STABLE | Updated with mock-first runtime + current admin features |
| SYSTEM.md | ✅ STABLE | Structure and status aligned with codebase |
| Project scaffold (server/client) | ✅ STABLE | FastAPI + React PWA running via Docker |
| DB schema + runtime sync | 🔄 IN PROGRESS | SQLAlchemy models active; Alembic workflow pending |
| Seed data (zones + demo users) | ✅ STABLE | Zones auto-seed + deterministic U001-U008 seed |
| Auth + RBAC | ✅ STABLE | OTP + JWT + role-based API access enforced |
| Policy management | 🔄 IN PROGRESS | Create/pause/update stable; cancel lifecycle pending |
| Trigger engine (DTPM + severity) | ✅ STABLE | Dual-trigger and tiering active |
| Integrations (Open-Meteo/WAQI/SACHET/order proxy) | ✅ STABLE | Mock-aware deterministic mode implemented |
| Fraud detector + Isolation Forest | ✅ STABLE | Rule + anomaly score integrated in claims path |
| Claims + payout services | ✅ STABLE | Auto/manual review flow + Razorpay mock payout |
| APScheduler jobs | ✅ STABLE | Polling + dedupe logic active |
| Worker dashboard | ✅ STABLE | Claims, policy controls, disruptions view |
| Admin dashboard | ✅ STABLE | Overview, claims review, workers tab, simulation, zone controls |
| Docker compose | ✅ STABLE | Full local stack and seed targets working |
| Postman collection (Phase 2) | ✅ STABLE | Collection and environment included |
| Automated tests | 🔄 IN PROGRESS | Test documentation exists; full suite expansion pending |

**Status key:** ✅ STABLE | 🔄 IN PROGRESS | ⚠️ BROKEN | ⬜ NOT STARTED

---

## 15. Phase 3 — Scale Additions (April 5–17)

Components to build in Phase 3, on top of Phase 2:

### New Backend
- **`server/services/forecast_shield.py`** — Reads Open-Meteo 6-hour forecast, fires proactive FCM push if >70% breach probability
- **`server/services/solidarity_pool.py`** — Manages pooled fund; activates when ≥30% of zone workers affected simultaneously
- **`server/services/income_smoothing.py`** — Opt-in buffer: retain ₹50–100 in high-earning weeks, auto-cover next premium
- **`server/services/trust_tier.py`** — Weekly trust tier recompute per worker based on GPS validation history + claim patterns
- **`server/adaptive/zone_recalibrator.py`** — Weekly cron: recompute zone_config thresholds from rolling 90-day baseline
- **`server/integrations/fcm.py`** — Firebase Cloud Messaging push notification sender
- **`server/integrations/twilio_mock.py`** — Twilio SMS sandbox for payout confirmation SMS
- Migrate APScheduler → Celery + Redis for distributed multi-zone polling

### New API Endpoints
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/workers/{id}/forecast-shield/opt-in` | Opt into enhanced pre-event coverage |
| POST | `/api/workers/{id}/income-smoothing/toggle` | Enable/disable income smoothing |
| GET | `/api/admin/solidarity-pool` | Pool balance, drawdown events |
| GET | `/api/admin/trust-tiers` | Trust tier distribution across workers |
| GET | `/api/admin/adaptive-thresholds` | Zone config history + next recalibration |

### New Frontend
- React Native + Expo worker app (replaces PWA)
- Real device GPS validation via Expo Location API
- FCM push notifications (Forecast Shield alerts)
- Income Smoothing toggle on worker dashboard
- Trust Tier badge + payout speed indicator

### Postman Phase 3 Collection
Add to `postman/Hermetical_Phase3.postman_collection.json`:
- Forecast Shield opt-in + FCM push verification
- Solidarity Pool activation (simulate ≥30% zone workers affected)
- Income Smoothing toggle + premium auto-cover flow
- Trust Tier promotion after clean claim history
- Adaptive threshold recalibration trigger (admin)
- Celery task queue health check

---

## 16. Known Issues & Tech Debt

| ID | Issue | Component | Priority |
|----|-------|-----------|----------|
| T001 | T2 activity data is synthetic — needs real platform API in production | Order Proxy | Low (by design for hackathon) |
| T002 | GPS location is zone-proxy only — real GPS requires mobile app (Phase 3) | Fraud Detector | Low (by design) |
| T003 | Groq free tier rate limit ~30 req/min — add request queue if demo spams LLM | LLM Service | Medium |
| T004 | Isolation Forest cold start for new workers uses zone model — may over-flag new accounts | Fraud Detector | Low |
| T005 | APScheduler loses state on server restart — honeypot schedule must reinitialize | Scheduler | Medium |

---

*SYSTEM.md Version 2.0 — Phase 2 Build Ready*
*Next update due: after first component reaches STABLE*
