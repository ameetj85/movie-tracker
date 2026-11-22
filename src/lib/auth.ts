import "server-only";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";

import {
  createSession,
  SESSION_COOKIE,
  sessionCookieOptions,
  validateSessionToken,
  type SessionUser,
} from "@/lib/session";

/**
 * Request-scoped session helpers (the Data Access Layer for auth).
 *
 * The proxy already turns away requests without a valid session, but anything
 * that needs to know *who* is signed in should call these rather than trusting
 * the proxy, per the Next.js authentication guide.
 */

/** The signed-in user, or null. Deduplicated per request. Must be rendered inside <Suspense>. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  // Session expiry compares against the current time, so this can never be prerendered.
  await connection();
  return validateSessionToken(token)?.user ?? null;
});

/** The signed-in user, or a redirect to the sign-in page. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Client IP and user agent for auditing (best effort; there's no proxy in front of a local install). */
export async function requestMeta(): Promise<{ ipAddress: string | null; userAgent: string | null }> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return { ipAddress: forwarded || h.get("x-real-ip") || null, userAgent: h.get("user-agent") };
}

/** Create a session for a user and set the cookie. Only callable from Server Actions / Route Handlers. */
export async function startSession(userId: number): Promise<void> {
  const { token, expiresAt } = createSession(userId, await requestMeta());
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
}

/**
 * Absolute base URL used in emailed links. Set APP_URL when the app is reached by
 * anything other than http://localhost:3000. The request's Host header is
 * deliberately not used: an attacker could forge it to point reset links at their own site.
 */
export function appBaseUrl(): string {
  return process.env.APP_URL || `http://localhost:${process.env.PORT ?? 3000}`;
}
