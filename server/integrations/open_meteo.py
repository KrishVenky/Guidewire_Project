import httpx
from dataclasses import dataclass
from typing import Optional


@dataclass
class MeteoData:
    precipitation_mm_hr: float
    temperature_2m: float
    apparent_temperature: float
    wind_speed: float
    forecast_rain_6hr: float  # max in next 6 hours
    forecast_breach_prob: float  # 0.0–1.0 probability of exceeding threshold in 6hr


BASE_URL = "https://api.open-meteo.com/v1/forecast"


async def get_current(lat: float, lng: float, rain_threshold: float = 50.0) -> MeteoData:
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
