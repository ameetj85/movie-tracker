import type { NextRequest } from "next/server";

import { searchTmdb, TmdbError } from "@/lib/tmdb";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const yearParam = Number(req.nextUrl.searchParams.get("year"));
  if (q.length < 2) return Response.json({ results: [] });
  if (q.length > 200) return Response.json({ error: "Query too long." }, { status: 400 });

  try {
    const year = Number.isInteger(yearParam) && yearParam > 1800 ? yearParam : undefined;
    return Response.json({ results: await searchTmdb(q, year) });
  } catch (e) {
    const err = e instanceof TmdbError ? e : new TmdbError("TMDB search failed.", 500);
    return Response.json({ error: err.message }, { status: err.status });
  }
}
