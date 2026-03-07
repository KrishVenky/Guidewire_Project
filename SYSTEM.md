# SYSTEM.md — GigShield Internal System Brain

> **FOR:** Developers, coding agents, LLMs working on this codebase
> **PURPOSE:** Complete implementation reference. Every component, endpoint, data model, directory, integration, and test status documented here. Read this before touching any file.
> **RULE:** Every time a component reaches stable status, this document is updated. Never let SYSTEM.md fall behind the codebase.

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

The trigger engine is deterministic rules only. The premium calculator is deterministic math only. The fraud detector is rule + statistical only. The LLM (Llama 3.1 8B via Ollama) exists in exactly one place: the communication layer that explains decisions already made, in Hinglish, to the worker.

If you find yourself routing a financial decision through Ollama — stop. That is a bug.

### Dual-Trigger Parametric Model (DTPM)
A payout is initiated ONLY when both triggers fire simultaneously:
- **T1:** An official disruption signal from a verified external source (SACHET/IMD/WAQI)
- **T2:** Zone-level order activity drop >60% vs the 7-day rolling average for that zone/hour

Neither trigger alone is sufficient. This is the core insurance architecture decision and must not be changed without updating the premium model accordingly.

### Data Flow (High Level)
```
External APIs (SACHET, IMD, WAQI, OWM)
    → Poller Service (Celery beat, every 15 min)
        → Trigger Engine (rules evaluation)
            → If BOTH T1 + T2 fire:
                → Fraud Check
                    → If clean: Claim created, Payout initiated (Razorpay mock)
                    → If flagged: Claim created, status = MANUAL_REVIEW
            → Regardless: LLM generates worker notification message
                → Push to worker dashboard + simulated SMS
```

---

## 2. Repository Structure

