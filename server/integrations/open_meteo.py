import httpx
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional
from config import get_settings

settings = get_settings()


@dataclass
class MeteoData:
    precipitation_mm_hr: float
    temperature_2m: float
    apparent_temperature: float
    wind_speed: float
    forecast_rain_6hr: float  # max in next 6 hours
    forecast_breach_prob: float  # 0.0–1.0 probability of exceeding threshold in 6hr


BASE_URL = "https://api.open-meteo.com/v1/forecast"
ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"


@dataclass
class WeatherValidation:
    consistent: bool
    observed_value: float
    historical_peak: float
    ratio: float
    reason: str


async def get_current(lat: float, lng: float, rain_threshold: float = 50.0) -> MeteoData:
    if settings.mock_mode:
        # Deterministic mock weather for demos: stable values, no network dependency.
        base = abs(int((lat + lng) * 100)) % 10
        rain = float(12 + base)
        temp = float(31 + (base % 4))
        return MeteoData(
            precipitation_mm_hr=rain,
            temperature_2m=temp,
            apparent_temperature=temp + 1.5,
            wind_speed=7.0,
            forecast_rain_6hr=rain + 3.0,
            forecast_breach_prob=0.0 if rain_threshold > (rain + 3.0) else 0.5,
        )

    params = {
        "latitude": lat,
        "longitude": lng,
        "current": "precipitation,temperature_2m,apparent_temperature,wind_speed_10m",
        "hourly": "precipitation",
        "forecast_days": 1,
        "timezone": "Asia/Kolkata",
    }
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(BASE_URL, params=params)
            resp.raise_for_status()
            data = resp.json()

        current = data.get("current", {})
        hourly = data.get("hourly", {})
        hourly_precip = hourly.get("precipitation", [0.0] * 24)

        # Next 6 hours of forecast
        forecast_6hr = hourly_precip[:6] if len(hourly_precip) >= 6 else hourly_precip
        max_forecast = max(forecast_6hr) if forecast_6hr else 0.0
        breach_prob = sum(1 for p in forecast_6hr if p >= rain_threshold) / max(len(forecast_6hr), 1)

        return MeteoData(
            precipitation_mm_hr=current.get("precipitation", 0.0),
            temperature_2m=current.get("temperature_2m", 25.0),
            apparent_temperature=current.get("apparent_temperature", 25.0),
            wind_speed=current.get("wind_speed_10m", 0.0),
            forecast_rain_6hr=max_forecast,
            forecast_breach_prob=breach_prob,
        )
    except Exception:
        return MeteoData(
            precipitation_mm_hr=0.0,
            temperature_2m=28.0,
            apparent_temperature=28.0,
            wind_speed=5.0,
            forecast_rain_6hr=0.0,
            forecast_breach_prob=0.0,
        )


async def validate_event_with_history(
    lat: float,
    lng: float,
    event_type: str,
    observed_value: float,
    event_time: Optional[datetime] = None,
) -> WeatherValidation:
    """
    Validates event intensity against same-day historical series to detect fake-weather claims.
    Returns a conservative "consistent=True" on API failure to avoid false fraud flags.
    """
    if event_time is None:
        event_time = datetime.now(timezone.utc)

    # Mock mode cannot validate external weather provenance.
    if settings.mock_mode:
        return WeatherValidation(
            consistent=True,
            observed_value=observed_value,
            historical_peak=observed_value,
            ratio=1.0,
            reason="MOCK_MODE",
        )

    day = event_time.strftime("%Y-%m-%d")

    if event_type == "HEAVY_RAIN":
        hourly_field = "precipitation"
    elif event_type == "EXTREME_HEAT":
        hourly_field = "temperature_2m"
    else:
        return WeatherValidation(
            consistent=True,
            observed_value=observed_value,
            historical_peak=observed_value,
            ratio=1.0,
            reason="NOT_WEATHER_EVENT",
        )

    params = {
        "latitude": lat,
        "longitude": lng,
        "start_date": day,
        "end_date": day,
        "hourly": hourly_field,
        "timezone": "Asia/Kolkata",
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(ARCHIVE_URL, params=params)
            resp.raise_for_status()
            data = resp.json()

        series = data.get("hourly", {}).get(hourly_field, []) or [0.0]
        peak = max(float(v) for v in series)
        ratio = observed_value / max(peak, 1e-6)

        # Conservative anomaly threshold: reported intensity > 1.8x observed archive peak.
        consistent = ratio <= 1.8
        return WeatherValidation(
            consistent=consistent,
            observed_value=observed_value,
            historical_peak=round(peak, 3),
            ratio=round(ratio, 3),
            reason="OK" if consistent else "HISTORICAL_MISMATCH",
        )
    except Exception:
        return WeatherValidation(
            consistent=True,
            observed_value=observed_value,
            historical_peak=observed_value,
            ratio=1.0,
            reason="ARCHIVE_UNAVAILABLE",
        )
