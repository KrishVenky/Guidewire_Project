from pydantic import BaseModel
from uuid import UUID
from datetime import datetime
from typing import Optional
from ..models.disruption_event import EventType, EventSource, PayoutTier


class SimulateDisruptionRequest(BaseModel):
    zone_id: UUID
    event_type: EventType
    raw_value: float
    force_t2: bool = False


class BandhToggleRequest(BaseModel):
    zone_id: UUID
    active: bool


class DisruptionEventResponse(BaseModel):
    id: UUID
    zone_id: UUID
    event_type: EventType
    source: EventSource
    severity_score: float
    raw_value: float
    order_drop_pct: float
    t1_confirmed: bool
    t2_confirmed: bool
    dual_trigger_fired: bool
    payout_tier: PayoutTier
    affected_worker_count: int
    started_at: datetime

    class Config:
        from_attributes = True


class SimulationResult(BaseModel):
    disruption_event_id: UUID
    event_type: EventType
    source: EventSource
    zone_id: UUID
    t1_confirmed: bool
    t2_confirmed: bool
    dual_trigger_fired: bool
    severity_score: float
    payout_tier: PayoutTier
    claims_created: int
    skipped_workers: int
    message: str
