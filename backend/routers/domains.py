from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from database import get_db
import models, schemas

router = APIRouter(prefix="/api/domains", tags=["Domain Rules"])

PRESET_DOMAINS = {
    "gmail.com": {"max_per_minute": 20, "max_per_hour": 500, "max_per_day": 5000, "max_connections": 20},
    "yahoo.com": {"max_per_minute": 10, "max_per_hour": 300, "max_per_day": 3000, "max_connections": 10},
    "outlook.com": {"max_per_minute": 15, "max_per_hour": 400, "max_per_day": 4000, "max_connections": 15},
    "hotmail.com": {"max_per_minute": 15, "max_per_hour": 400, "max_per_day": 4000, "max_connections": 15},
    "aol.com": {"max_per_minute": 8, "max_per_hour": 200, "max_per_day": 2000, "max_connections": 8},
}


@router.get("/presets")
def get_presets():
    return PRESET_DOMAINS


@router.get("/", response_model=List[schemas.DomainRuleOut])
def list_domains(db: Session = Depends(get_db)):
    return db.query(models.DomainRule).order_by(models.DomainRule.domain).all()


@router.post("/", response_model=schemas.DomainRuleOut)
def create_domain(payload: schemas.DomainRuleCreate, db: Session = Depends(get_db)):
    existing = db.query(models.DomainRule).filter(models.DomainRule.domain == payload.domain).first()
    if existing:
        raise HTTPException(status_code=400, detail="Domain rule already exists")
    rule = models.DomainRule(**payload.model_dump())
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule


@router.post("/preset/{domain_name}", response_model=schemas.DomainRuleOut)
def create_from_preset(domain_name: str, db: Session = Depends(get_db)):
    if domain_name not in PRESET_DOMAINS:
        raise HTTPException(status_code=404, detail="Preset not found")
    existing = db.query(models.DomainRule).filter(models.DomainRule.domain == domain_name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Domain rule already exists")
    data = PRESET_DOMAINS[domain_name]
    rule = models.DomainRule(domain=domain_name, **data)
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule


@router.get("/{domain_id}", response_model=schemas.DomainRuleOut)
def get_domain(domain_id: int, db: Session = Depends(get_db)):
    rule = db.query(models.DomainRule).filter(models.DomainRule.id == domain_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Domain rule not found")
    return rule


@router.patch("/{domain_id}", response_model=schemas.DomainRuleOut)
def update_domain(domain_id: int, payload: schemas.DomainRuleUpdate, db: Session = Depends(get_db)):
    rule = db.query(models.DomainRule).filter(models.DomainRule.id == domain_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Domain rule not found")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(rule, field, value)
    db.commit()
    db.refresh(rule)
    return rule


@router.delete("/{domain_id}")
def delete_domain(domain_id: int, db: Session = Depends(get_db)):
    rule = db.query(models.DomainRule).filter(models.DomainRule.id == domain_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Domain rule not found")
    db.delete(rule)
    db.commit()
    return {"ok": True}
