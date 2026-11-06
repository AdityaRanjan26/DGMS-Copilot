/**
 * app/api/notifications/route.ts
 *
 * Proxies notification endpoints from the Python backend.
 * Falls back to curated static notifications when backend is offline.
 */
export const dynamic = "force-dynamic";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";

const STATIC_NOTIFICATIONS = [
  {
    id: "notif-001",
    type: "compliance",
    titleKey: "notifications.n1_title",
    messageKey: "notifications.n1_message",
    title: "B Shift ventilation entry delayed",
    message: "Panel 3A register update breached the configured pre-deployment rule. Review required before next shift.",
    timestamp: Math.floor(Date.now() / 1000) - 3600,
    read: false,
    archived: false,
    severity: "critical",
    action_url: "/shift-analysis",
    action_label_key: "notifications.n1_action"
  },
  {
    id: "notif-002",
    type: "repository",
    titleKey: "notifications.n2_title",
    messageKey: "notifications.n2_message",
    title: "6 new DGMS references indexed",
    message: "Knowledge repository now exposes searchable clause-level citations from the latest circulars.",
    timestamp: Math.floor(Date.now() / 1000) - 7200,
    read: false,
    archived: false,
    severity: "success",
    action_url: "/repository",
    action_label_key: "notifications.n2_action"
  },
  {
    id: "notif-003",
    type: "compliance",
    titleKey: "notifications.n3_title",
    messageKey: "notifications.n3_message",
    title: "Conveyor inspection rate improved",
    message: "Karo OCP closure rate improved from 88% to 94% across recent shift checks.",
    timestamp: Math.floor(Date.now() / 1000) - 86400,
    read: true,
    archived: false,
    severity: "success",
    action_url: "/dashboard",
    action_label_key: "notifications.n3_action"
  },
  {
    id: "notif-004",
    type: "system",
    titleKey: "notifications.n4_title",
    messageKey: "notifications.n4_message",
    title: "Platform running in offline mode",
    message: "The DGMS Copilot backend is not reachable. Document search and assistant features require the Python server.",
    timestamp: Math.floor(Date.now() / 1000) - 300,
    read: false,
    archived: false,
    severity: "warning"
  }
];

export async function GET(request: Request): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url);
    const params = searchParams.toString();
    const url = `${BACKEND_URL}/api/notifications${params ? `?${params}` : ""}`;

    const res = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      signal: AbortSignal.timeout(4_000), // 4s timeout — fast fail
    });

    if (!res.ok) {
      return Response.json(STATIC_NOTIFICATIONS);
    }

    const data = await res.json();
    return Response.json(data);
  } catch {
    // Backend offline — return curated static notifications silently
    return Response.json(STATIC_NOTIFICATIONS);
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json();
    const action = (body.action as string) ?? "read";
    const url = `${BACKEND_URL}/api/notifications/${action}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(4_000),
    });

    if (!res.ok) {
      return Response.json({ ok: true }); // Optimistic — client already updated
    }
    return Response.json(await res.json());
  } catch {
    return Response.json({ ok: true }); // Optimistic update
  }
}
