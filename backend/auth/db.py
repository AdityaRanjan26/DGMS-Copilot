"""
backend/auth/db.py

Government-Grade Enterprise Authentication & Security Database Module for DGMS Copilot.
Supports PostgreSQL (with fallback to SQLite for local embedded mode).

Features:
  - Enterprise PostgreSQL / SQLite dual-engine database layer
  - PBKDF2-HMAC-SHA256 password hashing with 100,000 iterations & unique 32-byte salt
  - Schema auto-initialization for users, active_sessions, and audit_logs
  - Pre-seeded certified officer accounts for DGMS / CCL deployment
"""

from __future__ import annotations
import os
import sqlite3
import hashlib
import secrets
import time
import logging
from typing import Optional, Dict, Any, List, Tuple

logger = logging.getLogger(__name__)

# Check PostgreSQL driver availability
POSTGRES_AVAILABLE = False
try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
    POSTGRES_AVAILABLE = True
except ImportError:
    pass

POSTGRES_URL = os.getenv("POSTGRES_URL") or os.getenv("DATABASE_URL") or "postgresql://postgres:postgres@localhost:5432/dgms_copilot"
USE_POSTGRES = os.getenv("USE_POSTGRES", "true").lower() in ("true", "1", "yes") and POSTGRES_AVAILABLE

SQLITE_DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "auth.db")

# ── Password Hashing Utility ───────────────────────────────────────────────────

def hash_password(password: str, salt: Optional[bytes] = None) -> tuple[str, str]:
    """Hashes a password using PBKDF2-HMAC-SHA256 with 100,000 iterations."""
    if salt is None:
        salt = secrets.token_bytes(32)
    key = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, 100_000)
    return key.hex(), salt.hex()

def verify_password(password: str, stored_hash: str, stored_salt: str) -> bool:
    """Verifies a plaintext password against stored hash and salt."""
    salt = bytes.fromhex(stored_salt)
    key = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, 100_000)
    return secrets.compare_digest(key.hex(), stored_hash)

# ── Database Layer Abstraction ─────────────────────────────────────────────────

class DBWrapper:
    """Unified wrapper handling PostgreSQL or SQLite connections seamlessly."""
    def __init__(self):
        self.is_postgres = False
        self.conn = None
        self._connect()

    def _connect(self):
        if USE_POSTGRES:
            try:
                self.conn = psycopg2.connect(POSTGRES_URL, cursor_factory=RealDictCursor)
                self.conn.autocommit = False
                self.is_postgres = True
                return
            except Exception as e:
                logger.warning("PostgreSQL connection failed (%s) — falling back to SQLite.", e)
        
        # SQLite Fallback
        self.conn = sqlite3.connect(SQLITE_DB_PATH, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self.conn.execute("PRAGMA journal_mode=WAL;")
        self.conn.execute("PRAGMA foreign_keys=ON;")
        self.is_postgres = False

    def execute(self, query: str, params: Tuple = ()) -> Any:
        # Convert parameter syntax if needed (? for SQLite, %s for Postgres)
        if self.is_postgres:
            pg_query = query.replace("?", "%s")
            cur = self.conn.cursor()
            cur.execute(pg_query, params)
            return cur
        else:
            return self.conn.execute(query, params)

    def fetchone(self, query: str, params: Tuple = ()) -> Optional[Dict[str, Any]]:
        cur = self.execute(query, params)
        row = cur.fetchone()
        if not row:
            return None
        return dict(row)

    def fetchall(self, query: str, params: Tuple = ()) -> List[Dict[str, Any]]:
        cur = self.execute(query, params)
        rows = cur.fetchall()
        return [dict(r) for r in rows]

    def commit(self):
        self.conn.commit()

    def close(self):
        try:
            self.conn.close()
        except Exception:
            pass

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type:
            try:
                self.conn.rollback()
            except Exception:
                pass
        else:
            self.commit()
        self.close()

def get_auth_db() -> DBWrapper:
    return DBWrapper()

# ── Database Initialization ───────────────────────────────────────────────────

def init_auth_db() -> None:
    """Creates database schema tables (PostgreSQL or SQLite) and seeds default officers."""
    with get_auth_db() as db:
        if db.is_postgres:
            logger.info("Initializing PostgreSQL database schema...")
            db.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id VARCHAR(64) PRIMARY KEY,
                    username VARCHAR(100) UNIQUE NOT NULL,
                    email VARCHAR(200) UNIQUE NOT NULL,
                    full_name TEXT NOT NULL,
                    role VARCHAR(50) NOT NULL,
                    mine_unit TEXT NOT NULL,
                    security_level VARCHAR(100) NOT NULL,
                    password_hash TEXT NOT NULL,
                    password_salt TEXT NOT NULL,
                    failed_attempts INT DEFAULT 0,
                    locked_until DOUBLE PRECISION DEFAULT 0,
                    created_at DOUBLE PRECISION NOT NULL,
                    last_login DOUBLE PRECISION
                );
            """)
            db.execute("""
                CREATE TABLE IF NOT EXISTS active_sessions (
                    token_hash VARCHAR(128) PRIMARY KEY,
                    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    ip_address VARCHAR(45) NOT NULL,
                    created_at DOUBLE PRECISION NOT NULL,
                    expires_at DOUBLE PRECISION NOT NULL
                );
            """)
            db.execute("""
                CREATE TABLE IF NOT EXISTS audit_logs (
                    id SERIAL PRIMARY KEY,
                    timestamp DOUBLE PRECISION NOT NULL,
                    user_id VARCHAR(64),
                    username VARCHAR(100),
                    ip_address VARCHAR(45) NOT NULL,
                    action VARCHAR(100) NOT NULL,
                    details TEXT,
                    severity VARCHAR(20) DEFAULT 'INFO'
                );
            """)
        else:
            logger.info("Initializing SQLite database schema...")
            db.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    username TEXT UNIQUE NOT NULL,
                    email TEXT UNIQUE NOT NULL,
                    full_name TEXT NOT NULL,
                    role TEXT NOT NULL,
                    mine_unit TEXT NOT NULL,
                    security_level TEXT NOT NULL,
                    password_hash TEXT NOT NULL,
                    password_salt TEXT NOT NULL,
                    failed_attempts INTEGER DEFAULT 0,
                    locked_until REAL DEFAULT 0,
                    created_at REAL NOT NULL,
                    last_login REAL
                );
            """)
            db.execute("""
                CREATE TABLE IF NOT EXISTS active_sessions (
                    token_hash TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    ip_address TEXT NOT NULL,
                    created_at REAL NOT NULL,
                    expires_at REAL NOT NULL,
                    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
                );
            """)
            db.execute("""
                CREATE TABLE IF NOT EXISTS audit_logs (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp REAL NOT NULL,
                    user_id TEXT,
                    username TEXT,
                    ip_address TEXT NOT NULL,
                    action TEXT NOT NULL,
                    details TEXT,
                    severity TEXT DEFAULT 'INFO'
                );
            """)

    _seed_default_users()

