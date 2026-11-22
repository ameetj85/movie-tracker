/**
 * Retail product titles from UPC databases look like
 * "The Dark Knight (Blu-ray + DVD + Digital Copy)" or "Jurassic Park 4K Ultra HD [Steelbook]".
 * These helpers turn them into a searchable movie title and a best-guess format.
 */

/** Words that describe the product, not the film. */
const PACKAGING =
  /\b(4k|uhd|ultra(\s*hd)?|blu-?ray|bd|dvd|vhs|digital(\s*(copy|code|hd))?|hd|3d|widescreen|full\s*screen|special\s*edition|collector'?s\s*edition|limited\s*edition|steel\s*book|steelbook|combo(\s*pack)?|slipcover|region\s*\w+|\d+[-\s]*discs?|2[-\s]*pack|includes?|with|bonus|theatrical|unrated|rated|edition|movie)\b/gi;

/** True if a bracketed part only describes packaging (so it can be dropped). */
function isPackagingOnly(part: string): boolean {
  return part.replace(PACKAGING, "").replace(/[\s+&,/\-:]+/g, "") === "";
}

/**
 * Home-video labels that product databases put in front of the title, e.g.
 * "Mill Creek - Fight Club". Only these are stripped, so real titles with a
 * dash ("Star Wars - A New Hope") are left alone.
 */
const LABEL_PREFIX =
  /^(mill\s*creek|shout!?\s*factory|scream\s*factory|criterion(\s*collection)?|arrow(\s*video)?|kino\s*lorber|vinegar\s*syndrome|warner(\s*bros\.?)?(\s*home\s*video)?|universal(\s*studios)?|disney|walt\s*disney|paramount|sony(\s*pictures)?|columbia|lionsgate|20th\s*century\s*(fox|studios)|mgm|anchor\s*bay|image\s*entertainment)\s*[-–:]\s+/i;

export function cleanUpcTitle(raw: string): string {
  let t = raw.trim().replace(LABEL_PREFIX, "");
  // Drop (…) and […] groups that are only packaging words: "(Blu-ray + DVD)", "[4K UHD]".
  t = t.replace(/\s*[([]([^)\]]*)[)\]]/g, (whole, inner: string) => (isPackagingOnly(inner) ? "" : whole));
  // Drop a trailing run of packaging words: "Heat 4K Ultra HD + Blu-ray".
  // Words keep inner hyphens ("Blu-ray"); a lone "-" separator is stripped as its own word.
  for (;;) {
    const m = /(?:^|[\s+&,/:]+)([^\s+&,/:]+)\s*$/.exec(t);
    if (!m || !isPackagingOnly(m[1])) break;
    t = t.slice(0, m.index).trim();
  }
  return t.replace(/[\s:,\-–]+$/, "").replace(/\s{2,}/g, " ").trim() || raw.trim();
}

/** The best single format to pre-select, from the product title. */
export function guessUpcFormat(raw: string): string | null {
  const t = raw.toLowerCase();
  if (/\b(4k|uhd|ultra\s*hd)\b/.test(t)) return "4K UHD";
  if (/\bblu-?ray\b/.test(t)) return "Blu-ray";
  if (/\bdvd\b/.test(t)) return "DVD";
  if (/\bvhs\b/.test(t)) return "VHS";
  return null;
}

/** UPC-A / EAN-13 / EAN-8 digits, or null. */
export function normalizeUpc(raw: string): string | null {
  const digits = raw.replace(/[\s-]/g, "");
  return /^\d{8,14}$/.test(digits) ? digits : null;
}
