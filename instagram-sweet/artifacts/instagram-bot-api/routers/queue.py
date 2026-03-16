from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from database import get_db, QueueItem

router = APIRouter()


@router.get("")
def get_queue(db: Session = Depends(get_db)):
    items = db.query(QueueItem).order_by(QueueItem.created_at.desc()).all()
    result = []
    for item in items:
        result.append({
            "id": item.id,
            "action_type": item.action_type,
            "target": item.target,
            "payload": item.payload,
            "status": item.status,
            "scheduled_at": item.scheduled_at.isoformat() if item.scheduled_at else None,
            "created_at": item.created_at.isoformat() if item.created_at else None,
        })
    return {"items": result, "total": len(result)}


@router.delete("/{item_id}")
def delete_queue_item(item_id: int, db: Session = Depends(get_db)):
    item = db.query(QueueItem).filter(QueueItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Queue item not found")
    db.delete(item)
    db.commit()
    return {"success": True, "message": f"Queue item {item_id} deleted"}