```
gigshield/
│
├── README.md                         # Hackathon submission doc (public)
├── SYSTEM.md                         # This file (internal brain)
├── docker-compose.yml                # Spins up: server, client, postgres, redis, ollama
├── .env.example                      # Copy to .env and fill values
│
├── client/                           # React 18 + Vite + TailwindCSS
│   ├── public/
│   ├── src/
│   │   ├── main.jsx                  # Entry point
│   │   ├── App.jsx                   # Router root
│   │   ├── components/               # Shared UI components
│   │   │   ├── ui/                   # Primitive components (Button, Card, Badge)
│   │   │   ├── layout/               # Navbar, Sidebar, PageWrapper
│   │   │   └── charts/               # Recharts wrappers for dashboards
│   │   ├── pages/                    # Route-level page components
│   │   │   ├── Onboarding/           # Worker registration flow
│   │   │   ├── WorkerDashboard/      # Worker-facing dashboard
│   │   │   ├── AdminDashboard/       # Insurer/admin dashboard
│   │   │   ├── Policy/               # Policy view + management
│   │   │   ├── Claims/               # Claims history + status
│   │   │   └── DisruptionMap/        # Live zone disruption view
│   │   ├── hooks/                    # Custom React hooks
│   │   │   ├── useWorker.js          # Worker auth + profile state
│   │   │   ├── usePolicy.js          # Policy fetch + status
│   │   │   ├── useClaims.js          # Claims data
│   │   │   └── useDisruptions.js     # Live disruption feed
│   │   ├── api/                      # Axios client + endpoint functions
│   │   │   └── index.js              # All API calls defined here
│   │   ├── store/                    # Zustand global state
│   │   │   └── index.js
│   │   └── utils/                    # Helper functions, formatters
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json
│
├── server/                           # FastAPI Python backend
│   ├── main.py                       # FastAPI app entry, router registration
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
│   │   ├── workers.py                # /api/workers/*
│   │   ├── policies.py               # /api/policies/*
│   │   ├── claims.py                 # /api/claims/*
│   │   ├── payouts.py                # /api/payouts/*
│   │   ├── disruptions.py            # /api/disruptions/*
│   │   ├── admin.py                  # /api/admin/*
│   │   └── llm.py                    # /api/llm/* (communication only)
│   │
│   ├── services/                     # Business logic layer
│   │   ├── trigger_engine.py         # DTPM dual-trigger evaluation
│   │   ├── premium_calculator.py     # Weekly premium computation
│   │   ├── fraud_detector.py         # Fraud rule evaluation
│   │   ├── payout_service.py         # Razorpay mock integration
│   │   ├── llm_service.py            # Ollama client (comm layer only)
│   │   └── notification_service.py   # Worker notifications
│   │
│   ├── integrations/                 # External API clients
│   │   ├── sachet.py                 # SACHET NDMA RSS feed parser
│   │   ├── imd.py                    # IMD weather API client
│   │   ├── waqi.py                   # WAQI AQI API client
│   │   ├── openweather.py            # OpenWeatherMap fallback
│   │   └── razorpay_mock.py          # Mock payout gateway
│   │
│   ├── tasks/                        # Celery async tasks
│   │   ├── celery_app.py             # Celery + Redis config
│   │   ├── poll_disruptions.py       # Every 15min: fetch all external APIs
│   │   ├── evaluate_triggers.py      # Every 15min: run DTPM evaluation
│   │   ├── process_payouts.py        # Async payout processing
│   │   └── weekly_premium.py         # Monday: deduct weekly premiums
│   │
│   ├── migrations/                   # Alembic DB migrations
│   │   └── versions/
│   │
│   ├── seeds/                        # Dev seed data
│   │   ├── zones.py                  # Bengaluru zones seed
│   │   ├── workers.py                # Mock worker profiles
│   │   └── historical_activity.py   # Zone activity baseline data
│   │
│   ├── tests/                        # Pytest test suite
│   │   ├── test_trigger_engine.py
│   │   ├── test_premium_calculator.py
│   │   ├── test_fraud_detector.py
│   │   └── test_api_endpoints.py
│   │
│   ├── requirements.txt
│   └── Dockerfile
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
    registration_date: datetime
    is_active: bool
    kyc_verified: bool
    tenure_weeks: int                 # Computed, used for tenure discount
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
    imd_station_id: str               # Nearest IMD weather station
    waqi_station_id: str              # Nearest WAQI monitoring station
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
    event_type: enum [HEAVY_RAIN, EXTREME_HEAT, HIGH_AQI, NDMA_ALERT, PLATFORM_OUTAGE]
    source: enum [SACHET, IMD, WAQI, OPENWEATHER, MOCK]
    severity: enum [WATCH, WARNING, SEVERE, EXTREME]
    raw_value: float                  # e.g. rainfall mm/hr, temp °C, AQI value
    threshold_breached: float         # Zone-specific threshold that was exceeded
    t1_confirmed: bool                # Official signal trigger fired
    t2_confirmed: bool                # Activity drop trigger fired
    dual_trigger_fired: bool          # Both T1 + T2 = True → payout eligible
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
    payout_amount: float              # Actual approved payout
    fraud_score: float                # 0.0–1.0 (>0.7 = MANUAL_REVIEW)
    fraud_flags: list[str]            # e.g. ["GPS_MISMATCH", "VELOCITY_BREACH"]
    auto_initiated: bool              # True = system-generated, False = manual
    created_at: datetime
    reviewed_at: datetime (nullable)
    llm_explanation: str              # Hinglish message shown to worker
```

