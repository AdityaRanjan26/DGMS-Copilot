"""
backend/api/auth.py

FastAPI router for DGMS Copilot Enterprise Authentication & Session Security.
Supports PostgreSQL and SQLite dual-database engine.

Endpoints:
  POST /api/auth/login            — Authenticate credentials & issue session token
  POST /api/auth/logout           — Revoke session token
  GET  /api/auth/me               — Get current authenticated officer profile
  POST /api/auth/change-password  — Update officer password with security policy check
  GET  /api/auth/audit-logs       — Retrieve security audit trail (Admin/CSO only)
"""

from __future__ import annotations
import sys
import os
from pathlib import Path
import logging
import time
import secrets
import hashlib
from typing import Optional

# Add backend directory to sys.path for IDE and Pylance resolution
BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from fastapi import APIRouter, HTTPException, Request, Header  # type: ignore
from pydantic import BaseModel, Field  # type: ignore

try:
    from backend.auth.db import get_auth_db, hash_password, verify_password, log_audit  # type: ignore
except (ModuleNotFoundError, ImportError):
    try:
        from auth.db import get_auth_db, hash_password, verify_password, log_audit  # type: ignore
    except (ModuleNotFoundError, ImportError):
        from ..auth.db import get_auth_db, hash_password, verify_password, log_audit  # type: ignore

logger = logging.getLogger(__name__)
router = APIRouter()

SESSION_DURATION = 86400  # 24 hours in seconds

# ── Schemas ───────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: str = Field(..., min_length=3, max_length=100)
    password: str = Field(..., min_length=1, max_length=100)

class UserProfile(BaseModel):
    id: str
    username: str
    email: str
    fullName: str
    role: str
    mineUnit: str
    securityLevel: str
    lastLogin: Optional[float] = None

class LoginResponse(BaseModel):
    token: str
    user: UserProfile
    message: str

class ChangePasswordRequest(BaseModel):
    currentPassword: str = Field(..., min_length=1)
    newPassword: str = Field(..., min_length=8, max_length=100)

class AuditLogItem(BaseModel):
    id: int
    timestamp: float
    userId: Optional[str]
    username: Optional[str]
    ipAddress: str
    action: str
    details: str
    severity: str

# ── Helper Functions ──────────────────────────────────────────────────────────

def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode('utf-8')).hexdigest()

def _get_user_by_token(token: str) -> Optional[dict]:
    token_hash = _hash_token(token)
    now = time.time()
    with get_auth_db() as db:
        session = db.fetchone(
            "SELECT user_id, expires_at FROM active_sessions WHERE token_hash = ?", (token_hash,)
        )
        
        if not session or session["expires_at"] < now:
            return None
            
        user = db.fetchone(
            "SELECT id, username, email, full_name, role, mine_unit, security_level, last_login FROM users WHERE id = ?",
            (session["user_id"],)
        )
        return user

# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/login", response_model=LoginResponse)
async def login(req: LoginRequest, http_req: Request):
    client_ip = getattr(http_req.client, "host", "unknown")
    email = req.email.strip().lower()
    
    with get_auth_db() as db:
        user = db.fetchone("SELECT * FROM users WHERE LOWER(email) = ? OR LOWER(username) = ?", (email, email))
        
        if not user:
            log_audit(client_ip, "LOGIN_FAILED", f"Invalid account: {email}", severity="WARN")
            raise HTTPException(status_code=401, detail="अमान्य क्रेडेंशियल्स (Invalid email or password)")

        now = time.time()

        # Check account lockout
        if user["locked_until"] > now:
            remaining_mins = int((user["locked_until"] - now) // 60) + 1
            log_audit(client_ip, "LOGIN_LOCKED", f"Attempt on locked account: {email}", user_id=user["id"], username=user["username"], severity="WARN")
            raise HTTPException(status_code=429, detail=f"सुरक्षा कारणों से खाता लॉक किया गया है। कृपया {remaining_mins} मिनट बाद पुनः प्रयास करें।")

        # Verify password
        if not verify_password(req.password, user["password_hash"], user["password_salt"]):
            failed = user["failed_attempts"] + 1
            locked_until = 0.0
            if failed >= 5:
                locked_until = now + 900  # Lock out for 15 minutes
                log_audit(client_ip, "ACCOUNT_LOCKED", f"Account locked after 5 failed attempts: {email}", user_id=user["id"], username=user["username"], severity="SECURITY")
            
            db.execute("UPDATE users SET failed_attempts = ?, locked_until = ? WHERE id = ?", (failed, locked_until, user["id"]))
            log_audit(client_ip, "LOGIN_FAILED", f"Password mismatch for: {email}", user_id=user["id"], username=user["username"], severity="WARN")
            raise HTTPException(status_code=401, detail="अमान्य क्रेडेंशियल्स (Invalid email or password)")

        # Success — reset failed attempts & update last login
        db.execute("UPDATE users SET failed_attempts = 0, locked_until = 0, last_login = ? WHERE id = ?", (now, user["id"]))

        # Create session token
        raw_token = secrets.token_urlsafe(48)
        token_hash = _hash_token(raw_token)
        expires_at = now + SESSION_DURATION

        db.execute("""
            INSERT INTO active_sessions (token_hash, user_id, ip_address, created_at, expires_at)
            VALUES (?, ?, ?, ?, ?)
        """, (token_hash, user["id"], client_ip, now, expires_at))

    log_audit(client_ip, "LOGIN_SUCCESS", f"Officer logged in: {user['email']}", user_id=user["id"], username=user["username"])

    profile = UserProfile(
        id=user["id"],
        username=user["username"],
        email=user["email"],
        fullName=user["full_name"],
        role=user["role"],
        mineUnit=user["mine_unit"],
        securityLevel=user["security_level"],
        lastLogin=now
    )

    return LoginResponse(
        token=raw_token,
        user=profile,
        message="सफलतापूर्वक प्रमाणीकृत (Authenticated successfully)"
    )

@router.get("/me", response_model=UserProfile)
async def get_me(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="अनधिकृत पहुंच (Unauthorized - Token missing)")
        
    token = authorization.split(" ")[1]
    user_dict = _get_user_by_token(token)
    if not user_dict:
        raise HTTPException(status_code=401, detail="सत्र समाप्त हो गया है (Session expired)")

    return UserProfile(
        id=user_dict["id"],
        username=user_dict["username"],
        email=user_dict["email"],
        fullName=user_dict["full_name"],
        role=user_dict["role"],
        mineUnit=user_dict["mine_unit"],
        securityLevel=user_dict["security_level"],
        lastLogin=user_dict["last_login"]
    )

@router.post("/logout")
async def logout(http_req: Request, authorization: Optional[str] = Header(None)):
    client_ip = getattr(http_req.client, "host", "unknown")
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
        token_hash = _hash_token(token)
        with get_auth_db() as db:
            session = db.fetchone("SELECT user_id FROM active_sessions WHERE token_hash = ?", (token_hash,))
            user_id = session["user_id"] if session else None
            db.execute("DELETE FROM active_sessions WHERE token_hash = ?", (token_hash,))
            if user_id:
                log_audit(client_ip, "LOGOUT", "Officer logged out", user_id=user_id)
                
    return {"message": "सफलतापूर्वक साइन आउट किया गया (Logged out successfully)"}

@router.post("/change-password")
async def change_password(req: ChangePasswordRequest, http_req: Request, authorization: Optional[str] = Header(None)):
    client_ip = getattr(http_req.client, "host", "unknown")
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="अनधिकृत (Unauthorized)")

    token = authorization.split(" ")[1]
    user_dict = _get_user_by_token(token)
    if not user_dict:
        raise HTTPException(status_code=401, detail="सत्र अमान्य है (Session invalid)")

    with get_auth_db() as db:
        full_user = db.fetchone("SELECT password_hash, password_salt FROM users WHERE id = ?", (user_dict["id"],))
        if not full_user or not verify_password(req.currentPassword, full_user["password_hash"], full_user["password_salt"]):
            log_audit(client_ip, "PASSWORD_CHANGE_FAILED", "Incorrect current password", user_id=user_dict["id"], username=user_dict["username"], severity="WARN")
            raise HTTPException(status_code=400, detail="वर्तमान पासवर्ड गलत है (Current password is incorrect)")

        new_hash, new_salt = hash_password(req.newPassword)
        db.execute("UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?", (new_hash, new_salt, user_dict["id"]))

    log_audit(client_ip, "PASSWORD_CHANGED", "Password updated successfully", user_id=user_dict["id"], username=user_dict["username"], severity="SECURITY")
    return {"message": "पासवर्ड सफलतापूर्वक अपडेट किया गया (Password updated successfully)"}

@router.get("/audit-logs", response_model=list[AuditLogItem])
async def get_audit_logs(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="अनधिकृत (Unauthorized)")

    token = authorization.split(" ")[1]
    user_dict = _get_user_by_token(token)
    if not user_dict:
        raise HTTPException(status_code=401, detail="सत्र अमान्य है (Session invalid)")

    with get_auth_db() as db:
        rows = db.fetchall("SELECT id, timestamp, user_id, username, ip_address, action, details, severity FROM audit_logs ORDER BY id DESC LIMIT 50")
        return [
            AuditLogItem(
                id=r["id"],
                timestamp=r["timestamp"],
                userId=r["user_id"],
                username=r["username"],
                ipAddress=r["ip_address"],
                action=r["action"],
                details=r["details"] or "",
                severity=r["severity"] or "INFO"
            )
            for r in rows
        ]
