"""
DTPM Dual-Trigger Parametric Model — deterministic rules only, zero ML.
T1: external disruption signal (Open-Meteo / WAQI / SACHET / bandh mock)
T2: zone order activity drop >60% vs 7-day rolling average
Both must fire simultaneously for a payout to be eligible.
"""
import asyncio
from dataclasses import dataclass
from typing import Optional, Tuple
from uuid import UUID

from ..integrations import open_meteo, waqi, sachet, order_proxy
from ..models.disruption_event import EventType, EventSource, PayoutTier


@dataclass
class T1Result:
    confirmed: bool
    source: EventSource = EventSource.OPEN_METEO
    event_type: EventType = EventType.HEAVY_RAIN
    raw_value: float = 0.0
    threshold: float = 0.0


@dataclass
class T2Result:
    confirmed: bool
    drop_pct: float = 0.0
    current_rate: float = 0.0
    baseline_rate: float = 0.0


# Track consecutive polls for sustained conditions
_consecutive_rain_polls: dict = {}
_consecutive_heat_polls: dict = {}


async def evaluate_t1(
    zone_id: str,
    lat: float,
    lng: float,
    rain_threshold: float,
    heat_threshold: float,
    aqi_threshold: float,
    sachet_district: str,
    waqi_station_id: str,
) -> T1Result:
    zid = str(zone_id)

    # 1. SACHET NDMA alerts (highest priority)
    alerts = await sachet.get_active_alerts(sachet_district)
    if sachet.has_active_alert(alerts, min_severity="ORANGE"):
        return T1Result(confirmed=True, source=EventSource.SACHET,
                        event_type=EventType.NDMA_ALERT, raw_value=1.0, threshold=1.0)

    # 2. Bandh signal
    if order_proxy.is_bandh_active(zid):
        return T1Result(confirmed=True, source=EventSource.BANDH_MOCK,
                        event_type=EventType.BANDH, raw_value=1.0, threshold=1.0)

    # 3. Open-Meteo weather
    meteo = await open_meteo.get_current(lat, lng, rain_threshold)

    # Heavy rain (sustained 3 polls = 15 min)
    if meteo.precipitation_mm_hr >= rain_threshold:
        _consecutive_rain_polls[zid] = _consecutive_rain_polls.get(zid, 0) + 1
    else:
        _consecutive_rain_polls[zid] = 0

    if _consecutive_rain_polls.get(zid, 0) >= 3:
        return T1Result(confirmed=True, source=EventSource.OPEN_METEO,
                        event_type=EventType.HEAVY_RAIN,
                        raw_value=meteo.precipitation_mm_hr, threshold=rain_threshold)

    # Extreme heat (sustained 3 polls)
    if meteo.temperature_2m >= heat_threshold:
        _consecutive_heat_polls[zid] = _consecutive_heat_polls.get(zid, 0) + 1
    else:
        _consecutive_heat_polls[zid] = 0

    if _consecutive_heat_polls.get(zid, 0) >= 3:
        return T1Result(confirmed=True, source=EventSource.OPEN_METEO,
                        event_type=EventType.EXTREME_HEAT,
                        raw_value=meteo.temperature_2m, threshold=heat_threshold)

    # 4. AQI check
    aqi_data = await waqi.get_current(waqi_station_id)
    if aqi_data.aqi >= aqi_threshold:
        return T1Result(confirmed=True, source=EventSource.WAQI,
                        event_type=EventType.HIGH_AQI,
                        raw_value=aqi_data.aqi, threshold=aqi_threshold)

    return T1Result(confirmed=False)


def evaluate_t2(zone_id: str, order_drop_threshold: float,
                weather_intensity: float = 0.0) -> T2Result:
    zid = str(zone_id)
    current_rate = order_proxy.get_current_order_rate(zid, weather_factor=max(0.0, 1.0 - weather_intensity))
    baseline = order_proxy.get_rolling_baseline(zid)
    drop_pct = order_proxy.compute_drop_pct(zid, current_rate)

    return T2Result(
        confirmed=drop_pct >= order_drop_threshold,
        drop_pct=round(drop_pct, 2),
        current_rate=round(current_rate, 2),
        baseline_rate=round(baseline, 2),
    )


def compute_severity(t1: T1Result, t2: T2Result, rain_threshold: float = 50.0) -> float:
    if not t1.confirmed or not t2.confirmed:
        return 0.0
    t1_score = min(60.0, (t1.raw_value / max(t1.threshold, 1)) * 40.0)
    t2_score = min(40.0, (t2.drop_pct / 60.0) * 40.0)
    return round(t1_score + t2_score, 2)


def severity_to_tier(score: float) -> PayoutTier:
    if score <= 40:
        return PayoutTier.NONE
    if score <= 60:
        return PayoutTier.HALF
    if score <= 80:
        return PayoutTier.THREE_QUARTER
    return PayoutTier.FULL


async def evaluate_zone(
    zone_id: str,
    lat: float,
    lng: float,
    rain_threshold: float,
    heat_threshold: float,
    aqi_threshold: float,
    order_drop_threshold: float,
    sachet_district: str,
    waqi_station_id: str,
) -> Tuple[T1Result, T2Result, float, PayoutTier]:
    t1 = await evaluate_t1(zone_id, lat, lng, rain_threshold, heat_threshold,
                            aqi_threshold, sachet_district, waqi_station_id)

    weather_intensity = 0.0
    if t1.confirmed and t1.event_type == EventType.HEAVY_RAIN:
        weather_intensity = min(1.0, t1.raw_value / 100.0)

    t2 = evaluate_t2(zone_id, order_drop_threshold, weather_intensity)
    severity = compute_severity(t1, t2)
    tier = severity_to_tier(severity)

    return t1, t2, severity, tier
