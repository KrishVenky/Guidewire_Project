import asyncio
import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

logger = logging.getLogger(__name__)
scheduler = AsyncIOScheduler(timezone="Asia/Kolkata")


async def poll_and_evaluate():
    """
    Runs every 5 minutes: fetches all external APIs for each zone,
    evaluates DTPM triggers, fires claims pipeline if both T1 + T2 fire.
    """
    try:
        from database import SessionLocal
        from models.zone import Zone
        from models.disruption_event import DisruptionEvent, EventSource
        from services.trigger_engine import evaluate_zone
        from services.claims_service import process_disruption_event

        db = SessionLocal()
        try:
            zones = db.query(Zone).all()
            for zone in zones:
                t1, t2, severity, tier = await evaluate_zone(
                    zone_id=str(zone.id),
                    lat=zone.open_meteo_lat,
                    lng=zone.open_meteo_lng,
                    rain_threshold=zone.rain_threshold,
                    heat_threshold=zone.heat_threshold,
                    aqi_threshold=zone.aqi_threshold,
                    order_drop_threshold=zone.order_drop_threshold,
                    sachet_district=zone.sachet_district,
                    waqi_station_id=zone.waqi_station_id,
                )

                if t1.confirmed and t2.confirmed and tier.value != "NONE":
                    event = DisruptionEvent(
                        zone_id=zone.id,
                        event_type=t1.event_type,
                        source=t1.source,
                        severity_score=severity,
                        raw_value=t1.raw_value,
                        threshold_breached=t1.threshold,
                        order_drop_pct=t2.drop_pct,
                        t1_confirmed=True,
                        t2_confirmed=True,
                        dual_trigger_fired=True,
                        payout_tier=tier,
                    )
                    db.add(event)
                    db.commit()
                    db.refresh(event)

                    # Load zone relationship
                    event.zone = zone

                    summary = await process_disruption_event(event, db)
                    logger.info(
                        f"[Scheduler] Zone={zone.name} triggered. "
                        f"Claims={summary['claims_created']}"
                    )
        finally:
            db.close()
    except Exception as e:
        logger.error(f"[Scheduler] poll_and_evaluate error: {e}")


async def deduct_weekly_premiums():
    """Runs every Monday at 06:00 IST."""
    try:
        from database import SessionLocal
        from models.policy import Policy, PolicyStatus
        from datetime import date

        db = SessionLocal()
        try:
            today = date.today()
            active_policies = db.query(Policy).filter(
                Policy.status == PolicyStatus.ACTIVE,
                Policy.premium_paid_this_week == False,
            ).all()

            for policy in active_policies:
                policy.total_premiums_paid += policy.weekly_premium
                policy.premium_paid_this_week = True
                policy.current_week_start = today

            db.commit()
            logger.info(f"[Scheduler] Weekly premiums deducted for {len(active_policies)} policies")
        finally:
            db.close()
    except Exception as e:
        logger.error(f"[Scheduler] deduct_weekly_premiums error: {e}")


async def reset_weekly_premium_flag():
    """Runs every Sunday at 23:55 IST to reset premium_paid_this_week."""
    try:
        from database import SessionLocal
        from models.policy import Policy, PolicyStatus

        db = SessionLocal()
        try:
            db.query(Policy).filter(Policy.status == PolicyStatus.ACTIVE).update(
                {"premium_paid_this_week": False}
            )
            db.commit()
        finally:
            db.close()
    except Exception as e:
        logger.error(f"[Scheduler] reset_weekly_premium_flag error: {e}")


def start_scheduler():
    # Poll every 5 minutes
    scheduler.add_job(
        poll_and_evaluate,
        trigger=IntervalTrigger(minutes=5),
        id="poll_and_evaluate",
        replace_existing=True,
        max_instances=1,
    )

    # Weekly premium deduction — Monday 06:00 IST
    scheduler.add_job(
        deduct_weekly_premiums,
        trigger=CronTrigger(day_of_week="mon", hour=6, minute=0, timezone="Asia/Kolkata"),
        id="weekly_premiums",
        replace_existing=True,
    )

    # Reset flag — Sunday 23:55 IST
    scheduler.add_job(
        reset_weekly_premium_flag,
        trigger=CronTrigger(day_of_week="sun", hour=23, minute=55, timezone="Asia/Kolkata"),
        id="reset_premium_flag",
        replace_existing=True,
    )

    scheduler.start()
    logger.info("[Scheduler] APScheduler started — polling every 5 minutes")
