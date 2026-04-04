from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Runtime mode
    mock_mode: bool = True

    # Database
    database_url: str = "postgresql://rainready:rainready@localhost:5432/rainready"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # LLM (optional — app falls back to templates if not set)
    groq_api_key: str = ""
    groq_model: str = "llama-3.1-8b-instant"

    # External APIs
    waqi_api_token: str = ""
    # Open-Meteo: no key required

    # Razorpay mock
    razorpay_key_id: str = "mock_key"
    razorpay_key_secret: str = "mock_secret"

    # App
    secret_key: str = "change_this_in_production"
    jwt_exp_minutes: int = 480
    otp_exp_minutes: int = 5
    admin_pin: str = "admin123"
    auth_debug_return_otp: bool = True
    debug: bool = True
    mock_mode: bool = True
    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    class Config:
        env_file = "../.env"
        env_file_encoding = "utf-8"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
