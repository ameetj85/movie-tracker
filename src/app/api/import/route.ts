import { revalidatePath } from "next/cache";
import { z } from "zod";

import { FORMATS } from "@/lib/constants";
import { commitImport, MAX_IMPORT_BYTES, planImport, type ImportOptions } from "@/lib/import";
import { isTmdbConfigured } from "@/lib/tmdb";

const bodySchema = z.object({
  mode: z.enum(["preview", "commit"]),
  csv: z.string().max(MAX_IMPORT_BYTES, "The file is larger than 5 MB."),
  options: z.object({
    defaultFormat: z.enum(FORMATS).nullable(),
    skipExisting: z.boolean(),
    enrich: z.boolean(),
  }),
});

export type ImportPreview = Awaited<ReturnType<typeof preview>>;

function preview(plan: Exclude<ReturnType<typeof planImport>, { fatal: string }>) {
  const ISSUE_CAP = 200;
  return {
    totalRows: plan.totalRows,
    columns: plan.columns,
    unmappedHeaders: plan.unmappedHeaders,
    isLetterboxd: plan.isLetterboxd,
    movieCount: plan.movies.length,
    copyCount: plan.movies.reduce((n, m) => n + m.input.copies.length, 0),
    wishlistCount: plan.movies.filter((m) => m.input.isWishlist).length,
    sample: plan.movies.slice(0, 50).map((m) => ({
      title: m.input.title,
      releaseYear: m.input.releaseYear,
      formats: m.input.copies.map((c) => c.format),
      isWishlist: m.input.isWishlist,
      rows: m.rows,
    })),
    existingCount: plan.existing.length,
    existing: plan.existing.slice(0, 50),
    missingFormatRows: plan.missingFormatRows,
    issueCount: plan.issues.length,
    errorCount: plan.issues.filter((i) => i.level === "error").length,
    issues: plan.issues.slice(0, ISSUE_CAP),
    tmdbEnabled: isTmdbConfigured(),
  };
}

/**
 * POST /api/import
 * - mode "preview": parse + validate, returns ImportPreview JSON. Nothing is written.
 * - mode "commit": re-plans (stateless) and imports, streaming NDJSON lines:
 *   {type:"progress",phase,done,total}… then {type:"result",…} or {type:"error",message}.
 */
export async function POST(req: Request) {
  if (Number(req.headers.get("content-length") ?? 0) > MAX_IMPORT_BYTES * 2) {
    return Response.json({ error: "The file is larger than 5 MB." }, { status: 413 });
  }
  let body: z.infer<typeof bodySchema>;
  try {
    const parsed = bodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
    }
    body = parsed.data;
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const options: ImportOptions = body.options;
  const plan = planImport(body.csv, options);
  if ("fatal" in plan) return Response.json({ error: plan.fatal }, { status: 422 });

  if (body.mode === "preview") return Response.json(preview(plan));

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
      try {
        const result = await commitImport(plan, options, (p) => send({ type: "progress", ...p }));
        revalidatePath("/", "layout");
        send({ type: "result", ...result });
      } catch (e) {
        console.error("Import failed", e);
        send({ type: "error", message: "Import failed; nothing was saved." });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
