import subprocess
import os
import json
import glob
from datetime import datetime
from fastapi import APIRouter, Query, Request, Depends
from sqlalchemy.orm import Session
from database import get_db
import models

try:
    import zstandard as zstd
    HAS_ZSTD = True
except ImportError:
    HAS_ZSTD = False

router = APIRouter(prefix="/api/logs", tags=["Logs"])

KUMOMTA_LOG_DIR = os.getenv("KUMOMTA_LOG_DIR", "/var/log/kumomta")


def _read_log_file(filepath: str) -> list[str]:
    """Read a KumoMTA log file — handles both zstd-compressed and plain text."""
    # Try zstd decompression first
    if HAS_ZSTD:
        try:
            dctx = zstd.ZstdDecompressor()
            with open(filepath, "rb") as f:
                raw = f.read()
            if raw:
                text = dctx.decompress(raw, max_output_size=50 * 1024 * 1024)
                return text.decode("utf-8", errors="replace").splitlines()
        except Exception:
            pass

    # Fallback: try subprocess zstdcat (if zstd binary is installed)
    try:
        result = subprocess.run(
            ["zstdcat", filepath],
            capture_output=True, timeout=10,
        )
        if result.returncode == 0 and result.stdout:
            return result.stdout.decode("utf-8", errors="replace").splitlines()
    except Exception:
        pass

    # Last resort: plain text
    try:
        with open(filepath, "r", errors="replace") as f:
            return f.readlines()
    except Exception:
        return []


def _read_journal(unit: str, lines: int = 100) -> list[dict]:
    try:
        result = subprocess.run(
            ["journalctl", "-u", unit, "-n", str(lines), "--no-pager", "--output=short-iso"],
            capture_output=True, text=True, timeout=10,
        )
        raw_lines = result.stdout.strip().splitlines()
        entries = []
        for line in raw_lines:
            if not line or line.startswith("--"):
                continue
            # Detect log level from content
            low = line.lower()
            if " error " in low or "error" in low or "failed" in low or "failure" in low:
                level = "error"
            elif " warn" in low or "warning" in low:
                level = "warn"
            elif " info " in low:
                level = "info"
            else:
                level = "debug"
            entries.append({"line": line, "level": level})
        return entries
    except Exception as e:
        return [{"line": f"Could not read logs: {e}", "level": "error"}]


@router.get("/kumomta")
def kumomta_logs(lines: int = Query(default=100, le=500)):
    return {"logs": _read_journal("kumomta", lines)}


@router.get("/backend")
def backend_logs(lines: int = Query(default=100, le=500)):
    return {"logs": _read_journal("kumomta-panel-backend", lines)}


@router.get("/frontend")
def frontend_logs(lines: int = Query(default=50, le=200)):
    return {"logs": _read_journal("kumomta-panel-frontend", lines)}


def _parse_response(resp) -> dict:
    """Parse KumoMTA response field into code + message."""
    if not resp:
        return {"code": 0, "message": ""}
    if isinstance(resp, dict):
        code = resp.get("code", 0)
        content = resp.get("content", "") or ""
        # enhanced_code is a dict like {"class":2,"subject":0,"detail":0} — format as "2.0.0"
        enhanced = resp.get("enhanced_code")
        if isinstance(enhanced, dict):
            ec = f"{enhanced.get('class','')}.{enhanced.get('subject','')}.{enhanced.get('detail','')}"
        elif enhanced:
            ec = str(enhanced)
        else:
            ec = ""
        msg = f"{ec} {content}".strip() if ec else content
        return {"code": code, "message": msg}
    return {"code": 0, "message": str(resp)}


def _parse_ts(ts) -> str:
    """Convert KumoMTA timestamp (Unix float or ISO string) to ISO string."""
    if not ts:
        return ""
    try:
        if isinstance(ts, (int, float)):
            return datetime.utcfromtimestamp(ts).strftime("%Y-%m-%d %H:%M:%S UTC")
        return str(ts)
    except Exception:
        return str(ts)


