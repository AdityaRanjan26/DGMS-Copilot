"""
api/notifications.py

GET  /api/notifications        — List all notifications
POST /api/notifications/read   — Mark notifications as read
POST /api/notifications/clear  — Delete/archive notifications

Notifications are sourced from:
  - System events (backend health, model load, index rebuild)
  - Repository events (new documents indexed, ingestion status)
  - Compliance alerts (based on platform rules — hardcoded but extensible)
  - Report analysis (shift report anomalies)

Architecture: In-memory store per server process.
Easily swappable to Redis/DB in production.
"""

from __future__ import annotations
import logging
import time
import uuid
from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel

logger = logging.getLogger(__name__)
router = APIRouter(tags=["notifications"])


# ── Data models ────────────────────────────────────────────────────────────────

NotificationSeverity = Literal["info", "warning", "critical", "success"]
NotificationSource = Literal["system", "repository", "compliance", "report", "assistant"]


class Notification(BaseModel):
    id: str
    type: NotificationSource
    title: str
    message: str
    titleKey: str | None = None
    messageKey: str | None = None
    timestamp: float
    read: bool = False
    archived: bool = False
    severity: NotificationSeverity = "info"
    action_url: str | None = None
    action_label: str | None = None
    action_label_key: str | None = None


class MarkReadRequest(BaseModel):
    ids: list[str] | None = None  # None = mark all read


class DeleteRequest(BaseModel):
    ids: list[str]


# ── In-memory store ────────────────────────────────────────────────────────────

_notifications: list[Notification] = []


def _now() -> float:
    return time.time()


def _seed_initial_notifications() -> None:
    """Seed with realistic demo notifications on first startup."""
    global _notifications
    base = _now()
    _notifications = [
        Notification(
            id=str(uuid.uuid4()),
            type="compliance",
            title="B Shift ventilation entry delayed",
            message="Panel 3A register update breached the configured pre-deployment rule. Review required before next shift.",
            titleKey="notifications.n1_title",
            messageKey="notifications.n1_message",
            timestamp=base - 3600 * 2,
            severity="critical",
            action_url="/shift-analysis",
            action_label="Review Report",
            action_label_key="notifications.n1_action",
        ),
        Notification(
            id=str(uuid.uuid4()),
            type="repository",
            title="6 new DGMS references indexed",
            message="Knowledge repository now exposes searchable clause-level citations from the latest circulars.",
            titleKey="notifications.n2_title",
            messageKey="notifications.n2_message",
            timestamp=base - 3600 * 5,
            severity="success",
            action_url="/repository",
            action_label="View Repository",
            action_label_key="notifications.n2_action",
        ),
        Notification(
            id=str(uuid.uuid4()),
            type="compliance",
            title="Conveyor inspection rate improved",
            message="Karo OCP closure rate improved from 88% to 94% across recent shift checks.",
            titleKey="notifications.n3_title",
            messageKey="notifications.n3_message",
            timestamp=base - 3600 * 8,
            severity="success",
            action_url="/dashboard",
            action_label="View Dashboard",
            action_label_key="notifications.n3_action",
        ),
        Notification(
            id=str(uuid.uuid4()),
            type="system",
            title="Platform running in offline mode",
            message="The DGMS Copilot backend is not reachable. Document search and assistant features require the Python server.",
            titleKey="notifications.n4_title",
            messageKey="notifications.n4_message",
            timestamp=base - 3600 * 24,
            severity="warning",
        ),
        Notification(
            id=str(uuid.uuid4()),
            type="system",
            title="AI Model Loaded",
            message="LLM model is loaded and ready. Expected response latency: 3–8 seconds.",
            timestamp=base - 3600 * 48,
            read=True,
            severity="info",
        ),
    ]


_seed_initial_notifications()


def add_notification(
    type: NotificationSource,
    title: str,
    message: str,
    severity: NotificationSeverity = "info",
    action_url: str | None = None,
    action_label: str | None = None,
) -> Notification:
    """Programmatically add a notification from anywhere in the backend."""
    n = Notification(
        id=str(uuid.uuid4()),
        type=type,
        title=title,
        message=message,
        timestamp=_now(),
        severity=severity,
        action_url=action_url,
        action_label=action_label,
    )
    _notifications.insert(0, n)
    # Keep max 100 notifications
    if len(_notifications) > 100:
        _notifications.pop()
    return n


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/notifications", response_model=list[Notification])
def get_notifications(
    include_archived: bool = False,
    severity: str | None = None,
    source: str | None = None,
    limit: int = 50,
) -> list[Notification]:
    """List notifications with optional filters."""
    results = [n for n in _notifications if not n.archived or include_archived]

    if severity:
        results = [n for n in results if n.severity == severity]
    if source:
        results = [n for n in results if n.type == source]

    return sorted(results, key=lambda n: n.timestamp, reverse=True)[:limit]


@router.get("/notifications/count")
def get_unread_count() -> dict:
    """Return the count of unread notifications."""
    unread = sum(1 for n in _notifications if not n.read and not n.archived)
    return {"unread": unread, "total": len([n for n in _notifications if not n.archived])}


@router.post("/notifications/read")
def mark_read(body: MarkReadRequest) -> dict:
    """Mark one, many, or all notifications as read."""
    count = 0
    for n in _notifications:
        if body.ids is None or n.id in body.ids:
            if not n.read:
                n.read = True
                count += 1
    return {"marked_read": count}


@router.post("/notifications/delete")
def delete_notifications(body: DeleteRequest) -> dict:
    """Archive (soft-delete) notifications by ID."""
    id_set = set(body.ids)
    count = 0
    for n in _notifications:
        if n.id in id_set and not n.archived:
            n.archived = True
            count += 1
    return {"archived": count}