### Payout
```python
class Payout:
    id: UUID (PK)
    claim_id: UUID (FK → Claim)
    worker_id: UUID (FK → Worker)
    amount: float
    upi_id: str                       # Worker UPI at time of payout
    razorpay_payment_id: str          # Mock gateway reference
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
- On startup: initializes DB tables, seeds zone data if empty

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
| GET | `/active` | Get all currently active disruptions | None |
| GET | `/zone/{zone_id}` | Disruptions for specific zone | None |
| POST | `/simulate` | **Dev only** — trigger a mock disruption | Admin |

#### Admin — `/api/admin`
| Method | Path | Description | Auth |
|--------|------|-------------|------|
| GET | `/dashboard` | Full insurer metrics | Admin |
| GET | `/claims/pending` | All claims awaiting review | Admin |
| GET | `/workers` | All registered workers | Admin |
| GET | `/financial-summary` | Loss ratios, payout totals | Admin |

#### LLM — `/api/llm`
| Method | Path | Description | Auth |
|--------|------|-------------|------|
| POST | `/explain-claim` | Generate Hinglish claim explanation | Internal |
| POST | `/onboarding-chat` | Conversational onboarding Q&A | Worker |

---

## 5. Frontend — Client

### Routing Structure (`App.jsx`)
```
/                         → Redirect to /onboarding or /dashboard
/onboarding               → Multi-step worker registration
/dashboard                → WorkerDashboard (requires auth)
/dashboard/policy         → Policy details + management
/dashboard/claims         → Claims history
/dashboard/disruptions    → Live disruption map for worker's zone
/admin                    → AdminDashboard (requires admin auth)
/admin/claims             → Pending claims review queue
/admin/analytics          → Loss ratios, risk analytics
```

### Key Pages

#### Onboarding (`/pages/Onboarding/`)
Multi-step flow — 4 steps:
1. Phone number entry + OTP (mocked)
2. Personal details (name, platform, zone selection)
3. UPI ID entry + income declaration
4. LLM chat assistant: explains policy in Hinglish, answers questions
5. Premium preview → confirm + activate policy

State is local to the onboarding flow (no global store needed until Step 5).

#### WorkerDashboard (`/pages/WorkerDashboard/`)
Shows:
- Active policy status + this week's premium
- Coverage amount remaining
- Recent claims with status badges
- Live disruption alerts for worker's zone
- Earnings protected (cumulative payout total)

Data source: `GET /api/workers/{id}/dashboard` (single aggregated endpoint)

#### AdminDashboard (`/pages/AdminDashboard/`)
Shows:
- Total active policies
- This week's disruption events
- Claims pipeline (auto-approved / pending review / paid)
- Loss ratio chart (Recharts LineChart)
- Zone risk heatmap
- Predictive alert: next 48h disruption probability per zone

#### DisruptionMap (`/pages/DisruptionMap/`)
Visual zone status display. Not a real map (no Google Maps dependency). Uses a styled zone grid showing each Bengaluru zone with color-coded status (green/yellow/orange/red) based on active disruption level.

---

## 6. External Integrations

### SACHET NDMA (`server/integrations/sachet.py`)
- **Source:** https://sachet.ndma.gov.in/
- **Method:** RSS feed parsing (feedparser library)
- **Poll frequency:** Every 15 minutes via Celery beat
- **What we extract:** Alert type, severity, affected districts, issued_at
- **Mapping:** District → Zone (lookup table in seeds/zones.py)
- **Trigger condition:** severity in [ORANGE, RED] and district matches any active zone

### IMD API (`server/integrations/imd.py`)
- **Source:** IndianAPI.in (wraps IMD data, free tier 1000 req/day)
- **Method:** REST GET, JSON response
- **Poll frequency:** Every 15 minutes
- **What we extract:** rainfall_mm_per_hr, temp_celsius, wind_speed, forecast_next_6hr
- **Trigger condition (rain):** rainfall > zone.rain_threshold (default 50mm/hr)
- **Trigger condition (heat):** temp > 44°C for 3+ consecutive polls

### WAQI AQI (`server/integrations/waqi.py`)
- **Source:** api.waqi.info (free token, unlimited)
- **Method:** REST GET, JSON response
- **Poll frequency:** Every 30 minutes (AQI changes slower)
- **What we extract:** aqi_value, dominant_pollutant, pm25, pm10
- **Trigger condition:** aqi > 300 (Hazardous per NAQI scale)

### OpenWeatherMap (`server/integrations/openweather.py`)
- **Role:** Fallback if IMD is unavailable
- **Method:** REST GET, JSON response
- **Free tier:** 1000 calls/day
- **Used for:** Rain intensity confirmation, temperature cross-check

### Razorpay Mock (`server/integrations/razorpay_mock.py`)
- **NOT real Razorpay SDK** — this is a mock that simulates the API shape
- Generates fake `payment_id` with `rzp_mock_` prefix
- Simulates 95% success rate, 5% random failure (realistic testing)
- Records payout in local DB only
- In Phase 3: swap this class for real Razorpay test mode SDK

---

## 7. LLM Layer

### Model: Llama 3.1 8B via Ollama
- **Runs on:** localhost:11434 (Ollama default)
- **Quantization:** Q4_K_M (fits in ~9GB VRAM on 4060 Ti 16GB)
- **Pull command:** `ollama pull llama3.1:8b`

### LLM Service (`server/services/llm_service.py`)
Wraps all Ollama calls. Two functions only:

#### `generate_claim_explanation(claim, disruption_event, worker) → str`
Called after a claim is created. Returns a Hinglish explanation of:
- What happened (disruption type, zone, time)
- Why the claim was approved or flagged
- How much will be paid and when
- What to do if disputed

**System prompt template:**
```
You are GigShield's assistant. Explain the following insurance claim decision 
to a delivery worker in simple Hindi-English mix (Hinglish). 
Be warm, clear, and under 100 words. Do not use technical terms.
Never suggest the decision could be wrong.
Facts: {claim_json}
```

#### `onboarding_chat(message, conversation_history, worker_context) → str`
Handles conversational onboarding. Answers questions about:
- How the insurance works
- What is covered / not covered
- How premium is calculated for their zone
- How payouts work

**System prompt template:**
```
You are GigShield's onboarding assistant for delivery workers.
Answer only questions about GigShield insurance.
Speak in simple Hinglish. Be brief (under 80 words per reply).
Worker context: {worker_context}
If asked anything not related to GigShield, politely redirect.
```

### What the LLM Must NEVER Do
- Calculate or suggest premium amounts
- Approve or reject claims
- Evaluate fraud
- Access the database directly
- Make API calls

---

## 8. Trigger Engine

**File:** `server/services/trigger_engine.py`

This is the most critical service in the system. It is pure deterministic logic.

### Evaluation Flow (runs every 15 min via Celery)
```python
for each zone in active_zones:
    t1 = evaluate_t1(zone)     # Check external disruption signals
    t2 = evaluate_t2(zone)     # Check zone activity drop
    
    if t1 and t2:
        event = create_disruption_event(zone, t1_data, t2_data)
        eligible_workers = get_active_policy_workers_in_zone(zone)
        for worker in eligible_workers:
            fraud_result = fraud_detector.evaluate(worker, event)
            claim = create_claim(worker, event, fraud_result)
            if not fraud_result.flagged:
                payout_service.initiate(claim)
            notification_service.notify(worker, claim)
