from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db, DATABASE_URL, DB_TYPE
import models, schemas

router = APIRouter(prefix="/api/settings", tags=["Settings"])

DEFAULTS = {
    "kumomta_host": "127.0.0.1",
    "kumomta_port": "25",
    "kumomta_api_port": "8001",
    "config_dir": "/opt/kumomta/etc/policy",
    # Comma-separated list of allowed relay IPs/CIDRs, or "0.0.0.0/0" for anywhere
    "relay_hosts": "127.0.0.1,::1",
}


def get_setting(db: Session, key: str) -> str:
    row = db.query(models.AppSettings).filter(models.AppSettings.key == key).first()
    return row.value if row else DEFAULTS.get(key, "")


def set_setting(db: Session, key: str, value: str):
    row = db.query(models.AppSettings).filter(models.AppSettings.key == key).first()
    if row:
        row.value = value
    else:
        row = models.AppSettings(key=key, value=value)
        db.add(row)
    db.commit()


@router.get("/")
def get_settings(db: Session = Depends(get_db)):
    return {
        "kumomta_host": get_setting(db, "kumomta_host"),
        "kumomta_port": int(get_setting(db, "kumomta_port") or 25),
        "kumomta_api_port": int(get_setting(db, "kumomta_api_port") or 8001),
        "config_dir": get_setting(db, "config_dir"),
        "relay_hosts": get_setting(db, "relay_hosts"),
    }


@router.post("/")
def update_settings(payload: schemas.SettingsUpdate, db: Session = Depends(get_db)):
    data = payload.model_dump(exclude_none=True)
    for key, value in data.items():
        set_setting(db, key, str(value))
    return {"ok": True}


@router.get("/relay-hosts")
def get_relay_hosts(db: Session = Depends(get_db)):
    raw = get_setting(db, "relay_hosts")
    return {"relay_hosts": [h.strip() for h in raw.split(",") if h.strip()]}


@router.get("/database-info")
def database_info():
    """Return current database type and masked connection URL."""
    # Mask password in URL for safe display
    safe_url = DATABASE_URL
    if "@" in DATABASE_URL:
        # mysql+pymysql://user:PASS@host/db → mysql+pymysql://user:***@host/db
        parts = DATABASE_URL.split("@")
        creds = parts[0].split("://")[1] if "://" in parts[0] else parts[0]
        if ":" in creds:
            user = creds.split(":")[0]
            protocol = parts[0].split("://")[0]
            safe_url = f"{protocol}://{user}:***@{'@'.join(parts[1:])}"

    return {
        "db_type": DB_TYPE,
        "url_display": safe_url,
        "drivers": {
            "sqlite": "built-in (no driver needed)",
            "mysql": "pip install pymysql",
            "postgresql": "pip install psycopg2-binary",
        }
    }
