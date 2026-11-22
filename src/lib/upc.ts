import "server-only";

import { cleanUpcTitle, guessUpcFormat } from "@/lib/upc-title";

/**
 * Barcode → product title via UPCitemdb's free trial endpoint (no API key,
 * about 100 lookups a day per IP). Only the barcode digits are sent.
 */
const ENDPOINT = "https://api.upcitemdb.com/prod/trial/lookup";

export class UpcError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export type UpcResult = {
  /** Title as the product database lists it, e.g. "Heat (Blu-ray + Digital)". */
  productTitle: string;
  /** Cleaned film title for the TMDB search, e.g. "Heat". */
  title: string;
  /** Best-guess format, e.g. "Blu-ray", or null. */
  format: string | null;
};

type RawResponse = { code?: string; message?: string; items?: { title?: string }[] };

export async function lookupUpc(upc: string): Promise<UpcResult | null> {
  let res: Response;
  try {
    res = await fetch(`${ENDPOINT}?upc=${encodeURIComponent(upc)}`, {
      headers: { Accept: "application/json", "User-Agent": "MovieVault/1.0" },
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    throw new UpcError("Couldn't reach the barcode database. Check your internet connection.", 502);
  }
  if (res.status === 429) throw new UpcError("Daily barcode lookup limit reached. Try again tomorrow, or search by title.", 429);
  const body = (await res.json().catch(() => ({}))) as RawResponse;
  if (res.status === 400 || body.code === "INVALID_UPC") return null;
  if (!res.ok) throw new UpcError(`Barcode lookup failed (${res.status}).`, 502);
  const productTitle = body.items?.find((i) => i.title)?.title?.trim();
  if (!productTitle) return null;
  return { productTitle, title: cleanUpcTitle(productTitle), format: guessUpcFormat(productTitle) };
}
