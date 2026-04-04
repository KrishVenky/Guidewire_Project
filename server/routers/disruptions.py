import asyncio
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from uuid import UUID
from typing import List

from database import get_db
from models.disruption_event import DisruptionEvent, EventSource, PayoutTier
from models.zone import Zone
from schemas.disruption import (
    SimulateDisruptionRequest, BandhToggleRequest,
    DisruptionEventResponse, SimulationResult
)
from services.trigger_engine import compute_severity, severity_to_tier
from services.claims_service import process_disruption_event
from integrations.order_proxy import set_bandh, simulate_weather_drop, compute_drop_pct, reset_zone_state

router = APIRouter(prefix="/api/disruptions", tags=["disruptions"])


@router.get("/active", response_model=List[DisruptionEventResponse])
def get_active_disruptions(db: Session = Depends(get_db)):
    return (
        db.query(DisruptionEvent)
        .filter(DisruptionEvent.ended_at == None, DisruptionEvent.dual_trigger_fired == True)
        .order_by(DisruptionEvent.started_at.desc())
        .limit(20)
        .all()
    )


@router.get("/zone/{zone_id}", response_model=List[DisruptionEventResponse])
def get_zone_disruptions(zone_id: UUID, db: Session = Depends(get_db)):
    return (
        db.query(DisruptionEvent)
        .filter(DisruptionEvent.zone_id == zone_id)
        .order_by(DisruptionEvent.started_at.desc())
        .limit(20)
        .all()
    )


@router.post("/simulate", response_model=SimulationResult, status_code=201)
async def simulate_disruption(body: SimulateDisruptionRequest, db: Session = Depends(get_db)):
    zone = db.query(Zone).filter(Zone.id == body.zone_id).first()
    if not zone:
        raise HTTPException(status_code=404, detail="Zone not found")

    # T1: use provided raw_value vs zone threshold
    threshold_map = {
        "HEAVY_RAIN": zone.rain_threshold,
        "EXTREME_HEAT": zone.heat_threshold,
        "HIGH_AQI": zone.aqi_threshold,
        "NDMA_ALERT": 1.0,
        "BANDH": 1.0,
        "ORDER_DROP": zone.order_drop_threshold,
    }
    threshold = threshold_map.get(body.event_type.value, 50.0)
    t1_confirmed = body.raw_value >= threshold

    # T2: simulate order drop based on weather intensity or forced
    if body.force_t2:
        order_drop_pct = zone.order_drop_threshold + 10.0
        t2_confirmed = True
    else:
        intensity = min(1.0, body.raw_value / max(threshold * 2, 1))
        current_rate = simulate_weather_drop(str(zone.id), intensity)
        order_drop_pct = compute_drop_pct(str(zone.id), current_rate)
        t2_confirmed = order_drop_pct >= zone.order_drop_threshold

    dual_trigger = t1_confirmed and t2_confirmed

    # Severity + tier
    from services.trigger_engine import T1Result, T2Result
    from models.disruption_event import EventType, EventSource
    t1 = T1Result(confirmed=t1_confirmed, raw_value=body.raw_value, threshold=threshold)
    t2 = T2Result(confirmed=t2_confirmed, drop_pct=order_drop_pct)
    severity = compute_severity(t1, t2)
    tier = severity_to_tier(severity)

    event = DisruptionEvent(
        zone_id=zone.id,
        event_type=body.event_type,
        source=EventSource.SIMULATION,
        severity_score=severity,
        raw_value=body.raw_value,
        threshold_breached=threshold,
        order_drop_pct=order_drop_pct,
        t1_confirmed=t1_confirmed,
        t2_confirmed=t2_confirmed,
        dual_trigger_fired=dual_trigger,
        payout_tier=tier,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    event.zone = zone

    claims_created = 0
    skipped = 0

    if dual_trigger and tier != PayoutTier.NONE:
        summary = await process_disruption_event(event, db)
        claims_created = summary["claims_created"]
        skipped = summary["skipped_workers"]

    # Reset simulated T2 state so order rates return to baseline
    reset_zone_state(str(zone.id))

    return SimulationResult(
        disruption_event_id=event.id,
        event_type=event.event_type,
        source=event.source,
        zone_id=event.zone_id,
        t1_confirmed=t1_confirmed,
        t2_confirmed=t2_confirmed,
        dual_trigger_fired=dual_trigger,
        severity_score=severity,
        payout_tier=tier,
        claims_created=claims_created,
        skipped_workers=skipped,
        message=f"Simulation complete for {zone.name}. "
                f"{'Both triggers fired — claims generated.' if dual_trigger else 'Triggers did not both fire — no claims.'}"
    )


@router.post("/bandh/toggle")
def toggle_bandh(body: BandhToggleRequest, db: Session = Depends(get_db)):
    zone = db.query(Zone).filter(Zone.id == body.zone_id).first()
    if not zone:
        raise HTTPException(status_code=404, detail="Zone not found")
    set_bandh(str(body.zone_id), body.active)
    return {"zone_id": str(body.zone_id), "zone_name": zone.name, "bandh_active": body.active}
