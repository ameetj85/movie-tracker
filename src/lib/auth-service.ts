import "server-only";

import { and, count, eq, gt, isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import { passwordResetTokens, users } from "@/db/schema";
import { sendEmail } from "@/lib/email";
import { getDummyHash, hashPassword, verifyPassword } from "@/lib/password";
import { generateToken, hashToken, invalidateUserSessions, type SessionUser } from "@/lib/session";

/**
 * Account logic with no request/cookie handling, so it can be unit tested.
 * Server Actions in `auth-actions.ts` wrap these and manage the session cookie.
 */

/** Lock an account for LOCKOUT_MS after this many failed sign-ins in a row. */
export const MAX_FAILED_LOGINS = 5;
export const LOCKOUT_MS = 15 * 60 * 1000;
/** Reset links are valid for one hour. */
export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
/** Ignore repeat reset requests for the same account within this window. */
const RESET_REQUEST_COOLDOWN_MS = 60 * 1000;

function toSessionUser(u: { id: number; email: string; name: string | null }): SessionUser {
  return { id: u.id, email: u.email, name: u.name };
}

export function countUsers(): number {
  return db.select({ n: count() }).from(users).get()?.n ?? 0;
}

/**
 * Anyone can create the first account. After that, sign-up is closed unless
 * AUTH_ALLOW_SIGNUP=true, so a vault reachable on the network isn't open to strangers.
 */
export function isSignUpOpen(): boolean {
  return process.env.AUTH_ALLOW_SIGNUP === "true" || countUsers() === 0;
}

export type RegisterResult = { ok: true; user: SessionUser } | { ok: false; field?: "email"; message: string };

export async function registerUser(input: { email: string; password: string; name: string | null }): Promise<RegisterResult> {
  if (!isSignUpOpen()) return { ok: false, message: "Sign-up is closed. Ask the owner of this vault for an account." };
  const passwordHash = await hashPassword(input.password);
  const now = new Date().toISOString();
  try {
    const user = db
      .insert(users)
      .values({ email: input.email, name: input.name, passwordHash, passwordChangedAt: now, lastLoginAt: now })
      .returning()
      .get();
    return { ok: true, user: toSessionUser(user) };
  } catch (err) {
    if (err instanceof Error && /UNIQUE constraint failed: users\.email/.test(err.message)) {
      return { ok: false, field: "email", message: "An account with this email already exists." };
    }
    throw err;
  }
}

export type AuthenticateResult = { ok: true; user: SessionUser } | { ok: false; message: string };

const INVALID_CREDENTIALS = "Incorrect email or password.";

export async function authenticate(email: string, password: string): Promise<AuthenticateResult> {
  const user = db.select().from(users).where(eq(users.email, email)).get();
  if (!user) {
    await verifyPassword(password, await getDummyHash());
    return { ok: false, message: INVALID_CREDENTIALS };
  }

  const now = Date.now();
  if (user.lockedUntil && Date.parse(user.lockedUntil) > now) {
    const minutes = Math.ceil((Date.parse(user.lockedUntil) - now) / 60_000);
    return {
      ok: false,
      message: `Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}, or reset your password.`,
    };
  }

  if (!(await verifyPassword(password, user.passwordHash))) {
    // A lock that has expired starts a fresh count.
    const attempts = (user.lockedUntil ? 0 : user.failedLoginAttempts) + 1;
    const locked = attempts >= MAX_FAILED_LOGINS;
    db.update(users)
      .set({
        failedLoginAttempts: locked ? 0 : attempts,
        lockedUntil: locked ? new Date(now + LOCKOUT_MS).toISOString() : null,
      })
      .where(eq(users.id, user.id))
      .run();
    return { ok: false, message: INVALID_CREDENTIALS };
  }

  db.update(users)
    .set({ failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date(now).toISOString() })
    .where(eq(users.id, user.id))
    .run();
  return { ok: true, user: toSessionUser(user) };
}

/**
 * Start a password reset. If the email belongs to an account, issue a single-use
 * token (superseding older ones) and email the link. Callers must show the same
 * message either way, so the form can't be used to discover accounts.
 *
 * Returns the raw token for tests; it is never shown to the requester.
 */
export async function requestPasswordReset(
  email: string,
  meta: { ipAddress?: string | null; baseUrl: string },
): Promise<string | null> {
  const user = db.select({ id: users.id, email: users.email, name: users.name }).from(users).where(eq(users.email, email)).get();
  if (!user) return null;

  const now = Date.now();
  const recent = db
    .select({ id: passwordResetTokens.id })
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.userId, user.id),
        isNull(passwordResetTokens.usedAt),
        // Issued within the cooldown <=> it still has more than (TTL - cooldown) to live.
        gt(passwordResetTokens.expiresAt, new Date(now + RESET_TOKEN_TTL_MS - RESET_REQUEST_COOLDOWN_MS).toISOString()),
      ),
    )
    .get();
  if (recent) return null;

  const token = generateToken();
  const nowIso = new Date(now).toISOString();
  db.transaction((tx) => {
    // Only the newest link works.
    tx.update(passwordResetTokens)
      .set({ usedAt: nowIso })
      .where(and(eq(passwordResetTokens.userId, user.id), isNull(passwordResetTokens.usedAt)))
      .run();
    tx.insert(passwordResetTokens)
      .values({
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(now + RESET_TOKEN_TTL_MS).toISOString(),
        requestedIp: meta.ipAddress ?? null,
      })
      .run();
  });

  const link = new URL(`/reset-password?token=${encodeURIComponent(token)}`, meta.baseUrl).toString();
  const greeting = user.name ? `Hi ${user.name},` : "Hi,";
  await sendEmail({
    to: user.email,
    subject: "Reset your Movie Vault password",
    text:
      `${greeting}\n\nSomeone (hopefully you) asked to reset the password for your Movie Vault account.\n\n` +
      `Open this link to choose a new password. It works once and expires in 1 hour:\n${link}\n\n` +
      `If you didn't ask for this, you can ignore this email; your password won't change.`,
    html:
      `<p>${escapeHtml(greeting)}</p><p>Someone (hopefully you) asked to reset the password for your Movie Vault account.</p>` +
      `<p><a href="${escapeHtml(link)}">Choose a new password</a></p>` +
      `<p>The link works once and expires in 1 hour. If you didn't ask for this, you can ignore this email; your password won't change.</p>`,
  });
  return token;
}

