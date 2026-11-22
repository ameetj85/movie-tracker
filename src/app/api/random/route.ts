import type { NextRequest } from "next/server";

import { parseCollectionQuery } from "@/lib/collection-params";
import { listMovies } from "@/lib/queries";

/**
 * "What should I watch?" — a random owned movie matching the collection page's
 * current search and filters. Unless a watch-status filter is set, only
 * unwatched movies are candidates.
 */
export async function GET(req: NextRequest) {
  const query = parseCollectionQuery(Object.fromEntries(req.nextUrl.searchParams));
  const candidates = await listMovies({
    ...query,
    view: "owned",
    status: query.status ?? "unwatched",
  });
  if (candidates.length === 0) {
    return Response.json({ pick: null, unwatchedOnly: query.status === null });
  }
  const m = candidates[Math.floor(Math.random() * candidates.length)];
  return Response.json({ pick: { id: m.id, title: m.title }, pool: candidates.length });
}
