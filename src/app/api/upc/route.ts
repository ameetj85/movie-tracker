import type { NextRequest } from "next/server";

import { findByUpc } from "@/lib/queries";
import { lookupUpc, UpcError } from "@/lib/upc";
import { normalizeUpc } from "@/lib/upc-title";

export type UpcLookupResponse = {
  upc: string;
  /** null when the barcode isn't in the product database. */
  product: { productTitle: string; title: string; format: string | null } | null;
  /** Copies in the vault that already have this barcode. */
  existing: { movieId: number; title: string; format: string; isWishlist: boolean }[];
};

/** GET /api/upc?code=… — what is this disc, and do I already own it? */
export async function GET(req: NextRequest) {
  const upc = normalizeUpc(req.nextUrl.searchParams.get("code") ?? "");
  if (!upc) return Response.json({ error: "Enter the 8–14 digit number under the barcode." }, { status: 400 });

  const existing = await findByUpc(upc);
  try {
    const product = await lookupUpc(upc);
    return Response.json({ upc, product, existing } satisfies UpcLookupResponse);
  } catch (e) {
    const err = e instanceof UpcError ? e : new UpcError("Barcode lookup failed.", 500);
    // Still report a local match even when the online lookup fails.
    return Response.json({ error: err.message, upc, existing }, { status: err.status });
  }
}
