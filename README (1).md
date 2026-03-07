# 🛡️ GigShield — AI-Powered Parametric Income Insurance for India's Delivery Workers

> **Guidewire DEVTrails 2026 | Unicorn Chase**
> Protecting the income of Zomato, Swiggy & Blinkit delivery partners against uncontrollable external disruptions.

---

## The Problem

India's food and grocery delivery workers — the people behind every Zomato order and every Blinkit 10-minute delivery — lose 20–30% of their monthly income when the world outside stops cooperating. Heavy rain. Extreme heat. AQI emergencies. Unplanned Bandhs. When these events hit, platforms stop assigning orders. Workers sit idle. And there is no safety net.

Existing insurance products don't help. Government schemes cover accidents and health. Platforms cover liability during active rides. Nobody covers **lost income from external disruptions** — the single biggest financial risk a delivery worker actually faces week to week.

**GigShield fixes this.**

---

## The Solution

GigShield is a **dual-trigger parametric income insurance platform** built specifically for Zomato/Swiggy/Blinkit delivery partners. Workers pay a small weekly premium. When a verified external disruption hits their zone, coverage activates automatically. No claim forms. No waiting. Payout lands in their UPI within minutes.

### What Makes This Different

Most parametric systems use a single trigger — "it rained, here's money." The problem is **basis risk**: it rained in one part of the city but your zone was fine, or the platform was still running deliveries. A single weather reading is not proof of income loss.

GigShield uses a **Dual-Trigger Parametric Model (DTPM)**:

```
Trigger fires ONLY when BOTH conditions are met simultaneously:

  [T1] Official disruption signal      AND    [T2] Zone-level order activity drop
       (SACHET/IMD/WAQI API)                       (Platform activity proxy)

       Example: IMD records 65mm/hr              Example: Order assignment rate
       rainfall in Whitefield zone               drops >60% in same zone/window
```

This eliminates false payouts and makes the model financially viable — a critical differentiator from a real insurance architecture standpoint.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     DATA INGESTION LAYER                     │
│  SACHET RSS (NDMA) │ IMD API │ WAQI API │ OpenWeatherMap    │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                   TRIGGER ENGINE (Rules-Based)               │
│  Threshold evaluator per zone │ Dual-trigger validator      │
│  NO ML/LLM in this layer — deterministic rules only        │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                   CORE PLATFORM (FastAPI)                    │
│  Worker Registry │ Policy Engine │ Premium Calculator       │
│  Claims Manager  │ Fraud Detection │ Payout Processor       │
└──────────────┬───────────────────────────┬──────────────────┘
               │                           │
┌──────────────▼──────────┐   ┌────────────▼─────────────────┐
│   PostgreSQL Database   │   │   LLM LAYER (Llama 3.1 8B)   │
│  Workers │ Policies     │   │   Ollama local inference      │
│  Claims  │ Zones        │   │   Hinglish communication      │
│  Payouts │ Audit log    │   │   Claim explanation only      │
└─────────────────────────┘   └──────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                   REACT FRONTEND                             │
│  Worker Dashboard │ Admin Dashboard │ Onboarding Flow       │
└─────────────────────────────────────────────────────────────┘
```

**Critical design principle:** The LLM never makes financial decisions. It only explains decisions already made by the rules engine — in plain Hinglish to the worker.

---

## Parametric Triggers

| Trigger | Source | Threshold | Type |
|---------|--------|-----------|------|
| Heavy Rainfall | IMD API + OpenWeatherMap | >50mm/hr sustained 45min | Environmental |
| Extreme Heat | IMD API | >44°C for 3+ consecutive hours | Environmental |
| Severe AQI | WAQI API | AQI >300 (Hazardous) | Environmental |
| NDMA Red Alert | SACHET RSS Feed | Any Red/Orange district alert | Official Govt |
| Zone Order Drop | Platform Activity Proxy | >60% drop vs 7-day rolling avg | Activity |

All thresholds are **zone-relative** — calibrated to each delivery zone's historical baseline, not city-wide averages.

---

## Weekly Premium Model

Premium is calculated dynamically every week per worker using:

```
Weekly Premium = Base Rate × Zone Risk Multiplier × Season Factor × Worker Tenure Discount

