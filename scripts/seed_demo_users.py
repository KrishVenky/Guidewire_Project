"""
Deterministic demo seed for fixed test users (U001-U008).
Run:
  python scripts/seed_demo_users.py
or inside Docker:
  docker compose exec server python scripts/seed_demo_users.py
"""
import sys
import os
from datetime import date, datetime, timezone

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "server")))

from database import SessionLocal, create_tables
from models.worker import Worker, Platform, TrustTier
from models.policy import Policy, PolicyStatus
from models.zone import Zone
from services.premium_calculator import calculate

USERS = [
    {"code": "U001", "name": "Aarav Clean", "phone": "9000000001", "zone": "Whitefield", "income": 3500, "hours": 48, "trust": TrustTier.NEW_PARTNER},
    {"code": "U002", "name": "Bhavna HighIncome", "phone": "9000000002", "zone": "Koramangala", "income": 9000, "hours": 50, "trust": TrustTier.RISING_PARTNER},
    {"code": "U003", "name": "Charan Velocity", "phone": "9000000003", "zone": "HSR Layout", "income": 4200, "hours": 52, "trust": TrustTier.NEW_PARTNER},
    {"code": "U004", "name": "Diya ZoneMismatch", "phone": "9000000004", "zone": "Indiranagar", "income": 3800, "hours": 46, "trust": TrustTier.NEW_PARTNER},
    {"code": "U005", "name": "Eshan Duplicate", "phone": "9000000005", "zone": "Whitefield", "income": 3600, "hours": 48, "trust": TrustTier.NEW_PARTNER},
    {"code": "U006", "name": "Farah Trusted", "phone": "9000000006", "zone": "Koramangala", "income": 4800, "hours": 45, "trust": TrustTier.TRUSTED_PARTNER},
    {"code": "U007", "name": "Gautam Honeypot", "phone": "9000000007", "zone": "HSR Layout", "income": 3400, "hours": 48, "trust": TrustTier.NEW_PARTNER},
    {"code": "U008", "name": "Harini Stress", "phone": "9000000008", "zone": "Whitefield", "income": 3000, "hours": 50, "trust": TrustTier.RISING_PARTNER},
]


def run():
    create_tables()
    db = SessionLocal()
    try:
        zones = {z.name: z for z in db.query(Zone).all()}
        if not zones:
            raise RuntimeError("Zones not seeded. Start app once to seed zones first.")

        for u in USERS:
            zone = zones.get(u["zone"])
            if not zone:
                continue

            worker = db.query(Worker).filter(Worker.phone == u["phone"]).first()
            if not worker:
                worker = Worker(
                    full_name=u["name"],
                    phone=u["phone"],
                    upi_id=f"{u['code'].lower()}@upi",
                    platform=Platform.ZOMATO,
                    zone_id=zone.id,
                    avg_weekly_income=float(u["income"]),
                    declared_weekly_hours=int(u["hours"]),
                    tenure_weeks=60 if u["trust"] == TrustTier.TRUSTED_PARTNER else 8,
                    trust_tier=u["trust"],
                    kyc_verified=True,
                )
                db.add(worker)
                db.flush()

            existing_policy = db.query(Policy).filter(
                Policy.worker_id == worker.id,
                Policy.status == PolicyStatus.ACTIVE,
            ).first()
            if not existing_policy:
                breakdown = calculate(
                    avg_weekly_income=worker.avg_weekly_income,
                    declared_weekly_hours=worker.declared_weekly_hours,
                    tenure_weeks=worker.tenure_weeks,
                    flood_risk_score=zone.flood_risk_score,
                    heat_risk_score=zone.heat_risk_score,
                    aqi_risk_score=zone.aqi_risk_score,
                )
                policy = Policy(
                    worker_id=worker.id,
                    weekly_premium=breakdown.weekly_premium,
                    coverage_amount=breakdown.coverage_amount,
                    status=PolicyStatus.ACTIVE,
                    start_date=date.today(),
                    current_week_start=date.today(),
                    premium_paid_this_week=False,
                    terms_accepted_at=datetime.now(timezone.utc),
                    privacy_accepted_at=datetime.now(timezone.utc),
                    activation_source="DEMO_SEED",
                )
                db.add(policy)

        db.commit()
        print("Seeded deterministic demo users U001-U008.")
    finally:
        db.close()


if __name__ == "__main__":
    run()
