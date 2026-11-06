import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const response = await fetch(`${BACKEND_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      // 60-second timeout — backend Ollama limit is 45 s; this gives headroom for latency
      signal: AbortSignal.timeout(60_000),
    });

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json(
        { error: `Backend error: ${error}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Unknown error";

    if (message.includes("fetch") || message.includes("ECONNREFUSED")) {
      return NextResponse.json(
        {
          error:
            "Cannot connect to the DGMS Copilot backend. " +
            "Please ensure the Python backend is running on port 8000. " +
            "Run: cd backend && start_backend.bat",
        },
        { status: 503 }
      );
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