Base Rate: ₹35/week (covers up to ₹1,500 income protection)

Zone Risk Multiplier: 0.8x (low-flood zone) to 1.4x (high-flood zone)
Season Factor: 1.0 (dry) to 1.6 (monsoon peak, June-September)
Tenure Discount: -5% per 3 months active (max -20%)

Example: Whitefield zone, monsoon season, new worker
₹35 × 1.3 × 1.5 × 1.0 = ₹68.25/week
```

Premium is deducted from the worker's linked UPI every Monday morning.

---

## Fraud Detection

| Mechanism | What It Catches |
|-----------|----------------|
| GPS zone validation | Worker not in claimed disruption zone at trigger time |
| Activity cross-check | Worker had active deliveries during claimed disruption window |
| Duplicate trigger guard | Same event cannot trigger multiple claims per worker |
| Historical anomaly score | Claim pattern deviates from worker's own baseline |
| Velocity check | More than 2 claims in 7 days flags for manual review |

---

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Frontend | React 18 + Vite + TailwindCSS | Fast dev, clean component model |
| Backend | Python 3.11 + FastAPI | Async, typed, excellent for data pipelines |
| Database | PostgreSQL 15 | Relational integrity for financial data |
| LLM | Llama 3.1 8B via Ollama | Local inference, Hindi/Hinglish capable |
| Task Queue | Celery + Redis | Async trigger monitoring, payout jobs |
| Payments | Razorpay Test Mode | Mock UPI payouts with real API shape |
| Containerization | Docker + Docker Compose | One command setup for judges |
| External APIs | SACHET RSS, IMD, WAQI, OpenWeatherMap | All free tier / public |

---

## Delivery Persona

**Primary:** Zomato food delivery partners + Blinkit grocery delivery partners
(Blinkit is a Zomato subsidiary — same worker pool, unified risk model)

**Secondary:** Swiggy food + Swiggy Instamart partners

**Target geography (Phase 1):** Bengaluru (4 zones: Whitefield, Koramangala, HSR Layout, Indiranagar)
**Scale target (Phase 3):** 6 metro cities

---

## Phase Deliverables

### Phase 1 — Ideation & Foundation (March 4–20) ✅
- [x] README.md with full strategy
- [ ] Project scaffold (client + server)
- [ ] Worker onboarding flow (frontend + backend)
- [ ] Weather API integration (data fetch layer)
- [ ] 2-minute strategy video

### Phase 2 — Automation & Protection (March 21–April 4)
- [ ] Registration + Policy Management
- [ ] Dynamic premium calculation (ML model)
- [ ] Claims management with dual-trigger
- [ ] 3-5 automated disruption triggers live
- [ ] 2-minute demo video

### Phase 3 — Scale & Optimise (April 5–17)
- [ ] Advanced fraud detection
- [ ] Instant payout simulation (Razorpay test)
- [ ] Intelligent dashboards (Worker + Admin)
- [ ] 5-minute walkthrough video
- [ ] Final pitch deck PDF

---

## Repository Structure

```
gigshield/
├── client/                   # React frontend
├── server/                   # FastAPI backend
├── docker-compose.yml        # One-command local setup
├── README.md                 # This file — public/judge-facing
└── SYSTEM.md                 # Internal system brain — agents/devs
```

---

## Team

Guidewire DEVTrails 2026 Participant Team
Built with FastAPI · React · PostgreSQL · Llama 3.1 · Love for gig workers

---

*GigShield is not affiliated with Zomato, Swiggy, or Blinkit. Worker data is simulated for hackathon purposes.*
