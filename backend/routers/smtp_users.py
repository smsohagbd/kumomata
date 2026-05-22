import hashlib
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import get_db
import models

router = APIRouter(prefix="/api/smtp-users", tags=["SMTP Users"])


def _hash(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()


class SmtpUserCreate(BaseModel):
    username: str
    password: str
    description: Optional[str] = None
    is_active: bool = True


class SmtpUserOut(BaseModel):
    id: int
    username: str
    description: Optional[str]
    is_active: bool
    created_at: Optional[str]

    class Config:
        from_attributes = True


class VerifyRequest(BaseModel):
    username: str
    password: str


@router.get("", response_model=List[SmtpUserOut])
def list_users(db: Session = Depends(get_db)):
    return db.query(models.SmtpUser).order_by(models.SmtpUser.created_at.desc()).all()


@router.post("", response_model=SmtpUserOut)
def create_user(data: SmtpUserCreate, db: Session = Depends(get_db)):
    existing = db.query(models.SmtpUser).filter(models.SmtpUser.username == data.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    user = models.SmtpUser(
        username=data.username,
        password_hash=_hash(data.password),
        description=data.description,
        is_active=data.is_active,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.put("/{user_id}", response_model=SmtpUserOut)
def update_user(user_id: int, data: SmtpUserCreate, db: Session = Depends(get_db)):
    user = db.query(models.SmtpUser).filter(models.SmtpUser.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.username = data.username
    if data.password:
        user.password_hash = _hash(data.password)
    user.description = data.description
    user.is_active = data.is_active
    db.commit()
    db.refresh(user)
    return user


@router.delete("/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(models.SmtpUser).filter(models.SmtpUser.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()
    return {"ok": True}


@router.post("/verify")
def verify_credentials(data: VerifyRequest, db: Session = Depends(get_db)):
    """Called by KumoMTA Lua to validate SMTP AUTH credentials."""
    user = (
        db.query(models.SmtpUser)
        .filter(models.SmtpUser.username == data.username, models.SmtpUser.is_active == True)
        .first()
    )
    if user and user.password_hash == _hash(data.password):
        return {"ok": True}
    return {"ok": False}
