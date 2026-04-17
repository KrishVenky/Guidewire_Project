from sqlalchemy import create_engine, inspect, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from config import get_settings

settings = get_settings()

engine = create_engine(
    settings.database_url,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def _sync_existing_schema():
    """Apply lightweight, idempotent dev-time schema updates for existing DB volumes."""
    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())

    with engine.begin() as conn:
        if "workers" in table_names:
            existing_worker_columns = {col["name"] for col in inspector.get_columns("workers")}
            if "pii_retention_until" not in existing_worker_columns:
                conn.execute(text("ALTER TABLE workers ADD COLUMN IF NOT EXISTS pii_retention_until TIMESTAMPTZ"))
            if "deletion_requested_at" not in existing_worker_columns:
                conn.execute(text("ALTER TABLE workers ADD COLUMN IF NOT EXISTS deletion_requested_at TIMESTAMPTZ"))
            if "deletion_request_reason" not in existing_worker_columns:
                conn.execute(text("ALTER TABLE workers ADD COLUMN IF NOT EXISTS deletion_request_reason VARCHAR"))
            if "deletion_request_status" not in existing_worker_columns:
                conn.execute(text("ALTER TABLE workers ADD COLUMN IF NOT EXISTS deletion_request_status VARCHAR DEFAULT 'NONE'"))
            if "deleted_at" not in existing_worker_columns:
                conn.execute(text("ALTER TABLE workers ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ"))
            if "preferred_language" not in existing_worker_columns:
                conn.execute(text("ALTER TABLE workers ADD COLUMN IF NOT EXISTS preferred_language VARCHAR DEFAULT 'en'"))
            if "whatsapp_opt_in" not in existing_worker_columns:
                conn.execute(text("ALTER TABLE workers ADD COLUMN IF NOT EXISTS whatsapp_opt_in BOOLEAN DEFAULT TRUE"))
            if "sms_opt_in" not in existing_worker_columns:
                conn.execute(text("ALTER TABLE workers ADD COLUMN IF NOT EXISTS sms_opt_in BOOLEAN DEFAULT TRUE"))
            if "email_opt_in" not in existing_worker_columns:
                conn.execute(text("ALTER TABLE workers ADD COLUMN IF NOT EXISTS email_opt_in BOOLEAN DEFAULT FALSE"))
            if "proactive_alerts_opt_in" not in existing_worker_columns:
                conn.execute(text("ALTER TABLE workers ADD COLUMN IF NOT EXISTS proactive_alerts_opt_in BOOLEAN DEFAULT TRUE"))
            if "quiet_hours_start" not in existing_worker_columns:
                conn.execute(text("ALTER TABLE workers ADD COLUMN IF NOT EXISTS quiet_hours_start INTEGER"))
            if "quiet_hours_end" not in existing_worker_columns:
                conn.execute(text("ALTER TABLE workers ADD COLUMN IF NOT EXISTS quiet_hours_end INTEGER"))

        if "policies" in table_names:
            existing_policy_columns = {col["name"] for col in inspector.get_columns("policies")}
            if "terms_accepted_at" not in existing_policy_columns:
                conn.execute(text("ALTER TABLE policies ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ"))
            if "privacy_accepted_at" not in existing_policy_columns:
                conn.execute(text("ALTER TABLE policies ADD COLUMN IF NOT EXISTS privacy_accepted_at TIMESTAMPTZ"))
            if "consent_artifact" not in existing_policy_columns:
                conn.execute(text("ALTER TABLE policies ADD COLUMN IF NOT EXISTS consent_artifact JSON"))
            if "consent_receipt_hash" not in existing_policy_columns:
                conn.execute(text("ALTER TABLE policies ADD COLUMN IF NOT EXISTS consent_receipt_hash VARCHAR"))
            if "activation_source" not in existing_policy_columns:
                conn.execute(
                    text(
                        "ALTER TABLE policies ADD COLUMN IF NOT EXISTS activation_source VARCHAR DEFAULT 'DASHBOARD'"
                    )
                )

        if "claims" in table_names:
            existing_claim_columns = {col["name"] for col in inspector.get_columns("claims")}
            if "event_started_at" not in existing_claim_columns:
                conn.execute(text("ALTER TABLE claims ADD COLUMN IF NOT EXISTS event_started_at TIMESTAMPTZ"))
            if "event_ended_at" not in existing_claim_columns:
                conn.execute(text("ALTER TABLE claims ADD COLUMN IF NOT EXISTS event_ended_at TIMESTAMPTZ"))
            if "duration_hours" not in existing_claim_columns:
                conn.execute(text("ALTER TABLE claims ADD COLUMN IF NOT EXISTS duration_hours DOUBLE PRECISION DEFAULT 0.0"))
            if "filed_at" not in existing_claim_columns:
                conn.execute(text("ALTER TABLE claims ADD COLUMN IF NOT EXISTS filed_at TIMESTAMPTZ DEFAULT now()"))
            if "evidence_receipt_hash" not in existing_claim_columns:
                conn.execute(text("ALTER TABLE claims ADD COLUMN IF NOT EXISTS evidence_receipt_hash VARCHAR"))
            if "evidence_payload" not in existing_claim_columns:
                conn.execute(text("ALTER TABLE claims ADD COLUMN IF NOT EXISTS evidence_payload JSON"))
            if "decision_reason_code" not in existing_claim_columns:
                conn.execute(text("ALTER TABLE claims ADD COLUMN IF NOT EXISTS decision_reason_code VARCHAR"))
            if "worker_zone_at_event_start" not in existing_claim_columns:
                conn.execute(text("ALTER TABLE claims ADD COLUMN IF NOT EXISTS worker_zone_at_event_start UUID"))


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    from models import worker, zone, policy, claim, payout, disruption_event, audit_log  # noqa
    Base.metadata.create_all(bind=engine)
    _sync_existing_schema()
