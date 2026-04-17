import uuid
from typing import Any, Optional

from sqlalchemy.orm import Session

from models.audit_log import AuditLog, TriggeredBy


def log_event(
    db: Session,
    entity_type: str,
    entity_id: Optional[uuid.UUID],
    action: str,
    triggered_by: TriggeredBy,
    old_value: Optional[dict[str, Any]] = None,
    new_value: Optional[dict[str, Any]] = None,
):
    log = AuditLog(
        entity_type=entity_type,
        entity_id=entity_id or uuid.UUID(int=0),
        action=action,
        old_value=old_value,
        new_value=new_value,
        triggered_by=triggered_by,
    )
    db.add(log)
    db.commit()
