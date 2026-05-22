from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
import models, schemas

router = APIRouter(prefix="/api/ips", tags=["IP Addresses"])


@router.get("/", response_model=List[schemas.IPAddressOut])
def list_ips(db: Session = Depends(get_db)):
    return db.query(models.IPAddress).order_by(models.IPAddress.created_at.desc()).all()


@router.post("/", response_model=schemas.IPAddressOut)
def create_ip(payload: schemas.IPAddressCreate, db: Session = Depends(get_db)):
    existing = db.query(models.IPAddress).filter(models.IPAddress.ip == payload.ip).first()
    if existing:
        raise HTTPException(status_code=400, detail="IP address already exists")
    ip = models.IPAddress(**payload.model_dump())
    db.add(ip)
    db.commit()
    db.refresh(ip)
    return ip


@router.get("/{ip_id}", response_model=schemas.IPAddressOut)
def get_ip(ip_id: int, db: Session = Depends(get_db)):
    ip = db.query(models.IPAddress).filter(models.IPAddress.id == ip_id).first()
    if not ip:
        raise HTTPException(status_code=404, detail="IP not found")
    return ip


@router.patch("/{ip_id}", response_model=schemas.IPAddressOut)
def update_ip(ip_id: int, payload: schemas.IPAddressUpdate, db: Session = Depends(get_db)):
    ip = db.query(models.IPAddress).filter(models.IPAddress.id == ip_id).first()
    if not ip:
        raise HTTPException(status_code=404, detail="IP not found")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(ip, field, value)
    db.commit()
    db.refresh(ip)
    return ip


@router.delete("/{ip_id}")
def delete_ip(ip_id: int, db: Session = Depends(get_db)):
    ip = db.query(models.IPAddress).filter(models.IPAddress.id == ip_id).first()
    if not ip:
        raise HTTPException(status_code=404, detail="IP not found")
    db.delete(ip)
    db.commit()
    return {"ok": True}


@router.get("/{ip_id}/rules", response_model=List[schemas.IPDomainRuleOut])
def get_ip_rules(ip_id: int, db: Session = Depends(get_db)):
    ip = db.query(models.IPAddress).filter(models.IPAddress.id == ip_id).first()
    if not ip:
        raise HTTPException(status_code=404, detail="IP not found")
    return ip.domain_rules


@router.post("/{ip_id}/rules", response_model=schemas.IPDomainRuleOut)
def add_ip_rule(ip_id: int, payload: schemas.IPDomainRuleCreate, db: Session = Depends(get_db)):
    payload.ip_id = ip_id
    rule = models.IPDomainRule(**payload.model_dump())
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule


@router.delete("/{ip_id}/rules/{rule_id}")
def delete_ip_rule(ip_id: int, rule_id: int, db: Session = Depends(get_db)):
    rule = db.query(models.IPDomainRule).filter(
        models.IPDomainRule.id == rule_id,
        models.IPDomainRule.ip_id == ip_id
    ).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    db.delete(rule)
    db.commit()
    return {"ok": True}