def _seed_default_users() -> None:
    default_users = [
        {
            "id": "USR-CSO-001",
            "username": "cso_officer",
            "email": "officer@ccl.gov.in",
            "full_name": "मुख्य सुरक्षा अधिकारी (Chief Safety Officer)",
            "role": "safety_officer",
            "mine_unit": "CCL — रांची मुख्यालय (Ranchi HQ)",
            "security_level": "Level 4 - Executive Command",
            "password": "DGMS@2026!"
        },
        {
            "id": "USR-MGR-002",
            "username": "colliery_mgr",
            "email": "manager@ccl.gov.in",
            "full_name": "कोलियरी प्रबंधक (Colliery Manager)",
            "role": "mine_manager",
            "mine_unit": "करो ओसीपी (Karo OCP)",
            "security_level": "Level 3 - Operational Manager",
            "password": "DGMS@2026!"
        },
        {
            "id": "USR-ADM-003",
            "username": "sys_admin",
            "email": "admin@ccl.gov.in",
            "full_name": "सिस्टम प्रशासक (System Administrator)",
            "role": "system_admin",
            "mine_unit": "DGMS अनुपालन सेल (Safety Directorate)",
            "security_level": "Level 5 - System Superuser",
            "password": "DGMS@2026!"
        }
    ]

    with get_auth_db() as db:
        for u in default_users:
            existing = db.fetchone("SELECT id FROM users WHERE LOWER(email) = ?", (u["email"].lower(),))
            if not existing:
                p_hash, p_salt = hash_password(u["password"])
                db.execute("""
                    INSERT INTO users (id, username, email, full_name, role, mine_unit, security_level, password_hash, password_salt, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (u["id"], u["username"], u["email"], u["full_name"], u["role"], u["mine_unit"], u["security_level"], p_hash, p_salt, time.time()))

    logger.info("Default DGMS Officer accounts verified and seeded.")

def log_audit(ip: str, action: str, details: str = "", user_id: Optional[str] = None, username: Optional[str] = None, severity: str = "INFO") -> None:
    try:
        with get_auth_db() as db:
            db.execute("""
                INSERT INTO audit_logs (timestamp, user_id, username, ip_address, action, details, severity)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (time.time(), user_id, username, ip, action, details, severity))
    except Exception as e:
        logger.error("Failed to write audit log: %s", e)

# Run schema initialization
init_auth_db()
