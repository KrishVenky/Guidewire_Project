import numpy as np
import joblib
from pathlib import Path

MODEL_PATH = Path(__file__).parent / "premium_model.joblib"
_model = None


def _load():
    global _model
    if _model is None and MODEL_PATH.exists():
        _model = joblib.load(MODEL_PATH)
    return _model


def predict(
    base_rate: float,
    zone_multiplier: float,
    season_factor: float,
    tenure_discount: float,
    earnings_velocity_factor: float,
) -> float:
    model = _load()
    if model is None:
        raise RuntimeError("Model not loaded")

    X = np.array([[zone_multiplier, season_factor, tenure_discount, earnings_velocity_factor]])
    prediction = float(model.predict(X)[0])
    return max(prediction, 20.0)