@router.get("/email")
def email_logs(lines: int = Query(default=200, le=1000)):
    """
    Read KumoMTA JSONL delivery log files from /var/log/kumomta/.
    Returns newest records first with full response code and message.
    """
    records = []
    try:
        pattern = os.path.join(KUMOMTA_LOG_DIR, "*")
        log_files = sorted(glob.glob(pattern), key=os.path.getmtime)
        if not log_files:
            return {
                "records": [],
                "error": (
                    f"No log files in {KUMOMTA_LOG_DIR}. "
                    "Go to Config & Deploy → Deploy Config to enable logging, "
                    "then restart KumoMTA: systemctl restart kumomta"
                )
            }

        all_lines = []
        for filepath in reversed(log_files):
            try:
                if os.path.getsize(filepath) == 0:
                    continue  # skip empty/open segments
                file_lines = [l for l in _read_log_file(filepath) if l.strip()]
                all_lines.extend(reversed(file_lines))
                if len(all_lines) >= lines:
                    break
            except Exception:
                continue

        for raw in all_lines[:lines]:
            raw = raw.strip()
            if not raw:
                continue
            try:
                rec = json.loads(raw)
            except json.JSONDecodeError:
                continue

            resp = _parse_response(rec.get("response"))

            # peer_address may be a dict or string
            peer = rec.get("peer_address") or {}
            peer_ip = peer.get("addr", "") if isinstance(peer, dict) else str(peer)

            records.append({
                "type":         rec.get("type", "Unknown"),
                "timestamp":    _parse_ts(rec.get("timestamp")),
                "sender":       rec.get("sender", ""),
                "recipient":    rec.get("recipient", ""),
                "queue":        rec.get("queue", ""),
                "site":         rec.get("site", ""),
                "code":         resp["code"],
                "response":     resp["message"],
                "size":         rec.get("size", 0),
                "num_attempts": rec.get("num_attempts", 0),
                "peer_ip":      peer_ip,
                "egress_pool":  rec.get("egress_pool", ""),
                "egress_source":rec.get("egress_source", ""),
                "bounce_class": rec.get("bounce_classification") or "",
                "id":           rec.get("id", ""),
            })

    except Exception as e:
        return {"records": [], "error": str(e)}

    return {"records": records, "total": len(records)}


# ─── Webhook receiver (KumoMTA pushes events here in realtime) ────────────────

@router.post("/webhook")
async def receive_webhook(request: Request, db: Session = Depends(get_db)):
    """
    KumoMTA calls this endpoint for every log event via configure_log_hook.
    Stores events in the email_logs table for instant frontend display.
    """
    try:
        body = await request.body()
        # KumoMTA sends one JSON object per line (batch of events)
        saved = 0
        for line in body.decode("utf-8", errors="replace").splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                rec = json.loads(line)
            except json.JSONDecodeError:
                continue

            resp = _parse_response(rec.get("response"))
            peer = rec.get("peer_address") or {}
            peer_ip = peer.get("addr", "") if isinstance(peer, dict) else str(peer)
            bounce = rec.get("bounce_classification") or ""
            if isinstance(bounce, dict):
                bounce = bounce.get("name", "") or bounce.get("category", "") or str(bounce)

            entry = models.EmailLog(
                event_type=rec.get("type", "Unknown"),
                message_id=rec.get("id", ""),
                sender=rec.get("sender", ""),
                recipient=rec.get("recipient", ""),
                queue=rec.get("queue", ""),
                site=rec.get("site", ""),
                response_code=resp["code"],
                response_message=resp["message"],
                peer_ip=peer_ip,
                egress_pool=rec.get("egress_pool") or "",
                egress_source=rec.get("egress_source") or "",
                size=rec.get("size") or 0,
                num_attempts=rec.get("num_attempts") or 0,
                bounce_class=bounce if bounce not in ("Uncategorized", "") else "",
                event_time=_parse_ts(rec.get("timestamp")),
            )
            db.add(entry)
            saved += 1

        db.commit()
        return {"ok": True, "saved": saved}
    except Exception as e:
        return {"ok": False, "error": str(e)}


@router.get("/email/realtime")
def email_logs_realtime(
    limit: int = Query(default=200, le=1000),
    db: Session = Depends(get_db),
):
    """Return email log events from DB (populated in realtime via webhook)."""
    rows = (
        db.query(models.EmailLog)
        .order_by(models.EmailLog.id.desc())
        .limit(limit)
        .all()
    )
    records = [
        {
            "type":         r.event_type,
            "timestamp":    r.event_time or "",
            "sender":       r.sender or "",
            "recipient":    r.recipient or "",
            "queue":        r.queue or "",
            "site":         r.site or "",
            "code":         r.response_code or 0,
            "response":     r.response_message or "",
            "size":         r.size or 0,
            "num_attempts": r.num_attempts or 0,
            "peer_ip":      r.peer_ip or "",
            "egress_pool":  r.egress_pool or "",
            "egress_source":r.egress_source or "",
            "bounce_class": r.bounce_class or "",
            "id":           r.message_id or "",
        }
        for r in rows
    ]
    return {"records": records, "total": len(records)}
