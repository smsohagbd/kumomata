"""
Database configuration — supports SQLite, MySQL, PostgreSQL via DATABASE_URL env var.

Examples:
  SQLite  (default):  DATABASE_URL=sqlite:///kumomta_panel.db
  MySQL:              DATABASE_URL=mysql+pymysql://user:pass@localhost:3306/kumomta_panel
  PostgreSQL:         DATABASE_URL=postgresql+psycopg2://user:pass@localhost:5432/kumomta_panel
  MariaDB:            DATABASE_URL=mysql+pymysql://user:pass@localhost:3306/kumomta_panel

Set DATABASE_URL in the systemd service's Environment= or in a .env file.
"""
from sqlalchemy import create_engine, text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

# ── Resolve DATABASE_URL ─────────────────────────────────────────────────────
# Legacy: support old DB_PATH variable for SQLite
_db_path = os.getenv("DB_PATH", "kumomta_panel.db")
DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{_db_path}")

DB_TYPE = DATABASE_URL.split("://")[0].split("+")[0]  # "sqlite", "mysql", "postgresql"

# ── Engine ────────────────────────────────────────────────────────────────────
_connect_args = {}
if DB_TYPE == "sqlite":
    _connect_args["check_same_thread"] = False

engine = create_engine(
    DATABASE_URL,
    connect_args=_connect_args,
    # Connection pool settings (SQLite doesn't need pool; MySQL/PG benefits from it)
    pool_pre_ping=True,           # detect stale connections
    pool_recycle=3600 if DB_TYPE != "sqlite" else -1,
)

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
    """
    Safe schema migrations — adds new columns/tables without losing data.
    SQLAlchemy's create_all only creates missing tables; ALTER TABLE handles new columns.
    For MySQL/PostgreSQL the syntax is the same; SQLite silently ignores duplicate columns.
    """
    with engine.connect() as conn:
        # Each migration is idempotent (IF NOT EXISTS / try-except)
        migrations = _get_migrations()
        for sql in migrations:
            try:
                conn.execute(text(sql))
                conn.commit()
            except Exception:
                pass  # Already exists — safe to ignore


def _get_migrations() -> list[str]:
    """Return DDL statements safe to run on both SQLite and MySQL/PostgreSQL."""
    auto_inc = "AUTO_INCREMENT" if DB_TYPE == "mysql" else ""
    serial = "INTEGER" if DB_TYPE == "sqlite" else "BIGINT"

    return [
        # New columns on existing tables
        "ALTER TABLE ip_addresses ADD COLUMN hostname VARCHAR(255)",
        "ALTER TABLE domain_rules ADD COLUMN egress_pool VARCHAR(128)",

        # email_logs table
        f"""CREATE TABLE IF NOT EXISTS email_logs (
            id {serial} PRIMARY KEY {auto_inc},
            event_type VARCHAR(64) NOT NULL,
            message_id VARCHAR(128),
            sender VARCHAR(255),
            recipient VARCHAR(255),
            queue VARCHAR(255),
            site VARCHAR(255),
            response_code INTEGER,
            response_message TEXT,
            peer_ip VARCHAR(64),
            egress_pool VARCHAR(128),
            egress_source VARCHAR(128),
            size INTEGER,
            num_attempts INTEGER,
            bounce_class VARCHAR(128),
            event_time VARCHAR(64),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )""",
        "CREATE INDEX IF NOT EXISTS ix_email_logs_event_type ON email_logs (event_type)",
        "CREATE INDEX IF NOT EXISTS ix_email_logs_created_at ON email_logs (created_at)",

        # suppressed_emails table
        f"""CREATE TABLE IF NOT EXISTS suppressed_emails (
            id {serial} PRIMARY KEY {auto_inc},
            email VARCHAR(255) NOT NULL UNIQUE,
            reason TEXT,
            bounce_code INTEGER,
            source VARCHAR(64) DEFAULT 'bounce',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )""",
        "CREATE INDEX IF NOT EXISTS ix_suppressed_emails_email ON suppressed_emails (email)",
    ]
