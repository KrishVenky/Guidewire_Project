"""
Dynamic premium calculator.
Uses XGBoost model if available, falls back to formula.
"""
import os
import math
from datetime import date
from dataclasses import dataclass
from typing import Optional

BASE_RATE = 35.0
MAX_COVERAGE = 1500.0

# Bengaluru season calendar
SEASON_FACTORS = {
    (1, 2): 0.9,
    (3, 4, 5): 1.1,
    (6, 7, 8, 9): 1.5,
    (10,): 1.2,
    (11, 12): 0.95,
}


@dataclass
class PremiumBreakdown:
    base_rate: float
    zone_multiplier: float
    season_factor: float
    tenure_discount: float
    earnings_velocity_factor: float
    weekly_premium: float
    coverage_amount: float


def _season_factor(month: int) -> float:
    for months, factor in SEASON_FACTORS.items():
        if month in months:
            return factor
    return 1.0


def _zone_multiplier(flood_risk: float, heat_risk: float, aqi_risk: float) -> float:
    weighted = flood_risk * 0.5 + heat_risk * 0.3 + aqi_risk * 0.2
    return round(0.8 + weighted * 0.6, 3)  # maps 0.0–1.0 → 0.8–1.4


def _tenure_discount(tenure_weeks: int) -> float:
    if tenure_weeks < 13:
        return 1.0
    if tenure_weeks < 26:
        return 0.95
    if tenure_weeks < 52:
        return 0.90
    return 0.80


def _earnings_velocity_factor(avg_weekly_income: float, zone_median: float = 3500.0) -> float:
    ratio = avg_weekly_income / max(zone_median, 1)
    if ratio < 0.8:
        return 0.90
    if ratio < 1.2:
        return 1.00
    if ratio < 1.5:
        return 1.10
    if ratio < 2.0:
        return 1.15
    return 1.25


def calculate(
    avg_weekly_income: float,
    declared_weekly_hours: int,
    tenure_weeks: int,
    flood_risk_score: float,
    heat_risk_score: float,
    aqi_risk_score: float,
    month: Optional[int] = None,
    zone_median_income: float = 3500.0,
) -> PremiumBreakdown:
    if month is None:
        month = date.today().month

    zone_mult = _zone_multiplier(flood_risk_score, heat_risk_score, aqi_risk_score)
    season = _season_factor(month)
    tenure = _tenure_discount(tenure_weeks)
    ev_factor = _earnings_velocity_factor(avg_weekly_income, zone_median_income)

    # Try XGBoost model first
    try:
        from ..ml.premium_model import predict
        weekly_premium = predict(
            base_rate=BASE_RATE,
            zone_multiplier=zone_mult,
            season_factor=season,
            tenure_discount=tenure,
            earnings_velocity_factor=ev_factor,
        )
    except Exception:
        weekly_premium = BASE_RATE * zone_mult * season * tenure * ev_factor

    weekly_premium = round(max(weekly_premium, 20.0), 2)

    hourly_rate = avg_weekly_income / max(declared_weekly_hours, 1)
    coverage_amount = min(avg_weekly_income * 0.6, MAX_COVERAGE)

    return PremiumBreakdown(
        base_rate=BASE_RATE,
        zone_multiplier=zone_mult,
        season_factor=season,
        tenure_discount=tenure,
        earnings_velocity_factor=ev_factor,
        weekly_premium=weekly_premium,
        coverage_amount=round(coverage_amount, 2),
    )


def compute_payout(
    payout_tier: str,
    claimed_hours: float,
    avg_weekly_income: float,
    declared_weekly_hours: int,
    coverage_amount: float,
) -> float:
    tier_multipliers = {
        "NONE": 0.0,
        "HALF": 0.5,
        "THREE_QUARTER": 0.75,
        "FULL": 1.0,
    }
    mult = tier_multipliers.get(payout_tier, 0.0)
    hourly_rate = avg_weekly_income / max(declared_weekly_hours, 1)
    raw_payout = hourly_rate * claimed_hours * mult
    return round(min(raw_payout, coverage_amount), 2)
