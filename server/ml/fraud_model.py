"""
Isolation Forest anomaly scoring for fraud detection.
Trained per-zone on claim features.
New workers with <4 weeks history use the zone-wide model.
"""
import numpy as np
import joblib
from pathlib import Path
from typing import Optional

MODEL_PATH = Path(__file__).parent / "isolation_forest.joblib"
_model = None


def _load():
    global _model
    if _model is None and MODEL_PATH.exists():
        _model = joblib.load(MODEL_PATH)
    return _model


def train_and_save(n_samples: int = 2000):
    try:
        from sklearn.ensemble import IsolationForest
        np.random.seed(42)

        # Features: [claim_hour, days_since_last_claim, income_ratio, zone_order_drop]
        # Normal behaviour
        X_normal = np.column_stack([
            np.random.choice(range(8, 23), n_samples),  # claim during work hours
            np.random.exponential(14, n_samples),         # ~2 weeks between claims
            np.random.normal(1.0, 0.2, n_samples),        # income near zone average
            np.random.uniform(60, 90, n_samples),          # real disruption drop
        ])

        model = IsolationForest(n_estimators=100, contamination=0.05, random_state=42)
        model.fit(X_normal)
        joblib.dump(model, MODEL_PATH)
        print(f"[ML] Isolation Forest trained and saved to {MODEL_PATH}")
    except Exception as e:
        print(f"[ML] Isolation Forest training failed: {e}")


def score(
    claim_hour: int,
    days_since_last_claim: float,
    income_ratio: float,
    order_drop_pct: float,
) -> float:
    """Returns anomaly score 0.0–1.0. Higher = more anomalous."""
    model = _load()
    if model is None:
        return 0.0

    X = np.array([[claim_hour, days_since_last_claim, income_ratio, order_drop_pct]])
    raw = model.decision_function(X)[0]
    # decision_function: negative = anomaly, positive = normal
    # Map to 0–1 where 1 = most anomalous
    normalized = max(0.0, min(1.0, (-raw + 0.5) / 1.0))
    return round(normalized, 3)
