# RainReady — Simulation & Demo Guide

## Quick Start

### 1. Start the backend
```bash
cd Guidewire_Project
uvicorn server.main:app --reload --port 8000
```

### 2. Start the frontend
```bash
cd Guidewire_Project/client
npm install
npm run dev
```

- Frontend: http://localhost:5173
- API docs: http://localhost:8000/docs
- Health: http://localhost:8000/health

---

## Test Credentials

| Role  | Access             | Credential       |
|-------|--------------------|------------------|
| Admin | /admin dashboard   | PIN: `admin123`  |
| Worker | Register via onboarding | Any phone number |

---

## End-to-End Demo Flow

### Step 1 — Register a worker
1. Open http://localhost:5173
2. Complete 5-step onboarding:
   - Phone: any number (e.g. `9999999999`)
   - Name: any
   - Platform: ZOMATO
   - Zone: Whitefield
   - Income: ₹3500/week, 48 hrs
   - UPI: `test@upi`
3. Policy activates automatically on completion

### Step 2 — Fire a disruption
1. Go to http://localhost:5173/admin → PIN: `admin123`
2. Click **Simulate** tab
3. Set:
   - Zone: Whitefield
   - Event Type: `HEAVY_RAIN`
   - Raw Value: `72.5`
   - Force T2: ✅ checked
4. Click **Fire Disruption**

### Step 3 — Observe the pipeline
Watch the backend logs:
```
T1 confirmed → T2 confirmed → Claim created → Fraud check → Payout → LLM explanation
```

### Step 4 — Check worker dashboard
Go back to http://localhost:5173 — the claim appears with:
- Payout amount
- Hinglish LLM explanation
- Event start/end time and duration

---

## All 5 Trigger Types

| Event Type    | How to Simulate                        | Source        |
|---------------|----------------------------------------|---------------|
| HEAVY_RAIN    | Simulate tab, raw_value > zone threshold (50mm/hr) | Open-Meteo  |
| EXTREME_HEAT  | Simulate tab, raw_value > 44.0         | Open-Meteo    |
| HIGH_AQI      | Simulate tab, raw_value > zone AQI threshold | WAQI     |
| NDMA_ALERT    | Simulate tab, select NDMA_ALERT        | SACHET RSS    |
| BANDH         | Zones tab → Activate Bandh on any zone | Manual toggle |

---

## Fraud Detection Scenarios

To trigger fraud flags, fire the same disruption twice for the same worker:

1. Fire disruption for Whitefield → claim created (clean)
2. Fire same disruption again → `DUPLICATE_CLAIM` flag → MANUAL_REVIEW

Other fraud signals the system detects automatically:
- `GPS_ZONE_MISMATCH` — worker's zone differs from event zone
- `VELOCITY_BREACH` — more than 2 claims in 7 days
- `INCOME_ANOMALY` — declared income > 3× zone average
- `ISOLATION_FOREST_ANOMALY` — ML anomaly score > 0.8
- `HONEYPOT_TRIGGERED` — honeypot event fired

Flagged claims appear in **Admin → Claims → Fraud Intelligence panel**.

---

## Stress Test (Actuarial)

```
GET http://localhost:8000/api/admin/stress-test?scenario=monsoon_14day
```

Available scenarios:
- `monsoon_14day` — 14-day sustained heavy rain
- `heatwave_7day` — 7-day extreme heat
- `aqi_spike_3day` — 3-day hazardous AQI

Returns BCR (Benefit-Cost Ratio). Target: 0.55–0.70. System suspends new enrolments at BCR > 0.85.

---

## Bandh Simulation

1. Admin → Zones tab
2. Click **Activate Bandh** on any zone
3. The next scheduler poll (every 5 min) will fire T1 automatically
4. Or use Simulate tab with event type `BANDH` for immediate trigger

---

## Zone Configuration

| Zone         | Rain Threshold | AQI Threshold | Risk Multiplier |
|--------------|---------------|---------------|-----------------|
| Whitefield   | 50 mm/hr      | 285           | 1.10×           |
| Koramangala  | 50 mm/hr      | 295           | 1.15×           |
| HSR Layout   | 50 mm/hr      | 300           | 1.05×           |
| Indiranagar  | 50 mm/hr      | 300           | 0.95×           |

---

## System Architecture

```
Frontend (React PWA) → Vite proxy → FastAPI backend
                                         │
                    ┌────────────────────┼─────────────────────┐
                    │                    │                      │
              Supabase DB          APScheduler            Groq LLM
              (PostgreSQL)       (5-min zone poll)     (Hinglish explain)
                    │                    │
              SQLAlchemy ORM      Trigger Engine (DTPM)
                                   T1 (weather/AQI/NDMA/bandh)
                                   T2 (order drop >60%)
                                         │
                                  Claims Pipeline
                                   Fraud Check → Payout → LLM
```

---

## Environment Variables

See `.env.example` for the full template. Required for full functionality:
- `DATABASE_URL` — Supabase PostgreSQL connection string (session pooler)
- `WAQI_API_TOKEN` — free at aqicn.org/api
- `GROQ_API_KEY` — free at console.groq.com (optional, falls back to template)
- `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` — any string works in mock mode
