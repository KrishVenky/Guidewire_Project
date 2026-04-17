import pytest

from services.otp_service import OtpService, OtpError


def test_otp_request_and_verify_success():
    service = OtpService()

    otp = service.request_otp(phone="9000000001", worker_id="w-1", exp_minutes=5)
    assert len(otp) == 6
    result = service.verify_otp(phone="9000000001", otp=otp)
    assert result.worker_id == "w-1"


def test_otp_invalid_attempts_lockout():
    service = OtpService()
    _ = service.request_otp(phone="9000000002", worker_id="w-2", exp_minutes=5)

    for _ in range(5):
        with pytest.raises(OtpError) as exc:
            service.verify_otp(phone="9000000002", otp="000000")
        assert exc.value.status_code in {401, 429}

    with pytest.raises(OtpError) as exc2:
        service.verify_otp(phone="9000000002", otp="000000")
    assert exc2.value.status_code == 429
