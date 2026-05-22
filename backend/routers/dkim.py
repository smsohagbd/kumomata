from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
import models, schemas
from services.dkim_service import generate_dkim_keypair, build_dns_record

router = APIRouter(prefix="/api/dkim", tags=["DKIM"])


@router.get("/", response_model=List[schemas.DKIMKeyOut])
def list_keys(db: Session = Depends(get_db)):
    return db.query(models.DKIMKey).order_by(models.DKIMKey.created_at.desc()).all()


@router.post("/generate", response_model=schemas.DKIMKeyOut)
def generate_key(payload: schemas.DKIMKeyCreate, db: Session = Depends(get_db)):
    existing = db.query(models.DKIMKey).filter(
        models.DKIMKey.domain == payload.domain,
        models.DKIMKey.selector == payload.selector,
        models.DKIMKey.is_active == True,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Active DKIM key already exists for this domain/selector")

    private_key, public_key = generate_dkim_keypair()
    dns_record = build_dns_record(payload.selector, payload.domain, public_key)

    key = models.DKIMKey(
        domain=payload.domain,
        selector=payload.selector,
        private_key=private_key,
        public_key=public_key,
        dns_record=dns_record,
    )
    db.add(key)
    db.commit()
    db.refresh(key)
    return key


@router.get("/{key_id}", response_model=schemas.DKIMKeyOut)
def get_key(key_id: int, db: Session = Depends(get_db)):
    key = db.query(models.DKIMKey).filter(models.DKIMKey.id == key_id).first()
    if not key:
        raise HTTPException(status_code=404, detail="DKIM key not found")
    return key


@router.delete("/{key_id}")
def delete_key(key_id: int, db: Session = Depends(get_db)):
    key = db.query(models.DKIMKey).filter(models.DKIMKey.id == key_id).first()
    if not key:
        raise HTTPException(status_code=404, detail="DKIM key not found")
    db.delete(key)
    db.commit()
    return {"ok": True}
