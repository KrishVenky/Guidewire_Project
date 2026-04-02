import uuid
from sqlalchemy import Column, String, DateTime, Enum as SAEnum, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import enum
from database import Base


class TriggeredBy(str, enum.Enum):
    SYSTEM = "SYSTEM"
    ADMIN = "ADMIN"
    WORKER = "WORKER"


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    entity_type = Column(String, nullable=False)
    entity_id = Column(UUID(as_uuid=True), nullable=False)
    action = Column(String, nullable=False)
    old_value = Column(JSON, nullable=True)
    new_value = Column(JSON, nullable=True)
    triggered_by = Column(SAEnum(TriggeredBy), default=TriggeredBy.SYSTEM)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
