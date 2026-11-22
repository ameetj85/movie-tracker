import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/db";
import { passwordResetTokens, sessions, users } from "@/db/schema";
import {
  authenticate,
  findValidResetToken,
  isSignUpOpen,
  MAX_FAILED_LOGINS,
  registerUser,
  requestPasswordReset,
  resetPassword,
} from "@/lib/auth-service";
import { safeNextPath, signUpSchema } from "@/lib/auth-validation";
import { hashPassword, verifyPassword } from "@/lib/password";
import { createSession, hashToken, validateSessionToken } from "@/lib/session";

const sendEmail = vi.hoisted(() => vi.fn(async () => {}));
vi.mock("@/lib/email", () => ({ sendEmail, isEmailConfigured: () => false }));

const BASE = { baseUrl: "http://localhost:3000" };
const register = (email = "me@example.com", password = "correct horse") =>
  registerUser({ email, password, name: "Me" }).then((r) => {
    if (!r.ok) throw new Error(r.message);
    return r.user;
  });

beforeEach(() => {
  db.delete(users).run();
  sendEmail.mockClear();
});
afterEach(() => {
  vi.useRealTimers();
  delete process.env.AUTH_ALLOW_SIGNUP;
});

describe("password hashing", () => {
  it("verifies the right password only, with a fresh salt each time", async () => {
    const a = await hashPassword("hunter22");
    const b = await hashPassword("hunter22");
    expect(a).not.toBe(b);
    expect(a.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("hunter22", a)).toBe(true);
    expect(await verifyPassword("hunter23", a)).toBe(false);
    expect(await verifyPassword("hunter22", "not-a-hash")).toBe(false);
  });
});

describe("validation", () => {
  it("normalizes email and checks the confirmation", () => {
    const ok = signUpSchema.safeParse({ name: " ", email: " Me@Example.COM ", password: "12345678", confirmPassword: "12345678" });
    expect(ok.success && ok.data).toMatchObject({ name: null, email: "me@example.com" });
    const bad = signUpSchema.safeParse({ name: "", email: "x@y.z", password: "12345678", confirmPassword: "nope" });
    expect(bad.success).toBe(false);
  });

  it("only redirects to local paths after sign-in", () => {
    expect(safeNextPath("/movies/3?x=1")).toBe("/movies/3?x=1");
    expect(safeNextPath("https://evil.example")).toBe("/");
    expect(safeNextPath("//evil.example")).toBe("/");
    expect(safeNextPath("/\\evil.example")).toBe("/");
    expect(safeNextPath(undefined)).toBe("/");
  });
});

describe("sign-up", () => {
  it("is open for the first account only, unless AUTH_ALLOW_SIGNUP=true", async () => {
    expect(isSignUpOpen()).toBe(true);
    await register();
    expect(isSignUpOpen()).toBe(false);
    expect(await registerUser({ email: "two@example.com", password: "password1", name: null })).toMatchObject({ ok: false });
    process.env.AUTH_ALLOW_SIGNUP = "true";
    expect(await registerUser({ email: "two@example.com", password: "password1", name: null })).toMatchObject({ ok: true });
  });

  it("rejects a duplicate email", async () => {
    process.env.AUTH_ALLOW_SIGNUP = "true";
    await register();
    expect(await registerUser({ email: "me@example.com", password: "password1", name: null })).toMatchObject({
      ok: false,
      field: "email",
    });
  });
});

