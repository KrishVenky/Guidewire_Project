from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Environment profile: development | staging | production
    app_env: str = "development"

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
    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    class Config:
        env_file = "../.env"
        env_file_encoding = "utf-8"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


def assert_runtime_safety(settings: Settings):
    """
    Block unsafe defaults in non-development environments.
    """
    if settings.app_env.lower() == "development":
        return

    unsafe_reasons = []
    if settings.secret_key == "change_this_in_production":
        unsafe_reasons.append("SECRET_KEY is using insecure default")
    if settings.admin_pin == "admin123":
        unsafe_reasons.append("ADMIN_PIN is using insecure default")
    if settings.auth_debug_return_otp:
        unsafe_reasons.append("AUTH_DEBUG_RETURN_OTP must be false")
    if settings.debug:
        unsafe_reasons.append("DEBUG must be false")
    if settings.mock_mode:
        unsafe_reasons.append("MOCK_MODE must be false")

    if unsafe_reasons:
        joined = "; ".join(unsafe_reasons)
        raise RuntimeError(f"Unsafe runtime configuration for {settings.app_env}: {joined}")
