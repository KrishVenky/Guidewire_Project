"""
XGBoost premium model training script.
Run once at startup (or manually) to generate premium_model.joblib.
Trained on synthetically seeded zone/worker data — the features correspond
exactly to the premium formula so the model learns realistic coefficients.
"""
import os
import numpy as np
import joblib
from pathlib import Path

MODEL_PATH = Path(__file__).parent / "premium_model.joblib"


def generate_training_data(n_samples: int = 5000):
    np.random.seed(42)

    base_rate = 35.0

    zone_mult = np.random.uniform(0.8, 1.4, n_samples)
    season = np.random.choice([0.9, 1.1, 1.5, 1.2, 0.95], n_samples,
                               p=[0.15, 0.25, 0.35, 0.1, 0.15])
    tenure = np.random.choice([1.0, 0.95, 0.90, 0.80], n_samples,
                               p=[0.4, 0.25, 0.2, 0.15])
    ev_factor = np.random.uniform(0.90, 1.25, n_samples)

    # Ground truth = formula + small noise (simulates real-world variance)
    y = base_rate * zone_mult * season * tenure * ev_factor
    y += np.random.normal(0, 1.5, n_samples)  # realistic variance
    y = np.clip(y, 20.0, 120.0)

    X = np.column_stack([zone_mult, season, tenure, ev_factor])
    return X, y


def train_and_save():
    try:
        from xgboost import XGBRegressor
        X, y = generate_training_data()

        model = XGBRegressor(
            n_estimators=200,
            max_depth=4,
            learning_rate=0.05,
            subsample=0.8,
            colsample_bytree=0.8,
            random_state=42,
            verbosity=0,
        )
        model.fit(X, y)
        joblib.dump(model, MODEL_PATH)
        print(f"[ML] Premium model trained and saved to {MODEL_PATH}")
    except Exception as e:
        print(f"[ML] Training failed: {e} — will use formula fallback")


if __name__ == "__main__":
    train_and_save()
