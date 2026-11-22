import { z } from "zod";

export const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 256;

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, "Email is too long.")
  .pipe(z.email("Enter a valid email address."));

export const newPasswordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters.`)
  .max(PASSWORD_MAX_LENGTH, `Use at most ${PASSWORD_MAX_LENGTH} characters.`);

export const signUpSchema = z
  .object({
    name: z
      .string()
      .trim()
      .max(100, "Name is too long.")
      .transform((s) => (s === "" ? null : s)),
    email: emailSchema,
    password: newPasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords don't match.",
  });

export const signInSchema = z.object({
  email: emailSchema,
  // No length rules on sign-in: just check what was typed.
  password: z.string().min(1, "Enter your password.").max(PASSWORD_MAX_LENGTH),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1).max(200),
    password: newPasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords don't match.",
  });

export type AuthFieldErrors = Partial<Record<string, string>>;

export function authFieldErrors(error: z.ZodError): AuthFieldErrors {
  const out: AuthFieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    out[key] ??= issue.message;
  }
  return out;
}

/**
 * Only allow redirects back to a path on this site after sign-in
 * ("/movies/3", not "https://evil.example" or "//evil.example").
 */
export function safeNextPath(next: unknown): string {
  if (typeof next !== "string" || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return "/";
  }
  return next;
}
