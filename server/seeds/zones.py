"""
Seed the 4 Bengaluru zones and set order-rate baselines.
"""
from models.zone import Zone
from integrations.order_proxy import set_baseline

def _aqi_threshold_from_risk(aqi_risk_score: float) -> float:
    """
    Derive zone-level AQI trigger threshold from historical risk score.
    Higher risk (more AQI-sensitive zone) → lower threshold → triggers sooner.
    Formula: threshold = 350 - (aqi_risk_score * 100)
      0.35 risk → 315  (low sensitivity, needs higher AQI to trigger)
      0.50 risk → 300  (city baseline)
      0.55 risk → 295
      0.65 risk → 285  (high sensitivity, triggers earlier)
    """
    return round(350.0 - (aqi_risk_score * 100.0), 1)


ZONES = [
    {
        "name": "Koramangala",
        "city": "Bengaluru",
        "lat_center": 12.9352,
        "lng_center": 77.6245,
        "open_meteo_lat": 12.9352,
        "open_meteo_lng": 77.6245,
        "waqi_station_id": "@7025",
        "sachet_district": "Bengaluru Urban",
        "flood_risk_score": 0.6,
        "heat_risk_score": 0.5,
        "aqi_risk_score": 0.55,
        "risk_multiplier": 1.15,
        "rain_threshold": 50.0,
        "heat_threshold": 44.0,
        "order_drop_threshold": 60.0,
        "baseline_order_rate": 120.0,
    },
    {
        "name": "Whitefield",
        "city": "Bengaluru",
        "lat_center": 12.9698,
        "lng_center": 77.7499,
        "open_meteo_lat": 12.9698,
        "open_meteo_lng": 77.7499,
        "waqi_station_id": "@7026",
        "sachet_district": "Bengaluru Urban",
        "flood_risk_score": 0.4,
        "heat_risk_score": 0.6,
        "aqi_risk_score": 0.65,
        "risk_multiplier": 1.1,
        "rain_threshold": 50.0,
        "heat_threshold": 44.0,
        "order_drop_threshold": 60.0,
        "baseline_order_rate": 100.0,
    },
    {
        "name": "HSR Layout",
        "city": "Bengaluru",
        "lat_center": 12.9116,
        "lng_center": 77.6389,
        "open_meteo_lat": 12.9116,
        "open_meteo_lng": 77.6389,
        "waqi_station_id": "@7025",
        "sachet_district": "Bengaluru Urban",
        "flood_risk_score": 0.45,
        "heat_risk_score": 0.5,
        "aqi_risk_score": 0.5,
        "risk_multiplier": 1.05,
        "rain_threshold": 50.0,
        "heat_threshold": 44.0,
        "order_drop_threshold": 60.0,
        "baseline_order_rate": 95.0,
    },
    {
        "name": "Indiranagar",
        "city": "Bengaluru",
        "lat_center": 12.9784,
        "lng_center": 77.6408,
        "open_meteo_lat": 12.9784,
        "open_meteo_lng": 77.6408,
        "waqi_station_id": "@7025",
        "sachet_district": "Bengaluru Urban",
        "flood_risk_score": 0.35,
        "heat_risk_score": 0.45,
        "aqi_risk_score": 0.5,
        "risk_multiplier": 0.95,
        "rain_threshold": 50.0,
        "heat_threshold": 44.0,
        "order_drop_threshold": 60.0,
        "baseline_order_rate": 110.0,
    },
]


def seed_zones(db):
    from sqlalchemy.exc import IntegrityError
    seeded = []
    for z in ZONES:
        existing = db.query(Zone).filter(Zone.name == z["name"]).first()
        if existing:
            set_baseline(str(existing.id), z["baseline_order_rate"])
            seeded.append(existing)
            continue

        baseline = z.pop("baseline_order_rate")
        # Derive aqi_threshold dynamically from aqi_risk_score — not hardcoded
        z["aqi_threshold"] = _aqi_threshold_from_risk(z["aqi_risk_score"])
        zone = Zone(**z)
        db.add(zone)
        try:
            db.commit()
            db.refresh(zone)
            set_baseline(str(zone.id), baseline)
            seeded.append(zone)
        except IntegrityError:
            db.rollback()

    return seeded
