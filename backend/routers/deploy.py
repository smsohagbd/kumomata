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
from routers.settings import get_setting

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
    relay_hosts = get_setting(db, "relay_hosts") or "127.0.0.1,::1"

    errors = []

    # Write init.lua
    init_lua_path = os.path.join(POLICY_DIR, "init.lua")
    try:
        _write_file(init_lua_path, generate_init_lua(ips, dkim_keys, relay_hosts, domain_rules))
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
            os.chmod(key_path, 0o640)
            # KumoMTA runs as kumod — make sure it can read the key
            try:
                import pwd
                kumod = pwd.getpwnam("kumod")
                os.chown(key_path, kumod.pw_uid, kumod.pw_gid)
                # Also fix parent dirs
                domain_dir = os.path.dirname(key_path)
                dkim_base = os.path.dirname(domain_dir)
                for d in [dkim_base, domain_dir]:
                    os.chown(d, kumod.pw_uid, kumod.pw_gid)
            except KeyError:
                pass  # kumod user not found (dev environment)
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


@router.post("/test-smtp")
async def test_smtp():
    """
    Test SMTP handshake on localhost:25.
    Connects, sends EHLO, checks response — does NOT send any mail.
    """
    import asyncio
    import socket

    result = {"connected": False, "ehlo": False, "banner": "", "capabilities": [], "error": ""}
    try:
        reader, writer = await asyncio.wait_for(
            asyncio.open_connection("127.0.0.1", 25), timeout=5
        )
        banner = (await asyncio.wait_for(reader.readline(), timeout=5)).decode(errors="replace").strip()
        result["banner"] = banner
        if not banner.startswith("220"):
            result["error"] = f"Unexpected banner: {banner}"
            writer.close()
            return result
        result["connected"] = True

        # Send EHLO
        hostname = socket.gethostname()
        writer.write(f"EHLO {hostname}\r\n".encode())
        await writer.drain()
        caps = []
        while True:
            line = (await asyncio.wait_for(reader.readline(), timeout=5)).decode(errors="replace").strip()
            caps.append(line)
            if line.startswith("250 ") or (not line.startswith("250")):
                break
        result["capabilities"] = caps
        result["ehlo"] = any(l.startswith("250") for l in caps)

        # Graceful quit
        writer.write(b"QUIT\r\n")
        await writer.drain()
        writer.close()
    except asyncio.TimeoutError:
        result["error"] = "Connection timed out — is KumoMTA running and listening on port 25?"
    except ConnectionRefusedError:
        result["error"] = "Connection refused — KumoMTA is not listening on port 25"
    except Exception as e:
        result["error"] = str(e)

    return result


@router.post("/clear-queue")
async def clear_queue(domain: str = ""):
    """
    Cancel/bounce queued messages via KumoMTA admin API.
    domain= : cancel only that destination domain (e.g. gmail.com)
    empty   : cancel everything in the queue
    """
    import httpx
    KUMOMTA_API = os.getenv("KUMOMTA_API", "http://127.0.0.1:8001")

    # KumoMTA admin bounce API — try v1 first, fall back to older path
    for endpoint in ["/api/admin/bounce/v1", "/api/admin/bounce"]:
        payload: dict = {"reason": "Cancelled via panel"}
        if domain:
            payload["domain"] = domain
        else:
            payload["everything"] = True
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.post(f"{KUMOMTA_API}{endpoint}", json=payload)
                if resp.status_code != 404:
                    return {
                        "ok": resp.status_code < 300,
                        "status": resp.status_code,
                        "detail": resp.text,
                        "endpoint": endpoint,
                    }
        except Exception as e:
            return {"ok": False, "error": str(e)}

    return {"ok": False, "error": "KumoMTA bounce API not found"}


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
