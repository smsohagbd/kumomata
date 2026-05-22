import subprocess
from fastapi import APIRouter, Query

router = APIRouter(prefix="/api/logs", tags=["Logs"])


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
