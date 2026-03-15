# GigShield — AI-Powered Parametric Income Insurance for India's Delivery Workers

> Guidewire DEVTrails 2026 | Unicorn Chase
> Protecting the income of Zomato, Swiggy & Blinkit delivery partners against uncontrollable external disruptions.

---

## The Problem

India's food and grocery delivery workers — the people behind every Zomato order and every Blinkit 10-minute delivery — lose 20–30% of their monthly income when the world outside stops cooperating. Heavy rain. Extreme heat. AQI emergencies. Unplanned bandhs. When these events hit, platforms stop assigning orders. Workers sit idle. There is no safety net.

Existing insurance products don't help. Government schemes cover accidents and health. Platforms cover liability during active rides. Nobody covers **lost income from external disruptions** — the single biggest financial risk a delivery worker actually faces week to week.

**GigShield fixes this.**

---

## The Solution

GigShield is a **dual-trigger parametric income insurance platform** built specifically for Zomato, Swiggy, and Blinkit delivery partners. Workers pay a small weekly premium. When a verified external disruption hits their zone, coverage activates automatically. No claim forms. No waiting. Payout lands in their UPI within minutes.

### What Makes This Different

Most parametric systems use a single trigger — "it rained, here's money." The problem is **basis risk**: it rained in one part of the city but your zone was fine, or the platform was still running deliveries. A single weather reading is not proof of income loss.

GigShield uses a **Dual-Trigger Parametric Model (DTPM)**:

![Dual Trigger Model](docs/assets/gigshield_dual_trigger_model.png)

This eliminates false payouts and makes the model financially viable — a critical differentiator from a real insurance architecture standpoint.

Additionally, thresholds are **not hardcoded**. They are written to a `zone_config` table in the database and recomputed weekly by the adaptive ML engine, which learns each zone's historical baseline and seasonal patterns. A threshold that made sense for Whitefield in January is automatically recalibrated for the monsoon peak in July.

---

## Delivery Persona

**Primary:** Zomato food delivery partners + Blinkit grocery delivery partners
(Blinkit is a Zomato subsidiary — same worker pool, unified risk model)

**Secondary:** Swiggy food + Swiggy Instamart partners

**Target geography (Phase 1):** Bengaluru — 4 zones: Whitefield, Koramangala, HSR Layout, Indiranagar

**Scale target (Phase 3):** 6 metro cities

---

## Architecture Overview

![System Architecture](docs/assets/gigshield_system_architecture_v2.png)

**Critical design principle:** The LLM never makes financial decisions. It only explains decisions already made by the deterministic rules engine — in plain Hinglish to the worker. All payout logic is fully auditable.

---

## Parametric Triggers

| Trigger | Source | Threshold | Type |
|---------|--------|-----------|------|
| Heavy Rainfall | Open-Meteo + WAQI | >50mm/hr sustained 45min | Environmental |
| Extreme Heat | Open-Meteo | >44°C for 3+ consecutive hours | Environmental |
| Severe AQI | WAQI API | AQI >300 (Hazardous) | Environmental |
| NDMA Red Alert | SACHET RSS Feed | Any Red/Orange district alert | Official Govt |
| Zone Order Drop | Platform Activity Proxy | >60% drop vs 7-day rolling avg | Activity |
| Social Disruption | Bandh signal mock / RSS scrape | Keyword-confirmed curfew/strike | Social |

All thresholds are **zone-relative** — written to the `zone_config` table and recalibrated weekly against each zone's rolling 90-day baseline. A threshold is never hardcoded.

---

## Weekly Premium Model

Premium is calculated dynamically every week per worker using a trained XGBoost model:

```
Weekly Premium = Base Rate × Zone Risk Multiplier × Season Factor × Worker Tenure Discount
                                                                   × Earnings Velocity Factor

Base Rate: ₹35/week (covers up to ₹1,500 income protection)

Zone Risk Multiplier: 0.8x (low-flood zone) to 1.4x (high-flood zone) — recalibrated weekly
Season Factor: 1.0 (dry) to 1.6 (monsoon peak, June–September)
Tenure Discount: -5% per 3 months active, max -20%
Earnings Velocity Factor: adjusts coverage based on worker's personal hourly earning rate

Example: Whitefield zone, monsoon season, new worker
₹35 × 1.3 × 1.5 × 1.0 = ₹68.25/week
```

