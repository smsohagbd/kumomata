"""
Deploy router: writes generated configs to the KumoMTA policy directory
and reloads the KumoMTA service.

This only works when the panel is running ON the same Linux server as KumoMTA.
"""
import os
import subprocess
import shutil
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
import models
from services.config_generator import generate_init_lua, generate_shaping_toml, get_dkim_key_path

router = APIRouter(prefix="/api/deploy", tags=["Deploy"])

POLICY_DIR = os.getenv("KUMOMTA_POLICY_DIR", "/opt/kumomta/etc/policy")
DKIM_DIR = os.getenv("KUMOMTA_DKIM_DIR", "/var/lib/kumomta/data/dkim")
# These env vars are set by the systemd service created by install.sh


def _write_file(path: str, content: str):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        f.write(content)


def _reload_kumomta() -> dict:
    """
    Reloads or restarts KumoMTA after config change.
    Tries reload first (graceful); falls back to restart if stopped.
    """
    try:
        # Check if the service is currently active
        active = subprocess.run(
            ["systemctl", "is-active", "kumomta"],
            capture_output=True, text=True, timeout=5,
        )
        is_active = active.stdout.strip() == "active"

        # Use reload if running (no connection drop), restart if stopped
        action = "reload" if is_active else "restart"
        result = subprocess.run(
            ["systemctl", action, "kumomta"],
            capture_output=True, text=True, timeout=15,
        )
        if result.returncode == 0:
            return {"ok": True, "action": action}
        # If reload failed, fall back to restart
        if action == "reload":
            result2 = subprocess.run(
                ["systemctl", "restart", "kumomta"],
                capture_output=True, text=True, timeout=15,
            )
            if result2.returncode == 0:
                return {"ok": True, "action": "restart"}
            return {"ok": False, "error": result2.stderr.strip() or "restart failed"}
        return {"ok": False, "error": result.stderr.strip() or f"{action} failed"}
    except FileNotFoundError:
        return {"ok": False, "error": "systemctl not found — are you running on Linux?"}
    except Exception as e:
        return {"ok": False, "error": str(e)}


@router.post("/config")
def deploy_config(db: Session = Depends(get_db)):
    """
    1. Generate init.lua and shaping.toml from database
    2. Write them to the KumoMTA policy directory
    3. Write DKIM private keys to the DKIM directory
    4. Reload KumoMTA
    """
    ips = db.query(models.IPAddress).filter(models.IPAddress.is_active == True).all()
    dkim_keys = db.query(models.DKIMKey).filter(models.DKIMKey.is_active == True).all()
    domain_rules = db.query(models.DomainRule).filter(models.DomainRule.is_active == True).all()

    errors = []

    # Write init.lua
    init_lua_path = os.path.join(POLICY_DIR, "init.lua")
    try:
        _write_file(init_lua_path, generate_init_lua(ips, dkim_keys))
    except PermissionError:
        errors.append(f"Permission denied writing {init_lua_path}. Run the panel as root or grant write access.")
    except Exception as e:
        errors.append(f"Failed to write init.lua: {e}")

    # Write shaping.toml
    shaping_toml_path = os.path.join(POLICY_DIR, "shaping.toml")
    try:
        _write_file(shaping_toml_path, generate_shaping_toml(domain_rules))
    except PermissionError:
        errors.append(f"Permission denied writing {shaping_toml_path}.")
    except Exception as e:
        errors.append(f"Failed to write shaping.toml: {e}")

    # Write DKIM private key files
    dkim_written = []
    for key in dkim_keys:
        key_path = get_dkim_key_path(key.domain, key.selector)
        try:
            _write_file(key_path, key.private_key)
            os.chmod(key_path, 0o600)  # private key: owner-read only
            dkim_written.append(f"{key.domain}/{key.selector}")
        except PermissionError:
            errors.append(f"Permission denied writing DKIM key for {key.domain}.")
        except Exception as e:
            errors.append(f"Failed to write DKIM key for {key.domain}: {e}")

    if errors:
        raise HTTPException(status_code=500, detail={"errors": errors})

    # Reload KumoMTA
    reload_result = _reload_kumomta()

    return {
        "ok": True,
        "files_written": {
            "init_lua": init_lua_path,
            "shaping_toml": shaping_toml_path,
            "dkim_keys": dkim_written,
        },
        "kumomta_reloaded": reload_result["ok"],
        "reload_error": reload_result.get("error"),
    }


@router.get("/status")
def deploy_status():
    """Check whether the policy directory and KumoMTA service are accessible."""
    policy_dir_exists = os.path.isdir(POLICY_DIR)
    policy_dir_writable = os.access(POLICY_DIR, os.W_OK) if policy_dir_exists else False

    kumomta_running = False
    try:
        result = subprocess.run(
            ["systemctl", "is-active", "kumomta"],
            capture_output=True, text=True, timeout=5,
        )
        kumomta_running = result.stdout.strip() == "active"
    except Exception:
        pass

    return {
        "policy_dir": POLICY_DIR,
        "policy_dir_exists": policy_dir_exists,
        "policy_dir_writable": policy_dir_writable,
        "kumomta_running": kumomta_running,
        "dkim_dir": DKIM_DIR,
    }
