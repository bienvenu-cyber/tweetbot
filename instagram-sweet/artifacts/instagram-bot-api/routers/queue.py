from fastapi import APIRouter, HTTPException
import db_proxy

router = APIRouter()


@router.get("")
def get_queue():
    items = db_proxy.select("bot_queue", order="created_at.desc")
    result = []
    for item in items:
        result.append({
            "id": item.get("id"),
            "action_type": item.get("action_type"),
            "target": item.get("target"),
            "payload": item.get("payload"),
            "status": item.get("status"),
            "scheduled_at": item.get("scheduled_at"),
            "created_at": item.get("created_at"),
        })
    return {"items": result, "total": len(result)}


@router.delete("/{item_id}")
def delete_queue_item(item_id: int):
    row = db_proxy.select_one("bot_queue", item_id)
    if not row:
        raise HTTPException(status_code=404, detail="Queue item not found")
    db_proxy.delete("bot_queue", item_id)
    return {"success": True, "message": f"Queue item {item_id} deleted"}
