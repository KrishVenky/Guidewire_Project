from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from auth import create_access_token
from config import get_settings
from database import get_db
from models.worker import Worker

router = APIRouter(prefix="/api/auth", tags=["auth"])
settings = get_settings()

_otp_store = {}


class WorkerOtpRequest(BaseModel):
    phone: str


class WorkerOtpVerify(BaseModel):
    phone: str
    otp: str


class AdminLoginRequest(BaseModel):
    pin: str


@router.post("/worker/request-otp")
def request_worker_otp(body: WorkerOtpRequest, db: Session = Depends(get_db)):
    phone = (body.phone or "").strip()
    if not phone.isdigit() or len(phone) != 10:
        raise HTTPException(status_code=400, detail="Enter a valid 10-digit mobile number")

    worker = db.query(Worker).filter(Worker.phone == phone).first()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")

    # Demo-safe OTP generation. Replace with SMS provider in production.
    otp = "123456"
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.otp_exp_minutes)
    _otp_store[phone] = {"otp": otp, "worker_id": str(worker.id), "expires_at": expires_at}

    response = {"sent": True, "expires_in_minutes": settings.otp_exp_minutes}
    if settings.auth_debug_return_otp:
        response["debug_otp"] = otp
    return response


@router.post("/worker/verify-otp")
def verify_worker_otp(body: WorkerOtpVerify, db: Session = Depends(get_db)):
    record = _otp_store.get(body.phone)
    if not record:
        raise HTTPException(status_code=401, detail="OTP not requested")

    if datetime.now(timezone.utc) > record["expires_at"]:
        _otp_store.pop(body.phone, None)
        raise HTTPException(status_code=401, detail="OTP expired")

    if body.otp != record["otp"]:
        raise HTTPException(status_code=401, detail="Invalid OTP")

    worker_id = UUID(record["worker_id"])
    worker = db.query(Worker).filter(Worker.id == worker_id).first()
    if not worker:
        raise HTTPException(status_code=404, detail="Worker not found")

    _otp_store.pop(body.phone, None)
    token = create_access_token(role="worker", worker_id=worker.id)
    return {
        "access_token": token,
        "token_type": "bearer",
        "role": "worker",
        "worker": worker,
    }


@router.post("/admin/login")
def admin_login(body: AdminLoginRequest):
    if body.pin != settings.admin_pin:
        raise HTTPException(status_code=401, detail="Invalid admin credentials")
    token = create_access_token(role="admin")
    return {"access_token": token, "token_type": "bearer", "role": "admin"}
