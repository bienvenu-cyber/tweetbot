from fastapi import APIRouter, Depends, Query
from typing import Optional
from sqlalchemy.orm import Session
from database import get_db, LogEntry

router = APIRouter()


@router.get("")
def get_logs(
    db: Session = Depends(get_db),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    action_type: Optional[str] = Query(None),
):
    query = db.query(LogEntry)
    if action_type:
        query = query.filter(LogEntry.action_type == action_type)

    total = query.count()
    logs = query.order_by(LogEntry.created_at.desc()).offset(offset).limit(limit).all()

    result = []
    for log in logs:
        result.append({
            "id": log.id,
            "action_type": log.action_type,
            "target": log.target,
            "status": log.status,
            "message": log.message,
            "created_at": log.created_at.isoformat() if log.created_at else None,
        })
    return {"logs": result, "total": total}