Premium is deducted from the worker's linked UPI every Monday morning via Razorpay.

### Payout Precision via Earnings Velocity Profiling

Rather than a flat payout amount, GigShield models each worker's hourly earning rate across time of day, day of week, zone, and season. When a disruption fires, the payout reflects the **actual estimated income lost** during that window — not a generic flat amount. A worker who earns ₹800/day receives proportionally more coverage than one earning ₹400/day. This makes pricing fairer and payouts more trustworthy.

### Disruption Severity Scoring

Triggers are not binary. Each disruption event receives a severity score (0–100):

```
Severity score = f(T1 intensity, T2 order drop magnitude)

Score 0–40:   No payout (disruption below threshold)
Score 41–60:  50% payout
Score 61–80:  75% payout
Score 81–100: 100% payout
```

This reduces insurer loss ratio, prevents gaming edge-case thresholds, and produces more defensible payout decisions.

---

## Novel Features

### Forecast Shield (Predictive Coverage Upgrade)

When Open-Meteo's 6-hour forecast predicts >70% probability of threshold breach, GigShield sends the worker a proactive Hinglish alert: "Kal Whitefield mein baarish ka alert hai — aaj coverage upgrade karo ₹8 mein?" Workers can opt into an enhanced coverage tier before the event. This turns GigShield from reactive insurance into a financial planning tool — workers have agency over their own protection.

### Solidarity Pool for Social Disruptions

For bandh and curfew events that simultaneously affect large numbers of workers, individual policy payouts are supplemented by a **Solidarity Pool** — a separate fund built from a ₹5/week opt-in surcharge. When ≥30% of zone workers are affected simultaneously, the event is classified as a pooled risk event and payouts draw from the solidarity pool rather than individual policies. This mirrors mutual insurance design and demonstrates real insurance domain depth.

### Post-Payout Trust Feedback Loop

Immediately after every payout, a 3-question in-app survey fires in Hinglish. Responses generate a **zone trust score** per zone per week on the admin dashboard. If a zone's trust score drops — workers got paid but didn't understand why — the LLM explanation template for that zone is automatically flagged for tone revision. This closes a loop no competitor will have: parametric insurance that monitors not just whether payouts fire correctly, but whether workers actually understand and trust them.

![Trust Feedback Loop](docs/assets/gigshield_trust_feedback_loop.png)

### Worker Trust Tier

Workers build a trust tier over time — Trusted Partner, Rising Partner, New Partner — based on GPS validation history and claim patterns. Higher tiers unlock faster payout speeds (under 2 minutes vs standard 10 minutes) and eligibility for higher coverage amounts. This gives workers a reason to engage with the app even outside disruption events and gamifies honesty without exposing the fraud score directly.

### Income Smoothing (Phase 3)

Opt-in micro-savings layer. In high-earning weeks, the platform retains a small voluntary buffer (₹50–100 with worker consent). When a low-earning week or uncovered disruption occurs, GigShield draws from this buffer to cover the worker's next premium automatically. No insurance terminology. Just "GigShield ne aapki good week ka ₹60 rakha tha — aaj kaam aa gaya."

---

## Fraud Detection

| Mechanism | What It Catches |
|-----------|----------------|
| GPS zone validation | Worker phone not in claimed disruption zone at trigger time (Expo Location API) |
| Activity cross-check | Worker had active deliveries during claimed disruption window |
| Duplicate trigger guard | Same event cannot trigger multiple claims per worker |
| Isolation Forest anomaly score | Claim pattern deviates from worker's own historical baseline (scikit-learn) |
| Velocity check | More than 2 claims in 7 days flags for manual review |
| Fake weather claim detection | Historical AQI/rainfall cross-validated against NDMA official alerts |

---

## LLM Communication Layer

The Groq API (Llama 3.1 8B) powers all worker-facing communication in Hinglish. The LLM is used for:

- **Proactive disruption alerts** before events — "Kal Whitefield mein 67mm baarish ka IMD alert hai. Tera coverage active hai."
- **Post-payout explanation** — "Aaj baarish ki wajah se orders band the. ₹340 tera UPI mein aa gaya."
- **Onboarding flow** — conversational insurance setup, not a form
- **Payout status queries** — "Mere paise kab aayenge?" handled naturally
- **Coverage upgrade prompts** — Forecast Shield notifications

