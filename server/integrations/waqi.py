import httpx
from dataclasses import dataclass
from config import get_settings

settings = get_settings()


@dataclass
class AQIData:
    aqi: float
    dominant_pollutant: str
    pm25: float
    pm10: float


async def get_current(station_id: str) -> AQIData:
    if not settings.waqi_api_token or not station_id:
        return AQIData(aqi=80.0, dominant_pollutant="pm25", pm25=45.0, pm10=60.0)

    url = f"https://api.waqi.info/feed/{station_id}/?token={settings.waqi_api_token}"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()

        if data.get("status") != "ok":
            return AQIData(aqi=80.0, dominant_pollutant="pm25", pm25=45.0, pm10=60.0)

        d = data["data"]
        iaqi = d.get("iaqi", {})
        return AQIData(
            aqi=float(d.get("aqi", 80)),
            dominant_pollutant=d.get("dominentpol", "pm25"),
            pm25=float(iaqi.get("pm25", {}).get("v", 45.0)),
            pm10=float(iaqi.get("pm10", {}).get("v", 60.0)),
        )
    except Exception:
        return AQIData(aqi=80.0, dominant_pollutant="pm25", pm25=45.0, pm10=60.0)
