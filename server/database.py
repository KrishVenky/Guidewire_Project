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
        if "policies" in table_names:
            existing_policy_columns = {col["name"] for col in inspector.get_columns("policies")}
            if "terms_accepted_at" not in existing_policy_columns:
                conn.execute(text("ALTER TABLE policies ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ"))
            if "privacy_accepted_at" not in existing_policy_columns:
                conn.execute(text("ALTER TABLE policies ADD COLUMN IF NOT EXISTS privacy_accepted_at TIMESTAMPTZ"))
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
