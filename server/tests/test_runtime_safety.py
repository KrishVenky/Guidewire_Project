import pytest

from config import Settings, assert_runtime_safety


def test_runtime_safety_blocks_insecure_prod_defaults():
    settings = Settings(
        app_env="production",
        secret_key="change_this_in_production",
        admin_pin="admin123",
        auth_debug_return_otp=True,
        debug=True,
        mock_mode=True,
    )

    with pytest.raises(RuntimeError):
        assert_runtime_safety(settings)


def test_runtime_safety_allows_secure_prod_config():
    settings = Settings(
        app_env="production",
        secret_key="super_secret_key_123",
        admin_pin="A1b2C3d4E5f6",
        auth_debug_return_otp=False,
        debug=False,
        mock_mode=False,
    )

    assert_runtime_safety(settings)
