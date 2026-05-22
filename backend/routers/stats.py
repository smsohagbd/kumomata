from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
import models
import httpx
import os

router = APIRouter(prefix="/api/stats", tags=["Stats"])

KUMOMTA_API = os.getenv("KUMOMTA_API", "http://127.0.0.1:8001")


async def fetch_kumomta(path: str):
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{KUMOMTA_API}{path}")
            resp.raise_for_status()
            return resp.json()
    except Exception:
        return None


@router.get("/overview")
async def overview(db: Session = Depends(get_db)):
    total_ips = db.query(models.IPAddress).count()
    active_ips = db.query(models.IPAddress).filter(models.IPAddress.is_active == True).count()
    total_domains = db.query(models.DomainRule).count()
    total_dkim = db.query(models.DKIMKey).filter(models.DKIMKey.is_active == True).count()

    kumomta_metrics = await fetch_kumomta("/metrics")

    return {
        "total_ips": total_ips,
        "active_ips": active_ips,
        "total_domain_rules": total_domains,
        "active_dkim_keys": total_dkim,
        "kumomta_online": kumomta_metrics is not None,
        "kumomta_metrics": kumomta_metrics,
    }


@router.get("/queues")
async def queue_stats():
    data = await fetch_kumomta("/api/v1/queue")
    if data is None:
        return {"error": "KumoMTA not reachable", "queues": []}
    return data


@router.get("/metrics")
async def raw_metrics():
    data = await fetch_kumomta("/metrics")
    if data is None:
        raise HTTPException(status_code=503, detail="KumoMTA not reachable")
    return data
