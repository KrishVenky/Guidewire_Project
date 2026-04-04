"""
Simulated zone order-rate microservice.
In production this would be a real platform API.
Returns synthetic order rates based on seeded 7-day rolling baseline + weather-correlated noise.
"""
import math
import random
from datetime import datetime, timedelta
from typing import Dict
from uuid import UUID

# In-memory store for zone baselines (populated from seed data at startup)
_zone_baselines: Dict[str, float] = {}
_zone_current_rates: Dict[str, float] = {}
_bandh_active: Dict[str, bool] = {}


def set_baseline(zone_id: str, baseline_rate: float):
    _zone_baselines[zone_id] = baseline_rate
    _zone_current_rates[zone_id] = baseline_rate


def set_bandh(zone_id: str, active: bool):
    _bandh_active[str(zone_id)] = active


def is_bandh_active(zone_id: str) -> bool:
    return _bandh_active.get(str(zone_id), False)


def get_current_order_rate(zone_id: str, weather_factor: float = 1.0) -> float:
    """
    Returns synthetic current order rate.
    weather_factor: 0.0 = no orders (extreme event), 1.0 = normal
    """
    zid = str(zone_id)
    baseline = _zone_baselines.get(zid, 100.0)

    if _bandh_active.get(zid, False):
        return baseline * random.uniform(0.05, 0.15)

    hour = datetime.now().hour
    # Delivery peak hours: 12–14 and 19–22
    hour_factor = 1.0 + 0.3 * math.sin(math.pi * (hour - 6) / 18)

    noise = random.uniform(0.9, 1.1)
    rate = baseline * hour_factor * weather_factor * noise
    _zone_current_rates[zid] = rate
    return max(rate, 0.0)


def get_rolling_baseline(zone_id: str, days: int = 7) -> float:
    zid = str(zone_id)
    return _zone_baselines.get(zid, 100.0)


def compute_drop_pct(zone_id: str, current_rate: float) -> float:
    baseline = get_rolling_baseline(zone_id)
    if baseline == 0:
        return 0.0
    drop = (baseline - current_rate) / baseline * 100
    return max(drop, 0.0)


def simulate_weather_drop(zone_id: str, intensity: float) -> float:
    """
    intensity: 0.0–1.0 (1.0 = complete shutdown)
    Returns current rate after weather impact.
    """
    baseline = get_rolling_baseline(zone_id)
    weather_factor = max(0.0, 1.0 - intensity)
    noise = random.uniform(0.85, 1.0)
    return baseline * weather_factor * noise


def reset_zone_state(zone_id: str):
    """Reset simulated order drop and bandh flags back to baseline after event ends."""
    zid = str(zone_id)
    _bandh_active[zid] = False
    if zid in _zone_baselines:
        _zone_current_rates[zid] = _zone_baselines[zid]
