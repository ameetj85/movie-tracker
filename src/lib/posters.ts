import "server-only";

import { createHash } from "node:crypto";
import { mkdir, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Posters are cached on disk so the collection works offline. They live outside
 * public/ because Next only serves public/ files that existed at build time;
 * src/app/posters/[file]/route.ts serves them at /posters/<file>.
 */
export const POSTER_DIR = path.resolve(
  /*turbopackIgnore: true*/ process.cwd(),
  process.env.POSTER_DIR ?? "data/posters",
);
export const LOCAL_POSTER_PREFIX = "/posters/";
export const POSTER_FILE_RE = /^[a-z0-9_-]+\.(jpg|png|webp)$/i;

const MAX_BYTES = 10 * 1024 * 1024;
const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const isLocalPoster = (url: string | null): url is string =>
  !!url && url.startsWith(LOCAL_POSTER_PREFIX);

export function posterFilePath(file: string): string | null {
  return POSTER_FILE_RE.test(file) ? path.join(/*turbopackIgnore: true*/ POSTER_DIR, file) : null;
}

/**
 * Download a remote poster into the local cache and return its local URL.
 * Local URLs pass through unchanged. If the download fails (offline, bad URL,
 * not an image), returns the original URL so the save still succeeds.
 */
export async function cachePoster(url: string | null): Promise<string | null> {
  if (!url || isLocalPoster(url) || !/^https?:\/\//i.test(url)) return url;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000), redirect: "follow" });
    if (!res.ok) return url;
    const type = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    const ext = EXT_BY_TYPE[type];
    if (!ext) return url;
    if (Number(res.headers.get("content-length") ?? 0) > MAX_BYTES) return url;
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length === 0 || bytes.length > MAX_BYTES) return url;

    // Content-addressed name: re-downloading the same poster reuses the file.
    const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 24);
    const file = `${hash}.${ext}`;
    await mkdir(POSTER_DIR, { recursive: true });
    const dest = path.join(/*turbopackIgnore: true*/ POSTER_DIR, file);
    const tmp = `${dest}.${process.pid}.tmp`;
    await writeFile(tmp, bytes);
    await rename(tmp, dest);
    return `${LOCAL_POSTER_PREFIX}${file}`;
  } catch {
    return url;
  }
}

/** Delete a cached poster file. Caller must ensure nothing references it. */
export async function deletePosterFile(url: string): Promise<void> {
  if (!isLocalPoster(url)) return;
  const file = posterFilePath(url.slice(LOCAL_POSTER_PREFIX.length));
  if (!file) return;
  await unlink(file).catch(() => {});
}
