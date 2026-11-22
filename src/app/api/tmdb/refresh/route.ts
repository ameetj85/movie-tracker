import { revalidatePath } from "next/cache";

import { db } from "@/db";
import { movies } from "@/db/schema";
import { backupIfDue } from "@/lib/backup";
import { isTmdbConfigured, TmdbError } from "@/lib/tmdb";
import { syncMovieFromTmdb, type SyncOutcome } from "@/lib/tmdb-sync";

export type RefreshLine =
  | { type: "progress"; done: number; total: number }
  | { type: "result"; updated: number; unchanged: number; unmatched: string[]; errors: number }
  | { type: "error"; message: string };

const CONCURRENCY = 4;

/**
 * POST /api/tmdb/refresh — fill blank metadata and record franchises for every
 * movie from TMDB ("fill" mode: never overwrites what's there). Streams NDJSON
 * {type:"progress"} lines, then one {type:"result"} (or {type:"error"}).
 */
export async function POST() {
  if (!isTmdbConfigured()) {
    return Response.json({ error: "TMDB isn't configured." }, { status: 503 });
  }
  const all = db.select().from(movies).all();
  await backupIfDue();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (line: RefreshLine) => controller.enqueue(encoder.encode(JSON.stringify(line) + "\n"));
      const counts: Record<SyncOutcome, number> = { updated: 0, unchanged: 0, unmatched: 0 };
      const unmatched: string[] = [];
      let errors = 0;
      let done = 0;
      let next = 0;
      let fatal: string | null = null;
      send({ type: "progress", done, total: all.length });

      async function worker() {
        while (next < all.length && !fatal) {
          const m = all[next++];
          try {
            const outcome = await syncMovieFromTmdb(m, "fill");
            counts[outcome]++;
            if (outcome === "unmatched") unmatched.push(m.title);
          } catch (e) {
            // Bad credentials or no network: stop instead of failing every movie.
            if (e instanceof TmdbError && (e.status === 502 || e.status === 503)) fatal = e.message;
            else errors++;
          }
          send({ type: "progress", done: ++done, total: all.length });
        }
      }

      try {
        await Promise.all(Array.from({ length: Math.min(CONCURRENCY, all.length) }, worker));
        revalidatePath("/", "layout");
        if (fatal) send({ type: "error", message: `${fatal} ${counts.updated} movies were updated before it stopped.` });
        else send({ type: "result", updated: counts.updated, unchanged: counts.unchanged, unmatched, errors });
      } catch (e) {
        console.error("TMDB refresh failed", e);
        send({ type: "error", message: "Refresh failed." });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
