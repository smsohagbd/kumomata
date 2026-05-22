from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from database import get_db
import models

router = APIRouter(prefix="/api/suppressions", tags=["Suppressions"])


class SuppressCreate(BaseModel):
    email: str
    reason: Optional[str] = "Manually added"


@router.get("")
def list_suppressions(db: Session = Depends(get_db)):
    rows = db.query(models.SuppressedEmail).order_by(models.SuppressedEmail.created_at.desc()).all()
    return [
        {
            "id": r.id,
            "email": r.email,
            "reason": r.reason,
            "bounce_code": r.bounce_code,
            "source": r.source,
            "created_at": r.created_at.isoformat() if r.created_at else "",
        }
        for r in rows
    ]


@router.get("/check")
def check_suppressed(email: str, db: Session = Depends(get_db)):
    """Used by KumoMTA Lua to check if a recipient is suppressed."""
    row = db.query(models.SuppressedEmail).filter(
        models.SuppressedEmail.email == email.lower().strip()
    ).first()
    return {"suppressed": row is not None, "reason": row.reason if row else ""}


@router.post("")
def add_suppression(body: SuppressCreate, db: Session = Depends(get_db)):
    email = body.email.lower().strip()
    existing = db.query(models.SuppressedEmail).filter(
        models.SuppressedEmail.email == email
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Already suppressed")
    row = models.SuppressedEmail(email=email, reason=body.reason, source="manual")
    db.add(row)
    db.commit()
    db.refresh(row)
    return {"ok": True, "id": row.id}


@router.delete("/{suppression_id}")
def remove_suppression(suppression_id: int, db: Session = Depends(get_db)):
    row = db.query(models.SuppressedEmail).filter(
        models.SuppressedEmail.id == suppression_id
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(row)
    db.commit()
    return {"ok": True}
