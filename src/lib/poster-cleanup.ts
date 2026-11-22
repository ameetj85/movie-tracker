import "server-only";

import { count, eq } from "drizzle-orm";

import { db } from "@/db";
import { movies } from "@/db/schema";
import { deletePosterFile, isLocalPoster } from "@/lib/posters";

/** Remove a cached poster file once no movie references it any more. */
export async function deletePosterIfUnused(url: string | null): Promise<void> {
  if (!isLocalPoster(url)) return;
  const [{ n }] = await db.select({ n: count() }).from(movies).where(eq(movies.posterUrl, url));
  if (n === 0) await deletePosterFile(url);
}
