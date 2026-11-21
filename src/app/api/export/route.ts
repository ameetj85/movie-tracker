import type { NextRequest } from "next/server";

import { exportCsv, exportJson } from "@/lib/export";

/** GET /api/export?format=csv|json — downloads the whole collection. */
export async function GET(req: NextRequest) {
  const format = req.nextUrl.searchParams.get("format") === "json" ? "json" : "csv";
  const stamp = new Date().toISOString().slice(0, 10);
  const body = format === "json" ? await exportJson() : await exportCsv();
  return new Response(body, {
    headers: {
      "Content-Type": format === "json" ? "application/json; charset=utf-8" : "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="movie-vault-${stamp}.${format}"`,
      "Cache-Control": "no-store",
    },
  });
}
