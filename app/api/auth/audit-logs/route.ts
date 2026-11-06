import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get("authorization") || "";
    const res = await fetch(`${BACKEND_URL}/api/auth/audit-logs`, {
      method: "GET",
      headers: { "Authorization": authHeader },
      cache: "no-store",
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    return NextResponse.json(
      { error: "Backend service offline", details: String(error) },
      { status: 503 }
    );
  }
}
