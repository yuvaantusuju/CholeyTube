export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Liveness probe. CholeyTube is stateless (no database), so this only reports
 * process health plus which resolver mode the API is running in.
 */
export async function GET() {
  return Response.json(
    {
      ok: true,
      service: "choleytube",
      mode: process.env.RESOLVER_ENDPOINT ? "live" : "preview",
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
