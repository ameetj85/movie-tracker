import { notFound } from "next/navigation";

/** Parse a positive integer route param, or render the 404 page. */
export function parseIdParam(value: string): number {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  return id;
}