```

### T1 Evaluation Logic
```python
def evaluate_t1(zone) -> T1Result:
    # Priority order — first match wins
    if sachet.has_active_alert(zone.district, severity=['ORANGE','RED']):
        return T1Result(confirmed=True, source='SACHET', ...)
    
    imd_data = imd.get_current(zone.imd_station_id)
    if imd_data.rainfall_mm_per_hr > zone.rain_threshold:
        return T1Result(confirmed=True, source='IMD_RAIN', ...)
    if imd_data.temp_celsius > 44 and consecutive_hot_polls >= 3:
        return T1Result(confirmed=True, source='IMD_HEAT', ...)
    
    waqi_data = waqi.get_current(zone.waqi_station_id)
    if waqi_data.aqi > 300:
        return T1Result(confirmed=True, source='WAQI', ...)
    
    return T1Result(confirmed=False)
```

### T2 Evaluation Logic
```python
def evaluate_t2(zone) -> T2Result:
    current_rate = activity_monitor.get_current_order_rate(zone)
    baseline = activity_monitor.get_rolling_baseline(zone, days=7)
    drop_pct = (baseline - current_rate) / baseline * 100
    
    if drop_pct >= 60:
        return T2Result(confirmed=True, drop_percentage=drop_pct)
    return T2Result(confirmed=False, drop_percentage=drop_pct)
