import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { and, eq, lt, ne } from "drizzle-orm";

import { db } from "@/db";
import { sessions, users } from "@/db/schema";

/**
 * Database-backed sessions. The browser holds a random token in an httpOnly
 * cookie; the `sessions` table stores only its SHA-256 hash.
 *
 * This module doesn't touch `next/headers`, so the proxy (src/proxy.ts) and unit
 * tests can use it directly. Cookie reads/writes live in `auth.ts` and the proxy.
 */

export const SESSION_COOKIE = "mv_session";
/** Sessions last 30 days and slide forward while in use. */
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** Extend a session (and re-send the cookie) at most once a day. */
const REFRESH_AFTER_MS = 24 * 60 * 60 * 1000;

/** The narrow view of a user that the UI and Server Actions get. */
export type SessionUser = { id: number; email: string; name: string | null };

/** A random 256-bit token, URL-safe. Used for session cookies and reset links. */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Cookie settings for the session cookie. `secure` follows APP_URL, so plain-http LAN use still works. */
export function sessionCookieOptions(expires: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: (process.env.APP_URL ?? "").startsWith("https://"),
    path: "/",
    expires,
  };
}

export function createSession(
  userId: number,
  meta: { userAgent?: string | null; ipAddress?: string | null } = {},
): { token: string; expiresAt: Date } {
  const token = generateToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  db.insert(sessions)
    .values({
      id: hashToken(token),
      userId,
      expiresAt: expiresAt.toISOString(),
      lastSeenAt: now.toISOString(),
      userAgent: meta.userAgent?.slice(0, 500) ?? null,
      ipAddress: meta.ipAddress ?? null,
    })
    .run();
  return { token, expiresAt };
}

export type ValidatedSession = {
  user: SessionUser;
  expiresAt: Date;
  /** True when the expiry was extended, so the caller should re-send the cookie. */
  refreshed: boolean;
};

/** Look up a session token. Expired sessions are deleted and return null. */
export function validateSessionToken(token: string): ValidatedSession | null {
  if (!token) return null;
  const id = hashToken(token);
  const row = db
    .select({
      expiresAt: sessions.expiresAt,
      lastSeenAt: sessions.lastSeenAt,
      user: { id: users.id, email: users.email, name: users.name },
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.id, id))
    .get();
  if (!row) return null;

  const now = Date.now();
  if (Date.parse(row.expiresAt) <= now) {
    db.delete(sessions).where(eq(sessions.id, id)).run();
    return null;
  }

  if (now - Date.parse(row.lastSeenAt) >= REFRESH_AFTER_MS) {
    const expiresAt = new Date(now + SESSION_TTL_MS);
    db.update(sessions)
      .set({ expiresAt: expiresAt.toISOString(), lastSeenAt: new Date(now).toISOString() })
      .where(eq(sessions.id, id))
      .run();
    return { user: row.user, expiresAt, refreshed: true };
  }
  return { user: row.user, expiresAt: new Date(row.expiresAt), refreshed: false };
}

export function invalidateSession(token: string): void {
  db.delete(sessions).where(eq(sessions.id, hashToken(token))).run();
}

/** Sign a user out everywhere (optionally keeping the current session). */
export function invalidateUserSessions(userId: number, exceptToken?: string): void {
  db.delete(sessions)
    .where(
      exceptToken
        ? and(eq(sessions.userId, userId), ne(sessions.id, hashToken(exceptToken)))
        : eq(sessions.userId, userId),
    )
    .run();
}

/** Remove expired sessions. Called opportunistically on sign-in. */
export function deleteExpiredSessions(): void {
  db.delete(sessions).where(lt(sessions.expiresAt, new Date().toISOString())).run();
}