The LLM never makes any financial decision. All decisions (trigger fired, payout amount, fraud flag) are made by the deterministic rules engine and the ML models. The LLM only communicates decisions already made.

**Fallback:** If no Groq API key is configured, the system falls back to templated Hinglish messages automatically. The app works fully without the LLM layer — judges who don't configure the key still see a complete working demo.

---

## Tech Stack

| Layer | Technology | Reason |
|-------|-----------|--------|
| Worker frontend | React Native + Expo (Phase 3) / React PWA (Phase 1) | Real device target, Expo Go for judge demos |
| Admin frontend | React 18 + Vite + TailwindCSS | Web is correct for admin/insurer |
| Backend | Python 3.11 + FastAPI | Async, typed, excellent for data pipelines |
| Database | Supabase (hosted PostgreSQL) | Free hosted DB, phone OTP auth, realtime subscriptions |
| LLM | Groq API — Llama 3.1 8B | Judge machine compatible, fast inference, free tier |
| ML models | scikit-learn (XGBoost + Isolation Forest) | Local training on seeded data, zero cost, serialized via joblib |
| Task scheduling | APScheduler in FastAPI (Phase 1–2) → Celery + Redis (Phase 3) | Complexity scales with need |
| Push notifications | Firebase Cloud Messaging | Free, Android-first, works with PWA and React Native |
| Payments | Razorpay Test Mode | Mock UPI payouts with real API shape |
| API caching | Redis TTL cache (5-min per zone) | Prevents rate limit hits across 4 zones × 4 APIs |
| Containerization | Docker + Docker Compose | One-command setup for judges |
| External APIs | Open-Meteo (free, no key), WAQI, SACHET RSS | All free tier / public |

---

## API Strategy

### Weather and Environmental (T1 Triggers)

**Open-Meteo** is the primary weather source — completely free, no API key required, returns hourly precipitation, temperature, and wind per lat/lng. Used as the default for all zone polling.

**WAQI** provides AQI data for 12,000+ stations globally. Bengaluru has strong coverage. Free token via signup, returns AQI + PM2.5 per station.

**SACHET RSS (NDMA)** is the government disaster alert feed. No auth required, public RSS/XML. Parsed for district-level Orange/Red alerts.

### Platform Activity Proxy (T2 Trigger)

No real platform API exists for order-rate data. A small FastAPI mock microservice returns `zone_order_rate` using a noise + weather-correlated formula. Judges expect simulation here. Historical baseline is seeded using Python Faker + pandas — 90 days of per-zone order data in Postgres, giving the 7-day rolling average real data to compare against.

### Social and Bandh Signals

A mock JSON endpoint controlled via the admin dashboard simulates bandh/curfew signals. Toggling a flag triggers the social disruption flow end-to-end — more demo-friendly than depending on live Twitter search latency.

---

## Repository Structure

```
gigshield/
├── client/                        # React PWA (Phase 1) / React Native (Phase 3)
│   ├── worker-app/                # Worker-facing mobile interface
│   └── admin-dashboard/           # Admin / insurer web dashboard
├── server/                        # FastAPI backend
│   ├── api/                       # Route handlers
│   ├── engine/                    # Trigger engine (deterministic rules)
│   ├── ml/                        # XGBoost premium model, Isolation Forest fraud
│   ├── adaptive/                  # Zone threshold recalibration logic
│   ├── llm/                       # Groq integration + fallback templates
│   └── jobs/                      # APScheduler polling jobs
├── scripts/
│   └── seed_historical_data.py    # Faker + pandas — 90-day zone baseline seeder
├── docker-compose.yml             # One-command local setup
├── .env.example                   # API keys config — app works without LLM key
├── README.md                      # This file
└── SYSTEM.md                      # Internal architecture notes
```

---

## Phase Deliverables

### Phase 1 — Ideation and Foundation (March 4–20)
- [x] README with full strategy, architecture, and tech decisions
- [ ] Project scaffold — client (PWA) + server (FastAPI)
- [ ] Worker onboarding flow — phone OTP via Supabase Auth
- [ ] Open-Meteo + WAQI data fetch layer with Redis caching
- [ ] Historical baseline seeder (90-day mock data)
- [ ] 2-minute strategy video

