from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session
from database import get_db
import models
from services.config_generator import generate_init_lua, generate_shaping_toml
from routers.settings import get_setting

router = APIRouter(prefix="/api/config", tags=["Config"])


def _relay_hosts(db: Session) -> str:
    return get_setting(db, "relay_hosts") or "127.0.0.1,::1"


@router.get("/preview/init-lua", response_class=PlainTextResponse)
def preview_init_lua(db: Session = Depends(get_db)):
    ips = db.query(models.IPAddress).filter(models.IPAddress.is_active == True).all()
    dkim_keys = db.query(models.DKIMKey).filter(models.DKIMKey.is_active == True).all()
    return generate_init_lua(ips, dkim_keys, _relay_hosts(db))


@router.get("/preview/shaping-toml", response_class=PlainTextResponse)
def preview_shaping_toml(db: Session = Depends(get_db)):
    domain_rules = db.query(models.DomainRule).filter(models.DomainRule.is_active == True).all()
    return generate_shaping_toml(domain_rules)


@router.get("/export")
def export_config(db: Session = Depends(get_db)):
    ips = db.query(models.IPAddress).filter(models.IPAddress.is_active == True).all()
    dkim_keys = db.query(models.DKIMKey).filter(models.DKIMKey.is_active == True).all()
    domain_rules = db.query(models.DomainRule).filter(models.DomainRule.is_active == True).all()
    return {
        "init_lua": generate_init_lua(ips, dkim_keys, _relay_hosts(db)),
        "shaping_toml": generate_shaping_toml(domain_rules),
    }
