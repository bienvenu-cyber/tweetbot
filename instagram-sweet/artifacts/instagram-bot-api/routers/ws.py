"""
WebSocket endpoint for real-time bulk job status updates.
Clients connect to /bot-api/ws/bulk-jobs/{job_id} and receive JSON updates.
"""

import asyncio
import json
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from database import SessionLocal, BulkJob

logger = logging.getLogger("instagram_bot")
router = APIRouter()

# Global set of active WebSocket connections per job
_job_subscribers: dict[int, set[WebSocket]] = {}


async def broadcast_job_update(job_id: int, data: dict):
    """Broadcast a job update to all subscribers of that job."""
    subs = _job_subscribers.get(job_id, set())
    dead = set()
    for ws in subs:
        try:
            await ws.send_json(data)
        except Exception:
            dead.add(ws)
    _job_subscribers[job_id] = subs - dead


def get_job_snapshot(job_id: int) -> dict | None:
    db = SessionLocal()
    try:
        job = db.query(BulkJob).filter(BulkJob.id == job_id).first()
        if not job:
            return None
        return {
            "job_id": job.id,
            "status": job.status,
            "total": job.total,
            "processed": job.processed,
            "succeeded": job.succeeded,
            "failed": job.failed,
            "message": job.message,
        }
    finally:
        db.close()


@router.websocket("/ws/bulk-jobs/{job_id}")
async def ws_bulk_job(websocket: WebSocket, job_id: int):
    await websocket.accept()

    # Register subscriber
    if job_id not in _job_subscribers:
        _job_subscribers[job_id] = set()
    _job_subscribers[job_id].add(websocket)

    try:
        # Send initial snapshot
        snapshot = get_job_snapshot(job_id)
        if snapshot:
            await websocket.send_json(snapshot)
        else:
            await websocket.send_json({"error": "Job not found"})
            await websocket.close()
            return

        # Keep connection alive, polling for updates
        while True:
            # Also accept messages from client (e.g. ping/cancel)
            try:
                msg = await asyncio.wait_for(websocket.receive_text(), timeout=2.0)
                if msg == "cancel":
                    db = SessionLocal()
                    try:
                        job = db.query(BulkJob).filter(BulkJob.id == job_id).first()
                        if job and job.status == "running":
                            job.status = "cancelled"
                            db.commit()
                    finally:
                        db.close()
            except asyncio.TimeoutError:
                pass

            # Push latest state
            snapshot = get_job_snapshot(job_id)
            if snapshot:
                await websocket.send_json(snapshot)
                if snapshot["status"] in ("completed", "failed", "cancelled"):
                    await websocket.close()
                    break
            else:
                break

    except WebSocketDisconnect:
        pass
    finally:
        _job_subscribers.get(job_id, set()).discard(websocket)