/** Find the account a reset token belongs to, if the token is unused and unexpired. */
export function findValidResetToken(token: string): { id: number; userId: number } | null {
  const row = db
    .select({ id: passwordResetTokens.id, userId: passwordResetTokens.userId, expiresAt: passwordResetTokens.expiresAt })
    .from(passwordResetTokens)
    .where(and(eq(passwordResetTokens.tokenHash, hashToken(token)), isNull(passwordResetTokens.usedAt)))
    .get();
  if (!row || Date.parse(row.expiresAt) <= Date.now()) return null;
  return { id: row.id, userId: row.userId };
}

export type ResetResult = { ok: true; user: SessionUser } | { ok: false; message: string };

/**
 * Redeem a reset token: set the new password, burn every outstanding token, and
 * sign the account out everywhere. Clicking the emailed link also proves the address works.
 */
export async function resetPassword(token: string, newPassword: string): Promise<ResetResult> {
  const found = findValidResetToken(token);
  if (!found) return { ok: false, message: "This reset link is invalid or has expired. Request a new one." };

  const passwordHash = await hashPassword(newPassword);
  const nowIso = new Date().toISOString();
  const user = db.transaction((tx) => {
    // Claim the token first, so two concurrent submissions can't both succeed.
    const claimed = tx
      .update(passwordResetTokens)
      .set({ usedAt: nowIso })
      .where(and(eq(passwordResetTokens.id, found.id), isNull(passwordResetTokens.usedAt)))
      .run();
    if (claimed.changes === 0) return null;
    tx.update(passwordResetTokens)
      .set({ usedAt: nowIso })
      .where(and(eq(passwordResetTokens.userId, found.userId), isNull(passwordResetTokens.usedAt)))
      .run();
    const current = tx.select({ emailVerifiedAt: users.emailVerifiedAt }).from(users).where(eq(users.id, found.userId)).get();
    return tx
      .update(users)
      .set({
        passwordHash,
        passwordChangedAt: nowIso,
        emailVerifiedAt: current?.emailVerifiedAt ?? nowIso,
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: nowIso,
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(eq(users.id, found.userId))
      .returning()
      .get();
  });
  if (!user) return { ok: false, message: "This reset link is invalid or has expired. Request a new one." };

  invalidateUserSessions(user.id);
  return { ok: true, user: toSessionUser(user) };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
