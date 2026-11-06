import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ source_id: string }> }
) {
  try {
    const { source_id } = await params;
    const { searchParams } = new URL(req.url);
    const lang = searchParams.get("lang") ?? "en";

    const backendResponse = await fetch(
      `${BACKEND_URL}/api/documents/${source_id}/download?lang=${lang}`,
      {
        method: "GET",
        signal: AbortSignal.timeout(30_000),
      }
    );

    if (!backendResponse.ok) {
      const errorText = await backendResponse.text();
      return new NextResponse(`Backend Error: ${errorText}`, {
        status: backendResponse.status,
      });
    }

    const arrayBuffer = await backendResponse.arrayBuffer();

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${source_id}.pdf"`,
        "Content-Length": arrayBuffer.byteLength.toString(),
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return new NextResponse(`Internal Server Error: ${message}`, {
      status: 500,
    });
  }
}
