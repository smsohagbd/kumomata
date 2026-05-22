import subprocess
import os
import json
import glob
from datetime import datetime
from fastapi import APIRouter, Query

router = APIRouter(prefix="/api/logs", tags=["Logs"])

KUMOMTA_LOG_DIR = os.getenv("KUMOMTA_LOG_DIR", "/var/log/kumomta")


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


@router.get("/email")
def email_logs(lines: int = Query(default=200, le=1000)):
    """
    Read KumoMTA delivery log files (JSONL format).
    KumoMTA writes one JSON record per line to /var/log/kumomta/.
    Each record has: type, timestamp, sender, recipient, queue, response, size
    """
    records = []
    try:
        # Find all log files, sort by modification time (newest last)
        pattern = os.path.join(KUMOMTA_LOG_DIR, "*")
        log_files = sorted(glob.glob(pattern), key=os.path.getmtime)
        if not log_files:
            return {"records": [], "error": f"No log files found in {KUMOMTA_LOG_DIR}. Deploy config first to enable logging."}

        all_lines = []
        for filepath in reversed(log_files):  # newest files first
            try:
                with open(filepath, "r") as f:
                    file_lines = f.readlines()
                    all_lines.extend(reversed(file_lines))  # newest lines first
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
                # Normalize fields
                records.append({
                    "type": rec.get("type", "Unknown"),
                    "timestamp": rec.get("timestamp", ""),
                    "sender": rec.get("sender", ""),
                    "recipient": rec.get("recipient", ""),
                    "queue": rec.get("queue", ""),
                    "response": rec.get("response", {}).get("content", "") if isinstance(rec.get("response"), dict) else str(rec.get("response", "")),
                    "size": rec.get("size", 0),
                    "num_attempts": rec.get("num_attempts", 0),
                    "disposition": rec.get("disposition", ""),
                })
            except json.JSONDecodeError:
                continue

    except Exception as e:
        return {"records": [], "error": str(e)}

    return {"records": records, "total": len(records)}
