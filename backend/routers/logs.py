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


def _parse_response(resp) -> dict:
    """Parse KumoMTA response field into code + message."""
    if not resp:
        return {"code": 0, "message": ""}
    if isinstance(resp, dict):
        code = resp.get("code", 0)
        content = resp.get("content", "") or ""
        enhanced = resp.get("enhanced_code") or ""
        msg = f"{enhanced} {content}".strip() if enhanced else content
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
                with open(filepath, "r") as f:
                    file_lines = [l for l in f.readlines() if l.strip()]
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