```

**Note on T2 in hackathon context:** Real platform order data is not accessible. T2 is simulated using a synthetic activity model seeded with historical patterns + disruption correlation. In production this would be a platform API integration.

---

## 9. Premium Calculator

**File:** `server/services/premium_calculator.py`

### Formula
```
weekly_premium = base_rate × zone_risk_multiplier × season_factor × tenure_discount

base_rate = 35.0  # ₹35 base per week
coverage_amount = avg_weekly_income × 0.6  # Cover 60% of weekly income

zone_risk_multiplier:
  Derived from zone.flood_risk_score, zone.heat_risk_score, zone.aqi_risk_score
  Weighted: flood 50%, heat 30%, aqi 20%
  Range: 0.8 (safest) → 1.4 (highest risk)

season_factor (Bengaluru calendar):
  Jan–Feb: 0.9  (dry, cool)
  Mar–May: 1.1  (pre-monsoon heat)
  Jun–Sep: 1.5  (monsoon peak)
  Oct:     1.2  (retreating monsoon)
  Nov–Dec: 0.95 (post-monsoon)

tenure_discount:
  < 3 months: 1.0 (no discount)
  3–6 months: 0.95
  6–12 months: 0.90
  > 12 months: 0.80 (max 20% discount)
```

### Coverage Amount Calculation
```
coverage_amount = min(avg_weekly_income × 0.6, 1500)  # Cap at ₹1500/week
hourly_rate = avg_weekly_income / declared_weekly_hours
payout_per_disruption = hourly_rate × disruption_duration_hours
```

---

## 10. Fraud Detection

**File:** `server/services/fraud_detector.py`

Returns `FraudResult(flagged: bool, score: float, flags: list[str])`

Score > 0.7 → MANUAL_REVIEW status on claim.

### Checks (in order, additive scoring)

| Check | Score Added | Flag |
|-------|-------------|------|
| Worker GPS not in disrupted zone at event time | +0.4 | `GPS_ZONE_MISMATCH` |
| Worker had active deliveries during disruption window | +0.5 | `ACTIVE_DURING_DISRUPTION` |
| Same disruption event claimed by same worker twice | +1.0 (auto-reject) | `DUPLICATE_CLAIM` |
| More than 2 claims in past 7 days | +0.3 | `VELOCITY_BREACH` |
| Claim filed >6 hours after event ended | +0.2 | `LATE_FILING` |
| Worker income declared > 3σ above zone average | +0.2 | `INCOME_ANOMALY` |

**Note:** GPS data is simulated in hackathon. Worker's registered zone is used as proxy location.

---

## 11. Environment Variables

Copy `.env.example` to `.env` and fill in:

```bash
# Database
DATABASE_URL=postgresql://gigshield:gigshield@localhost:5432/gigshield

# Redis (Celery broker)
REDIS_URL=redis://localhost:6379/0

# External APIs
WAQI_API_TOKEN=your_token_here          # Free at aqicn.org/api
OPENWEATHER_API_KEY=your_key_here       # Free tier at openweathermap.org
IMD_API_KEY=your_key_here               # IndianAPI.in free tier

# LLM
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1:8b

# Razorpay (mock — any string works in dev)
RAZORPAY_KEY_ID=mock_key
RAZORPAY_KEY_SECRET=mock_secret

# App
SECRET_KEY=change_this_in_production
DEBUG=true
CORS_ORIGINS=http://localhost:5173
```

---

## 12. Docker Setup

### `docker-compose.yml` Services
```yaml
services:
  postgres:    # Port 5432
  redis:       # Port 6379
  ollama:      # Port 11434 (GPU passthrough for NVIDIA)
  server:      # Port 8000 (FastAPI)
  worker:      # Celery worker (no exposed port)
  beat:        # Celery beat scheduler (no exposed port)
  client:      # Port 5173 (Vite dev server)