### Phase 2 — Automation and Protection (March 21–April 4)
- [ ] Registration and policy management
- [ ] Dynamic premium calculation — XGBoost model trained on seeded data
- [ ] Claims management with dual-trigger and severity scoring
- [ ] 5 automated disruption triggers live (Open-Meteo, WAQI, SACHET, order-drop proxy, bandh mock)
- [ ] Isolation Forest fraud detection
- [ ] Earnings velocity profiling per worker
- [ ] Post-payout Hinglish survey — trust score per zone
- [ ] 2-minute demo video

### Phase 3 — Scale and Optimise (April 5–17)
- [ ] React Native + Expo worker app with GPS-based fraud validation
- [ ] Forecast Shield — predictive coverage upgrade notifications via FCM
- [ ] Solidarity Pool — pooled risk model for social disruption events
- [ ] Income smoothing opt-in feature
- [ ] Worker trust tier system
- [ ] Instant payout simulation — Razorpay test mode + Twilio SMS sandbox
- [ ] Intelligent dual dashboard — worker view + admin insurer view with zone trust analytics
- [ ] Adaptive threshold recalibration — weekly zone_config recompute
- [ ] 5-minute walkthrough video demonstrating simulated disruption → auto payout end to end
- [ ] Final pitch deck PDF

---

## What We Are Not Building

GigShield strictly excludes the following per the problem statement constraints:

- Health insurance or accident medical bills
- Vehicle repair or maintenance coverage
- Life insurance of any kind
- Any coverage for events within a worker's control

All payouts are triggered exclusively by verified external disruptions causing loss of income. The system is designed so these exclusions are enforced at the trigger definition level — no trigger exists that could fire for a covered exclusion.

---

## Edge Cases and Systemic Risk Boundaries

This section documents known edge cases and our conscious design decisions around them. We are not implementing solutions for all of these — but we want to be transparent about where the product boundaries are and why.

### Single Restaurant Closures

If one restaurant closes due to a broken stove, a kitchen accident, or an LPG supply issue, GigShield does not trigger a payout. This is by design. A single restaurant closing is an operational event internal to that business, not an external systemic disruption. The delivery worker gets reassigned by the platform automatically. More importantly, a single closure does not move the T2 trigger — zone order drop rate won't shift enough to cross the 60% threshold from one restaurant going dark.

However, if an LPG shortage is severe enough to close a significant percentage of restaurants across a zone simultaneously, the T2 trigger fires naturally. The zone order drop rate falls, both triggers align, and GigShield pays out. We do not need a dedicated LPG trigger — the dual-trigger model catches the impact of systemic supply disruptions regardless of root cause by measuring outcomes rather than causes.

### Fraud Prevention on Repeated or Prolonged Disruptions

Each worker's policy enforces a **maximum consecutive trigger cap** — currently set at 4 weeks. If a disruption-level event persists beyond this window, claims move to manual review rather than auto-payout. This prevents exploitation of prolonged low-severity conditions that might technically meet thresholds but represent a different risk class than the acute disruptions the product is designed for.

The Isolation Forest anomaly model also flags workers whose claim frequency or payout amounts deviate significantly from their own historical baseline and from zone-wide peer patterns. GPS validation, activity cross-checks, and velocity guards provide additional layers.

### Truly Systemic Events — COVID-Scale Disruptions

GigShield is designed for recoverable, zone-level disruptions — events that last hours to days and affect a defined geography. It is explicitly not designed to be the primary safety net for economy-wide, indefinite disruptions like a pandemic.

For events of that magnitude, two mechanisms apply:

**Proportional drawdown from the Solidarity Pool.** If the pool reserve is insufficient to cover all triggered payouts in a given week, payouts scale down proportionally across all eligible workers rather than some workers receiving full payouts and others receiving nothing. This mirrors how real mutual insurance handles catastrophe scenarios.

**Policy suspension with reserve protection.** If a systemic event persists beyond the consecutive trigger cap and the pool reserve falls below a defined floor, new auto-payouts are suspended and the reserve is held for manual disbursement. At this point the event has moved outside the parametric insurance model and into territory that requires government or platform-level intervention.

We are transparent about this boundary because good insurance design means knowing what you are not covering, not pretending every scenario is solvable with the same product.

---

## Team

Guidewire DEVTrails 2026 Participant Team
Built with FastAPI · React Native · Supabase · Groq · scikit-learn · Love for gig workers

---

*GigShield is not affiliated with Zomato, Swiggy, Blinkit, or Razorpay. All worker data is simulated for hackathon purposes.*
