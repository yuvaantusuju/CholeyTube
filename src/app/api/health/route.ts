import { sql } from "drizzle-orm";
import { getDb } from "@/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();
  if (!db) {
    return Response.json({
      ok: true,
      database: "skipped",
      note: "DATABASE_URL not set; the app runs without persistence.",
    });
  }
  try {
    await db.execute(sql`select 1`);
    return Response.json({ ok: true, database: "ok" });
  } catch (err) {
    return Response.json(
      { ok: false, database: "error", error: err instanceof Error ? err.message : "unknown" },
      { status: 500 }
    );
  }
}