```

### One-Command Start
```bash
docker-compose up --build
```

### Ollama GPU Note
The docker-compose.yml includes NVIDIA GPU passthrough for the ollama service. Requires `nvidia-container-toolkit` installed on host. On your machine (4060 Ti) this works out of the box with NVIDIA drivers.

### Manual Model Pull (first time only)
```bash
docker exec -it gigshield-ollama-1 ollama pull llama3.1:8b
```

---

## 13. Testing Guide

### Backend Tests
```bash
cd server
pytest tests/ -v
```

#### Test: Trigger Engine (`tests/test_trigger_engine.py`)
- `test_both_triggers_required` — Verify payout does NOT fire on T1 alone
- `test_both_triggers_required_t2_alone` — Verify payout does NOT fire on T2 alone
- `test_dual_trigger_fires_claim` — Full happy path, both triggers → claim created
- `test_sachet_red_alert_sets_t1` — SACHET red alert correctly sets T1
- `test_rain_threshold_t1` — Rain above threshold sets T1, below does not

#### Test: Premium Calculator (`tests/test_premium_calculator.py`)
- `test_monsoon_premium_higher_than_dry` — Season factor working
- `test_tenure_discount_applied` — Discount tiers correct
- `test_high_risk_zone_higher_premium` — Zone multiplier working
- `test_coverage_cap_at_1500` — Cap enforced

#### Test: Fraud Detector (`tests/test_fraud_detector.py`)
- `test_duplicate_claim_auto_rejected`
- `test_gps_mismatch_raises_score`
- `test_clean_claim_passes`
- `test_velocity_breach_flagged`

### Manual Testing — Disruption Simulation
Use the dev-only endpoint to simulate a disruption without waiting for real API data:

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

This will: create a disruption event, evaluate all active policies in the zone, create claims, run fraud checks, initiate mock payouts, and generate LLM explanations.

---

## 14. Build Status

> Updated manually every time a component reaches stable status.

| Component | Status | Notes |
|-----------|--------|-------|
| Project scaffold | ⬜ NOT STARTED | |
| DB schema + migrations | ⬜ NOT STARTED | |
| Seed data (zones, workers) | ⬜ NOT STARTED | |
| Worker registration API | ⬜ NOT STARTED | |
| Premium calculator | ⬜ NOT STARTED | |
| SACHET integration | ⬜ NOT STARTED | |
| IMD integration | ⬜ NOT STARTED | |
| WAQI integration | ⬜ NOT STARTED | |
| Trigger engine | ⬜ NOT STARTED | |
| Fraud detector | ⬜ NOT STARTED | |
| Claims service | ⬜ NOT STARTED | |
| Payout service (mock) | ⬜ NOT STARTED | |
| LLM service | ⬜ NOT STARTED | |
| Celery tasks | ⬜ NOT STARTED | |
| React scaffold | ⬜ NOT STARTED | |
| Onboarding flow (UI) | ⬜ NOT STARTED | |
| Worker dashboard (UI) | ⬜ NOT STARTED | |
| Admin dashboard (UI) | ⬜ NOT STARTED | |
| Docker compose | ⬜ NOT STARTED | |
| Tests — trigger engine | ⬜ NOT STARTED | |
| Tests — premium calc | ⬜ NOT STARTED | |
| README.md | ✅ STABLE | Phase 1 submission ready |
| SYSTEM.md | ✅ STABLE | v1.0 |

**Status key:** ✅ STABLE | 🔄 IN PROGRESS | ⚠️ BROKEN | ⬜ NOT STARTED

---

## 15. Known Issues & Tech Debt

> Updated as issues are discovered.

| ID | Issue | Component | Priority |
|----|-------|-----------|----------|
| T001 | T2 activity data is synthetic — needs real platform proxy in production | Trigger Engine | Low (by design for hackathon) |
| T002 | IMD API requires IP whitelisting — use OpenWeatherMap as primary in dev | IMD Integration | High |
| T003 | Ollama cold start ~8 seconds — add startup warmup call | LLM Service | Medium |
| T004 | GPS location is zone-proxy only — real GPS would require mobile app | Fraud Detector | Low (by design) |

---

*SYSTEM.md Version 1.0 — Phase 1 Baseline*
*Next update due: after Phase 1 scaffold is stable and tested*
