import { z } from "zod";

import { WATCH_STATUSES } from "./constants";

/** Empty / whitespace-only strings become null. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Must be ${max} characters or fewer`)
    .transform((v) => (v === "" ? null : v));

/** Optional integer typed into a text input ("" → null). */
const optionalInt = (min: number, max: number, label: string) =>
  z
    .string()
    .trim()
    .transform((v, ctx) => {
      if (v === "") return null;
      const n = Number(v);
      if (!Number.isInteger(n) || n < min || n > max) {
        ctx.addIssue({ code: "custom", message: `${label} must be a whole number between ${min} and ${max}` });
        return z.NEVER;
      }
      return n;
    });

/** Optional YYYY-MM-DD date ("" → null). */
const optionalDate = z
  .string()
  .trim()
  .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), "Use YYYY-MM-DD")
  .transform((v) => (v === "" ? null : v));

export const copySchema = z
  .object({
    format: z.string().trim().min(1, "Choose a format").max(50),
    edition: optionalText(100),
    purchaseDate: optionalDate,
    price: z
      .string()
      .trim()
      .transform((v, ctx) => {
        if (v === "") return null;
        const n = Number(v.replace(/^\$/, ""));
        if (!Number.isFinite(n) || n < 0 || n > 100_000) {
          ctx.addIssue({ code: "custom", message: "Enter a valid price" });
          return z.NEVER;
        }
        return Math.round(n * 100);
      }),
    condition: optionalText(50),
    location: optionalText(100).optional().transform((v) => v ?? null),
    loanedTo: optionalText(100).optional().transform((v) => v ?? null),
    loanedOn: optionalDate.optional().transform((v) => v ?? null),
  })
  // A loan date without a borrower is meaningless: drop it.
  .transform((c) => (c.loanedTo ? c : { ...c, loanedOn: null }));

export type CopyFormValues = z.input<typeof copySchema>;
export type CopyInput = z.output<typeof copySchema>;

export const movieInputSchema = z
  .object({
    tmdbId: z.number().int().positive().nullable(),
    title: z.string().trim().min(1, "Title is required").max(300),
    releaseYear: optionalInt(1870, 2100, "Release year"),
    director: optionalText(200),
    cast: optionalText(2000),
    genres: z
      .string()
      .max(500)
      .transform((v) => {
        const list = [...new Set(v.split(",").map((g) => g.trim()).filter(Boolean))];
        return list.length ? list : null;
      }),
    posterUrl: optionalText(2000).refine(
      (v) => v === null || /^(https?:\/\/|\/)/.test(v),
      "Must be an http(s) URL or a /path",
    ),
    synopsis: optionalText(5000),
    runtime: optionalInt(1, 1000, "Runtime"),
    isWishlist: z.boolean(),
    watchStatus: z.enum(WATCH_STATUSES),
    rating: optionalInt(1, 10, "Rating"),
    notes: optionalText(5000),
    copies: z.array(copySchema).max(50),
  })
  .superRefine((m, ctx) => {
    if (!m.isWishlist && m.copies.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["copies"],
        message: "Add at least one format you own",
      });
    }
  });

/** Raw shape the client form sends (all text inputs are strings). */
export type MovieFormValues = z.input<typeof movieInputSchema>;
export type MovieInput = z.output<typeof movieInputSchema>;

export type FieldErrors = Record<string, string>;

export function toFieldErrors(error: z.ZodError): FieldErrors {
  const out: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    out[key] ??= issue.message;
  }
  return out;
}
