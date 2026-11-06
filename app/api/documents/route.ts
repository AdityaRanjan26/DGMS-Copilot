import { NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";

export async function GET() {
  try {
    const response = await fetch(`${BACKEND_URL}/api/documents`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      // Allow ample time for any potential latency, though this should be fast
      signal: AbortSignal.timeout(30_000),
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
    const message = err instanceof Error ? err.message : "Unknown error";

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