describe("sign-in", () => {
  it("accepts the right password and records the login", async () => {
    const user = await register();
    expect(await authenticate("me@example.com", "correct horse")).toEqual({ ok: true, user });
    expect(await authenticate("me@example.com", "wrong")).toMatchObject({ ok: false, message: "Incorrect email or password." });
    expect(await authenticate("nobody@example.com", "correct horse")).toMatchObject({
      ok: false,
      message: "Incorrect email or password.",
    });
  });

  it(`locks the account after ${MAX_FAILED_LOGINS} failures, even for the right password`, async () => {
    await register();
    for (let i = 0; i < MAX_FAILED_LOGINS; i++) await authenticate("me@example.com", "wrong");
    const locked = await authenticate("me@example.com", "correct horse");
    expect(locked.ok).toBe(false);
    expect(!locked.ok && locked.message).toMatch(/Too many failed attempts/);

    // The lock expires after 15 minutes.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 16 * 60 * 1000);
    expect(await authenticate("me@example.com", "correct horse")).toMatchObject({ ok: true });
  });
});

describe("sessions", () => {
  it("validates a token, stores only its hash, and expires", async () => {
    const user = await register();
    const { token } = createSession(user.id, { userAgent: "test" });
    expect(db.select().from(sessions).all().map((s) => s.id)).toEqual([hashToken(token)]);
    expect(validateSessionToken(token)).toMatchObject({ user, refreshed: false });
    expect(validateSessionToken("bogus")).toBeNull();

    // Two days later the session slides forward; after 31 days it's gone.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 2 * 24 * 60 * 60 * 1000);
    expect(validateSessionToken(token)).toMatchObject({ refreshed: true });
    vi.setSystemTime(Date.now() + 31 * 24 * 60 * 60 * 1000);
    expect(validateSessionToken(token)).toBeNull();
    expect(db.select().from(sessions).all()).toEqual([]);
  });
});

describe("password reset", () => {
  it("emails a single-use link that sets the password and signs out everywhere", async () => {
    const user = await register();
    const { token: sessionToken } = createSession(user.id);

    const token = await requestPasswordReset("ME@example.com".toLowerCase(), { ...BASE, ipAddress: "10.0.0.1" });
    expect(token).toBeTruthy();
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const mail = (sendEmail.mock.calls[0] as unknown as [{ to: string; text: string }])[0];
    expect(mail.to).toBe("me@example.com");
    expect(mail.text).toContain(`http://localhost:3000/reset-password?token=${token}`);
    // Only the hash is stored.
    expect(db.select().from(passwordResetTokens).get()).toMatchObject({ tokenHash: hashToken(token!), requestedIp: "10.0.0.1" });

    expect(await resetPassword(token!, "brand new pass")).toMatchObject({ ok: true, user: { id: user.id } });
    expect(await authenticate("me@example.com", "brand new pass")).toMatchObject({ ok: true });
    expect(await authenticate("me@example.com", "correct horse")).toMatchObject({ ok: false });
    expect(validateSessionToken(sessionToken)).toBeNull();
    expect(db.select().from(users).where(eq(users.id, user.id)).get()?.emailVerifiedAt).toBeTruthy();

    // The link can't be reused.
    expect(findValidResetToken(token!)).toBeNull();
    expect(await resetPassword(token!, "another pass")).toMatchObject({ ok: false });
  });

  it("does nothing for unknown emails and throttles repeat requests", async () => {
    await register();
    expect(await requestPasswordReset("nobody@example.com", BASE)).toBeNull();
    expect(sendEmail).not.toHaveBeenCalled();

    vi.useFakeTimers({ toFake: ["Date"] });
    const first = await requestPasswordReset("me@example.com", BASE);
    expect(await requestPasswordReset("me@example.com", BASE)).toBeNull();
    vi.setSystemTime(Date.now() + 2 * 60 * 1000);
    const second = await requestPasswordReset("me@example.com", BASE);
    expect(second).toBeTruthy();
    // A newer link supersedes the older one.
    expect(findValidResetToken(first!)).toBeNull();
    expect(findValidResetToken(second!)).not.toBeNull();
  });

  it("rejects expired links", async () => {
    await register();
    const token = await requestPasswordReset("me@example.com", BASE);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 61 * 60 * 1000);
    expect(findValidResetToken(token!)).toBeNull();
    expect(await resetPassword(token!, "brand new pass")).toMatchObject({ ok: false });
  });
});
