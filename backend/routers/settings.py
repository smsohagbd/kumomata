from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
import models, schemas

router = APIRouter(prefix="/api/settings", tags=["Settings"])

DEFAULTS = {
    "kumomta_host": "127.0.0.1",
    "kumomta_port": "25",
    "kumomta_api_port": "8001",
    "config_dir": "/opt/kumomta/etc/policy",
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


@router.get("/", response_model=schemas.SettingsOut)
def get_settings(db: Session = Depends(get_db)):
    return schemas.SettingsOut(
        kumomta_host=get_setting(db, "kumomta_host"),
        kumomta_port=int(get_setting(db, "kumomta_port") or 25),
        kumomta_api_port=int(get_setting(db, "kumomta_api_port") or 8000),
        config_dir=get_setting(db, "config_dir"),
    )


@router.post("/")
def update_settings(payload: schemas.SettingsUpdate, db: Session = Depends(get_db)):
    data = payload.model_dump(exclude_none=True)
    for key, value in data.items():
        set_setting(db, key, str(value))
    return {"ok": True}
