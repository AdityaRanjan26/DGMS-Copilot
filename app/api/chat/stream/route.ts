/**
 * app/api/chat/stream/route.ts
 *
 * Proxies the SSE streaming response from the Python backend.
 * Returns a ReadableStream that the assistant page consumes.
 */
export const dynamic = "force-dynamic";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json();

    const backendResponse = await fetch(`${BACKEND_URL}/api/chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      // @ts-expect-error — Node 18+ supports this
      duplex: "half",
    });

    if (!backendResponse.ok) {
      const error = await backendResponse.text();
      return new Response(
        `data: ${JSON.stringify({ error: `Backend error: ${error}`, done: true, citations: [] })}\n\n`,
        {
          status: backendResponse.status,
          headers: { "Content-Type": "text/event-stream" },
        }
      );
    }

    // Proxy the SSE stream directly
    return new Response(backendResponse.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    const msg =
      error instanceof TypeError && error.message.includes("fetch failed")
        ? "Backend is offline. Please start the Python server."
        : "An unexpected error occurred.";

    return new Response(
      `data: ${JSON.stringify({ error: msg, done: true, citations: [], intent: "ERROR" })}\n\n`,
      {
        status: 503,
        headers: { "Content-Type": "text/event-stream" },
      }
    );
  }
}
