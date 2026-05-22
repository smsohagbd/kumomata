from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

DB_PATH = os.getenv("DB_PATH", "kumomta_panel.db")
DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    from models import Base as ModelsBase
    ModelsBase.metadata.create_all(bind=engine)
    _migrate()


def _migrate():
    """Add new columns to existing tables without losing data."""
    from sqlalchemy import text
    with engine.connect() as conn:
        migrations = [
            "ALTER TABLE ip_addresses ADD COLUMN hostname VARCHAR",
            """CREATE TABLE IF NOT EXISTS email_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_type VARCHAR NOT NULL,
                message_id VARCHAR,
                sender VARCHAR,
                recipient VARCHAR,
                queue VARCHAR,
                site VARCHAR,
                response_code INTEGER,
                response_message VARCHAR,
                peer_ip VARCHAR,
                egress_pool VARCHAR,
                egress_source VARCHAR,
                size INTEGER,
                num_attempts INTEGER,
                bounce_class VARCHAR,
                event_time VARCHAR,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )""",
            "CREATE INDEX IF NOT EXISTS ix_email_logs_event_type ON email_logs (event_type)",
            "CREATE INDEX IF NOT EXISTS ix_email_logs_created_at ON email_logs (created_at)",
        ]
        for sql in migrations:
            try:
                conn.execute(text(sql))
                conn.commit()
            except Exception:
                pass  # Column already exists
