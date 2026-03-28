"""
Standalone seed script for 90-day zone activity baseline data.
Run: python scripts/seed_historical_data.py
Or inside Docker: docker exec -it rainready-server-1 python scripts/seed_historical_data.py
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import random
import math
from datetime import datetime, timedelta
from faker import Faker

fake = Faker("en_IN")

def run():
    from server.database import SessionLocal, create_tables
    from server.seeds.zones import seed_zones
    from server.models.worker import Worker, Platform, TrustTier
    from server.models.policy import Policy, PolicyStatus
    from datetime import date

    create_tables()
    db = SessionLocal()

    try:
        print("Seeding zones...")
        zones = seed_zones(db)
        print(f"  {len(zones)} zones seeded")

        print("Seeding mock workers...")
        workers_created = 0
        platforms = [Platform.ZOMATO, Platform.SWIGGY, Platform.BLINKIT]

        for zone in zones:
            for i in range(8):
                phone = f"9{random.randint(100000000, 999999999)}"
                existing = db.query(Worker).filter(Worker.phone == phone).first()
                if existing:
                    continue

                income = random.uniform(2500, 6000)
                tenure = random.randint(0, 80)

                worker = Worker(
                    full_name=fake.name(),
                    phone=phone,
                    upi_id=f"{fake.user_name()}@upi",
                    platform=random.choice(platforms),
                    zone_id=zone.id,
                    avg_weekly_income=round(income, 2),
                    declared_weekly_hours=random.randint(40, 60),
                    tenure_weeks=tenure,
                    trust_tier=TrustTier.TRUSTED_PARTNER if tenure > 52 else (
                        TrustTier.RISING_PARTNER if tenure > 13 else TrustTier.NEW_PARTNER
                    ),
                    kyc_verified=tenure > 4,
                )
                db.add(worker)
                workers_created += 1

        db.commit()
        print(f"  {workers_created} workers seeded")

        print("Seeding active policies for workers without one...")
        from server.services.premium_calculator import calculate
        workers_all = db.query(Worker).all()
        policies_created = 0

        for worker in workers_all:
            existing_policy = db.query(Policy).filter(Policy.worker_id == worker.id).first()
            if existing_policy:
                continue

            zone = worker.zone
            if not zone:
                continue

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
                start_date=date.today() - timedelta(weeks=worker.tenure_weeks),
                current_week_start=date.today(),
                total_premiums_paid=round(breakdown.weekly_premium * worker.tenure_weeks, 2),
            )
            db.add(policy)
            policies_created += 1

        db.commit()
        print(f"  {policies_created} policies seeded")

        print("\nSeed complete. Zone IDs for Postman environment:")
        for zone in zones:
            print(f"  {zone.name}: {zone.id}")

    finally:
        db.close()


if __name__ == "__main__":
    run()
