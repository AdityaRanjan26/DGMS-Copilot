import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const filename = url.searchParams.get("filename");
    
    if (!filename) {
      return new NextResponse("Filename is required", { status: 400 });
    }

    const response = await fetch(`${BACKEND_URL}/api/reports/export/${encodeURIComponent(filename)}`, {
      method: "GET",
    });

    if (!response.ok) {
      const error = await response.text();
      return new NextResponse(`Backend error: ${error}`, { status: response.status });
    }

    const blob = await response.blob();
    const headers = new Headers();
    headers.set("Content-Type", "application/pdf");
    headers.set("Content-Disposition", `attachment; filename=compliance_${filename}.pdf`);
    
    return new NextResponse(blob, { status: 200, headers });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new NextResponse(message, { status: 500 });
  }
}
