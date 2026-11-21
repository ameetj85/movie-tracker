import { getTmdbMovie, TmdbError } from "@/lib/tmdb";

export async function GET(_req: Request, ctx: RouteContext<"/api/tmdb/movie/[id]">) {
  const id = Number((await ctx.params).id);
  if (!Number.isSafeInteger(id) || id <= 0) {
    return Response.json({ error: "Invalid TMDB id." }, { status: 400 });
  }
  try {
    return Response.json(await getTmdbMovie(id));
  } catch (e) {
    const err = e instanceof TmdbError ? e : new TmdbError("TMDB lookup failed.", 500);
    return Response.json({ error: err.message }, { status: err.status });
  }
}
