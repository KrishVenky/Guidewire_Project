from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

from config import get_settings

settings = get_settings()
bearer_scheme = HTTPBearer(auto_error=False)


class AuthPrincipal(BaseModel):
    role: str
    worker_id: Optional[UUID] = None


def create_access_token(role: str, worker_id: Optional[UUID] = None) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": role,
        "role": role,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=settings.jwt_exp_minutes)).timestamp()),
    }
    if worker_id:
        payload["worker_id"] = str(worker_id)
    return jwt.encode(payload, settings.secret_key, algorithm="HS256")


def _unauthorized(detail: str = "Not authenticated") -> HTTPException:
    return HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=detail)


def get_current_principal(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> AuthPrincipal:
    if not credentials or not credentials.credentials:
        raise _unauthorized()
    token = credentials.credentials
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=["HS256"])
    except Exception:
        raise _unauthorized("Invalid or expired token")

    role = payload.get("role")
    if role not in {"worker", "admin"}:
        raise _unauthorized("Invalid token role")

    worker_id_raw = payload.get("worker_id")
    worker_id = None
    if worker_id_raw:
        try:
            worker_id = UUID(worker_id_raw)
        except ValueError:
            raise _unauthorized("Invalid worker token")

    return AuthPrincipal(role=role, worker_id=worker_id)


def require_admin(principal: AuthPrincipal = Depends(get_current_principal)) -> AuthPrincipal:
    if principal.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return principal


def require_worker(principal: AuthPrincipal = Depends(get_current_principal)) -> AuthPrincipal:
    if principal.role != "worker" or not principal.worker_id:
        raise HTTPException(status_code=403, detail="Worker access required")
    return principal


def require_worker_or_admin(principal: AuthPrincipal = Depends(get_current_principal)) -> AuthPrincipal:
    if principal.role not in {"worker", "admin"}:
        raise HTTPException(status_code=403, detail="Access denied")
    return principal
