from fastapi import APIRouter, Depends, Query
from typing import Optional
import db_proxy

router = APIRouter()


@router.get("")
def get_logs(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    action_type: Optional[str] = Query(None),
):
    filters = {}
    if action_type:
        filters["action_type"] = action_type

    all_rows = db_proxy.select("bot_logs", filters=filters, order="created_at.desc", limit=limit, offset=offset)
    total = db_proxy.count("bot_logs", filters=filters if filters else None)

    result = []
    for log in all_rows:
        result.append({
            "id": log.get("id"),
            "action_type": log.get("action_type"),
            "target": log.get("target"),
            "status": log.get("status"),
            "message": log.get("message"),
            "created_at": log.get("created_at"),
        })
    return {"logs": result, "total": total}
