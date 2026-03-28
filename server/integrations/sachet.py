import httpx
import feedparser
from dataclasses import dataclass
from typing import List


@dataclass
class SACHETAlert:
    title: str
    severity: str  # "RED", "ORANGE", "YELLOW", "GREEN"
    district: str
    description: str


SACHET_RSS_URL = "https://sachet.ndma.gov.in/cap_public_website/FeedPage"
SEVERITY_KEYWORDS = {
    "RED": ["red alert", "extreme", "severe warning"],
    "ORANGE": ["orange alert", "heavy", "warning"],
    "YELLOW": ["yellow alert", "moderate", "watch"],
}


async def get_active_alerts(district: str) -> List[SACHETAlert]:
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(SACHET_RSS_URL)
            content = resp.text

        feed = feedparser.parse(content)
        alerts = []

        for entry in feed.entries:
            title = entry.get("title", "").lower()
            summary = entry.get("summary", "").lower()
            combined = title + " " + summary

            if district.lower() not in combined and "bengaluru" not in combined and "karnataka" not in combined:
                continue

            severity = "GREEN"
            for level, keywords in SEVERITY_KEYWORDS.items():
                if any(kw in combined for kw in keywords):
                    severity = level
                    break

            alerts.append(SACHETAlert(
                title=entry.get("title", ""),
                severity=severity,
                district=district,
                description=entry.get("summary", ""),
            ))

        return alerts
    except Exception:
        return []


def has_active_alert(alerts: List[SACHETAlert], min_severity: str = "ORANGE") -> bool:
    severity_rank = {"GREEN": 0, "YELLOW": 1, "ORANGE": 2, "RED": 3}
    threshold = severity_rank.get(min_severity, 2)
    return any(severity_rank.get(a.severity, 0) >= threshold for a in alerts)
