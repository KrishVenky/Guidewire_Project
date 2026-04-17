import hashlib
import hmac
import json
import secrets
import time
from dataclasses import dataclass
from typing import Optional

from config import get_settings

settings = get_settings()

try:
    import redis  # type: ignore
except Exception:
    redis = None


COOLDOWN_SECONDS = 30
MAX_VERIFY_ATTEMPTS = 5


@dataclass
class OtpVerifyResult:
    worker_id: str


class OtpError(Exception):
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


class OtpService:
    def __init__(self):
        self._memory_store: dict[str, dict] = {}
        self._redis_client = None

        if redis is not None:
            try:
                client = redis.Redis.from_url(
                    settings.redis_url,
                    decode_responses=True,
                    socket_connect_timeout=2,
                    socket_timeout=2,
                )
                client.ping()
                self._redis_client = client
            except Exception:
                self._redis_client = None

    def _key(self, phone: str) -> str:
        return f"otp:{phone}"

    def _now(self) -> int:
        return int(time.time())

    def _get_record(self, phone: str) -> Optional[dict]:
        if self._redis_client is not None:
            raw = self._redis_client.get(self._key(phone))
            return json.loads(raw) if raw else None
        return self._memory_store.get(phone)

    def _set_record(self, phone: str, record: dict, ttl_seconds: int):
        if self._redis_client is not None:
            self._redis_client.setex(self._key(phone), ttl_seconds, json.dumps(record))
            return
        self._memory_store[phone] = record

    def _delete_record(self, phone: str):
        if self._redis_client is not None:
            self._redis_client.delete(self._key(phone))
            return
        self._memory_store.pop(phone, None)

    def _hash_otp(self, otp: str, salt: str) -> str:
        return hashlib.sha256(f"{salt}:{otp}".encode("utf-8")).hexdigest()

    def request_otp(self, phone: str, worker_id: str, exp_minutes: int) -> str:
        now = self._now()
        existing = self._get_record(phone)
        if existing and now < existing.get("cooldown_until", 0):
            wait_seconds = existing["cooldown_until"] - now
            raise OtpError(f"OTP recently requested. Try again in {wait_seconds}s", status_code=429)

        otp = f"{secrets.randbelow(1_000_000):06d}"
        salt = secrets.token_hex(8)
        expires_at = now + (exp_minutes * 60)

        record = {
            "worker_id": worker_id,
            "otp_hash": self._hash_otp(otp, salt),
            "salt": salt,
            "expires_at": expires_at,
            "attempts": 0,
            "cooldown_until": now + COOLDOWN_SECONDS,
        }

        ttl_seconds = (exp_minutes * 60) + 120
        self._set_record(phone, record, ttl_seconds)
        return otp

    def verify_otp(self, phone: str, otp: str) -> OtpVerifyResult:
        now = self._now()
        record = self._get_record(phone)
        if not record:
            raise OtpError("OTP not requested", status_code=401)

        if now > int(record.get("expires_at", 0)):
            self._delete_record(phone)
            raise OtpError("OTP expired", status_code=401)

        attempts = int(record.get("attempts", 0))
        if attempts >= MAX_VERIFY_ATTEMPTS:
            self._delete_record(phone)
            raise OtpError("Too many invalid OTP attempts. Request a new OTP", status_code=429)

        expected_hash = record.get("otp_hash", "")
        provided_hash = self._hash_otp(otp, record.get("salt", ""))

        if not hmac.compare_digest(provided_hash, expected_hash):
            record["attempts"] = attempts + 1
            ttl_seconds = max(int(record.get("expires_at", now) - now), 60)
            self._set_record(phone, record, ttl_seconds)
            raise OtpError("Invalid OTP", status_code=401)

        worker_id = record.get("worker_id")
        self._delete_record(phone)
        if not worker_id:
            raise OtpError("OTP validation failed", status_code=401)

        return OtpVerifyResult(worker_id=worker_id)


otp_service = OtpService()
