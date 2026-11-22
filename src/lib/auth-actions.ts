"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { appBaseUrl, requestMeta, startSession } from "@/lib/auth";
import { authenticate, registerUser, requestPasswordReset, resetPassword } from "@/lib/auth-service";
import {
  authFieldErrors,
  forgotPasswordSchema,
  resetPasswordSchema,
  safeNextPath,
  signInSchema,
  signUpSchema,
  type AuthFieldErrors,
} from "@/lib/auth-validation";
import { deleteExpiredSessions, invalidateSession, SESSION_COOKIE } from "@/lib/session";

export type AuthFormState =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors: AuthFieldErrors; email?: string }
  | { status: "sent"; email: string };

const str = (formData: FormData, key: string) => {
  const v = formData.get(key);
  return typeof v === "string" ? v : "";
};

export async function signUp(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = signUpSchema.safeParse({
    name: str(formData, "name"),
    email: str(formData, "email"),
    password: str(formData, "password"),
    confirmPassword: str(formData, "confirmPassword"),
  });
  if (!parsed.success) {
    return { status: "error", message: "Please fix the highlighted fields.", fieldErrors: authFieldErrors(parsed.error) };
  }
  const result = await registerUser(parsed.data);
  if (!result.ok) {
    return { status: "error", message: result.message, fieldErrors: result.field ? { [result.field]: result.message } : {} };
  }
  await startSession(result.user.id);
  redirect("/");
}

export async function signIn(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = str(formData, "email");
  const parsed = signInSchema.safeParse({ email, password: str(formData, "password") });
  if (!parsed.success) {
    return { status: "error", message: "Please fix the highlighted fields.", fieldErrors: authFieldErrors(parsed.error), email };
  }
  const result = await authenticate(parsed.data.email, parsed.data.password);
  if (!result.ok) return { status: "error", message: result.message, fieldErrors: {}, email };

  deleteExpiredSessions();
  await startSession(result.user.id);
  redirect(safeNextPath(str(formData, "next")));
}

export async function signOut(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) invalidateSession(token);
  jar.delete(SESSION_COOKIE);
  redirect("/login");
}

export async function forgotPassword(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = forgotPasswordSchema.safeParse({ email: str(formData, "email") });
  if (!parsed.success) {
    return { status: "error", message: "Please fix the highlighted fields.", fieldErrors: authFieldErrors(parsed.error) };
  }
  try {
    const { ipAddress } = await requestMeta();
    await requestPasswordReset(parsed.data.email, { ipAddress, baseUrl: appBaseUrl() });
  } catch (err) {
    // Log the SMTP failure for the owner. An error shown to the user would only
    // appear for real accounts, revealing which emails are registered, so they
    // get the usual "check your inbox" answer.
    console.error("Password reset email failed:", err);
  }
  return { status: "sent", email: parsed.data.email };
}

export async function completePasswordReset(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = resetPasswordSchema.safeParse({
    token: str(formData, "token"),
    password: str(formData, "password"),
    confirmPassword: str(formData, "confirmPassword"),
  });
  if (!parsed.success) {
    return { status: "error", message: "Please fix the highlighted fields.", fieldErrors: authFieldErrors(parsed.error) };
  }
  const result = await resetPassword(parsed.data.token, parsed.data.password);
  if (!result.ok) return { status: "error", message: result.message, fieldErrors: {} };

  await startSession(result.user.id);
  redirect("/");
}
