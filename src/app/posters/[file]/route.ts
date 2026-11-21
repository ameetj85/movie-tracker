import { readFile } from "node:fs/promises";

import { posterFilePath } from "@/lib/posters";

const TYPES: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

/** Serves locally cached posters from data/posters (see src/lib/posters.ts). */
export async function GET(_req: Request, ctx: RouteContext<"/posters/[file]">) {
  const { file } = await ctx.params;
  const filePath = posterFilePath(file);
  if (!filePath) return new Response("Not found", { status: 404 });

  try {
    const body = await readFile(filePath);
    const ext = file.split(".").pop()!.toLowerCase();
    return new Response(body, {
      headers: {
        "Content-Type": TYPES[ext] ?? "application/octet-stream",
        // File names are content hashes, so they never change.
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
